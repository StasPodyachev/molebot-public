# OpenClaw config — миграция на чистый конвейер

Цель: убрать недетерминированный роутинг (один бот → два агента) и «социальный хаос»
(agentToAgent + visibility:all), которые приводили к потере/обмену задач между агентами
(инцидент 2026-05-14, CONFIG_RULES.md).

Принцип: **1 аккаунт = 1 агент, без перекрытий, явный fallback, без agent-to-agent.**

## Что меняется

### Агенты (4, заменяют odmin/razrab/tester/main)
| Агент    | Роль              | Модель             | Может                                   | Не может            |
|----------|-------------------|--------------------|-----------------------------------------|---------------------|
| planner  | план/архитектура  | deepseek-v4-flash  | читать/писать файлы, читать git         | push, merge, deploy |
| coder    | реализация        | deepseek-v4-pro    | branch, commit, **push** (без merge)    | merge, deploy       |
| reviewer | ревью             | deepseek-reasoner  | только чтение + shell (тесты/линт)       | write, push, merge, deploy |
| deployer | деплой            | deepseek-v4-flash  | читать, shell, **deploy.run** (@OC_deployer_bot) | write, push, merge  |

> Модели — мой дефолт (баланс цена/качество). Если хочешь всё на flash — поменяй
> `model` у coder/reviewer на `deepseek-v4-flash`.

### Telegram (4 бота, по одному на агента)
| Бот              | account  | Агент    | Infisical key                  |
|------------------|----------|----------|--------------------------------|
| @ocstas_bot      | planner  | planner  | TG_TOKEN_PLANNER               |
| @OC_razrab_bot   | coder    | coder    | TG_TOKEN_CODER                 |
| @OC_TESTER1_bot  | reviewer | reviewer | TG_TOKEN_REVIEWER              |
| @OC_deployer_bot | deployer | deployer | TG_TOKEN_OC_DEPLOYER_BOT       |

> @molebot_org_bot **освобождён** — оставлен под бота проекта (использование позже),
> в конвейере не участвует. Деплой-подтверждения и notify/prod-алерты идут через
> канал `deployer` (@OC_deployer_bot).

Токены берутся из Infisical (`molebot-platform / Development`), не хранятся в конфиге.
Замени имена ключей (`TG_TOKEN_*`) на реальные, если они называются иначе.

### Bindings — 4 штуки, без дублей
Было: 7 биндингов, аккаунт `default` (@ocstas_bot) висел на odmin (#1,#7) **и** razrab (#4)
→ роутинг кидал монетку. Стало: ровно по одному биндингу на агента.

### Отключено
- `tools.agentToAgent.enabled: false` — агенты не дёргают друг друга напрямую,
  handoff только через файлы/PR-статус.
- `tools.sessions.visibility: "self"` — каждый агент видит только свои сессии.
- `routing.ambiguous: "reject"` — при неоднозначном роутинге не угадываем, а отклоняем.
- `groupPolicy: "owner-only"` на всех аккаунтах — чужие в группах не триггерят агентов.

### Деплой
- `deploy.requireConfirmation: true` — деплой только после подтверждения в Telegram
  через канал `deployer` (@OC_deployer_bot).
- Только `deployer` имеет `deploy.run`. coder/reviewer/planner — нет.

## Применение на VPS (x@oc-01-vps, 178.105.123.110:32323)

1. **Бэкап старого конфига:**
   ```bash
   cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.bak.$(date +%Y%m%d)
   ```
2. **Завести токены в Infisical** (если ключи названы иначе — поправь `botTokenRef`).
3. **Положить новый конфиг:**
   ```bash
   cp openclaw-config-new.json ~/.openclaw/openclaw.json
   ```
4. **Подготовить рабочие папки агентов и убрать мусор:**
   ```bash
   mkdir -p ~/.openclaw/workspace/{planner,coder,reviewer,deployer}
   rm -rf ~/.openclaw/workspace-razbra            # опечатка-папка
   rm -rf ~/.openclaw/workspace/*.bak.*           # старые бэкапы
   ```
   > `agentDir` у всех указывает на `/home/x/molebot_mantle/agents` — там лежат
   > planner.md / coder.md / reviewer.md / deployer.md (single source of truth).
5. **Проверить и перезапустить:**
   ```bash
   openclaw config validate    # если есть такая команда
   systemctl --user restart openclaw   # или ваш способ рестарта
   ```
6. **Дымовой тест:** написать `/status` в @molebot_org_bot, `план задачи X` в @ocstas_bot —
   убедиться, что отвечает только нужный агент.

## Откат
```bash
cp ~/.openclaw/openclaw.json.bak.YYYYMMDD ~/.openclaw/openclaw.json
systemctl --user restart openclaw
```

## Открытые вопросы / проверить руками
- Точный формат `botTokenRef` под вашу версию OpenClaw (Infisical-ref vs env-var). Если
  OpenClaw не умеет читать Infisical напрямую — подставь `"botTokenEnv": "TG_TOKEN_PLANNER"`
  и прокинь переменные через окружение сервиса.
- Имена tool-ID (`git.push`, `deploy.run` и т.п.) — сверь со своим списком доступных tools;
  поправь, если в твоей сборке они называются иначе.
- `model` ID (`deepseek-v4-pro`, `deepseek-reasoner`) — должны совпадать с провайдером в конфиге.
