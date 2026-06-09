// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MoleVault — delegated trading vault for Molebot (v2: Session Keys)
 * @notice Per-tokenId vault: owner deposits/withdraws; agent executes swaps ONLY through Agni Router.
 *         ROUTER is immutable. Agent has no transfer-out capability.
 *         Session Keys (EIP-712): NFT owner delegates trading to a session agent with limits
 *         and optional token whitelist (allowedTokens).
 *
 * Why Session Keys instead of AGENT_PRIVATE_KEY:
 *   AGENT_PRIVATE_KEY — серверный ключ, который нельзя хранить. Session Keys (EIP-712):
 *   пользователь подписывает сессию один раз через Privy, бот торгует автономно
 *   в рамках лимитов (maxTradeAmount, validUntil, allowedTokens).
 *
 *         Адреса (Mantle Sepolia):
 *           ROUTER (Agni Finance): 0xe2DB835566F8677d6889ffFC4F3304e8Df5Fc1df
 *           NFT (MolebotNFT):      передаётся в конструкторе
 *           AGENT:                 0xFecb0b79583A337c8Bd1E390B81661329b78450e
 */

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

interface IERC20Minimal {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IMolebotNFT {
    function ownerOf(uint256 tokenId) external view returns (address);
}

contract MoleVault {
    using ECDSA for bytes32;

    /// @notice Agni Finance Router — immutable, единственный адрес для executeSwap
    address public immutable ROUTER;

    /// @notice MolebotNFT contract — для проверки владельца токена
    address public immutable NFT;

    /// @notice Authorized agent address (immutable system agent)
    address public immutable AGENT;

    /* ────────────── Vault state (per tokenId) ────────────── */

    /// @notice tokenId → MNT balance (native token)
    mapping(uint256 => uint256) public mntBalance;

    /// @notice tokenId → ERC20 token → balance
    mapping(uint256 => mapping(address => uint256)) public tokenBalance;

    /* ────────────── Session state (per tokenId) ────────────── */

    struct Session {
        address sessionAgent;   // delegated agent address
        uint256 maxTradeAmount; // lifetime MNT limit for this session
        uint256 validUntil;     // unix timestamp, 0 = not set
        uint256 usedAmount;     // cumulative MNT traded in this session
        bool    active;
        address[] allowedTokens; // пустой массив = любой токен; иначе только эти
    }

    /// @notice tokenId → session (одна активная сессия на tokenId)
    mapping(uint256 => Session) public sessions;

    /* ────────────── EIP-712 Domain ────────────── */

    bytes32 private immutable DOMAIN_SEPARATOR;
    bytes32 private constant SESSION_TYPEHASH =
        keccak256("Session(uint256 tokenId,address sessionAgent,uint256 maxTradeAmount,uint256 validUntil,address[] allowedTokens)");

    /* ────────────── Events ────────────── */

    event Deposited(uint256 indexed tokenId, address indexed token, uint256 amount);
    event Withdrawn(uint256 indexed tokenId, address indexed token, uint256 amount, address indexed to);
    event SwapExecuted(uint256 indexed tokenId, address tokenIn, uint256 amountIn, bytes swapData);
    event SessionRegistered(uint256 indexed tokenId, address indexed sessionAgent, uint256 maxTradeAmount, uint256 validUntil);
    event SessionRevoked(uint256 indexed tokenId);
    event SessionUsed(uint256 indexed tokenId, uint256 amountInMnt, uint256 usedTotal);

    /* ────────────── Errors ────────────── */

    error NotNFTOwner();
    error NotAgent();
    error InsufficientBalance();
    error SwapFailed(bytes reason);
    error TransferFailed();
    error ZeroAddress();
    error SessionExpired();
    error SessionLimitExceeded();
    error InvalidSignature();
    error NoActiveSession();
    error SessionNotAllowedToken();

    /// @dev EIP-712 array hash: encodes each element individually (not ABI-encoding the whole array)
    function _eip712ArrayHash(address[] calldata arr) internal pure returns (bytes32) {
        bytes memory buf;
        for (uint256 i = 0; i < arr.length; i++) {
            buf = abi.encodePacked(buf, abi.encode(arr[i]));
        }
        return keccak256(buf);
    }

    /* ────────────── Modifiers ────────────── */

    modifier onlyNFTOwner(uint256 tokenId) {
        if (IMolebotNFT(NFT).ownerOf(tokenId) != msg.sender) revert NotNFTOwner();
        _;
    }

    modifier onlyAgentOrSession(uint256 tokenId) {
        if (msg.sender == AGENT) {
            _;
            return;
        }
        Session storage s = sessions[tokenId];
        if (!s.active) revert NotAgent();
        if (msg.sender != s.sessionAgent) revert NotAgent();
        if (block.timestamp > s.validUntil) revert SessionExpired();
        _;
    }

    modifier validAddress(address addr) {
        if (addr == address(0)) revert ZeroAddress();
        _;
    }

    /* ────────────── Constructor ────────────── */

    constructor(address _router, address _nft, address _agent) {
        if (_router == address(0)) revert ZeroAddress();
        if (_nft == address(0)) revert ZeroAddress();
        if (_agent == address(0)) revert ZeroAddress();

        ROUTER = _router;
        NFT    = _nft;
        AGENT  = _agent;

        // EIP-712 domain: name="MoleVault", version="1", chainId=5003, verifyingContract=this
        DOMAIN_SEPARATOR = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes("MoleVault")),
            keccak256(bytes("1")),
            5003,
            address(this)
        ));
    }

    // ──────────────────────────────────────────────────────
    // Session Keys (EIP-712)
    // ──────────────────────────────────────────────────────

    /**
     * @notice NFT owner регистрирует сессию для делегированного агента.
     *         allowedTokens — опциональный whitelist токенов, которые может свапать агент.
     *         Пустой массив = любые токены (только для доверенных агентов).
     *
     * @param tokenId       NFT токен
     * @param sessionAgent  Адрес агента, которому делегируется трейдинг
     * @param maxTradeAmount Максимальный объём MNT за время сессии
     * @param validUntil    Unix timestamp окончания сессии
     * @param allowedTokens Whitelist адресов токенов (пусто = любой токен)
     * @param signature     EIP-712 подпись NFT owner
     */
    function registerSession(
        uint256 tokenId,
        address sessionAgent,
        uint256 maxTradeAmount,
        uint256 validUntil,
        address[] calldata allowedTokens,
        bytes calldata signature
    ) external onlyNFTOwner(tokenId) validAddress(sessionAgent) {
        if (maxTradeAmount == 0) revert InsufficientBalance();
        if (validUntil <= block.timestamp) revert SessionExpired();

        // Build EIP-712 struct hash with allowedTokens array
        // address[] кодируется как keccak256(abi.encode(array)) по EIP-712 spec
        bytes32 structHash = keccak256(abi.encode(
            SESSION_TYPEHASH,
            tokenId,
            sessionAgent,
            maxTradeAmount,
            validUntil,
            _eip712ArrayHash(allowedTokens)
        ));

        // Build typed data hash: \x19\x01 ‖ domainSeparator ‖ structHash
        bytes32 digest = MessageHashUtils.toTypedDataHash(DOMAIN_SEPARATOR, structHash);

        // Recover signer — должен быть NFT owner
        address signer = ECDSA.recover(digest, signature);
        if (signer != IMolebotNFT(NFT).ownerOf(tokenId)) revert InvalidSignature();

        // Revoke previous session if exists
        if (sessions[tokenId].active) {
            emit SessionRevoked(tokenId);
        }

        // Register new session — field by field to avoid stack-too-deep with dynamic array
        Session storage s = sessions[tokenId];
        s.sessionAgent = sessionAgent;
        s.maxTradeAmount = maxTradeAmount;
        s.validUntil = validUntil;
        s.usedAmount = 0;
        s.active = true;
        // Copy allowedTokens calldata → storage
        delete s.allowedTokens;
        for (uint256 i = 0; i < allowedTokens.length; i++) {
            s.allowedTokens.push(allowedTokens[i]);
        }

        emit SessionRegistered(tokenId, sessionAgent, maxTradeAmount, validUntil);
    }

    /**
     * @notice NFT owner отзывает активную сессию
     */
    function revokeSession(uint256 tokenId) external onlyNFTOwner(tokenId) {
        if (!sessions[tokenId].active) revert NoActiveSession();
        delete sessions[tokenId];
        emit SessionRevoked(tokenId);
    }

    /**
     * @notice Проверить активную сессию для tokenId
     */
    function checkSession(uint256 tokenId, address caller) external view returns (bool active_, uint256 remaining) {
        Session storage s = sessions[tokenId];
        if (!s.active || block.timestamp > s.validUntil || caller != s.sessionAgent) {
            return (false, 0);
        }
        uint256 rem = s.maxTradeAmount > s.usedAmount ? s.maxTradeAmount - s.usedAmount : 0;
        return (true, rem);
    }

    // ──────────────────────────────────────────────────────
    // Owner: deposit MNT (native)
    // ──────────────────────────────────────────────────────

    /// @notice NFT owner deposits native MNT into their tokenId vault
    function deposit(uint256 tokenId) external payable onlyNFTOwner(tokenId) {
        if (msg.value == 0) revert InsufficientBalance();
        mntBalance[tokenId] += msg.value;
        emit Deposited(tokenId, address(0), msg.value);
    }

    // ──────────────────────────────────────────────────────
    // Owner: deposit ERC20
    // ──────────────────────────────────────────────────────

    /// @notice NFT owner deposits ERC20 tokens into their tokenId vault
    function depositToken(uint256 tokenId, address token, uint256 amount)
        external
        onlyNFTOwner(tokenId)
        validAddress(token)
    {
        if (amount == 0) revert InsufficientBalance();
        bool ok = IERC20Minimal(token).transferFrom(msg.sender, address(this), amount);
        if (!ok) revert TransferFailed();
        tokenBalance[tokenId][token] += amount;
        emit Deposited(tokenId, token, amount);
    }

    // ──────────────────────────────────────────────────────
    // Owner: withdraw any token
    // ──────────────────────────────────────────────────────

    /// @notice NFT owner withdraws tokens from their tokenId vault
    function withdraw(uint256 tokenId, address token, uint256 amount, address to)
        external
        onlyNFTOwner(tokenId)
        validAddress(to)
    {
        if (amount == 0) revert InsufficientBalance();

        if (token == address(0)) {
            if (mntBalance[tokenId] < amount) revert InsufficientBalance();
            mntBalance[tokenId] -= amount;
            (bool ok2,) = payable(to).call{value: amount}("");
            if (!ok2) revert TransferFailed();
        } else {
            if (tokenBalance[tokenId][token] < amount) revert InsufficientBalance();
            tokenBalance[tokenId][token] -= amount;
            bool ok2 = IERC20Minimal(token).transfer(to, amount);
            if (!ok2) revert TransferFailed();
        }

        emit Withdrawn(tokenId, token, amount, to);
    }

    // ──────────────────────────────────────────────────────
    // Agent / Session: execute swap through ROUTER only
    // ──────────────────────────────────────────────────────

    /**
     * @notice Execute swap через Agni ROUTER.
     *         Доступ: immutable AGENT ИЛИ активный session agent.
     *         Если сессия имеет allowedTokens — проверяет tokenIn.
     *
     * @param tokenId  NFT token
     * @param tokenIn  Входной токен (address(0) = native MNT)
     * @param amountIn Количество входного токена
     * @param swapData ABI-encoded calldata для ROUTER
     */
    function executeSwap(
        uint256 tokenId,
        address tokenIn,
        uint256 amountIn,
        bytes calldata swapData
    ) external onlyAgentOrSession(tokenId) {
        if (amountIn == 0) revert InsufficientBalance();

        // Для session agent: проверить лимиты + allowedTokens
        if (msg.sender != AGENT) {
            _checkSessionAllowedToken(tokenId, tokenIn);
            _checkSessionLimit(tokenId, amountIn);
        }

        // Debit vault balance
        if (tokenIn == address(0)) {
            if (mntBalance[tokenId] < amountIn) revert InsufficientBalance();
            mntBalance[tokenId] -= amountIn;
        } else {
            if (tokenBalance[tokenId][tokenIn] < amountIn) revert InsufficientBalance();
            tokenBalance[tokenId][tokenIn] -= amountIn;

            // Approve ROUTER to spend tokenIn
            bool approved = IERC20Minimal(tokenIn).approve(ROUTER, amountIn);
            if (!approved) revert TransferFailed();
        }

        // Execute swap: call ROUTER with swapData
        (bool ok, bytes memory ret) = tokenIn == address(0)
            ? ROUTER.call{value: amountIn}(swapData)
            : ROUTER.call(swapData);

        // Reset ERC20 approval
        if (tokenIn != address(0)) {
            IERC20Minimal(tokenIn).approve(ROUTER, 0);
        }

        if (!ok) revert SwapFailed(ret);

        // Track session usage
        if (msg.sender != AGENT) {
            _trackSessionUsage(tokenId, amountIn);
        }

        emit SwapExecuted(tokenId, tokenIn, amountIn, swapData);
    }

    // ──────────────────────────────────────────────────────
    // Internal: session enforcement
    // ──────────────────────────────────────────────────────

    /**
     * @dev Проверить, что tokenIn разрешён сессией.
     *      Если allowedTokens пуст — любой токен разрешён.
     *      Иначе tokenIn должен быть в массиве.
     */
    function _checkSessionAllowedToken(uint256 tokenId, address tokenIn) internal view {
        Session storage s = sessions[tokenId];
        address[] storage allowed = s.allowedTokens;
        if (allowed.length == 0) {
            return; // пустой whitelist = любой токен
        }
        for (uint256 i = 0; i < allowed.length; i++) {
            if (allowed[i] == tokenIn) {
                return; // токен в whitelist
            }
        }
        revert SessionNotAllowedToken();
    }

    function _checkSessionLimit(uint256 tokenId, uint256 amountIn) internal view {
        Session storage s = sessions[tokenId];
        if (s.usedAmount + amountIn > s.maxTradeAmount) revert SessionLimitExceeded();
    }

    function _trackSessionUsage(uint256 tokenId, uint256 amountIn) internal {
        Session storage s = sessions[tokenId];
        s.usedAmount += amountIn;
        emit SessionUsed(tokenId, amountIn, s.usedAmount);

        // Auto-revoke if limit reached
        if (s.usedAmount >= s.maxTradeAmount) {
            s.active = false;
            emit SessionRevoked(tokenId);
        }
    }

    // ──────────────────────────────────────────────────────
    // View helpers
    // ──────────────────────────────────────────────────────

    function getVaultBalance(uint256 tokenId, address token) external view returns (uint256) {
        if (token == address(0)) return mntBalance[tokenId];
        return tokenBalance[tokenId][token];
    }

    function getDomainSeparator() external view returns (bytes32) {
        return DOMAIN_SEPARATOR;
    }

    /// @notice Accept native MNT только от ROUTER (результат свопов)
    receive() external payable {
        if (msg.sender != ROUTER) revert("use deposit()");
    }
}
