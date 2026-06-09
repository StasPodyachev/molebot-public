import { createPublicClient, http, parseEther } from 'viem';
import { mantleSepoliaTestnet } from 'viem/chains';
const client = createPublicClient({ chain: mantleSepoliaTestnet, transport: http() });
const WMNT = '0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000';

// Try to estimate gas for deposit
try {
  const gas = await client.estimateGas({
    to: WMNT,
    data: '0xd0e30db0',  // deposit()
    value: parseEther('1'),
    account: '0x3d4434499E36ecC6676AFc32400E673224c40909',
  });
  console.log(`✅ deposit() gas estimate: ${gas}`);
} catch(e) {
  console.log(`❌ deposit() revert: ${e.shortMessage || e.message}`);
  if (e.metaMessages) console.log(e.metaMessages.join('\n'));
}

// Try calling the canonical Mantle bridging contract
// On Mantle, the WMNT might be done via L1StandardBridge or similar
// Let's check the Mantle L2 precompiles
const precompiles = [
  ['0x4200000000000000000000000000000000000010', 'L2StandardBridge'],
  ['0x420000000000000000000000000000000000000a', 'OVM_L2ToL1MessagePasser'],
  ['0x4200000000000000000000000000000000000011', 'L2ERC721Bridge'],
];
for (const [addr, name] of precompiles) {
  const code = await client.getBytecode({ address: addr });
  const exists = code !== undefined && code !== '0x' && code !== null;
  console.log(`${exists ? 'CONTRACT' : 'NO CODE'} ${name} ${addr}`);
  if (exists) {
    // Check if it's a proxy
    try {
      const name2 = await client.readContract({
        address: addr,
        abi: [{type:'function',name:'l2TokenBridge',inputs:[],outputs:[{type:'address'}],stateMutability:'view'}],
        functionName: 'l2TokenBridge',
      });
      console.log(`  l2TokenBridge: ${name2}`);
    } catch {}
  }
}
