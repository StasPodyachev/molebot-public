/**
 * Backend API сервер для Molebot Chat (Mantle)
 * Порт: 3002 (проксируется через Next.js rewrites)
 */

import express from 'express';
import cors from 'cors';
import { loadConfig } from '../../agent/src/config.js';
import { ChatBillingService } from '../../agent/src/services/chatBillingService.js';
import { chatRouter } from './routes/chat.js';
import { chatHistoryRouter } from './routes/chat-history.js';

const app = express();
const PORT = Number(process.env.API_PORT ?? '3002');

app.use(cors());
app.use(express.json());

// Инициализация сервисов
const config = loadConfig();

// Определяем agentWallet — если не задан, используем плейсхолдер
if (!config.agentWallet || config.agentWallet === '0x') {
  console.warn('[backend] AGENT_WALLET_ADDRESS не задан. Используйте .env');
}

const billingService = new ChatBillingService(config);

// Роуты
app.use('/api/chat', chatRouter(billingService));
app.use('/api/chat/history', chatHistoryRouter());

// Healthcheck
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, chainId: config.chainId, contract: config.contractAddress });
});

// Глобальный обработчик ошибок
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[backend] Unhandled error:', err);
  res.status(500).json({ ok: false, error: 'internal_error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`[backend] Molebot Chat API running on http://localhost:${PORT}`);
  console.log(`[backend] Contract: ${config.contractAddress} (chainId ${config.chainId})`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await billingService.close();
  process.exit(0);
});
process.on('SIGINT', async () => {
  await billingService.close();
  process.exit(0);
});
