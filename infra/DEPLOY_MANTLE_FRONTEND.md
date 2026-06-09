# Деплой Molebot.Mantle на Hetzner

## DNS

Добавь A-запись:
```
mantle.molebot.org → <IP твоего Hetzner VPS>
```

## На Hetzner (где крутится основной Caddy)

### 1. Добавить Caddy config

Скопируй `infra/Caddyfile.mantle` в Caddy-конфиги:
```bash
# Если Caddy на хосте
sudo cp infra/Caddyfile.mantle /etc/caddy/conf.d/mantle.molebot.org
sudo systemctl reload caddy

# Или если Caddy в Docker — добавь в volumes
```

### 2. Собрать и запустить стек

```bash
cd molebot_mantle

# Шаг 1: Собрать Next.js на хосте (требуется перед Docker build)
cd frontend && npx next build && cd ..

# Шаг 2: Собрать Docker образ и запустить
docker compose -f infra/docker-compose.mantle.yml up -d
```

### 3. Проверить

```bash
curl -H "Host: mantle.molebot.org" http://localhost/ 2>&1 | head -5
# или
curl https://mantle.molebot.org/
curl https://mantle.molebot.org/api/health
```

## Privy Dashboard

Уже должно быть добавлено:
- `https://mantle.molebot.org` в Allowed Origins
- Email + Google логин включены
- Embedded Wallet (EVM) `createOnLogin: users-without-wallets`

Если нет — добавь в [Privy Dashboard](https://dashboard.privy.io).
