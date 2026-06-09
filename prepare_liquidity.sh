#!/bin/bash
# ============================================================================
# Deploy testnet setup: token + pool + liquidity on Agni Mantle Sepolia
# ============================================================================
set -e

# === ADDRESSES ===
export MANTLE_RPC="https://rpc.sepolia.mantle.xyz"
export CHAIN_ID=5003

# Agni contracts (testnet)
export FACTORY="0x503Ca2ad7C9C70F4157d14CF94D3ef5Fa96D7032"
export NONFUNGIBLE_POSITION_MANAGER="0xb04a19EF7853c52EDe6FBb28F8FfBecb73329eD7"
export SWAP_ROUTER="0xe2DB835566F8677d6889ffFC4F3304e8Df5Fc1df"

# WMNT precompile (wraps native MNT)
export WMNT="0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000"

# New test token
export TOKEN_CREATOR="0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"  # placeholder — replace after deploy

# WALLET — YOUR ADDRESS
export WALLET=""  # будет заполнено

echo "=== LIQUIDITY SETUP SCRIPT ==="
echo "RPC: $MANTLE_RPC"
echo "Chain: $CHAIN_ID"
echo ""
echo "ШАГ 1: Развернуть контракт токена MoleTestUSDC"
echo "  Используй Remix: https://remix.ethereum.org"
echo "  Контракт: ERC20PresetMinterPauser (OpenZeppelin)"
echo "  Name: MoleTestUSDC"
echo "  Symbol: mUSDC"
echo "  Decimals: 6"
echo "  InitialSupply: 10000000000 (10,000 * 10^6)"
echo "  После деплоя — запиши адрес контракта"
echo ""
echo "ШАГ 2: Wrap 500 MNT → WMNT"
echo '  cast send 0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000 "deposit()" --value 500ether --rpc-url $MANTLE_RPC --private-key $KEY'
echo ""
echo "ШАГ 3: Mint себе 10,000 mUSDC"
echo '  cast send <TOKEN_ADDR> "mint(address,uint256)" $WALLET 10000000000 --rpc-url $MANTLE_RPC --private-key $KEY'
echo ""
echo "ШАГ 4: Approve PositionManager на WMNT (500)"
echo '  cast send 0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000 "approve(address,uint256)" $NONFUNGIBLE_POSITION_MANAGER 500000000000000000000 --rpc-url $MANTLE_RPC --private-key $KEY'
echo ""
echo "ШАГ 5: Approve PositionManager на mUSDC (5000)"
echo '  cast send <TOKEN_ADDR> "approve(address,uint256)" $NONFUNGIBLE_POSITION_MANAGER 5000000000 --rpc-url $MANTLE_RPC --private-key $KEY'
echo ""
echo "ШАГ 6: Создать пул + добавить ликвидность через NonfungiblePositionManager"
echo "  Call: mint("
echo "  token0: WMNT (lexicographically smaller address wins)"
echo "  token1: <TOKEN_ADDR>"
echo "  fee: 3000 (0.30%)"
echo "  tickLower: -887220"
echo "  tickUpper: 887220"
echo "  amount0Desired: 500000000000000000000 (500 WMNT)"
echo "  amount1Desired: 5000000000 (5000 mUSDC)"
echo "  amount0Min: 0"
echo "  amount1Min: 0"
echo "  recipient: $WALLET"
echo "  deadline: <future_timestamp>"
echo ")"
echo ""
echo "=== CALCULATING MINT CALLLDATA ==="
echo "Will generate precise calldata for the mint transaction..."
echo ""
echo "NOTE: token0 and token1 ordering depends on address comparison."
echo "WMNT(0xDead...0000) vs <TOKEN_ADDR> — whichever is smaller is token0"
echo "Amounts must be swapped if token0 != WMNT"
