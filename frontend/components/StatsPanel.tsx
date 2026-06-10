'use client';

import { useState, useEffect, useCallback } from 'react';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

interface TradeStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnl: number;
  bestTrade: number;
  worstTrade: number;
  avgPnlPerTrade: number;
  dailyPnl: number;
  activePosition: boolean;
}

interface StatsResponse {
  ok: boolean;
  stats: TradeStats;
}

interface StatsPanelProps {
  tokenId: number;
  apiBase?: string;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function fmtPnL(v: number): string {
  const sign = v >= 0 ? '+' : '';
  return `${sign}$${Math.abs(v).toFixed(2)}`;
}

function pnlColor(v: number): string {
  if (v > 0) return 'text-green-400';
  if (v < 0) return 'text-red-400';
  return 'text-gray-400';
}

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export default function StatsPanel({ tokenId, apiBase }: StatsPanelProps) {
  const API = apiBase || 'https://vps.molebot.org/api';

  const [stats, setStats] = useState<TradeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(() => {
    setLoading(true);
    fetch(`${API}/trade/stats?tokenId=${tokenId}`)
      .then(r => r.json())
      .then((d: StatsResponse) => {
        if (d.ok) {
          setStats(d.stats);
          setError(null);
        } else {
          setError('Failed to load statistics');
        }
      })
      .catch(() => setError('Stats service is temporarily unavailable'))
      .finally(() => setLoading(false));
  }, [API, tokenId]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  /* ----------------------------------------------------------------------- */
  /* Render                                                                   */
  /* ----------------------------------------------------------------------- */

  if (loading && !stats) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-800 rounded w-1/3" />
          <div className="grid grid-cols-3 gap-3">
            <div className="h-16 bg-gray-800 rounded-xl" />
            <div className="h-16 bg-gray-800 rounded-xl" />
            <div className="h-16 bg-gray-800 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-100">Statistics</h3>
        <button
          type="button"
          onClick={fetchStats}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          ↻
        </button>
      </div>

      {/* KPIs — 3 cards in a row */}
      <div className="grid grid-cols-3 gap-3">
        {/* Total PnL */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-3 text-center">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">PnL</p>
          <p className={`text-lg font-bold font-mono ${pnlColor(stats.totalPnl)}`}>
            {fmtPnL(stats.totalPnl)}
          </p>
          {stats.dailyPnl !== 0 && (
            <p className={`text-[10px] font-mono mt-0.5 ${pnlColor(stats.dailyPnl)}`}>
              {fmtPnL(stats.dailyPnl)} today
            </p>
          )}
        </div>

        {/* Win rate */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-3 text-center">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Winrate</p>
          <p className={`text-lg font-bold font-mono ${
            stats.winRate >= 50 ? 'text-green-400' : stats.winRate > 0 ? 'text-yellow-400' : 'text-gray-400'
          }`}>
            {stats.winRate}%
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">
            {stats.winningTrades}W / {stats.losingTrades}L
          </p>
        </div>

        {/* Total trades */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-3 text-center">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Trades</p>
          <p className="text-lg font-bold font-mono text-gray-200">
            {stats.totalTrades}
          </p>
          {stats.activePosition && (
            <p className="text-[10px] text-blue-400 mt-0.5">1 active</p>
          )}
        </div>
      </div>

      {/* Details: best/worst/avg */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="text-center">
          <span className="text-gray-500">Best</span>
          <p className={`font-mono font-medium ${pnlColor(stats.bestTrade)}`}>
            {stats.bestTrade !== 0 ? fmtPnL(stats.bestTrade) : '—'}
          </p>
        </div>
        <div className="text-center">
          <span className="text-gray-500">Worst</span>
          <p className={`font-mono font-medium ${pnlColor(stats.worstTrade)}`}>
            {stats.worstTrade !== 0 ? fmtPnL(stats.worstTrade) : '—'}
          </p>
        </div>
        <div className="text-center">
          <span className="text-gray-500">Avg</span>
          <p className={`font-mono font-medium ${pnlColor(stats.avgPnlPerTrade)}`}>
            {stats.avgPnlPerTrade !== 0 ? fmtPnL(stats.avgPnlPerTrade) : '—'}
          </p>
        </div>
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
