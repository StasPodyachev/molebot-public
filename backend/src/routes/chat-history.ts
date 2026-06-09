/**
 * GET /api/chat/history?tokenId=:id&limit=N
 */

import { Router } from 'express';
import { getHistory } from '../services/chat-history.js';

export function chatHistoryRouter(): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    try {
      const tokenId = req.query.tokenId;
      const limit = Math.min(Number(req.query.limit ?? '50'), 100);

      if (!tokenId) {
        return res.status(400).json({
          ok: false,
          errorCode: 'INVALID_INPUT',
          errorMessage: 'tokenId обязателен',
        });
      }

      const tokenIdBig = BigInt(String(tokenId));
      const messages = await getHistory(tokenIdBig, limit);

      return res.json({
        ok: true,
        tokenId: Number(tokenIdBig),
        messages,
        count: messages.length,
      });
    } catch (err) {
      console.error('[chat-history] Error:', err);
      return res.status(500).json({
        ok: false,
        errorCode: 'INTERNAL_ERROR',
        errorMessage: (err as Error).message,
      });
    }
  });

  return router;
}
