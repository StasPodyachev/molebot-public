/**
 * Agni Finance plugin — константы
 *
 * Agni — Uniswap V3-style AMM на Mantle.
 * Все адреса взяты из agni-sdk (TestnetAddresses).
 */

// ====== Адреса контрактов (Mantle Sepolia, chainId 5003) ======

/** SwapRouter — основной роутер для свапов */
export const AGNI_SWAP_ROUTER = '0xe2DB835566F8677d6889ffFC4F3304e8Df5Fc1df' as const;

/** QuoterV2 — оффчейн-расчёт свопа */
export const AGNI_QUOTER_V2 = '0x49C8bb51C6bb791e8D6C31310cE0C14f68492991' as const;

/** AgniFactory */
export const AGNI_FACTORY = '0x503Ca2ad7C9C70F4157d14CF94D3ef5Fa96D7032' as const;

// ====== Токены (Mantle Sepolia) ======

/** Wrapped MNT */
export const AGNI_WMNT = '0xEa12Be2389c2254bAaD383c6eD1fa1e15202b52A' as const;

/** USDC */
export const AGNI_USDC = '0x82a2eb46a64e4908bbc403854bc8aa699bf058e9' as const;

/** USDT */
export const AGNI_USDT = '0x3e163F861826C3f7878bD8fa8117A179d80731Ab' as const;

// ====== ABI ======

/** ISwapRouter ABI — только exactInputSingle (для swap) */
export const SWAP_ROUTER_ABI = [
  {
    type: 'function' as const,
    name: 'exactInputSingle',
    inputs: [
      {
        type: 'tuple',
        name: 'params',
        components: [
          { type: 'address', name: 'tokenIn' },
          { type: 'address', name: 'tokenOut' },
          { type: 'uint24', name: 'fee' },
          { type: 'address', name: 'recipient' },
          { type: 'uint256', name: 'deadline' },
          { type: 'uint256', name: 'amountIn' },
          { type: 'uint256', name: 'amountOutMinimum' },
          { type: 'uint160', name: 'sqrtPriceLimitX96' },
        ],
      },
    ],
    outputs: [{ type: 'uint256', name: 'amountOut' }],
    stateMutability: 'payable' as const,
  },
] as const;

/** IQuoterV2 ABI — только quoteExactInputSingle */
export const QUOTER_V2_ABI = [
  {
    type: 'function' as const,
    name: 'quoteExactInputSingle',
    inputs: [
      {
        type: 'tuple',
        name: 'params',
        components: [
          { type: 'address', name: 'tokenIn' },
          { type: 'address', name: 'tokenOut' },
          { type: 'uint256', name: 'amountIn' },
          { type: 'uint24', name: 'fee' },
          { type: 'uint160', name: 'sqrtPriceLimitX96' },
        ],
      },
    ],
    outputs: [
      { type: 'uint256', name: 'amountOut' },
      { type: 'uint160', name: 'sqrtPriceX96After' },
      { type: 'uint32', name: 'initializedTicksCrossed' },
      { type: 'uint256', name: 'gasEstimate' },
    ],
    stateMutability: 'nonpayable' as const,
  },
] as const;

/** ERC20 минимальный ABI — balanceOf, decimals, allowance */
export const ERC20_ABI = [
  {
    type: 'function' as const,
    name: 'balanceOf',
    inputs: [{ type: 'address', name: 'account' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'decimals',
    inputs: [],
    outputs: [{ type: 'uint8' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'allowance',
    inputs: [
      { type: 'address', name: 'owner' },
      { type: 'address', name: 'spender' },
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view' as const,
  },
] as const;

/** Fee tiers (Uniswap V3 стандарт, в сотых долях базисного пункта) */
export const FEE_TIERS = {
  /** 0.01% */
  LOWEST: 100,
  /** 0.05% */
  LOW: 500,
  /** 0.3% */
  MEDIUM: 3000,
  /** 1% */
  HIGH: 10000,
} as const;

/** Дефолтный fee tier */
export const DEFAULT_FEE_TIER = 3000;

// ====== MoleVault v2 (Session Keys, T-VAULT-02) ======

/** MoleVault deployed address (Mantle Sepolia, v2 with session keys) */
export const MOLE_VAULT_ADDRESS = '0x252F0d506Da5131Bdc469796b273c724AB8Bc6F7' as const;

/** MoleVault ABI — checkSession + executeSwap */
export const MOLEVAULT_ABI = [
  {
    type: 'function' as const,
    name: 'checkSession',
    inputs: [
      { type: 'uint256', name: 'tokenId' },
      { type: 'address', name: 'caller' },
    ],
    outputs: [
      { type: 'bool', name: 'active_' },
      { type: 'uint256', name: 'remaining' },
    ],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'executeSwap',
    inputs: [
      { type: 'uint256', name: 'tokenId' },
      { type: 'address', name: 'tokenIn' },
      { type: 'uint256', name: 'amountIn' },
      { type: 'bytes', name: 'swapData' },
    ],
    outputs: [],
    stateMutability: 'nonpayable' as const,
  },
  {
    type: 'function' as const,
    name: 'getVaultBalance',
    inputs: [
      { type: 'uint256', name: 'tokenId' },
      { type: 'address', name: 'token' },
    ],
    outputs: [{ type: 'uint256', name: '' }],
    stateMutability: 'view' as const,
  },
] as const;
