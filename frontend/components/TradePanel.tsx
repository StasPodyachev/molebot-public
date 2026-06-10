'use client';

import { useState, useEffect, useCallback } from 'react';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

interface TradeEntry {
  id: string;
  tokenId: number;
  pair: string;
  side: 'BUY' | 'SELL';
  amount: number;
  price: number;
  pnl: number;
  status: 'open' | 'closed';
  openedAt: number;
  closedAt?: number;
}

interface PositionData {
  active: boolean;
  trade?: TradeEntry;
  currentPrice?: number;
  pnlPercent?: number;
  durationMinutes?: number;
}

interface TradeHistoryResponse {
  ok: boolean;
  trades: TradeEntry[];
}

interface PositionResponse {
  ok: boolean;
  position: PositionData;
}

interface TradeActionResponse {
  ok: boolean;
  trade: TradeEntry;
  errorMessage?: string;
}

interface TradePanelProps {
  tokenId: number;
  apiBase?: string;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function timeAgo(ms: number): string {
  const secs = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (secs < 60) return 'now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

function fmtUSD(v: number): string {
  const sign = v >= 0 ? '+' : '';
  return `${sign}$${Math.abs(v).toFixed(2)}`;
}

function fmtPrice(v: number): string {
  return v < 1 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`;
}

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export default function TradePanel({ tokenId, apiBase }: TradePanelProps) {
  const API = apiBase || 'https://vps.molebot.org/api';

  const [trades, setTrades] = useState<TradeEntry[]>([]);
  const [position, setPosition] = useState<PositionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/trade/history?tokenId=${tokenId}&limit=20`).then(r => r.json()),
      fetch(`${API}/trade/position?tokenId=${tokenId}`).then(r => r.json()),
    ])
      .then(([hist, pos]: [TradeHistoryResponse, PositionResponse]) => {
        if (hist.ok) setTrades(hist.trades ?? []);
        if (pos.ok) setPosition(pos.position);
        setError(null);
      })
      .catch(() => setError('Trading service is temporarily unavailable'))
      .finally(() => setLoading(false));
  }, [API, tokenId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 15s when position is active
  useEffect(() => {
    if (!position?.active) return;
    const i = setInterval(fetchData, 15_000);
    return () => clearInterval(i);
  }, [position?.active, fetchData]);

  const doAction = useCallback(async (action: 'open' | 'close') => {
    setActing(true);
    setError(null);
    try {
      const res = await fetch(`${API}/trade/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId }),
      });
      const data: TradeActionResponse = await res.json();
      if (data.ok) {
        await fetchData();
      } else {
        setError(data.errorMessage ?? 'Operation failed');
      }
    } catch {
      setError('Trading service is temporarily unavailable');
    } finally {
      setActing(false);
    }
  }, [API, tokenId, fetchData]);

  /* ----------------------------------------------------------------------- */
  /* Render                                                                   */
  /* ----------------------------------------------------------------------- */

  if (loading && trades.length === 0 && !position) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-800 rounded w-1/3" />
          <div className="h-3 bg-gray-800 rounded w-2/3" />
          <div className="h-12 bg-gray-800 rounded w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-100">Trading</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchData}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Active position card */}
      {position?.active && position.trade ? (
        <div className={`p-3 rounded-xl border ${
          (position.pnlPercent ?? 0) >= 0
            ? 'bg-green-900/20 border-green-700/40'
            : 'bg-red-900/20 border-red-700/40'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                position.trade.side === 'BUY'
                  ? 'bg-green-600/30 text-green-300'
                  : 'bg-red-600/30 text-red-300'
              }`}>
                {position.trade.side}
              </span>
              <span className="text-sm font-medium text-gray-200">
                {position.trade.pair}
              </span>
            </div>
            <span className="text-xs text-gray-500">
              {position.durationMinutes}m ago
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-gray-500">Entry</span>
              <p className="text-gray-200 font-mono">{fmtPrice(position.trade.price)}</p>
            </div>
            <div>
              <span className="text-gray-500">Current</span>
              <p className="text-gray-200 font-mono">
                {position.currentPrice ? fmtPrice(position.currentPrice) : '—'}
              </p>
            </div>
            <div>
              <span className="text-gray-500">PnL</span>
              <p className={`font-mono ${
                (position.pnlPercent ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {position.pnlPercent != null ? `${position.pnlPercent >= 0 ? '+' : ''}${position.pnlPercent}%` : '—'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => doAction('close')}
            disabled={acting}
            className="mt-3 w-full text-xs bg-red-600/80 hover:bg-red-500 disabled:bg-gray-800 disabled:text-gray-600 text-white px-3 py-2 rounded-lg transition-all disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
          >
            {acting ? (
              <>
                <span className="w-2.5 h-2.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                Closing...
              </>
            ) : (
              'Close position'
            )}
          </button>
        </div>
      ) : (
        /* No active position — show open trade button */
        <div className="text-center py-3">
          <p className="text-xs text-gray-600 mb-3">No active positions</p>
          <button
            type="button"
            onClick={() => doAction('open')}
            disabled={acting}
            className="text-xs bg-mole-600 hover:bg-mole-500 disabled:bg-gray-800 disabled:text-gray-600 text-white px-4 py-2 rounded-lg transition-all disabled:cursor-not-allowed inline-flex items-center gap-1.5"
          >
            {acting ? (
              <>
                <span className="w-2.5 h-2.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                Opening...
              </>
            ) : (
              'Open trade (mock)'
            )}
          </button>
        </div>
      )}

      {/* Trade history toggle + table */}
      <div>
        <button
          type="button"
          onClick={() => setShowHistory(!showHistory)}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
        >
          <span className={`transition-transform ${showHistory ? 'rotate-90' : ''}`}>▶</span>
          Trade history ({trades.length})
        </button>

        {showHistory && (
          <div className="mt-3 overflow-x-auto">
            {trades.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-4">
                No trades yet. Click ‘Open trade’ to get started.
              </p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800">
                    <th className="text-left py-2 pr-2 font-medium">Time</th>
                    <th className="text-left py-2 pr-2 font-medium">Pair</th>
                    <th className="text-center py-2 pr-2 font-medium">Side</th>
                    <th className="text-right py-2 pr-2 font-medium">Amount</th>
                    <th className="text-right py-2 pr-2 font-medium">Price</th>
                    <th className="text-right py-2 font-medium">PnL</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((t) => (
                    <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="py-2 pr-2 text-gray-500 whitespace-nowrap">
                        {timeAgo(t.openedAt)}
                      </td>
                      <td className="py-2 pr-2 text-gray-300 font-mono whitespace-nowrap">
                        {t.pair}
                      </td>
                      <td className="py-2 pr-2 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          t.side === 'BUY'
                            ? 'bg-green-600/30 text-green-300'
                            : 'bg-red-600/30 text-red-300'
                        }`}>
                          {t.side}
                        </span>
                        {t.status === 'open' && (
                          <span className="ml-1 px-1 py-0.5 rounded text-[10px] bg-blue-600/30 text-blue-300">
                            OPEN
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-right text-gray-200 font-mono">
                        ${t.amount.toFixed(2)}
                      </td>
                      <td className="py-2 pr-2 text-right text-gray-400 font-mono">
                        {fmtPrice(t.price)}
                      </td>
                      <td className={`py-2 text-right font-mono font-medium ${
                        t.status === 'open' ? 'text-gray-500' :
                        t.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {t.status === 'open' ? '—' : fmtUSD(t.pnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
          ⚠ {error}
        </div>
      )}
    </div>
  );
}
