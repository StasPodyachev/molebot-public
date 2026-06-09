import { createPublicClient, http } from 'viem';
import { mantleSepoliaTestnet } from 'viem/chains';
(async()=>{
const c = createPublicClient({chain:mantleSepoliaTestnet,transport:http()});

// Merchant Moe mainnet addresses — check if deployed on testnet too
const addrs = [
  ['MoeFactory', '0x5bef015ca9424a7c07b68490616a4c1f094bedec'],
  ['MoeRouter', '0xeaEE7EE68874218c3558b40063c42B82D3E7232a'],
  ['LB Factory', '0xa6630671775c4EA2743840F9A5016dCf2A104054'],
  ['LB Router', '0x013e138EF6008ae5FDFDE29700e3f2Bc61d21E3a'],
  ['LB Quoter', '0x501b8AFd35df20f531fF45F6f695793AC3316c85'],
  ['Agni Factory', '0x503Ca2ad7C9C70F4157d14CF94D3ef5Fa96D7032'],
  ['Agni QuoterV2', '0x49C8bb51C6bb791e8D6C31310cE0C14f68492991'],
  ['Agni PositionMgr', '0xb04a19EF7853c52EDe6FBb28F8FfBecb73329eD7'],
  ['Agni SwapRouter', '0xe2DB835566F8677d6889ffFC4F3304e8Df5Fc1df'],
  ['Pyth Oracle', '0x98046Bd286715D3B0BC227Dd7a956b83D8978603'],
];

for (const [name, addr] of addrs) {
  const code = await c.getBytecode({ address: addr });
  const exists = code !== undefined && code !== '0x' && code !== null;
  const bytes = exists ? (code.length / 2 - 1) : 0;
  console.log(`${exists ? '✅' : '❌'} ${name}: ${addr.slice(0,10)}... ${bytes > 0 ? bytes + ' bytes' : '—'}`);
}

// Also try Uniswap V3 on Mantle Sepolia
const uniAddrs = [
  ['UniV3 Factory', '0x0227628f3F023bb0B980b67D528571c95c6DaC1c'],
  ['UniV3 QuoterV2', '0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3'],
  ['UniV3 Router', '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E'],
];
for (const [name, addr] of uniAddrs) {
  const code = await c.getBytecode({ address: addr });
  const exists = code !== undefined && code !== '0x' && code !== null;
  console.log(`${exists ? '✅' : '❌'} ${name}: ${addr.slice(0,10)}... ${exists ? 'CONTRACT' : '—'}`);
}
})()
