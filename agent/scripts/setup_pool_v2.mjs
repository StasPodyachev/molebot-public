import { createPublicClient, createWalletClient, http, parseEther, formatEther, formatUnits, parseUnits, maxUint256 } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mantleSepoliaTestnet } from 'viem/chains';
import { readFileSync } from 'fs';

const keyPath = 'scripts/testnet-key.hex';
const rawKey = readFileSync(keyPath, 'utf-8').trim();
const k = rawKey.startsWith('0x') ? rawKey.slice(2) : rawKey;
const account = privateKeyToAccount('0x' + k);
const ADDR = account.address;
const publicClient = createPublicClient({ chain: mantleSepoliaTestnet, transport: http() });
const walletClient = createWalletClient({ account, chain: mantleSepoliaTestnet, transport: http() });

const MY_WMNT = '0xff365b905e5f3963ee917698849afe8fcd8a8872';  // my WrappedMNT
const MUSDC_TOKEN = '0x9754fD5256f2Bc15D0bc29367E2259Bb2F1431a2';
const POSITION_MANAGER = '0xb04a19EF7853c52EDe6FBb28F8FfBecb73329eD7';
const FACTORY = '0x503Ca2ad7C9C70F4157d14CF94D3ef5Fa96D7032';

const MY_WMNT_ABI = [
  { type:'function',name:'deposit',inputs:[],outputs:[],stateMutability:'payable' },
  { type:'function',name:'balanceOf',inputs:[{type:'address'}],outputs:[{type:'uint256'}],stateMutability:'view' },
  { type:'function',name:'approve',inputs:[{type:'address'},{type:'uint256'}],outputs:[{type:'bool'}],stateMutability:'nonpayable' },
  { type:'function',name:'symbol',inputs:[],outputs:[{type:'string'}],stateMutability:'view' },
];

const ERC20_ABI = [
  { type:'function',name:'balanceOf',inputs:[{type:'address'}],outputs:[{type:'uint256'}],stateMutability:'view' },
  { type:'function',name:'approve',inputs:[{type:'address'},{type:'uint256'}],outputs:[{type:'bool'}],stateMutability:'nonpayable' },
];

const POSITION_ABI = [{type:'function',name:'mint',inputs:[{type:'tuple',components:[
  {type:'address',name:'token0'},{type:'address',name:'token1'},{type:'uint24',name:'fee'},
  {type:'int24',name:'tickLower'},{type:'int24',name:'tickUpper'},
  {type:'uint256',name:'amount0Desired'},{type:'uint256',name:'amount1Desired'},
  {type:'uint256',name:'amount0Min'},{type:'uint256',name:'amount1Min'},
  {type:'address',name:'recipient'},{type:'uint256',name:'deadline'},
]}],outputs:[{type:'uint256'},{type:'uint128'},{type:'uint256'},{type:'uint256'}],stateMutability:'nonpayable'}];

async function main() {
  const bal = await publicClient.getBalance({address:ADDR});
  console.log('Balance:', formatEther(bal), 'MNT');

  // Step 1: Wrap 9.9 MNT → my WMNT
  console.log('\n1. Wrapping 9.9 MNT → myWMNT...');
  const wrapHash = await walletClient.writeContract({
    address: MY_WMNT, abi: MY_WMNT_ABI, functionName: 'deposit',
    value: parseEther('9.9'),
  });
  console.log(`   Tx: ${wrapHash}`);
  await publicClient.waitForTransactionReceipt({hash:wrapHash});
  const wmntBal = await publicClient.readContract({address:MY_WMNT,abi:MY_WMNT_ABI,functionName:'balanceOf',args:[ADDR]});
  console.log(`   myWMNT balance: ${formatEther(wmntBal)}`);

  // Step 2: Approve PositionManager on myWMNT
  console.log('\n2. Approve myWMNT for PositionManager...');
  const appHash = await walletClient.writeContract({
    address: MY_WMNT, abi: MY_WMNT_ABI, functionName: 'approve',
    args: [POSITION_MANAGER, maxUint256],
  });
  await publicClient.waitForTransactionReceipt({hash:appHash});
  console.log(`   Tx: ${appHash}`);

  // Step 3: Check mUSDC balance
  console.log('\n3. Checking mUSDC balance...');
  const musdc = await publicClient.readContract({address:MUSDC_TOKEN,abi:ERC20_ABI,functionName:'balanceOf',args:[ADDR]});
  console.log(`   my mUSDC: ${formatUnits(musdc, 6)}`);
  
  console.log('\n⚠️ НУЖНО mint mUSDC на мой адрес!');
  console.log(`   Адрес: ${ADDR}`);
  console.log(`   myWMNT: ${MY_WMNT}`);
  console.log('   Отправь через Remix:');
  console.log('   mint(' + ADDR + ', 5000000000)  # 5000 mUSDC');
  console.log('   Потом запусти create_pool.mjs');
}
main().catch(console.error);
