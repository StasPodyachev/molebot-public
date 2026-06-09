import { createPublicClient, createWalletClient, http, parseEther, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mantleSepoliaTestnet } from 'viem/chains';
import { readFileSync } from 'fs';

const PRIV_KEY = readFileSync('scripts/testnet-key.hex', 'utf-8').trim();
const account = privateKeyToAccount(PRIV_KEY);
const ADDR = account.address;
const publicClient = createPublicClient({ chain: mantleSepoliaTestnet, transport: http() });
const walletClient = createWalletClient({ account, chain: mantleSepoliaTestnet, transport: http() });

// Minimal ERC20 + deposit/withdraw ABI
const WMNT_ABI = [
  { type:'constructor', inputs:[], stateMutability:'nonpayable' },
  { type:'function', name:'deposit', inputs:[], outputs:[], stateMutability:'payable' },
  { type:'function', name:'withdraw', inputs:[{type:'uint256'}], outputs:[], stateMutability:'nonpayable' },
  { type:'function', name:'symbol', inputs:[], outputs:[{type:'string'}], stateMutability:'view' },
];

// Deploy bytecode for WrappedMNT — compile with solc or use standard ERC20
// This is the compiled bytecode of WrappedMNT.sol above (Solidity 0.8.20+)
// Using a CREATE2 deployment or just deploy via a standard pattern
console.log(`Deploying from: ${ADDR}`);
const bal = await publicClient.getBalance({ address: ADDR });
console.log(`Balance: ${formatEther(bal)} MNT`);

// Instead of raw bytecode deploy, write a simple deployer
// Use the contract we already have — Стас deploy через Remix
console.log(`\n📋 Deploy WrappedMNT.sol через Remix:
1. Открой Remix: https://remix.ethereum.org
2. Создай WrappedMNT.sol
3. Вставь код из contracts/WrappedMNT.sol
4. Compile 0.8.20+ → Deploy (Injected Provider)
5. После деплоя — пришли адрес
`);
