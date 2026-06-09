import { createPublicClient, http } from 'viem';
import { mantleSepoliaTestnet } from 'viem/chains';

const client = createPublicClient({
  chain: mantleSepoliaTestnet,
  transport: http('https://rpc.sepolia.mantle.xyz'),
});

const FACTORY = '0x503Ca2ad7C9C70F4157d14CF94D3ef5Fa96D7032';
const PAIRS = {
  'WMNT/USDC': { a: '0xEa12Be2389c2254bAaD383c6eD1fa1e15202b52A', b: '0x82a2eb46a64e4908bbc403854bc8aa699bf058e9' },
  'WMNT/USDT': { a: '0xEa12Be2389c2254bAaD383c6eD1fa1e15202b52A', b: '0x3e163F861826C3f7878bD8fa8117A179d80731Ab' },
  'WMNT/ETH':  { a: '0xEa12Be2389c2254bAaD383c6eD1fa1e15202b52A', b: '0xdEAddEaDdeadDEadDEADDEAddEADDEAddead1111' },
  'USDC/USDT': { a: '0x82a2eb46a64e4908bbc403854bc8aa699bf058e9', b: '0x3e163F861826C3f7878bD8fa8117A179d80731Ab' },
};
const FEES = [100, 500, 3000, 10000];
const FEE_NAMES = {100:'0.01%', 500:'0.05%', 3000:'0.30%', 10000:'1%'};

const ABI = [{
  type: 'function', name: 'getPool',
  inputs: [{type:'address'},{type:'address'},{type:'uint24'}],
  outputs: [{type:'address'}], stateMutability:'view'
}];

for (const [name, tokens] of Object.entries(PAIRS)) {
  for (const fee of FEES) {
    try {
      const pool = await client.readContract({ address: FACTORY, abi: ABI, functionName: 'getPool', args: [tokens.a, tokens.b, fee] });
      if (pool !== '0x0000000000000000000000000000000000000000') {
        console.log(`✅ ${name} @ ${FEE_NAMES[fee]} | Pool: ${pool}`);
      }
    } catch {}
  }
}
console.log('Scan complete. No pools found = no existing liquidity.');
