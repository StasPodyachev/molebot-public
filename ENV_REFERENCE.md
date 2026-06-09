# ENV Reference — Molebot Mantle

Единый справочник env-переменных для всех сервисов. Секреты хранятся в Infisical, в git — только `.env.example` с плейсхолдерами.

---

## 1. Mantle RPC

| Переменная | Описание | Secret | Обязательно | Fallback |
|---|---|---|---|---|
| `MANTLE_RPC_URL` | RPC endpoint Mantle Sepolia | ❌ | да | `https://rpc.sepolia.mantle.xyz` |
| `CHAIN_ID` | Chain ID | ❌ | да | `5003` |
| `MANTLE_SCAN_API_KEY` | API ключ MantleScan для верификации | ✅ | опц. | — |

## 2. NFT / Credits

| Переменная | Описание | Secret | Обязательно | Fallback |
|---|---|---|---|---|
| `NFT_CONTRACT_ADDRESS` | Адрес MolebotNFT | ❌ | да | `0xFA9071C5c87c5B940Bf83B030fE52f3500559aCb` |
| `AI_CREDITS_CONTRACT_ADDRESS` | Адрес AICredits | ❌ | да | `0x15Fa9046d2db9E38308Ed9bbA8F8e872beBF6B64` |
| `AGENT_WALLET_ADDRESS` | Адрес кошелька агента | ❌ | да | `0xFecb0b79583A337c8Bd1E390B81661329b78450e` |
| `PLACEHOLDER_URI` | Placeholder URI до reveal | ❌ | да | `ipfs://placeholder/` |

## 3. DeepSeek / LLM

| Переменная | Описание | Secret | Обязательно | Fallback |
|---|---|---|---|---|
| `LLM_API_KEY` | API ключ DeepSeek | ✅ | да | — |
| `LLM_PROVIDER_URL` | URL провайдера | ❌ | да | `https://api.deepseek.com` |
| `LLM_GATEWAY_PORT` | Порт LLM Gateway | ❌ | да | `3010` |
| `LLM_DEFAULT_MODEL` | Модель по умолчанию | ❌ | да | `deepseek-chat` |
| `LLM_STUB_MODE` | Режим заглушки (true/false) | ❌ | да | `true` |

## 4. Agni Finance

| Переменная | Описание | Secret | Обязательно | Fallback |
|---|---|---|---|---|
| `AGNI_SWAP_ROUTER` | Адрес SwapRouter | ❌ | да | `0xe2DB835566F8677d6889ffFC4F3304e8Df5Fc1df` |
| `AGNI_QUOTER` | Адрес QuoterV2 | ❌ | да | `0x49C8bb51C6bb791e8D6C31310cE0C14f68492991` |
| `AGNI_MAX_TRADE_AMOUNT` | Макс. сумма трейда (USDC) | ❌ | да | `1000` |
| `AGNI_DAILY_LIMIT` | Дневной лимит (USDC) | ❌ | да | `5000` |
| `AGNI_DEFAULT_SLIPPAGE` | Slippage по умолчанию (%) | ❌ | да | `0.5` |

## 5. Turnkey

| Переменная | Описание | Secret | Обязательно | Fallback |
|---|---|---|---|---|
| `TURNKEY_API_PUBLIC_KEY` | Публичный ключ Turnkey API | ✅ | опц. | — |
| `TURNKEY_API_PRIVATE_KEY` | Приватный ключ Turnkey API | ✅ | опц. | — |
| `TURNKEY_ORGANIZATION_ID` | ID организации Turnkey | ❌ | опц. | — |

## 6. Agent / Chat

| Переменная | Описание | Secret | Обязательно | Fallback |
|---|---|---|---|---|
| `CHAT_FEE_WEI` | Плата за сообщение (wei) | ❌ | да | `1000000000000000` |
| `API_PORT` | Порт API агента | ❌ | да | `3002` |
| `TX_MAX_AGE_SEC` | Макс. возраст tx (сек) | ❌ | да | `600` |
| `REDIS_URL` | Redis connection string | ❌ | опц. | — |
| `SQLITE_PATH` | Путь к SQLite | ❌ | да | `./data/used_tx.db` |

## 7. Web / Frontend

| Переменная | Описание | Secret | Обязательно | Fallback |
|---|---|---|---|---|
| `NEXT_PUBLIC_NFT_CONTRACT` | Адрес MolebotNFT (public) | ❌ | да | `0xFA9071C5c87c5B940Bf83B030fE52f3500559aCb` |
| `NEXT_PUBLIC_API_URL` | URL backend API | ❌ | да | `http://localhost:3002` |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy App ID | ❌ | да | — |

## 8. Бекап (старые)

| Переменная | Описание | Secret | Статус |
|---|---|---|---|
| `BYREAL_API_URL` | Byreal endpoint | ❌ | 🔴 заменён на Agni |
| `BYREAL_API_KEY` | Byreal API ключ | ✅ | 🔴 заменён на Agni |
