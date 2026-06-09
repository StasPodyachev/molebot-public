// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AICredits — токен кредитов для LLM-запросов и agent actions
 * @notice Владелец (owner) может эмитировать кредиты. Агент (agentAddress)
 *         списывает кредиты при выполнении LLM-запросов или agent actions.
 *
 * Зоны ответственности:
 *   - owner       (onlyOwner)     → mintCredits, setAgent
 *   - agentAddress (onlyAgent)    → spendCredits
 *   - кто угодно                 → balanceOf (view)
 */
contract AICredits is Ownable {

    // ── Состояние ────────────────────────────────────────────────────────

    /// @notice Адрес агента, который может списывать кредиты
    address public agentAddress;

    /// @notice Маппинг балансов кредитов пользователей
    mapping(address => uint256) private _credits;

    // ── События ───────────────────────────────────────────────────────────

    /// @notice Эмиссия кредитов
    /// @param to Получатель
    /// @param amount Количество кредитов
    event CreditsMinted(address indexed to, uint256 amount);

    /// @notice Списание кредитов
    /// @param from Владелец кредитов
    /// @param amount Количество списанных кредитов
    event CreditsSpent(address indexed from, uint256 amount);

    /// @notice Изменение адреса агента
    /// @param newAgent Новый адрес агента
    event AgentUpdated(address indexed newAgent);

    // ── Модификаторы ─────────────────────────────────────────────────────

    /// @dev Только агент (agentAddress) может вызывать
    modifier onlyAgent() {
        require(msg.sender == agentAddress, "AICredits: not agent");
        _;
    }

    // ── Конструктор ──────────────────────────────────────────────────────

    /// @param _agentAddress Адрес уполномоченного агента
    constructor(address _agentAddress) Ownable(msg.sender) {
        require(_agentAddress != address(0), "AICredits: zero agent address");
        agentAddress = _agentAddress;
    }

    // ── View ─────────────────────────────────────────────────────────────

    /// @notice Просмотр баланса кредитов
    /// @param account Адрес пользователя
    /// @return Количество кредитов
    function balanceOf(address account) external view returns (uint256) {
        return _credits[account];
    }

    // ── OnlyOwner ─────────────────────────────────────────────────────────

    /// @notice Эмитировать кредиты пользователю
    /// @param to Адрес получателя
    /// @param amount Количество кредитов
    function mintCredits(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "AICredits: mint to zero address");
        _credits[to] += amount;
        emit CreditsMinted(to, amount);
    }

    /// @notice Сменить адрес агента
    /// @param _agent Новый адрес агента
    function setAgent(address _agent) external onlyOwner {
        require(_agent != address(0), "AICredits: zero agent address");
        agentAddress = _agent;
        emit AgentUpdated(_agent);
    }

    /// @dev Запрещаем renounceOwnership — контракт не должен оставаться без owner
    function renounceOwnership() public view override onlyOwner {
        revert("AICredits: cannot renounce ownership");
    }

    // ── OnlyAgent ─────────────────────────────────────────────────────────

    /// @notice Списать кредиты у пользователя (за LLM-запрос или action)
    /// @param from Адрес пользователя
    /// @param amount Количество кредитов к списанию
    /// @dev Ревертит если баланс < amount
    function spendCredits(address from, uint256 amount) external onlyAgent {
        uint256 bal = _credits[from];
        require(bal >= amount, "AICredits: insufficient credits");
        _credits[from] = bal - amount;
        emit CreditsSpent(from, amount);
    }
}
