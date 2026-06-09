import { createPublicClient, createWalletClient, http, parseEther, parseUnits, formatEther, formatUnits, maxUint256 } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mantleSepoliaTestnet } from 'viem/chains';
import { readFileSync } from 'fs';

// ── Config ──
const PRIV_KEY = readFileSync('scripts/testnet-key.hex', 'utf-8').trim();
const TOKEN = '0x9754fD5256f2Bc15D0bc29367E2259Bb2F1431a2'; // mUSDC
const WMNT = '0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000';
const POSITION_MANAGER = '0xb04a19EF7853c52EDe6FBb28F8FfBecb73329eD7';
const FACTORY = '0x503Ca2ad7C9C70F4157d14CF94D3ef5Fa96D7032';

const account = privateKeyToAccount(PRIV_KEY);
const ADDR = account.address;

const publicClient = createPublicClient({ chain: mantleSepoliaTestnet, transport: http() });
const walletClient = createWalletClient({ account, chain: mantleSepoliaTestnet, transport: http() });

// ── ABIs ──
const WMNT_ABI = [
  { constant: false, inputs: [], name: 'deposit', outputs: [], payable: true, stateMutability: 'payable', type: 'function' },
  { constant: false, inputs: [{name:'spender',type:'address'},{name:'amount',type:'uint256'}], name: 'approve', outputs: [{type:'bool'}], payable: false, stateMutability: 'nonpayable', type: 'function' },
  { constant: true, inputs: [{name:'account',type:'address'}], name: 'balanceOf', outputs: [{type:'uint256'}], payable: false, stateMutability: 'view', type: 'function' },
];

const ERC20_ABI = [
  { inputs: [{name:'spender',type:'address'},{name:'amount',type:'uint256'}], name: 'approve', outputs: [{type:'bool'}], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{name:'to',type:'address'},{name:'amount',type:'uint256'}], name: 'mint', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{name:'account',type:'address'}], name: 'balanceOf', outputs: [{type:'uint256'}], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'decimals', outputs: [{type:'uint8'}], stateMutability: 'view', type: 'function' },
];

const POSITION_ABI = [
  { inputs: [{ components: [
    { name: 'token0', type: 'address' },
    { name: 'token1', type: 'address' },
    { name: 'fee', type: 'uint24' },
    { name: 'tickLower', type: 'int24' },
    { name: 'tickUpper', type: 'int24' },
    { name: 'amount0Desired', type: 'uint256' },
    { name: 'amount1Desired', type: 'uint256' },
    { name: 'amount0Min', type: 'uint256' },
    { name: 'amount1Min', type: 'uint256' },
    { name: 'recipient', type: 'address' },
    { name: 'deadline', type: 'uint256' },
  ], name: 'params', type: 'tuple' }], name: 'mint', outputs: [{name:'tokenId',type:'uint256'},{name:'liquidity',type:'uint128'},{name:'amount0',type:'uint256'},{name:'amount1',type:'uint256'}], stateMutability: 'nonpayable', type: 'function' },
];

const FACTORY_ABI = [
  { inputs: [{name:'tokenA',type:'address'},{name:'tokenB',type:'address'},{name:'fee',type:'uint24'}], name: 'getPool', outputs: [{type:'address'}], stateMutability: 'view', type: 'function' },
];

async function main() {
  // Check balance
  const balance = await publicClient.getBalance({ address: ADDR });
  const balEth = formatEther(balance);
  console.log(`\n💰 Balance: ${balEth} MNT`);
  console.log(`📬 Address: ${ADDR}`);

  if (balance < parseEther('9')) {
    console.error('❌ Need at least 9 MNT. Got', balEth);
    return;
  }

  // Step 2: Wrap 10 MNT → WMNT
  console.log('\n📦 Step 2: Wrapping 10 MNT → WMNT...');
  const wrapHash = await walletClient.writeContract({
    address: WMNT, abi: WMNT_ABI, functionName: 'deposit',
    value: parseEther("9.9"),
  });
  console.log(`   Tx: ${wrapHash}`);
  await publicClient.waitForTransactionReceipt({ hash: wrapHash });

  const wmntBalance = await publicClient.readContract({ address: WMNT, abi: WMNT_ABI, functionName: 'balanceOf', args: [ADDR] });
  console.log(`   WMNT balance: ${formatEther(wmntBalance)} WMNT`);

  // Step 3: Mint 200 mUSDC (enough for 10 WMNT * ~0.35 * 50 = small pool)
  // We want ~10 WMNT worth of mUSDC at roughly 1 MNT = 0.35 USDC
  // So 10 WMNT ≈ 3.5 mUSDC. Let's mint 50 mUSDC to have some room
  const MINT_AMOUNT = parseUnits('50', 6);
  console.log(`\n💎 Step 3: Minting 50 mUSDC...`);
  const mintHash = await walletClient.writeContract({
    address: TOKEN, abi: ERC20_ABI, functionName: 'mint', args: [ADDR, MINT_AMOUNT],
  });
  console.log(`   Tx: ${mintHash}`);
  await publicClient.waitForTransactionReceipt({ hash: mintHash });

  const musdcBalance = await publicClient.readContract({ address: TOKEN, abi: ERC20_ABI, functionName: 'balanceOf', args: [ADDR] });
  console.log(`   mUSDC balance: ${formatUnits(musdcBalance, 6)}`);

  // Step 4: Approve PositionManager for both tokens
  console.log(`\n✅ Step 4: Approving PositionManager...`);

  const approveWMNT = await walletClient.writeContract({
    address: WMNT, abi: WMNT_ABI, functionName: 'approve',
    args: [POSITION_MANAGER, maxUint256],
  });
  console.log(`   WMNT approve: ${approveWMNT}`);
  await publicClient.waitForTransactionReceipt({ hash: approveWMNT });

  const approveToken = await walletClient.writeContract({
    address: TOKEN, abi: ERC20_ABI, functionName: 'approve',
    args: [POSITION_MANAGER, maxUint256],
  });
  console.log(`   mUSDC approve: ${approveToken}`);
  await publicClient.waitForTransactionReceipt({ hash: approveToken });

  // Step 5: Create pool + add liquidity
  // mUSDC (0x9754...) < WMNT (0xDead...) lexicographically, so mUSDC = token0
  console.log(`\n🔄 Step 5: Creating pool + adding liquidity...`);

  const amount0Desired = MINT_AMOUNT;  // 50 mUSDC
  const amount1Desired = wmntBalance;   // all 10 WMNT

  const mintResult = await walletClient.writeContract({
    address: POSITION_MANAGER,
    abi: POSITION_ABI,
    functionName: 'mint',
    args: [{
      token0: TOKEN,       // mUSDC (lexicographically smaller)
      token1: WMNT,        // WMNT
      fee: 3000,
      tickLower: -887220,
      tickUpper: 887220,
      amount0Desired,
      amount1Desired,
      amount0Min: 0n,
      amount1Min: 0n,
      recipient: ADDR,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
    }],
  });
  console.log(`   Pool create + liquidity tx: ${mintResult}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: mintResult });
  console.log(`   ✅ DONE! Block: ${receipt.blockNumber}`);

  // Verify pool
  const poolAddr = await publicClient.readContract({
    address: FACTORY, abi: FACTORY_ABI, functionName: 'getPool',
    args: [TOKEN, WMNT, 3000],
  });
  console.log(`\n🔍 Pool address: ${poolAddr}`);

  // Try Quoter
  console.log('\n📊 Testing PriceFeed...');
  try {
    const { createPublicClient: c2, http: h2 } = await import('viem');
    const qClient = c2({ chain: mantleSepoliaTestnet, transport: h2() });
    const QUOTER = '0x49C8bb51C6bb791e8D6C31310cE0C14f68492991';
    const QUOTER_ABI = [{ type: 'function', name: 'quoteExactInputSingle', inputs: [{ type: 'tuple', components: [
      {type:'address',name:'tokenIn'},{type:'address',name:'tokenOut'},{type:'uint256',name:'amountIn'},{type:'uint24',name:'fee'},{type:'uint160',name:'sqrtPriceLimitX96'}
    ], name: 'params' }], outputs: [{type:'uint256'},{type:'uint160'},{type:'uint32'},{type:'uint256'}], stateMutability: 'nonpayable' }];
    const [amountOut] = await qClient.readContract({
      address: QUOTER, abi: QUOTER_ABI, functionName: 'quoteExactInputSingle',
      args: [{ tokenIn: WMNT, tokenOut: TOKEN, amountIn: parseEther('1'), fee: 3000, sqrtPriceLimitX96: 0n }],
    });
    console.log(`   1 WMNT → ${formatUnits(amountOut, 6)} mUSDC (price feed working!)`);
  } catch (e) {
    console.log(`   Quoter test: ${e.message?.slice(0, 80)}...`);
    console.log('   (may need a moment for the pool to propagate)');
  }
}

main().catch(console.error);
