// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MolebotNFT — минимальный ERC-721 для Mantle Testnet
 * @notice Без OZ. MAX_SUPPLY=100, PRICE=0.05 MNT, 1 per wallet.
 */
contract MolebotNFT {

    string public name   = "Molebot";
    string public symbol = "MOLE";

    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    uint256 public constant MAX_SUPPLY = 100;
    uint256 public constant MINT_PRICE = 0.05 ether;
    uint8   public constant MAX_LEVEL  = 8;

    address public owner;
    address public agentAddress;
    string  public placeholderURI;
    string  public baseURI;
    bool    public revealed;
    uint256 public totalSupply;

    mapping(address => bool) public hasMinted;

    struct MoleData {
        uint8   mood;
        uint8   levelIndex;
        int256  cumulativePnl;
        uint256 lastTradeTs;
        bool    isMythic;
    }
    mapping(uint256 => MoleData) public moles;

    uint256[9] public levelThresholds = [0,150,200,300,500,1000,2000,5000,10000];

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner_, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner_, address indexed operator, bool approved);
    event MoleMinted(address indexed to, uint256 indexed tokenId);
    event MoodUpdated(uint256 indexed tokenId, uint8 newMood);
    event LevelUp(uint256 indexed tokenId, uint8 newLevel);
    event Revealed();

    modifier onlyOwner() { require(msg.sender == owner,        "not owner"); _; }
    modifier onlyAgent() { require(msg.sender == agentAddress, "not agent"); _; }

    constructor(string memory _placeholderURI, address _agentAddress) {
        owner          = msg.sender;
        agentAddress   = _agentAddress;
        placeholderURI = _placeholderURI;
    }

    function balanceOf(address account) public view returns (uint256) {
        require(account != address(0), "zero address");
        return _balances[account];
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        address o = _owners[tokenId];
        require(o != address(0), "nonexistent token");
        return o;
    }

    function approve(address to, uint256 tokenId) public {
        address o = ownerOf(tokenId);
        require(msg.sender == o || isApprovedForAll(o, msg.sender), "not authorized");
        _tokenApprovals[tokenId] = to;
        emit Approval(o, to, tokenId);
    }

    function getApproved(uint256 tokenId) public view returns (address) {
        require(_owners[tokenId] != address(0), "nonexistent token");
        return _tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) public {
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address owner_, address operator) public view returns (bool) {
        return _operatorApprovals[owner_][operator];
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        address o = ownerOf(tokenId);
        require(
            msg.sender == o ||
            msg.sender == getApproved(tokenId) ||
            isApprovedForAll(o, msg.sender),
            "not authorized"
        );
        require(from == o, "wrong from");
        require(to != address(0), "zero address");
        delete _tokenApprovals[tokenId];
        _balances[from]--;
        _balances[to]++;
        _owners[tokenId] = to;
        emit Transfer(from, to, tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
        return
            interfaceId == 0x80ac58cd ||
            interfaceId == 0x5b5e139f ||
            interfaceId == 0x01ffc9a7;
    }

    function mint() external payable {
        require(totalSupply < MAX_SUPPLY,  "max supply reached");
        require(!hasMinted[msg.sender],    "already minted");
        require(msg.value >= MINT_PRICE,   "insufficient payment");

        hasMinted[msg.sender] = true;
        totalSupply++;
        uint256 tokenId = totalSupply;

        _owners[tokenId]      = msg.sender;
        _balances[msg.sender]++;

        bool isMythic = (uint256(keccak256(
            abi.encodePacked(block.timestamp, msg.sender, tokenId)
        )) % 100) < 5;

        moles[tokenId] = MoleData({
            mood:          1,
            levelIndex:    0,
            cumulativePnl: 0,
            lastTradeTs:   block.timestamp,
            isMythic:      isMythic
        });

        emit Transfer(address(0), msg.sender, tokenId);
        emit MoleMinted(msg.sender, tokenId);
    }

    function tokenURI(uint256 tokenId) public view returns (string memory) {
        require(_owners[tokenId] != address(0), "nonexistent token");
        if (!revealed) return placeholderURI;
        return string(abi.encodePacked(baseURI, _toString(tokenId), ".json"));
    }

    function updateMood(uint256 tokenId, uint8 mood) external onlyAgent {
        require(_owners[tokenId] != address(0), "nonexistent token");
        require(mood <= 2, "invalid mood");
        moles[tokenId].mood        = mood;
        moles[tokenId].lastTradeTs = block.timestamp;
        emit MoodUpdated(tokenId, mood);
    }

    function checkLevelUp(uint256 tokenId, int256 pnlDelta) external onlyAgent {
        require(_owners[tokenId] != address(0), "nonexistent token");
        int256 newPnl = moles[tokenId].cumulativePnl + pnlDelta;
        moles[tokenId].cumulativePnl = newPnl;
        moles[tokenId].lastTradeTs   = block.timestamp;

        uint8 cur = moles[tokenId].levelIndex;
        if (cur >= MAX_LEVEL) return;

        uint256 abs = newPnl > 0 ? uint256(newPnl) : 0;
        uint8 newLvl = cur;
        for (uint8 i = cur + 1; i <= MAX_LEVEL; i++) {
            if (abs >= levelThresholds[i]) { newLvl = i; } else { break; }
        }
        if (newLvl > cur) {
            moles[tokenId].levelIndex = newLvl;
            emit LevelUp(tokenId, newLvl);
        }
    }

    function reveal(string calldata _baseURI) external onlyOwner {
        baseURI  = _baseURI;
        revealed = true;
        emit Revealed();
    }

    function setAgent(address _agent) external onlyOwner { agentAddress = _agent; }

    function withdraw() external onlyOwner {
        (bool ok,) = payable(owner).call{value: address(this).balance}("");
        require(ok, "withdraw failed");
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero address");
        owner = newOwner;
    }

    function getMoleData(uint256 tokenId) external view returns (MoleData memory) {
        return moles[tokenId];
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buf = new bytes(digits);
        while (value != 0) {
            digits--;
            buf[digits] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        return string(buf);
    }
}
