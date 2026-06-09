import { createPublicClient, http } from 'viem';
import { mantleSepoliaTestnet } from 'viem/chains';

const client = createPublicClient({
  chain: mantleSepoliaTestnet,
  transport: http('https://rpc.sepolia.mantle.xyz'),
});

const tokens = [
  ['USDC agni-sdk', '0x82a2eb46a64e4908bbc403854bc8aa699bf058e9'],
  ['USDT agni-sdk', '0x3e163F861826C3f7878bD8fa8117A179d80731Ab'],
  ['WMNT agni-sdk', '0xEa12Be2389c2254bAaD383c6eD1fa1e15202b52A'],
  ['MolebotNFT', '0xFA9071C5c87c5B940Bf83B030fE52f3500559aCb'],
  ['AICredits', '0x15Fa9046d2db9E38308Ed9bbA8F8e872beBF6B64'],
  ['MoleVault', '0x252F0d506Da5131Bdc469796b273c724AB8Bc6F7'],
];

for (const [name, addr] of tokens) {
  const code = await client.getBytecode({ address: addr });
  const exists = code !== undefined && code !== '0x' && code !== null;
  const bytes = code ? (code.length / 2 - 1) : 0;
  if (exists) {
    console.log(`> ${name}: ${addr} — CONTRACT (${bytes} bytes)`);
  } else {
    console.log(`> ${name}: ${addr} — NO CODE`);
  }
}
