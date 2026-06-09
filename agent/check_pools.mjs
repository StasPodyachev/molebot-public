import { createPublicClient, http } from 'viem';
import { mantleSepoliaTestnet } from 'viem/chains';

const client = createPublicClient({
  chain: mantleSepoliaTestnet,
  transport: http('https://rpc.sepolia.mantle.xyz'),
});

// Agni Factory address (testnet)
const FACTORY = '0x503Ca2ad7C9C70F4157d14CF94D3ef5Fa96D7032';
const WMNT = '0xEa12Be2389c2254bAaD383c6eD1fa1e15202b52A';
const USDC = '0x82a2eb46a64e4908bbc403854bc8aa699bf058e9';
const USDT = '0x3e163F861826C3f7878bD8fa8117A179d80731Ab';

// Pool ABI just for getPool
const FACTORY_ABI = [
  {
    type: 'function',
    name: 'getPool',
    inputs: [
      { type: 'address', name: 'tokenA' },
      { type: 'address', name: 'tokenB' },
      { type: 'uint24', name: 'fee' },
    ],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'allPoolsLength',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'allPools',
    inputs: [{ type: 'uint256', name: '' }],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
];

const FEE_TIERS = [
  { name: '0.01%', fee: 100 },
  { name: '0.05%', fee: 500 },
  { name: '0.30%', fee: 3000 },
  { name: '1.00%', fee: 10000 },
];

async function main() {
  // Check total pools
  const poolCount = await client.readContract({
    address: FACTORY,
    abi: FACTORY_ABI,
    functionName: 'allPoolsLength',
  });
  console.log(`Total pools on Agni Mantle Sepolia: ${poolCount}`);

  // List all pools
  for (let i = 0; i < Number(poolCount); i++) {
    const poolAddr = await client.readContract({
      address: FACTORY,
      abi: FACTORY_ABI,
      functionName: 'allPools',
      args: [BigInt(i)],
    });
    console.log(`Pool #${i}: ${poolAddr}`);
  }

  // Check specific pairs
  const pairs = [
    ['WMNT/USDC', WMNT, USDC],
    ['WMNT/USDT', WMNT, USDT],
    ['WMNT/WETH', WMNT, '0xdEAddEaDdeadDEadDEADDEAddEADDEAddead1111'],
    ['USDC/USDT', USDC, USDT],
  ];

  console.log('\n--- Checking specific pairs ---');
  for (const [name, tokenA, tokenB] of pairs) {
    for (const { name: feeName, fee } of FEE_TIERS) {
      try {
        const pool = await client.readContract({
          address: FACTORY,
          abi: FACTORY_ABI,
          functionName: 'getPool',
          args: [tokenA, tokenB, fee],
        });
        if (pool !== '0x0000000000000000000000000000000000000000') {
          console.log(`✅ ${name} ${feeName}: ${pool}`);
        }
      } catch (e) {
        // skip
      }
    }
  }
  console.log('--- Done ---');
}

main().catch(console.error);
