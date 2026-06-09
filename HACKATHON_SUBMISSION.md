# 🦔 Molebot — Mantle Turing Test Hackathon 2026

> **Autonomous AI Trading Agent | Digital Pet NFT | Policy-Bound Keyless Security**

## 🎯 The Idea

Molebot is an **AI agent that lives on Mantle as a dynamic NFT**.

It trades on your behalf — analyzing markets through RSI and SMA crossover strategies, executing swaps through Agni Finance DEX, and managing risk with stop-losses and position limits.

But it's not just a trading bot. The Mole has **feelings, levels, and accessories**. A profitable day makes it happy and unlocks cosmetic upgrades. A losing day puts it to sleep. Over time, each Mole develops a unique **personality hash** and trading history shape its character.

## 🧠 What Makes It Intelligent?

- **Real-time technical analysis** via on-chain Agni Quoter (RSI, SMA crossover)
- **LLM-powered chat** — users talk to their Mole in natural language
- **Autonomous scheduling** — the agent checks markets every 15 minutes
- **Multi-language support** — the Mole speaks your language

## 🔐 The Key Innovation: User-Controlled Security

Unlike other trading agents that require you to hand over your private keys, Molebot uses:

1. **Turnkey TEE** — signing happens inside a hardware trusted execution environment. The agent can _request_ transactions, but the key never leaves the TEE and strict policies limit what can be signed.
2. **Squads Multisig** — any withdrawal requires your approval. The platform cannot unilaterally move your funds.
3. **Session Keys** — users approve session limits through EIP-712 signatures. No infinite approvals.

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Blockchain** | Mantle (Sepolia testnet + mainnet) |
| **Smart Contracts** | Solidity + Hardhat (ERC721, ERC20, custom vault) |
| **AI Agent** | TypeScript, DeepSeek LLM |
| **DEX** | Agni Finance (Uniswap V3 fork) |
| **Wallet** | Turnkey TEE, Squads multisig |
| **Auth** | Privy (social login + embedded wallets) |
| **Frontend** | React + Vite + Tailwind + Reown |
| **Infra** | Docker, Cloudflare Pages, Hetzner VPS |

## 🚢 What We Built (this repo)

- **Smart contracts**: ERC721 NFT, AICredits ERC20, MoleVault with session keys
- **Trading agent**: HTTP API server with LLM chat, price feed, 2 trading strategies, autonomous scheduler
- **Frontend**: Landing page, NFT dashboard, chat panel, strategy selector
- **DEX integration**: Agni Finance swap + quote via session-keyed vault

## 📊 Demo

- **Live site**: [molebot.org](https://molebot.org)
- **Video**: [YouTube demo](https://youtu.be/...)
- **GitHub**: [github.com/StasPodyachev/molebot-public](https://github.com/StasPodyachev/molebot-public)

## 👥 Team

**Stanislav Podyachev** — Full-stack blockchain developer
