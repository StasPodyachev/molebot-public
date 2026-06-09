// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MoleTestUSDC
 * @notice Тестнетовый USDC для Molebot на Mantle Sepolia.
 *   Mintable только владельцем.
 *   6 decimals (как настоящий USDC).
 */
contract MoleTestUSDC is ERC20, Ownable {
    uint8 private constant _DECIMALS = 6;

    constructor()
        ERC20("Mole Test USDC", "mUSDC")
        Ownable(msg.sender)
    {}

    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    /// @notice Mint токены любому адресу. Только owner.
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /// @notice Batch mint — раздать тестнет-токены фаусетом
    function faucet(address[] calldata recipients, uint256 amount) external onlyOwner {
        for (uint i = 0; i < recipients.length; i++) {
            _mint(recipients[i], amount);
        }
    }
}
