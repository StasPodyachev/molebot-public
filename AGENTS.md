# AGENTS.md — Molebot Mantle

> Единая точка входа для всех AI-агентов (OpenClaw, Claude Code, Codex, Cursor).
> Читается один раз при старте сессии. Это **конституция** проекта.
> Если инструкция здесь противоречит чему-либо в Obsidian или старых репозиториях — **прав этот файл**.

---

## 0. Главное правило (Single Source of Truth)

| Что | Где SoT | Можно ли писать агентам |
|---|---|---|
| **Код** (контракты, agent, backend, frontend, infra) | `molebot_mantle` (этот repo) | ✅ только через ветку + PR |
| **Задачи** | `molebot_mantle/tasks/*.md` | ✅ planner создаёт, остальные обновляют статус |
| **Решения** (architecture decisions) | `molebot_mantle/decisions/*.md` | ✅ append-only, никогда не переписывать |
| **Документация** | `molebot_mantle/docs/*` | ✅ |
| **Человеческие заметки / история** | `OC_Obsidian` (read-only зеркало) | ❌ агенты НЕ пишут |
| **Старый Solana-код (reference)** | `molebot` | ❌ только читать |

🔴 **Запрещённые источники истины (legacy, не использовать):**
- ❌ `~/.openclaw/workspace-*/.taskboard/*.json` — старый таскборд, удалён из процесса.
- ❌ `molebot-agents` repo — заморожен, не SoT.
- ❌ Telegram-сообщения как способ передачи кода или задач.
- ❌ `OC_Obsidian` как operational центр — теперь только read-only для человека.

**Статус задачи определяется ТОЛЬКО двумя вещами:**
1. Полем `status:` во front-matter файла `tasks/<ID>.md`.
2. Реальным состоянием git (ветка/PR/merge на GitHub).

Никаких "я написал в JSON, значит сделано". Нет ветки на GitHub — задача не сделана.

---

## 1. Pipeline (жёсткий, без вариаций)

```
task → planning → coding → review → decision → deploy
```

| Этап | Кто | Вход | Выход (артефакт) |
|---|---|---|---|
| task | человек / planner | идея, баг, фича | `tasks/<ID>.md` (status: todo) |
| planning | planner | `tasks/<ID>.md` | заполненный план в том же файле (status: ready) |
| coding | coder | task в status: ready | ветка `feat/<ID>-*` + PR (status: in_review) |
| review | reviewer | PR | review-комментарии / approve (status: approved \| changes_requested) |
| decision | human-gate | approved PR | решение мержить/нет |
| deploy | deployer (опц.) | merged main | задеплоено + запись в `decisions/` (status: done) |

Handoff между этапами — **только через файл-артефакт и статус PR**, не через «тег в Telegram».

---

## 2. Агенты (двухслойная модель)

**Слой 1 — Роль (стабильная, переиспользуемая между проектами).** Определения
живут в `agents/roles/<role>/BOOTSTRAP.md` и НЕ содержат проектной специфики.
Это постоянные «работники», которые прокачиваются от проекта к проекту.

**Слой 2 — Проект (этот файл `AGENTS.md` + `docs/`).** Вся специфика Molebot/Mantle
(репо, стек, адреса, дедлайн, чеклист) — здесь. При смене проекта меняется
только workspace агента и его `AGENTS.md`; роль остаётся нетронутой.

| Агент | Роль (Слой 1) | Одной строкой |
|---|---|---|
| **planner** | `agents/roles/planner/BOOTSTRAP.md` | Режет работу на атомарные таски, ведёт `tasks/` и `decisions/`. Не пишет код. |
| **coder** | `agents/roles/coder/BOOTSTRAP.md` | Реализует один task → ветка + PR + тесты. Не мержит. |
| **reviewer** | `agents/roles/reviewer/BOOTSTRAP.md` | Ревью PR по чеклисту. Approve или changes_requested. Не пишет фичекод. |
| **deployer** | `agents/roles/deployer/BOOTSTRAP.md` | (опц.) Деплой только смерженного main по команде человека. |

🔴 **Старые агенты `odmin` / `razrab` / `tester` УПРАЗДНЕНЫ.** Их файлы — только в Obsidian как история.

---

## 2a. Проектный контекст (Слой 2 — конкретика Molebot)

> Это то, что роль НЕ знает из `BOOTSTRAP.md` и берёт отсюда.

- **Репозиторий проекта:** `molebot_mantle` (этот repo). Всё write — через ветку + PR.
- **Что строим:** Molebot — автономный AI-торговый агент как «живой» NFT на Mantle. Подача на Mantle Turing Test Hackathon 2026 (DoraHacks), дедлайн **2026-06-15**.
- **Сеть:** Mantle Sepolia, chainId **5003**, RPC `https://rpc.sepolia.mantle.xyz`.
- **Развёрнутые контракты (testnet):**
  - MolebotNFT `0xFA9071C5c87c5B940Bf83B030fE52f3500559aCb`
  - AICredits `0x15Fa9046d2db9E38308Ed9bbA8F8e872beBF6B64`
  - Safe `0x660eAF880bCAbEf5EA1F174542f419E8eF30B07d`
  - Agent `0xFecb0b79583A337c8Bd1E390B81661329b78450e`
- **«Реальные средства / mainnet»:** Mantle mainnet и любые операции с реальными токенами — всегда отдельный явный approve человека (Stas).
- **Reference (read-only):** `molebot` — старый Solana-код как образец реализаций. `OC_Obsidian/Docs/` — исторический контекст.
- **Critical path до демо:** приоритет P0 — то, без чего демо хакатона не работает. Конкретный P0-список ведёт planner в `tasks/`.
- **Build/test/deploy команды:** см. `docs/architecture.md` и deploy-доки проекта (hardhat compile/test, CI в `.github/workflows/*`).

---

## 2b. Протокол ошибок (error escalation)

Если агент (coder/reviewer/deployer) столкнулся с ошибкой, которую не может
решить сам — он **не виснет**, а немедленно сообщает planner'у:

| Ситуация | Действие агента | Кому |
|---|---|---|
| Coder: непонятны acceptance criteria | 1 вопрос planner'у, не угадывать | → planner |
| Coder: CI/тесты не проходят после фикса | Пишет в Notes таска, меняет status: blocked | → planner |
| Reviewer: нашёл ошибки в коде | PR с CHANGES_REQUESTED + конкретные замечания | → coder (через PR) |
| Reviewer: CI красный, но PR уже открыт  | REJECT до зелёного CI | → coder |
| **Deployer: сборка/деплой упала** | Лог ошибки + статус старых контейнеров + **сразу planner'у** | → **planner** |
| Deployer: всё ок | Статус OK | → planner |
| Любой: нужен человек | Пишет причину и зовёт Стаса через planner | → planner → Стас |
| Deployer: нужно запуштить workflow файл | Использует GH_PAT_WORKFLOW из Infisical (API) для push | → сам |

**Planner** принимает решение:
- Мелкий баг → зовёт coder'а на hotfix (новая ветка + PR)
- Критическая проблема → зовёт Стаса через Telegram
- Непонятно → зовёт Стаса

> ❌ Запрещено: виснуть в пустом ожидании, переспрашивать одно и то же,
> игнорировать ошибку и публиковать сломанный код.

## 2c. Infisical secrets (для deployer'а)

Доступ к Infisical через API (не через CLI — CLI требует login):
```bash
TOKEN=$(cat ~/.infisical/token)
# Получить секрет
curl -s "https://app.infisical.com/api/v3/secrets/raw?secretName=GH_PAT_WORKFLOW&workspaceId=fd4bb536-fa11-4e9d-84f5-34e2efb5b83d&environment=dev" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin)['secrets'][0]['secretValue'])"
```

Для пуша workflow-файлов (нужен workflow scope):
```bash
PAT=$(...получить из Infisical API...)
git remote set-url origin "https://x-access-token:${PAT}@github.com/StasPodyachev/molebot_mantle.git"
git push origin <branch>
git remote set-url origin https://github.com/StasPodyachev/molebot_mantle.git  # вернуть обратно
```

## 3. Границы (общие для всех агентов)

- `trash` вместо `rm`. Необратимые операции — только после явного approve человека.
- Никаких реальных средств, приватных ключей, mainnet-деплоя без approve человека (Stas).
- Секреты — только через Infisical / GitHub Secrets. **В git не коммитить ни один токен/ключ/seed.**
- Один агент = одна сессия = один workspace в OpenClaw (изоляция, см. `docs/workflows/delivery-pipeline.md`).
- Если что-то непонятно — максимум 1–2 уточняющих вопроса, потом действуй по Least Solution.

---

## 4. Telegram (минимум)

Telegram — это **уведомления и ручной пинг**, НЕ шина передачи задач/кода.

Разрешено только:
- `/status` — текущее состояние (читает `tasks/` + git).
- Уведомление: PR открыт / review готов / CI упал.
- Подтверждение деплоя (человек жмёт "да").
- Критические ошибки (CI fail, прод упал).

Запрещено: передавать код через чат, назначать задачи тегами, держать состояние проекта в переписке.

---

## 5. Obsidian (read-only)

`OC_Obsidian` теперь — **read-only слой для человека**. Агенты:
- ✅ могут читать `Docs/` и старые `Errors/` для исторического контекста;
- ❌ НЕ пишут в него, НЕ держат там таски/статусы/решения.

Актуальная документация живёт в `molebot_mantle/docs/`. Obsidian опционально синхронизируется односторонне (repo → vault) для удобного чтения, но никогда наоборот.

---

## 6. Команды-воркфлоу (по мотивам ECC)

- `/plan <ID>` — planner заполняет план в `tasks/<ID>.md`.
- `/code <ID>` — coder берёт ready-таск, делает ветку + PR.
- `/review <PR>` — reviewer проходит `docs/workflows/review-checklist.md`.
- `/status` — сводка по `tasks/` и открытым PR.

---

_Версия: 2.0 · Двухслойная модель агентов (роль + проект) · Поддерживается planner-агентом._
