'use client';

import { usePrivy } from '@privy-io/react-auth';
import type { ReactNode } from 'react';

/**
 * RequireAuth — route guard for dashboard.
 *
 * Если пользователь не авторизован — показывает кнопку входа.
 * Privy может редиректить на login по умолчанию, но мы даём
 * явный UI, чтобы не терять контекст (какой роут пытались открыть).
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, authenticated, login } = usePrivy();

  if (!ready) {
    return (
      <main className="mx-auto max-w-xl p-8 text-center text-gray-400">
        <p>Загрузка…</p>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="mx-auto max-w-xl space-y-6 p-8 text-center">
        <h1 className="text-2xl font-bold text-white">Molebot</h1>
        <p className="text-gray-400">Войди, чтобы открыть дашборд.</p>
        <button
          onClick={login}
          className="rounded-lg bg-[#9945ff] px-6 py-3 font-semibold text-white hover:bg-[#b06dff]"
        >
          Войти
        </button>
      </main>
    );
  }

  return <>{children}</>;
}
