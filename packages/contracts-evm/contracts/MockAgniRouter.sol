// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockAgniRouter — имитация Agni Finance Router для тестов
 * @notice Поддерживает swapExactTokensForTokens, swapExactETHForTokens, swapExactTokensForETH.
 *         Использует фиксированную цену 1:1 для простоты тестирования.
 */

interface IERC20Mock {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function mint(address to, uint256 amount) external;
}

contract MockAgniRouter {
    error TransferFailed();

    /// @notice swapExactTokensForTokens — exact Uniswap V2 signature
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 /* amountOutMin */,
        address[] calldata path,
        address to,
        uint256 /* deadline */
    ) external returns (uint256[] memory amounts) {
        require(path.length >= 2, "invalid path");
        address tokenIn  = path[0];
        address tokenOut = path[path.length - 1];

        // Pull tokenIn from caller (msg.sender = vault)
        bool ok = IERC20Mock(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        if (!ok) revert TransferFailed();

        // 1:1 price, send to `to`
        ok = IERC20Mock(tokenOut).transfer(to, amountIn);
        if (!ok) revert TransferFailed();

        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        amounts[path.length - 1] = amountIn;
        return amounts;
    }

    /// @notice swapExactETHForTokens — takes native ETH, sends tokens
    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 /* amountOutMin */,
        address[] calldata path,
        address to,
        uint256 /* deadline */
    ) external returns (uint256[] memory amounts) {
        require(path.length >= 2, "invalid path");
        address tokenIn = path[0];

        bool ok = IERC20Mock(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        if (!ok) revert TransferFailed();

        // Send ETH to `to` (1:1)
        (bool sent,) = payable(to).call{value: amountIn}("");
        if (!sent) revert TransferFailed();

        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        amounts[path.length - 1] = amountIn;
        return amounts;
    }

    receive() external payable {}
}
