/**
 * agent/src/index.ts — HTTP API server entrypoint (FR-002)
 *
 * Запуск:
 *   AGENT_WALLET_ADDRESS=0x... npm start
 * или
 *   node dist/index.js
 */

import { createServer } from 'node:http';
import { loadConfig } from './config.js';
import { ChatRouter } from './api/chatRouter.js';
import { StrategyRouter } from './api/strategyRouter.js';
import { TradeRouter } from './api/tradeRouter.js';
import { VaultRouter } from './api/vaultRouter.js';
import { PriceRouter } from './api/priceRouter.js';
import { ChatBillingService } from './services/chatBillingService.js';
import { PriceFeed } from './services/priceFeed.js';
import { CandleStore as PriceCandleStore } from './services/candleStore.js';
import { CandleStore as MockCandleStore, StrategyEngine } from './services/strategyEngine.js';
import { TradingScheduler } from './services/tradingScheduler.js';
import { PositionTracker } from './services/positionTracker.js';
import { TradingRouter } from './api/tradingRouter.js';
import { initAgniPlugin } from './plugins/agni/index.js';

const config = loadConfig();

// Bootstrap Agni Finance plugin (graceful skip if not configured)
try {
  const agniConfig = {
    routerAddress: (process.env['AGNI_SWAP_ROUTER'] ?? undefined) as `0x${string}` | undefined,
    quoterAddress: (process.env['AGNI_QUOTER'] ?? undefined) as `0x${string}` | undefined,
    walletAddress: (process.env['AGNI_WALLET_ADDRESS'] ?? config.agentWallet) as `0x${string}`,
    vaultAddress: (process.env['MOLE_VAULT_ADDRESS'] ?? undefined) as `0x${string}` | undefined,
    sessionPrivateKey: (process.env['SESSION_PRIVATE_KEY'] ?? undefined) as `0x${string}` | undefined,
    maxTradeAmount: Number(process.env['AGNI_MAX_TRADE_AMOUNT'] ?? '1000'),
    dailyLimit: Number(process.env['AGNI_DAILY_LIMIT'] ?? '5000'),
    defaultSlippage: Number(process.env['AGNI_DEFAULT_SLIPPAGE'] ?? '0.5'),
    rpcUrl: process.env['AGNI_RPC_URL'] ?? config.rpcUrl,
    chainId: config.chainId,
    mockMode: process.env['AGNI_MOCK_MODE'] !== 'false',
  };
  initAgniPlugin(agniConfig);
  console.log('[server] Agni plugin initialized (mockMode=' + agniConfig.mockMode + ')');
} catch (err) {
  console.warn('[server] Agni plugin init skipped:', (err as Error).message);
}
const billingService = new ChatBillingService(config);
const chatRouter = new ChatRouter(config, billingService);
// TASK-014: Strategy Engine (mock candles) + real indicators
const strategyEngineStore = new MockCandleStore();
const strategyEngine = new StrategyEngine(strategyEngineStore);
const strategyRouter = new StrategyRouter(strategyEngine);
const tradeRouter = new TradeRouter();
const vaultRouter = new VaultRouter(
  (process.env['MOLE_VAULT_ADDRESS'] ?? '0x252F0d506Da5131Bdc469796b273c724AB8Bc6F7') as `0x${string}`,
  config.rpcUrl,
);

// TASK-013: PriceFeed + CandleStore + PriceRouter
const priceFeed = new PriceFeed();
const priceCandleStore = new PriceCandleStore();
const priceRouter = new PriceRouter(priceFeed, priceCandleStore);

// TASK-015: Trading Scheduler + PositionTracker + TradingRouter
const positionTracker = new PositionTracker();
const tradingScheduler = new TradingScheduler(priceFeed, strategyEngine, positionTracker);
const tradingRouter = new TradingRouter(tradingScheduler, positionTracker);
const PORT = parseInt(process.env.API_PORT ?? '3002', 10);

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  // CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Route: /api/trading/* → TradingRouter, /api/price/* → PriceRouter, /api/strategy/* → StrategyRouter, /api/trade/* → TradeRouter, /api/vault/* → VaultRouter, rest → ChatRouter
  if (url.pathname.startsWith('/api/trading')) {
    tradingRouter.handle(req, res).catch((err) => {
      console.error('[server] Trading route error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'internal_error' }));
    });
  } else if (url.pathname.startsWith('/api/price')) {
    priceRouter.handle(req, res).catch((err) => {
      console.error('[server] Price route error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'internal_error' }));
    });
  } else if (url.pathname.startsWith('/api/strategy')) {
    strategyRouter.handle(req, res).catch((err) => {
      console.error('[server] Strategy route error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'internal_error' }));
    });
  } else if (url.pathname.startsWith('/api/trade')) {
    tradeRouter.handle(req, res).catch((err) => {
      console.error('[server] Trade route error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'internal_error' }));
    });
  } else if (url.pathname.startsWith('/api/vault')) {
    vaultRouter.handle(req, res).catch((err) => {
      console.error('[server] Vault route error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'internal_error' }));
    });
  } else {
    chatRouter.handle(req, res).catch((err) => {
      console.error('[server] Unhandled route error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'internal_error' }));
    });
  }
});

server.listen(PORT, () => {
  console.log(`[server] API running on http://0.0.0.0:${PORT}`);
  console.log(`[server] Endpoints:`);
  console.log(`  POST /api/chat`);
  console.log(`  POST /api/chat/session  (FE-24: batch session)`);
  console.log(`  GET  /api/chat/quota?tokenId=...  (FE-24: remaining msgs)`);
  console.log(`  GET  /api/chat/history?tokenId=...`);
  console.log(`  GET  /api/chat/health`);
  console.log(`  GET  /api/trading/status?tokenId=... (TASK-015: scheduler + position status)`);
  console.log(`  POST /api/trading/start              (TASK-015: start scheduler)`);
  console.log(`  POST /api/trading/stop               (TASK-015: stop scheduler)`);
  console.log(`  GET  /api/price?pair=MNT/USDC       (TASK-013: current DEX price)`);
  console.log(`  GET  /api/price/history?pair=MNT/USDC&limit=50 (TASK-013: 5-min candles)`);
  console.log(`  GET  /api/strategy?tokenId=...  (FE-29: current strategy + signal)`);
  console.log(`  POST /api/strategy/set           (FE-29: change strategy)`);
  console.log(`  GET  /api/trade/history?tokenId=... (FE-30: trade history)`);
  console.log(`  GET  /api/trade/position?tokenId=... (FE-30: active position)`);
  console.log(`  POST /api/trade/open                (FE-30: open mock trade)`);
  console.log(`  POST /api/trade/close               (FE-30: close trade)`);
  console.log(`  GET  /api/vault/balance?tokenId=... (FE-34: vault MNT balance)`);
});

// Graceful shutdown
const shutdown = async () => {
  console.log('[server] Shutting down...');
  await billingService.close();
  tradingScheduler.stop();
  server.close(() => process.exit(0));
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
