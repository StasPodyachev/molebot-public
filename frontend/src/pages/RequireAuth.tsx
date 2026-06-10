'use client';

import { usePrivy } from '@privy-io/react-auth';
import type { ReactNode } from 'react';

/**
 * RequireAuth — route guard for dashboard.
 *
 * If the user is not authenticated — shows a sign in button.
 * Privy may redirect to login by default, but we provide
 * an explicit UI to preserve route context.
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, authenticated, login } = usePrivy();

  if (!ready) {
    return (
      <main className="mx-auto max-w-xl p-8 text-center text-gray-400">
        <p>Loading…</p>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="mx-auto max-w-xl space-y-6 p-8 text-center">
        <h1 className="text-2xl font-bold text-white">Molebot</h1>
        <p className="text-gray-400">Sign in to open the dashboard.</p>
        <button
          onClick={login}
          className="rounded-lg bg-[#9945ff] px-6 py-3 font-semibold text-white hover:bg-[#b06dff]"
        >
          Sign in
        </button>
      </main>
    );
  }

  return <>{children}</>;
}
