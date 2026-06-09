import { Router, type Request, type Response } from 'express';
import { LLMProxyService } from '../services/llm-proxy.js';
import { AICreditsService } from '../services/ai-credits.js';
import { ResponseCache } from '../services/cache.js';
import { type ChatRequest, type CreditsCheckRequest } from '../types.js';
import { type GatewayConfig } from '../config.js';

export function createRouter(config: GatewayConfig) {
  const router = Router();
  const llmProxy = new LLMProxyService(config);
  const creditsService = new AICreditsService(config);
  const cache = new ResponseCache(config.cacheTtlSec);

  /** POST /v1/chat/completions — основной LLM эндпоинт */
  router.post('/v1/chat/completions', async (req: Request, res: Response) => {
    try {
      const chatReq = req.body as ChatRequest;

      if (!chatReq.messages || !Array.isArray(chatReq.messages) || chatReq.messages.length === 0) {
        res.status(400).json({ error: 'Bad Request', message: 'messages is required and must be a non-empty array' });
        return;
      }

      // Проверка кэша
      const cached = cache.get(chatReq);
      if (cached) {
        res.json(cached);
        return;
      }

      // Проверка AICredits перед запросом (пропускаем только если stubMode)
      if (!config.stubMode) {
        const userAddress = (chatReq.user ?? config.agentWalletAddress) as `0x${string}`;
        const creditsCheck: CreditsCheckRequest = {
          address: userAddress,
          amount: BigInt(1),
        };
        const credits = await creditsService.checkCredits(creditsCheck);
        if (!credits.sufficient) {
          res.status(402).json({
            error: 'Payment Required',
            message: 'Insufficient AICredits',
            credits,
          });
          return;
        }

        // Списываем 1 кредит за запрос
        const spent = await creditsService.spendCredits(userAddress, 1n);
        if (!spent) {
          console.warn('[llm-gateway] Failed to spend credits, but proceeding with LLM request');
          // Не блокируем — трассируем ошибку
        }
      }

      // Запрос к LLM
      const response = await llmProxy.chat(chatReq);

      // Кэширование
      cache.set(chatReq, response);

      res.json(response);
    } catch (err) {
      console.error('[llm-gateway] chat error:', err);
      res.status(500).json({
        error: 'Internal Server Error',
        message: (err as Error).message,
      });
    }
  });

  /** POST /v1/credits/check — проверка баланса AICredits */
  router.post('/v1/credits/check', async (req: Request, res: Response) => {
    try {
      const checkReq = req.body as CreditsCheckRequest;
      if (!checkReq.address) {
        res.status(400).json({ error: 'Bad Request', message: 'address is required' });
        return;
      }
      const result = await creditsService.checkCredits(checkReq);
      res.json(result);
    } catch (err) {
      console.error('[llm-gateway] credits check error:', err);
      res.status(500).json({
        error: 'Internal Server Error',
        message: (err as Error).message,
      });
    }
  });

  return router;
}
