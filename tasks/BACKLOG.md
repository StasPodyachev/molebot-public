# Backlog — не критпуть демо

Эти таски существуют в Obsidian, но **не на критическом пути** хакатон-демо.
Не берём в работу, пока не закрыт критпуть.
Мигрировать в `tasks/<ID>.md` по мере необходимости.

## Code (отложено)
| Old ID | Что | Repo | Почему backlog |
|---|---|---|---|
| C-SC-02 | GiftEscrow.sol | molebot_mantle | не нужен для демо |
| C-SC-04 | MolebotAccessory.sol | molebot_mantle | косметика, не критпуть |
| C-AG-02 | Merchant Moe fallback plugin | agent | mainnet-only, нет Sepolia-контрактов |
| C-AG-03 | Nansen plugin (smart money) | agent | data-сигналы, опц. |
| C-AG-04 | Elfa plugin (sentiment) | agent | data-сигналы, опц. |
| C-AG-05 | ReplenishCreditsAction | agent | agentic economy, после AI-03 |
| C-AG-06 | Orbit plugin (vector memory) | agent | память, опц. |
| C-CHAIN-03 | Hive peer discovery (EVM) | agent | multi-agent discovery, не для демо |
| C-INFRA-02 | GH Actions Mantle deploy | molebot_mantle | удобство, не блокер |
| C-AI-01 | AICredits контракт | molebot_mantle | 🔴 дубль SC-03 — НЕ делать отдельно |

## Removed / replaced
| ID | Что | Судьба |
|---|---|---|
| **AG-01** (old) | Byreal plugin (Solana) | 🔄 заменён на Agni Finance. Byreal — Solana-only, не подходит для Mantle. |
| **Byreal** (H-1.5) | API-ключи Byreal | ❌ больше не блокер. Agni работает через RPC, ключи не нужны. |

## Human-таски (вне агентского pipeline — отслеживает человек)
H-1.* (аккаунты/ключи: Turnkey, Safe, DeepSeek, AI-кредиты, VPS, Infisical),
H-2.* (NFT-арт, HashLips, Pinata/IPFS, baseUri),
H-3.* (DoraHacks регистрация/сабмит, Discord, demo-видео, X-тред, voting).

> H-таски не должны быть в `tasks/` как агентские — это ручная работа Stas.
> Их статус удобнее держать read-only в Obsidian; в `tasks/` заводить только если
> они блокируют конкретный C-таск (тогда — как `depends_on` или `blocked`-заметка).
