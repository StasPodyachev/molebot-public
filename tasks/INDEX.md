# Tasks Index — состояние на 2026-06-05 14:30 UTC

Все основные фичи демо — в main.
Следующий этап: E2E тестирование и фикс багов.

## ✅ Смержено в main

### Infra
| ID | Задача | Статус |
|---|---|---|
| SC-01 | MolebotNFT.sol deployed | done |
| SC-03 | AICredits.sol deployed | done |
| INFRA-01 | Docker Compose stack | done |
| INFRA-03 | ENV vars Infisical | done |
| INFRA-04 | DNS vps.molebot.org + HTTPS | done |
| CHAIN-01 | Turnkey EVM policy | human |
| CHAIN-02 | Privy → Mantle | human |

### Agent / LLM
| ID | Задача | Статус |
|---|---|---|
| AG-01 | Agni Finance (mock) | done |
| AG-04 | Agni bootstrap | done |
| AI-02 | LLM Gateway (DeepSeek) | done |
| AI-03 | ElizaOS → Gateway | done |

### Frontend
| ID | Задача | Статус |
|---|---|---|
| FE-01 | Dashboard + chat (base) | done |
| FE-02 | CF Pages миграция + лендинг | done |
| FE-16 | Dashboard routing | done |
| FE-17 | Real MNT payment | done |
| FE-18 | tokenId fix | done |
| FE-19 | Cleanup refactor | done |
| FE-20 | Tests | done |
| FE-21 | Avatar layout | done |
| FE-22 | Chat error handling | done |
| FE-23 | Safe JSON.parse | todo |
| FE-24 | Batch approve 10 msg | done |
| FE-25 | EIP-712 signature fix | done |
| FE-26 | Empty POST body fix | done |
| FE-27 | Mint CALL_EXCEPTION | done† |
| FE-28 | apiBase fix (/api) | done |
| FE-29 | Strategy Panel | done |
| FE-30 | Trade Log + mock exec | done |
| FE-31 | Stats (PnL, winrate) | done |
| FE-32 | RPC Proxy через VPS | done |
| FE-33 | DeepSeek model + ABI | done |

† FE-27 закрыт через FE-32 (RPC proxy) + FE-33 (model/ABI)

## 📋 Осталось
| ID | Задача | Приоритет |
|---|---|---|
| **FE-34** | Vault — пополнение баланса крота | P0 |
| FE-23 | Safe JSON.parse (not blocker) | P1 |
| DEVOPS-01 | deploy-cf-pages.yml workflow | P2 |

## Demo Flow (проверить)
```
Mint → Dashboard → Strategy → Chat session → Ask → Trade → Stats
 ❓       ✅          ✅           ❓         ❓    ❓     ❓
```
E2E тестирование начинается после этой записи.

## ❌ Не сработавшие подходы (документация)
Детально описаны в соответствующих task-файлах:
- **FE-26.md:** CF Pages _redirects POST, Worker route, Pages Functions
- **FE-28.md:** прямой HTTP к VPS (mixed content), _redirects POST
- **FE-32.md:** FallbackProvider с dRPC (chainId mismatch), смена RPC на dRPC

## Изменения
- **2026-06-05:** все фичи демо в main. Осталось E2E тестирование.
