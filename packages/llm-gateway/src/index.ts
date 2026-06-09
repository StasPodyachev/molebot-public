/**
 * LLM Gateway — сервис между агентом и LLM провайдером (DeepSeek)
 *
 * Production mode:
 *   LLM_STUB_MODE=false (default) — проксирует к DeepSeek, проверяет AICredits on-chain
 *   LLM_STUB_MODE=true — мок-ответы для тестирования
 *
 * Зависимости:
 *   - 🔑 LLM_API_KEY — DeepSeek API ключ
 *   - 📄 AICredits.sol — 0x15Fa9046d2db9E38308Ed9bbA8F8e872beBF6B64 (Mantle Sepolia)
 */

import express from 'express';
import cors from 'cors';
import { loadConfig } from './config.js';
import { createRouter } from './routes/index.js';

const config = loadConfig();
const app = express();

app.use(cors());
app.use(express.json());

// Роуты API
app.use(createRouter(config));

// Healthcheck
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    stubMode: config.stubMode,
    providerUrl: config.llmProviderUrl,
    model: config.defaultModel,
    aiCredits: config.aiCreditsAddress,
    agentWallet: config.agentWalletAddress,
    note: config.stubMode
      ? '⚠️ Stub mode active. Set LLM_STUB_MODE=false for production.'
      : '✅ Production mode — real LLM + on-chain AICredits',
  });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[llm-gateway] Unhandled error:', err);
  res.status(500).json({ ok: false, error: 'internal_error', message: err.message });
});

app.listen(config.port, () => {
  console.log(`[llm-gateway] Running on http://0.0.0.0:${config.port}`);
  console.log(`[llm-gateway] Mode: ${config.stubMode ? 'STUB ⚠️' : 'PRODUCTION ✅'}`);
  console.log(`[llm-gateway] Provider: ${config.llmProviderUrl}`);
  console.log(`[llm-gateway] Model: ${config.defaultModel}`);
  console.log(`[llm-gateway] AICredits: ${config.aiCreditsAddress}`);
  console.log(`[llm-gateway] Agent wallet: ${config.agentWalletAddress}`);
  if (config.stubMode) {
    console.log(`[llm-gateway] ⚠️ Заглушка. Для production: LLM_STUB_MODE=false + LLM_API_KEY=...`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
