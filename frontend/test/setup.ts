import '@testing-library/jest-dom/vitest';

// Polyfill crypto.randomUUID for jsdom
if (typeof globalThis.crypto?.randomUUID !== 'function') {
  (globalThis.crypto as unknown as Record<string, unknown>).randomUUID = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-privy';
process.env.VITE_CHAT_SKIP_PAYMENT = 'true';
