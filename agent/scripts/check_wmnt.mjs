import { createPublicClient, http } from 'viem';
import { mantleSepoliaTestnet } from 'viem/chains';
const client = createPublicClient({ chain: mantleSepoliaTestnet, transport: http() });
const addrs = [
  ['Dead...0000', '0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000'],
  ['Ea12...52A', '0xEa12Be2389c2254bAaD383c6eD1fa1e15202b52A'],
  ['Dead...1111', '0xdEAddEaDdeadDEadDEADDEAddEADDEAddead1111'],
];
for (const [name, addr] of addrs) {
  const code = await client.getBytecode({ address: addr });
  const exists = code !== undefined && code !== '0x' && code !== null;
  console.log(`${exists ? 'CONTRACT' : 'NO CODE'} ${name} ${addr}`);
  if (exists) {
    try {
      const sym = await client.readContract({ address: addr, abi: [{type:'function',name:'symbol',inputs:[],outputs:[{type:'string'}],stateMutability:'view'}], functionName: 'symbol' });
      console.log(`  symbol: ${sym}`);
    } catch(e) { console.log(`  no symbol(): ${e.message.slice(0,80)}`); }
  }
}
