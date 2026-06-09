'use client';

import { useState, useEffect, useCallback } from 'react';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

interface StrategyData {
  ok: boolean;
  strategy: string;
  strategyName: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  description: string;
  risk: number;
  updatedAt: number;
  errorCode?: string;
  errorMessage?: string;
}

interface StrategyPanelProps {
  tokenId: number;
  apiBase?: string;
}

/* -------------------------------------------------------------------------- */
/* Strategy metadata (mirrors agent/src/api/strategyRouter.ts)                  */
/* -------------------------------------------------------------------------- */

const STRATEGY_META: Record<string, { name: string; description: string; risk: number }> = {
  conservative: {
    name: 'Консервативная',
    description: 'Минимальный риск. Только стабильные пары, малые объёмы.',
    risk: 1,
  },
  aggressive: {
    name: 'Агрессивная',
    description: 'Высокий риск/доходность. Новые токены, крупные позиции.',
    risk: 4,
  },
  dca: {
    name: 'DCA',
    description: 'Усреднение долларовой стоимости. Регулярные покупки малыми порциями.',
    risk: 2,
  },
  hodl: {
    name: 'HODL',
    description: 'Купил и держишь. Минимум сделок, долгосрочная перспектива.',
    risk: 2,
  },
};

const STRATEGY_KEYS = Object.keys(STRATEGY_META);

/* -------------------------------------------------------------------------- */
/* Signal visual config                                                        */
/* -------------------------------------------------------------------------- */

const SIGNAL_STYLE: Record<string, { icon: string; bg: string; text: string }> = {
  BUY: {
    icon: '▲',
    bg: 'bg-green-900/40 border-green-700/50',
    text: 'text-green-400',
  },
  SELL: {
    icon: '▼',
    bg: 'bg-red-900/40 border-red-700/50',
    text: 'text-red-400',
  },
  HOLD: {
    icon: '■',
    bg: 'bg-yellow-900/30 border-yellow-700/40',
    text: 'text-yellow-400',
  },
};

const RISK_DOTS: Record<number, string> = {
  1: '🟢',
  2: '🟡',
  3: '🟠',
  4: '🔴',
  5: '💀',
};

/* -------------------------------------------------------------------------- */
/* Helper: human-readable relative time                                       */
/* -------------------------------------------------------------------------- */

function timeAgo(ts: number): string {
  const secs = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (secs < 60) return 'только что';
  if (secs < 3600) return `${Math.floor(secs / 60)}м назад`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}ч назад`;
  return `${Math.floor(secs / 86400)}д назад`;
}

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export default function StrategyPanel({ tokenId, apiBase }: StrategyPanelProps) {
  const API = apiBase || 'https://vps.molebot.org/api';

  const [data, setData] = useState<StrategyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [changing, setChanging] = useState(false);

  // Fetch current strategy
  const fetchStrategy = useCallback(() => {
    setLoading(true);
    fetch(`${API}/strategy?tokenId=${tokenId}`)
      .then((r) => r.json())
      .then((d: StrategyData) => {
        if (d.ok) {
          setData(d);
          setError(null);
        } else {
          setError(d.errorMessage ?? 'Не удалось загрузить стратегию');
        }
      })
      .catch(() => {
        setError('Сервис стратегий временно недоступен');
      })
      .finally(() => setLoading(false));
  }, [API, tokenId]);

  useEffect(() => {
    fetchStrategy();
  }, [fetchStrategy]);

  // Change strategy
  const changeStrategy = useCallback(
    async (newStrategy: string) => {
      setChanging(true);
      setPickerOpen(false);
      try {
        const res = await fetch(`${API}/strategy/set`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ strategy: newStrategy, tokenId }),
        });
        const d = await res.json();
        if (d.ok) {
          // Refresh
          fetchStrategy();
        } else {
          setError(d.errorMessage ?? 'Не удалось сменить стратегию');
        }
      } catch {
        setError('Сервис стратегий временно недоступен');
      } finally {
        setChanging(false);
      }
    },
    [API, tokenId, fetchStrategy],
  );

  /* ----------------------------------------------------------------------- */
  /* Render                                                                   */
  /* ----------------------------------------------------------------------- */

  const signal = data?.signal;
  const signalStyle = signal ? SIGNAL_STYLE[signal] : null;

  if (loading && !data) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-800 rounded w-1/3" />
          <div className="h-3 bg-gray-800 rounded w-2/3" />
          <div className="h-8 bg-gray-800 rounded w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-100">Стратегия</h3>
        <button
          type="button"
          onClick={() => setPickerOpen(!pickerOpen)}
          disabled={changing}
          className="text-xs bg-mole-600 hover:bg-mole-500 disabled:bg-gray-800 disabled:text-gray-600 text-white px-3 py-1.5 rounded-lg transition-all disabled:cursor-not-allowed inline-flex items-center gap-1.5"
        >
          {changing ? (
            <>
              <span className="w-2.5 h-2.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              Меняю...
            </>
          ) : (
            'Сменить'
          )}
        </button>
      </div>

      {/* Strategy picker popup */}
      {pickerOpen && (
        <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-3 space-y-1.5">
          <p className="text-xs text-gray-500 mb-1">Выбери стратегию:</p>
          {STRATEGY_KEYS.map((key) => {
            const meta = STRATEGY_META[key];
            const isActive = data?.strategy === key;
            return (
              <button
                key={key}
                type="button"
                disabled={isActive}
                onClick={() => changeStrategy(key)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                  isActive
                    ? 'bg-mole-600/30 border border-mole-500/50 text-mole-200 cursor-default'
                    : 'bg-gray-900 border border-gray-700 hover:border-gray-500 text-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{meta.name}</span>
                  <span className="text-xs text-gray-500">{RISK_DOTS[meta.risk] ?? ''}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{meta.description}</p>
                {isActive && (
                  <span className="text-xs text-mole-400 mt-1 inline-block">✓ Активна</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Active strategy info */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <p className="text-base font-medium text-gray-100">
            {data?.strategyName ?? STRATEGY_META.conservative.name}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {data?.description ?? STRATEGY_META.conservative.description}
          </p>
          {data?.updatedAt && (
            <p className="text-xs text-gray-600 mt-1">
              Обновлено: {timeAgo(data.updatedAt)}
            </p>
          )}
        </div>
        <div className="text-xs text-gray-500">
          Риск: {data ? RISK_DOTS[data.risk] ?? '—' : '—'}
        </div>
      </div>

      {/* Signal badge */}
      {signalStyle && (
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${signalStyle.bg}`}
        >
          <span className={`text-2xl font-bold ${signalStyle.text}`}>
            {signalStyle.icon}
          </span>
          <div>
            <p className={`text-sm font-bold ${signalStyle.text}`}>
              Сигнал: {signal}
            </p>
            <p className="text-xs text-gray-500">
              {signal === 'BUY' && 'Крот рекомендует покупать'}
              {signal === 'SELL' && 'Крот рекомендует продавать'}
              {signal === 'HOLD' && 'Крот рекомендует держать'}
            </p>
          </div>
        </div>
      )}

      {/* Refresh button at bottom */}
      <div className="flex items-center justify-between text-xs text-gray-600">
        <button
          type="button"
          onClick={fetchStrategy}
          className="hover:text-gray-400 transition-colors"
        >
          ↻ Обновить
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
          ⚠ {error}
        </div>
      )}
    </div>
  );
}
