# ============================================================================
# LIQUIDITY SETUP — Molebot Mantle Sepolia
# ============================================================================
# Запускать последовательно. Каждый шаг — одна транзакция через MetaMask.
#
# Подготовка:
#   1. Открой MetaMask → сеть Mantle Sepolia (chainId 5003)
#   2. Убедись что есть ~510 MNT на кошельке
#   3. Remix: https://remix.ethereum.org
#
# ============================================================================

# ─── ШАГ 1: Деплой MoleTestUSDC ─────────────────────────────────────────
# В Remix:
#   1. Файлы → создать MoleTestUSDC.sol → вставить код из 
#      agent/src/contracts/MoleTestUSDC.sol
#   2. Вкладка Solidity Compiler → Compile 0.8.20+
#   3. Вкладка Deploy → Injected Provider (MetaMask)
#   4. CONTRACT: MoleTestUSDC → Deploy → подписать в MetaMask
#   5. После деплоя — скопировать адрес контракта
#
# ⚠️ Запиши сюда адрес: _________________________________
# Назовём его <TOKEN>

# ─── ШАГ 2: Wrap 500 MNT → WMNT ─────────────────────────────────────────
# Контракт: 0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000
# Функция:  deposit()
# Value:    500000000000000000000 (500 MNT)
#
# Открой в Mantle Explorer:
#   https://explorer.testnet.mantle.xyz/address/0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000
#   → Contract → Write Contract → Connect Wallet (MetaMask)
#   → deposit() → send 500 MNT → Confirm
#
# ИЛИ в MetaMask напрямую:
#   To:       0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000
#   Data:     0xd0e30db0
#   Value:    500000000000000000000 wei (500 MNT)
#   Gas:      60000

# ─── ШАГ 3: Mint 10,000 mUSDC себе ─────────────────────────────────────
# Контракт: <TOKEN>
# Функция:  mint(address to, uint256 amount)
# Параметры: to = <ТВОЙ_АДРЕС>, amount = 10000000000 (10,000 * 10^6)
#
# Calldata:
#   Function: mint(address,uint256)
#   to:       <ТВОЙ_АДРЕС> (0x...)
#   amount:   10000000000
#
# Открой в Mantle Explorer:
#   https://explorer.testnet.mantle.xyz/address/<TOKEN>
#   → Contract → Write Contract → mint → fill params → подписать

# ─── ШАГ 3.5: Проверка балансов ─────────────────────────────────────────
# Убедись что WMNT = 500 и mUSDC = 10,000
# WMNT balanceOf:  <ТВОЙ_АДРЕС> → https://explorer.testnet.mantle.xyz/address/<WMNT>
# mUSDC balanceOf: <ТВОЙ_АДРЕС> → https://explorer.testnet.mantle.xyz/address/<TOKEN>

# ─── ШАГ 4: Approve PositionManager на mUSDC (5,000) ───────────────────
# Контракт: <TOKEN>
# Функция:  approve(address spender, uint256 amount)
# spender:  0xb04a19EF7853c52EDe6FBb28F8FfBecb73329eD7 (NonfungiblePositionManager)
# amount:   5000000000 (5,000 * 10^6)
#
# Calldata:
#   Function: approve(address,uint256)
#   spender:  0xb04a19EF7853c52EDe6FBb28F8FfBecb73329eD7
#   amount:   5000000000

# ─── ШАГ 5: Approve PositionManager на WMNT (500) ──────────────────────
# Контракт: 0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000
# Функция:  approve(address spender, uint256 amount)
# spender:  0xb04a19EF7853c52EDe6FBb28F8FfBecb73329eD7
# amount:   500000000000000000000 (500 * 10^18)
#
# Calldata:
#   Function: approve(address,uint256)
#   spender:  0xb04a19EF7853c52EDe6FBb28F8FfBecb73329eD7
#   amount:   500000000000000000000

# ─── ШАГ 6: Создать пул + добавить ликвидность ─────────────────────────
# Контракт: 0xb04a19EF7853c52EDe6FBb28F8FfBecb73329eD7
# Функция:  mint(INonfungiblePositionManager.MintParams)
#
# Параметры:
#   token0:  <TOKEN>             (определить — адрес < TOKEN vs WMNT)
#   token1:  0xDead...0000       (второй токен)
#   fee:     3000                (0.30%)
#   tickLower: -887220           (full range)
#   tickUpper: 887220            (full range)
#   amount0Desired: 5000000000   (5000 mUSDC * 10^6)
#   amount1Desired: 500000000000000000000  (500 WMNT * 10^18)
#   amount0Min: 0
#   amount1Min: 0
#   recipient: <ТВОЙ_АДРЕС>
#   deadline: <timestamp + 1 час>
#
# ⚠️ ВАЖНО: token0 = тот чей адрес меньше (lexicographically сравнить)
#   WMNT = 0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000
#   TOKEN — записан выше
#
# Пример: если TOKEN адрес < WMNT, то:
#   token0 = TOKEN, amount0Desired = 5000 mUSDC
#   token1 = WMNT,  amount1Desired = 500 WMNT
#   и наоборот
#
# Открой в Mantle Explorer:
#   https://explorer.testnet.mantle.xyz/address/0xb04a19EF7853c52EDe6FBb28F8FfBecb73329eD7
#   → Contract → Write Contract → mint()
#   → Заполни все 10 полей
#   → Подпиши в MetaMask

# ─── ШАГ 7: Проверка ────────────────────────────────────────────────────
# curl http://localhost:3002/api/price?pair=MNT/USDC
# Должен вернуть реальную цену от Quoter, не fallback
