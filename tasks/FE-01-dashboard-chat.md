---
id: FE-01
title: Web dashboard & chat (MVP демо)
status: done
owner: coder
area: FE
priority: P0
branch: feat/FE-01-dashboard
pr: https://github.com/StasPodyachev/molebot_mantle/pull/15
depends_on: [SC-01, CHAIN-02, INFRA-03]
created: 2026-05-31
source: OC_Obsidian/Molebot.Mantle/C-tasks/C-FE-01-dashboard-chat.md
---

# FE-01 — Web dashboard & chat (MVP)

## Контекст
Центральный элемент демо: Privy-логин, кнопка Mint (если нет NFT), блок NFT/mood/level/PnL, чат с кротом через backend → LLM Gateway. После ответа mood/level обновляются на экране.

## Acceptance criteria
- [ ] Страница грузится, Privy-логин работает.
- [ ] После входа: есть NFT → ID, изображение, уровень (название), mood (иконка), PnL; нет NFT → "Mint Molebot (0.05 MNT)".
- [ ] Кнопка Mint → tx через Privy → после подтверждения NFT отображается.
- [ ] Чат: поле ввода + Send + история; `POST /api/chat` → ответ + mood.
- [ ] После ответа mood/level обновляются на экране.
- [ ] Ошибки (нет MNT, не та сеть, Privy) отображаются.
- [ ] Unit-тесты: рендер с/без NFT; mint через Privy-мок; отправка сообщения и отображение ответа.

## Scope
**В scope:** один роут `/` (dashboard), компоненты `MoleNFTCard`, `ChatPanel`, `MintButton`; PrivyProvider в layout.
**НЕ в scope:** формат chat API (уже согласован backend↔frontend).

## Затронутые файлы (план)
- `frontend/app/page.tsx`, `frontend/app/layout.tsx`
- `frontend/components/{MoleNFTCard,ChatPanel,MintButton}.tsx`
- API: `POST /api/chat` → `{ signature, message, txHash, tokenId, timestamp }` (см. `backend/src/routes/chat.ts`)

## Зависимости / блокеры
- 🔴 blocked: ждёт CHAIN-02 (Privy/Mantle конфиг) и INFRA-03 (env). SC-01 — done.
- Дизайн: тёмная тема (как `deploy-ui/index.html`), mood 😠/😐/😊, уровни из SC-01.

## Примечание
- CHAIN-02 ✅ (Privy настроен Стасом)
- INFRA-03 ✅ (AGNI_* env + LLM_GATEWAY_URL)
- AI-02 ✅ (LLM Gateway production — DeepSeek через Gateway)
- chat API уже работает: `POST /api/chat` → backend → LLM Gateway

## Notes / лог
- (migrated) Перенесён из C-FE-01. critical_path: true.
- 2026-06-01 16:12: Разблокирован (CHAIN-02 + INFRA-03 done).
