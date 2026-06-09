/**
 * deploy.ts — универсальный скрипт деплоя контрактов на Mantle.
 *
 * Использование:
 *   npx hardhat run scripts/deploy.ts --network mantle_sepolia
 *   npx hardhat run scripts/deploy.ts --network mantle_mainnet
 *
 * Переменные окружения (.env):
 *   DEPLOYER_PRIVATE_KEY  — приватный ключ деплоера
 *   AGENT_ADDRESS         — адрес агента для AICredits / MolebotNFT
 *   PLACEHOLDER_URI       — placeholder URI для MolebotNFT
 *   BASE_URI              — базовая URI для MolebotNFT (reveal)
 */

import hre from 'hardhat';

async function main() {
  const network = hre.network.name;
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);

  console.log('═══════════════════════════════════════');
  console.log('🚀 Molebot EVM — Deploy');
  console.log('═══════════════════════════════════════');
  console.log(`\n📡 Network:    ${network}`);
  console.log(`👤 Deployer:   ${deployer.address}`);
  console.log(`💰 Balance:    ${hre.ethers.formatEther(balance)} ETH\n`);

  // Проверка баланса
  const minBalance = hre.ethers.parseEther('0.001');
  if (balance < minBalance) {
    console.warn('⚠️  Low balance! May not be enough for deployment.');
    if (network !== 'hardhat') {
      console.error('❌ Insufficient funds. Aborting.');
      process.exit(1);
    }
  }

  // ─── AICredits ─────────────────────────────────────────────────────────

  const signers = await hre.ethers.getSigners();
  const agentAddress = process.env.AGENT_ADDRESS
    ?? (signers.length > 1 ? signers[1].address : signers[0].address);

  if (!process.env.AGENT_ADDRESS) {
    console.warn('⚠️  AGENT_ADDRESS not set. Using fallback: ' + agentAddress);
    console.warn('   Set AGENT_ADDRESS in .env for production deployments.');
  }

  console.log(`🤖 Agent address: ${agentAddress}\n`);

  const AICreditsFactory = await hre.ethers.getContractFactory('AICredits');
  const credits = await AICreditsFactory.deploy(agentAddress);
  await credits.waitForDeployment();
  const creditsAddr = await credits.getAddress();
  console.log(`✅ AICredits deployed to: ${creditsAddr}`);

  // ─── MolebotNFT ────────────────────────────────────────────────────────

  const placeholderURI = process.env.PLACEHOLDER_URI ?? 'ipfs://placeholder/';
  const nftFactory = await hre.ethers.getContractFactory('MolebotNFT');
  const nft = await nftFactory.deploy(placeholderURI, agentAddress, deployer.address);
  await nft.waitForDeployment();
  const nftAddr = await nft.getAddress();
  console.log(`✅ MolebotNFT deployed to: ${nftAddr}`);

  // ─── Вывод ─────────────────────────────────────────────────────────────

  console.log('\n═══════════════════════════════════════');
  console.log('📋 Summary');
  console.log('═══════════════════════════════════════');
  console.log(`  AICredits  → ${creditsAddr}`);
  console.log(`  MolebotNFT → ${nftAddr}`);
  console.log(`  Agent      → ${agentAddress}`);
  if (network !== 'hardhat') {
    console.log(`\n🔍 Explorer (AICredits):  https://explorer.sepolia.mantle.xyz/address/${creditsAddr}`);
    console.log(`🔍 Explorer (MolebotNFT): https://explorer.sepolia.mantle.xyz/address/${nftAddr}`);
  }
  console.log('═══════════════════════════════════════');
  console.log('✅ Done');
  console.log('═══════════════════════════════════════');
}

main().catch((error) => {
  console.error('\n❌ Deploy failed:', error);
  process.exitCode = 1;
});
