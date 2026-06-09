import { createPublicClient, createWalletClient, http, parseEther, formatEther, formatUnits, maxUint256 } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mantleSepoliaTestnet } from 'viem/chains';
import { readFileSync } from 'fs';

const rawKey = readFileSync('scripts/testnet-key.hex', 'utf-8').trim();
const k = rawKey.startsWith('0x') ? rawKey.slice(2) : rawKey;
const account = privateKeyToAccount('0x' + k);
const ADDR = account.address;
const publicClient = createPublicClient({ chain: mantleSepoliaTestnet, transport: http() });
const walletClient = createWalletClient({ account, chain: mantleSepoliaTestnet, transport: http() });

const MY_WMNT = '0x9cb3d81a8e8ec5b1b1f678a3497428566b5b4866';
const MUSDC = '0x9754fD5256f2Bc15D0bc29367E2259Bb2F1431a2';
const PM = '0xb04a19EF7853c52EDe6FBb28F8FfBecb73329eD7';
const FACTORY = '0x503Ca2ad7C9C70F4157d14CF94D3ef5Fa96D7032';

const ABI = {
  wmnt: [{type:'function',name:'deposit',inputs:[],outputs:[],stateMutability:'payable'},
    {type:'function',name:'balanceOf',inputs:[{type:'address'}],outputs:[{type:'uint256'}],stateMutability:'view'},
    {type:'function',name:'approve',inputs:[{type:'address'},{type:'uint256'}],outputs:[{type:'bool'}],stateMutability:'nonpayable'}],
  erc20: [{type:'function',name:'balanceOf',inputs:[{type:'address'}],outputs:[{type:'uint256'}],stateMutability:'view'},
    {type:'function',name:'approve',inputs:[{type:'address'},{type:'uint256'}],outputs:[{type:'bool'}],stateMutability:'nonpayable'}],
  pos: [{type:'function',name:'mint',inputs:[{type:'tuple',components:[
    {type:'address',name:'token0'},{type:'address',name:'token1'},{type:'uint24',name:'fee'},
    {type:'int24',name:'tickLower'},{type:'int24',name:'tickUpper'},
    {type:'uint256',name:'amount0Desired'},{type:'uint256',name:'amount1Desired'},
    {type:'uint256',name:'amount0Min'},{type:'uint256',name:'amount1Min'},
    {type:'address',name:'recipient'},{type:'uint256',name:'deadline'}]
  }],outputs:[{type:'uint256'},{type:'uint128'},{type:'uint256'},{type:'uint256'}],stateMutability:'nonpayable'}],
  factory: [{type:'function',name:'getPool',inputs:[{type:'address'},{type:'address'},{type:'uint24'}],outputs:[{type:'address'}],stateMutability:'view'}],
};

async function main() {
  // Step 1: Wrap 10 MNT
  console.log('1. Wrapping 10 MNT → WMNT...');
  const h1 = await walletClient.writeContract({address:MY_WMNT,abi:ABI.wmnt,functionName:'deposit',value:parseEther('10')});
  await publicClient.waitForTransactionReceipt({hash:h1});
  const wmnt = await publicClient.readContract({address:MY_WMNT,abi:ABI.wmnt,functionName:'balanceOf',args:[ADDR]});
  console.log(`   WMNT: ${formatEther(wmnt)}`);

  // Step 2: Approve WMNT
  console.log('2. Approving WMNT...');
  const h2 = await walletClient.writeContract({address:MY_WMNT,abi:ABI.wmnt,functionName:'approve',args:[PM,maxUint256]});
  await publicClient.waitForTransactionReceipt({hash:h2});
  console.log(`   Done`);

  // Step 3: Approve mUSDC
  console.log('3. Approving mUSDC...');
  const h3 = await walletClient.writeContract({address:MUSDC,abi:ABI.erc20,functionName:'approve',args:[PM,maxUint256]});
  await publicClient.waitForTransactionReceipt({hash:h3});
  console.log(`   Done`);

  // Step 4: Create pool + add liquidity
  // mUSDC (0x9754...) < MY_WMNT (0x9cb3...) lexicographically, so mUSDC = token0
  console.log('4. Creating pool + adding liquidity (5000 mUSDC : 10 WMNT)...');
  const deadline = BigInt(Math.floor(Date.now()/1000) + 3600);
  const h4 = await walletClient.writeContract({address:PM,abi:ABI.pos,functionName:'mint',args:[{
    token0: MUSDC, token1: MY_WMNT, fee: 3000,
    tickLower: -887220, tickUpper: 887220,
    amount0Desired: 5000000000n,  // 5000 mUSDC
    amount1Desired: parseEther('10'),  // 10 WMNT
    amount0Min: 0n, amount1Min: 0n,
    recipient: ADDR, deadline,
  }],gas:2000000n});
  const r4 = await publicClient.waitForTransactionReceipt({hash:h4});
  console.log(`   Status: ${r4.status}`);
  console.log(`   Tx: ${h4}`);

  // Verify pool
  const pool = await publicClient.readContract({address:FACTORY,abi:ABI.factory,functionName:'getPool',args:[MUSDC,MY_WMNT,3000]});
  console.log(`\n🔍 Pool address: ${pool}`);

  // Test Quoter
  console.log('\n📊 Testing price feed...');
  const QUOTER = '0x49C8bb51C6bb791e8D6C31310cE0C14f68492991';
  const QA = [{type:'function',name:'quoteExactInputSingle',inputs:[{type:'tuple',components:[
    {type:'address',name:'tokenIn'},{type:'address',name:'tokenOut'},
    {type:'uint256',name:'amountIn'},{type:'uint24',name:'fee'},
    {type:'uint160',name:'sqrtPriceLimitX96'}],name:'params'}],
    outputs:[{type:'uint256'},{type:'uint160'},{type:'uint32'},{type:'uint256'}],stateMutability:'nonpayable'}];
  try {
    const [ao] = await publicClient.readContract({address:QUOTER,abi:QA,functionName:'quoteExactInputSingle',
      args:[{tokenIn:MY_WMNT,tokenOut:MUSDC,amountIn:parseEther('1'),fee:3000,sqrtPriceLimitX96:0n}]});
    console.log(`   1 WMNT → ${formatUnits(ao, 6)} mUSDC`);
  } catch(e) { console.log(`   Quoter: ${e.message.slice(0,80)}`); }
}
main().catch(console.error);
