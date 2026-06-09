import { expect } from 'chai';
import { ethers } from 'hardhat';
import { MolebotNFT } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('MolebotNFT', function () {
  let contract: MolebotNFT;
  let owner: SignerWithAddress;
  let agent: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  const PLACEHOLDER = 'ipfs://placeholder/';
  const BASE_URI = 'ipfs://bafybeigwkc4pzfugfpcjdv2stsgc7qq7hsnxa3czci6nncpebqvioryyoq/';

  beforeEach(async function () {
    [owner, agent, user1, user2] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory('MolebotNFT');
    // MolebotNFT constructor: (string _placeholderURI, address _agentAddress)
    contract = await Factory.deploy(PLACEHOLDER, agent.address);
    await contract.waitForDeployment();
  });

  /* ────────────── Constructor ────────────── */

  describe('Deployment', function () {
    it('should set correct name and symbol', async function () {
      expect(await contract.name()).to.equal('Molebot');
      expect(await contract.symbol()).to.equal('MOLE');
    });

    it('should set placeholder URI', async function () {
      expect(await contract.placeholderURI()).to.equal(PLACEHOLDER);
    });

    it('should set agent address', async function () {
      expect(await contract.agentAddress()).to.equal(agent.address);
    });

    it('should set owner', async function () {
      expect(await contract.owner()).to.equal(owner.address);
    });

    it('should not be revealed initially', async function () {
      expect(await contract.revealed()).to.equal(false);
    });

    it('should have correct constants', async function () {
      expect(await contract.MAX_SUPPLY()).to.equal(100);
      expect(await contract.MINT_PRICE()).to.equal(ethers.parseEther('0.05'));
    });
  });

  /* ────────────── Mint ────────────── */

  describe('Minting', function () {
    it('should mint with correct payment', async function () {
      await contract.connect(user1).mint({ value: ethers.parseEther('0.05') });
      expect(await contract.totalSupply()).to.equal(1);
      expect(await contract.ownerOf(1)).to.equal(user1.address);
      expect(await contract.hasMinted(user1.address)).to.equal(true);
    });

    it('should reject mint with insufficient payment', async function () {
      await expect(
        contract.connect(user1).mint({ value: ethers.parseEther('0.01') })
      ).to.be.revertedWith('insufficient payment');
    });

    it('should reject double mint (1 per wallet)', async function () {
      await contract.connect(user1).mint({ value: ethers.parseEther('0.05') });
      await expect(
        contract.connect(user1).mint({ value: ethers.parseEther('0.05') })
      ).to.be.revertedWith('already minted');
    });

    it('should store MoleData after mint', async function () {
      await contract.connect(user1).mint({ value: ethers.parseEther('0.05') });
      const data = await contract.moles(1);
      expect(data.mood).to.equal(1); // neutral
      expect(data.levelIndex).to.equal(0); // Slumbering Mole
      expect(data.cumulativePnl).to.equal(0);
    });
  });

  /* ────────────── Mood ────────────── */

  describe('Mood updates', function () {
    beforeEach(async function () {
      await contract.connect(user1).mint({ value: ethers.parseEther('0.05') });
    });

    it('should update mood (agent only)', async function () {
      await contract.connect(agent).updateMood(1, 2); // happy
      const data = await contract.moles(1);
      expect(data.mood).to.equal(2);
    });

    it('should reject mood update from non-agent', async function () {
      await expect(
        contract.connect(user1).updateMood(1, 2)
      ).to.be.revertedWith('not agent');
    });

    it('should reject invalid mood value', async function () {
      await expect(
        contract.connect(agent).updateMood(1, 5)
      ).to.be.revertedWith('invalid mood');
    });

    it('should emit MoodUpdated event', async function () {
      await expect(contract.connect(agent).updateMood(1, 2))
        .to.emit(contract, 'MoodUpdated')
        .withArgs(1, 2);
    });
  });

  /* ────────────── Level Up ────────────── */

  describe('Level up', function () {
    beforeEach(async function () {
      await contract.connect(user1).mint({ value: ethers.parseEther('0.05') });
    });

    it('should start at level 0 (Slumbering Mole)', async function () {
      const data = await contract.moles(1);
      expect(data.levelIndex).to.equal(0);
    });

    it('should level up with sufficient PnL', async function () {
      await contract.connect(agent).checkLevelUp(1, 200);
      const data = await contract.moles(1);
      expect(data.levelIndex).to.equal(2);
    });

    it('should not level up with insufficient PnL', async function () {
      await contract.connect(agent).checkLevelUp(1, 50);
      const data = await contract.moles(1);
      expect(data.levelIndex).to.equal(0);
    });

    it('should emit LevelUp event', async function () {
      await expect(contract.connect(agent).checkLevelUp(1, 200))
        .to.emit(contract, 'LevelUp')
        .withArgs(1, 2);
    });
  });

  /* ────────────── Token URI ────────────── */

  describe('Token URI', function () {
    beforeEach(async function () {
      await contract.connect(user1).mint({ value: ethers.parseEther('0.05') });
    });

    it('should return placeholder before reveal', async function () {
      const uri = await contract.tokenURI(1);
      expect(uri).to.equal(PLACEHOLDER);
    });

    it('should return real URI after reveal', async function () {
      await contract.connect(owner).reveal(BASE_URI);
      const uri = await contract.tokenURI(1);
      expect(uri).to.equal(`${BASE_URI}1.json`);
    });
  });

  /* ────────────── Owner ────────────── */

  describe('Owner functions', function () {
    it('should allow owner to withdraw', async function () {
      await contract.connect(user1).mint({ value: ethers.parseEther('0.05') });
      const balanceBefore = await ethers.provider.getBalance(owner.address);
      await contract.connect(owner).withdraw();
      const balanceAfter = await ethers.provider.getBalance(owner.address);
      expect(balanceAfter - balanceBefore).to.be.closeTo(
        ethers.parseEther('0.05'),
        ethers.parseEther('0.005')
      );
    });

    it('should allow owner to set agent', async function () {
      await contract.connect(owner).setAgent(user1.address);
      expect(await contract.agentAddress()).to.equal(user1.address);
    });
  });
});
