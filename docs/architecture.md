# Architecture — Molebot Mantle

> Техническая карта системы: рантайм продукта + рантайм разработки (агенты).
> Цель — убрать человека из роли ручного маршрутизатора между агентами.

## 1. Product architecture (что мы строим)

```
User (molebot.org / Telegram)
        │
     Caddy (TLS, reverse proxy)
        ├── /                → frontend (Next.js)
        ├── /api/chat/*      → backend (chat, history)
        └── /api/agent/*     → agent (ElizaOS + plugins)
        │
   Agent runtime (TS)
        ├── plugins/byreal        — execution (CLMM, swaps)
        ├── plugins/merchant-moe  — fallback execution
        └── services/             — chatBilling, chatMood, price, llm
        │
   Turnkey TEE (delegated signing, policy)
        │
   Mantle Sepolia
        ├── MolebotNFT.sol     — NFT, levels, mood
        ├── AICredits.sol      — оплата LLM/действий
        └── Safe multisig      — вывод средств
```

Decision loop: signals → LLM decision → `commit(keccak256(decision))` → Byreal execution → Turnkey sign → Mantle tx → P&L → `checkLevelUp` → NFT metadata refresh.

## 2. Dev/runtime architecture (как мы строим)

Минимальный конвейер с жёсткими handoff-артефактами. Человек — только на gate «decision/deploy».

```
        ┌─────────────────────────────────────────────────────────┐
        │  molebot_mantle (Single Source of Truth)                 │
        │  tasks/   decisions/   docs/   agents/   <code>          │
        └─────────────────────────────────────────────────────────┘
                 ▲            ▲            ▲             ▲
   reads/writes  │            │            │             │
        ┌────────┴───┐  ┌─────┴────┐  ┌────┴─────┐  ┌────┴──────┐
        │  planner   │→ │  coder   │→ │ reviewer │→ │ deployer  │
        │ (orchestr.)│  │ (1 task) │  │ (PR gate)│  │  (opt.)   │
        └────────────┘  └──────────┘  └──────────┘  └───────────┘
              │                                            │
              └──────── Telegram: status/notify/confirm ───┘
                          (NOT a task/code bus)

   OpenClaw: каждый агент = свой workspace + свой agentDir + своя сессия.
   Routing — детерминированный по этапу pipeline, не по «кто кого тегнул».
```

### Принципы (взято из ECC как библиотеки практик)

- **Single workflow surface** — один SoT-репозиторий, один формат таска, один pipeline. ("Pick one path only, don't stack.")
- **Separation of concerns** — отдельные роли planner/coder/reviewer, без перекрытия полномочий.
- **Review gates** — каждый PR проходит `review-checklist.md` (quality + security).
- **Search/plan-before-code** — coder не начинает, пока в таске нет заполненного плана (status: ready).
- **Append-only decisions** — архитектурные решения фиксируются в `decisions/`, не переписываются.

### Что НЕ берём из ECC (сознательное упрощение)

- ❌ 60+ skills, мульти-модельный harness, instinct/learning движок.
- ❌ Десятки language-specific reviewer-агентов.
- ❌ `multi-*` оркестрацию, hooks-рантайм, marketplace-плагины.

ECC = справочник практик, а не стек для накатывания целиком.

## 3. OpenClaw изоляция (критично)

- 1 агент ↔ 1 `agentId` ↔ 1 Telegram account ↔ 1 workspace. Никаких двойных bindings (инцидент 2026-05-14 — причина потери маршрутов).
- `agentDir` каждого агента содержит только его роль-файл (`agents/<role>.md`) + ссылку на `AGENTS.md`.
- Сессии не делят состояние через чат — состояние в repo (`tasks/`, git).
- Подробности routing — `docs/workflows/delivery-pipeline.md`.
