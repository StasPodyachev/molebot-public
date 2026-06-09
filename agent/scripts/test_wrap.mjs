import { createPublicClient, http, parseEther } from 'viem';
import { mantleSepoliaTestnet } from 'viem/chains';
const client = createPublicClient({ chain: mantleSepoliaTestnet, transport: http() });

const WMNT = '0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000';

// Check several known interfaces
const checks = [
  ['ERC20 totalSupply', [{type:'function',name:'totalSupply',inputs:[],outputs:[{type:'uint256'}],stateMutability:'view'}], 'totalSupply'],
  ['balanceOf(0xDead..0000)', [{type:'function',name:'balanceOf',inputs:[{type:'address'}],outputs:[{type:'uint256'}],stateMutability:'view'}], 'balanceOf', '0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000'],
  ['name', [{type:'function',name:'name',inputs:[],outputs:[{type:'string'}],stateMutability:'view'}], 'name'],
  ['decimals', [{type:'function',name:'decimals',inputs:[],outputs:[{type:'uint8'}],stateMutability:'view'}], 'decimals'],
];
for (const [label, abi, fn, ...args] of checks) {
  try {
    const res = await client.readContract({ address: WMNT, abi, functionName: fn, args });
    console.log(`✅ ${label}: ${res}`);
  } catch(e) {
    console.log(`❌ ${label}: ${e.message.slice(0,60)}`);
  }
}
