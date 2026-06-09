import { createPublicClient, http, getAddress } from 'viem';
import { mantleSepoliaTestnet } from 'viem/chains';

const client = createPublicClient({
  chain: mantleSepoliaTestnet,
  transport: http('https://rpc.sepolia.mantle.xyz'),
});

const USDC = '0x82a2eb46a64e4908bbc403854bc8aa699bf058e9';

const ERC20_ABI = [
  { type: 'function', name: 'name', inputs: [], outputs: [{type:'string'}], stateMutability:'view' },
  { type: 'function', name: 'symbol', inputs: [], outputs: [{type:'string'}], stateMutability:'view' },
  { type: 'function', name: 'decimals', inputs: [], outputs: [{type:'uint8'}], stateMutability:'view' },
  { type: 'function', name: 'totalSupply', inputs: [], outputs: [{type:'uint256'}], stateMutability:'view' },
  { type: 'function', name: 'balanceOf', inputs: [{type:'address'}], outputs: [{type:'uint256'}], stateMutability:'view' },
  // Check if mintable
  { type: 'function', name: 'owner', inputs: [], outputs: [{type:'address'}], stateMutability:'view' },
  { type: 'function', name: 'minter', inputs: [], outputs: [{type:'address'}], stateMutability:'view' },
  // OpenZeppelin Ownable check
  { type: 'function', name: 'isMinter', inputs: [{type:'address'}], outputs: [{type:'bool'}], stateMutability:'view' },
];

try {
  const [name, symbol, decimals, totalSupply] = await Promise.all([
    client.readContract({ address: USDC, abi: ERC20_ABI, functionName: 'name' }),
    client.readContract({ address: USDC, abi: ERC20_ABI, functionName: 'symbol' }),
    client.readContract({ address: USDC, abi: ERC20_ABI, functionName: 'decimals' }),
    client.readContract({ address: USDC, abi: ERC20_ABI, functionName: 'totalSupply' }),
  ]);
  console.log(`Token: ${name} (${symbol})`);
  console.log(`Decimals: ${decimals}`);
  console.log(`Total Supply: ${totalSupply} (${Number(totalSupply) / 10**decimals} ${symbol})`);

  // Check owner
  try {
    const owner = await client.readContract({ address: USDC, abi: ERC20_ABI, functionName: 'owner' });
    console.log(`Owner: ${owner}`);
    if (owner === '0x0000000000000000000000000000000000000000') {
      console.log('❌ Owner is zero address — likely renounced or not Ownable');
    }
  } catch {
    console.log('ℹ️ No owner() function — not Ownable');
  }

  // Check minter
  try {
    const minter = await client.readContract({ address: USDC, abi: ERC20_ABI, functionName: 'minter' });
    console.log(`Minter: ${minter}`);
  } catch {
    console.log('ℹ️ No minter() function');
  }

  // Check if there's a write function that looks like mint
  // Try getting bytecode to check if it's a real contract
  const code = await client.getBytecode({ address: USDC });
  console.log(`Is contract: ${code && code !== '0x' ? '✅ YES' : '❌ NO'}`);

} catch (err) {
  console.error('Error:', err.message);
}
