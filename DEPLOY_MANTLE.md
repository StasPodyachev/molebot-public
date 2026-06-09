# Инструкция по деплою MolebotNFT на Mantle Sepolia

> **Только MetaMask.** Приватный ключ не покидает кошелёк.
> Никаких .env с ключами, никаких `DEPLOYER_PRIVATE_KEY`.

---

## 1. Подготовка

### MetaMask — сеть Mantle Sepolia

Добавь, если ещё нет:

| Параметр | Значение |
|---|---|
| Network Name | Mantle Sepolia |
| RPC URL | https://rpc.sepolia.mantle.xyz |
| Chain ID | 5003 |
| Currency Symbol | MNT |
| Block Explorer | https://explorer.sepolia.mantle.xyz |

Способ: MetaMask → настройки → сети → добавить вручную.

### Тестовые MNT

Ты говорил, уже есть. Если понадобится ещё — [Mantle Sepolia Faucet](https://faucet.sepolia.mantle.xyz).

---

## 2. Компиляция (локально или на сервере)

```bash
cd packages/contracts-evm
npx hardhat compile
```

Скопилирует `MolebotNFT.sol` и `AICredits.sol`. Ошибок быть не должно (Solidity 0.8.28, EVM Cancun).

Конфиг уже есть в `hardhat.config.ts` — сеть `mantle_sepolia` (chainId 5003, RPC `https://rpc.sepolia.mantle.xyz`).

---

## 3. Деплой через Remix + MetaMask

### Шаг за шагом

1. Открой [https://remix.ethereum.org](https://remix.ethereum.org)
2. В проводнике слева создай файл `contracts/MolebotNFT.sol`
3. Скопируй содержимое из `packages/contracts-evm/contracts/MolebotNFT.sol`
4. Нажми **Ctrl+S** — компиляция (Solidity 0.8.28, EVM Cancun подхватится авто)
5. Перейди на вкладку **Deploy & Run Transactions** (иконка Ethereum слева)
6. **Environment** → выбери **Injected Provider — MetaMask**
7. MetaMask попросит подключиться — **подтверди**
8. Убедись, что в MetaMask выбрана **Mantle Sepolia**
9. В поле **CONTRACT** выбери `MolebotNFT`
10. Раскрой секцию **Deploy**, заполни **2 параметра** (не 3!):

    | Параметр | Значение |
    |---|---|
    | `_placeholderURI (string)` | `ipfs://bafybeigwkc4pzfugfpcjdv2stsgc7qq7hsnxa3czci6nncpebqvioryyoq/` |
    | `_agentAddress (address)` | `0x<твой адрес>` (пока твой) |

    ⚠️ `_owner` в контракте нет — он автоматически = `msg.sender`.

11. Нажми **transact**
12. MetaMask покажет транзакцию — проверь газ и **подпиши**
13. Через 5–10 секунд в логе Remix появится адрес контракта

**Скопируй адрес контракта.** Он понадобится для reveal и верификации.

---

## 4. Reveal (после деплоя)

В том же Remix, в разделе **Deployed Contracts**:

1. Найди свой контракт в списке
2. Разверни его — найди функцию `reveal`
3. В поле `_baseURI` введи: `ipfs://bafybeigwkc4pzfugfpcjdv2stsgc7qq7hsnxa3czci6nncpebqvioryyoq/`
4. Нажми **transact** → подпиши в MetaMask → done.

---

## 5. Верификация на Explorer

После деплоя — верифицируй контракт для [Mantle Explorer](https://explorer.sepolia.mantle.xyz) (нужно для Deployment Award хакатона).

### Через Hardhat (не требует ключа)

```bash
cd packages/contracts-evm
npx hardhat verify --network mantle_sepolia <АДРЕС_КОНТРАКТА> \
  "ipfs://bafybeigwkc4pzfugfpcjdv2stsgc7qq7hsnxa3czci6nncpebqvioryyoq/" \
  "0x<твой адрес>"
```

Параметры — те же, что передавал в конструктор (placeholderURI, agentAddress).

### Через Explorer UI (если hardhat verify не сработал)

1. Открой https://explorer.sepolia.mantle.xyz/address/`<АДРЕС_КОНТРАКТА>`#code
2. Нажми **Verify & Publish**
3. Выбери **Solidity (Single file)**
4. Compiler: `0.8.28`, EVM: `cancun`, Optimization: `200 runs`
5. Вставь код из `MolebotNFT.sol`
6. Constructor args закодируй через ABItool или укажи plain (зависит от explorer)

---

## BASE_URI (для контракта и tokenURI)

```solidity
string public constant BASE_URI = "ipfs://bafybeigwkc4pzfugfpcjdv2stsgc7qq7hsnxa3czci6nncpebqvioryyoq/";
```

Проверить: [https://ipfs.io/ipfs/bafybeigwkc4pzfugfpcjdv2stsgc7qq7hsnxa3czci6nncpebqvioryyoq/1.json](https://ipfs.io/ipfs/bafybeigwkc4pzfugfpcjdv2stsgc7qq7hsnxa3czci6nncpebqvioryyoq/1.json)

---

## После деплоя

1. Скинь мне адрес контракта — запишу в `decisions/`
2. Верифицируй на Explorer
3. Адрес пойдёт в конфиги backend/frontend (следующие таски)
4. Дальше — AICredits.sol и pipeline по INDEX.md

---

## Безопасность

⚠️ **Приватный ключ НИКОГДА не экспортируется из MetaMask**
⚠️ **Никаких .env с ключами, никаких DEPLOYER_PRIVATE_KEY**
⚠️ **Remix + Injected Provider = единственный способ деплоя**
