import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMoleNFT } from '../hooks/useMoleNFT';

// Mock ethers so no real RPC is hit
vi.mock('ethers', () => ({
  ethers: {
    JsonRpcProvider: class { },
    Contract: class { async balanceOf() { return 0n; } },
  },
}));

describe('useMoleNFT — Rules of Hooks (regression for React #311)', () => {
  it('does not crash when address transitions null -> address (auth flow)', () => {
    const { result, rerender } = renderHook(({ addr }) => useMoleNFT(addr), {
      initialProps: { addr: null as string | null },
    });
    expect(result.current.hasMinted).toBe(false);
    // Simulate Privy login: address becomes available — this used to throw #311
    expect(() => rerender({ addr: '0x1234567890123456789012345678901234567890' })).not.toThrow();
    expect(result.current).toHaveProperty('refresh');
  });
});
