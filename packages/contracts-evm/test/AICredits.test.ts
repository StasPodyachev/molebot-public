import { expect } from 'chai';
import { ethers } from 'hardhat';
import { AICredits } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('AICredits', function () {
  let contract: AICredits;
  let owner: SignerWithAddress;
  let agent: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let stranger: SignerWithAddress;

  beforeEach(async function () {
    [owner, agent, user1, user2, stranger] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory('AICredits');
    contract = await Factory.deploy(agent.address);
    await contract.waitForDeployment();
  });

  /* ────────────── Constructor ────────────── */

  describe('Deployment', function () {
    it('should set agent address from constructor', async function () {
      expect(await contract.agentAddress()).to.equal(agent.address);
    });

    it('should set deployer as owner', async function () {
      expect(await contract.owner()).to.equal(owner.address);
    });

    it('should reject zero agent address', async function () {
      const Factory = await ethers.getContractFactory('AICredits');
      await expect(
        Factory.deploy(ethers.ZeroAddress)
      ).to.be.revertedWith('AICredits: zero agent address');
    });
  });

  /* ────────────── balanceOf ────────────── */

  describe('balanceOf', function () {
    it('should return 0 for new accounts', async function () {
      expect(await contract.balanceOf(user1.address)).to.equal(0);
    });
  });

  /* ────────────── mintCredits (onlyOwner) ────────────── */

  describe('mintCredits', function () {
    it('should mint credits to user', async function () {
      await contract.connect(owner).mintCredits(user1.address, 100);
      expect(await contract.balanceOf(user1.address)).to.equal(100);
    });

    it('should accumulate credits on multiple mints', async function () {
      await contract.connect(owner).mintCredits(user1.address, 50);
      await contract.connect(owner).mintCredits(user1.address, 30);
      expect(await contract.balanceOf(user1.address)).to.equal(80);
    });

    it('should reject mint from non-owner', async function () {
      await expect(
        contract.connect(user1).mintCredits(user2.address, 100)
      ).to.be.revertedWithCustomError(
        contract,
        'OwnableUnauthorizedAccount'
      ).withArgs(user1.address);
    });

    it('should reject mint to zero address', async function () {
      await expect(
        contract.connect(owner).mintCredits(ethers.ZeroAddress, 100)
      ).to.be.revertedWith('AICredits: mint to zero address');
    });

    it('should emit CreditsMinted event', async function () {
      await expect(contract.connect(owner).mintCredits(user1.address, 100))
        .to.emit(contract, 'CreditsMinted')
        .withArgs(user1.address, 100);
    });
  });

  /* ────────────── spendCredits (onlyAgent) ────────────── */

  describe('spendCredits', function () {
    beforeEach(async function () {
      // Mint 100 credits to user1 before each spend test
      await contract.connect(owner).mintCredits(user1.address, 100);
    });

    it('should spend credits from user', async function () {
      await contract.connect(agent).spendCredits(user1.address, 30);
      expect(await contract.balanceOf(user1.address)).to.equal(70);
    });

    it('should spend exact balance', async function () {
      await contract.connect(agent).spendCredits(user1.address, 100);
      expect(await contract.balanceOf(user1.address)).to.equal(0);
    });

    it('should reject spend from non-agent', async function () {
      await expect(
        contract.connect(user1).spendCredits(user1.address, 10)
      ).to.be.revertedWith('AICredits: not agent');
    });

    it('should reject spend from stranger (non-owner, non-agent)', async function () {
      await expect(
        contract.connect(stranger).spendCredits(user1.address, 10)
      ).to.be.revertedWith('AICredits: not agent');
    });

    it('should reject spend exceeding balance', async function () {
      await expect(
        contract.connect(agent).spendCredits(user1.address, 101)
      ).to.be.revertedWith('AICredits: insufficient credits');
    });

    it('should reject spend from account with 0 balance', async function () {
      await expect(
        contract.connect(agent).spendCredits(user2.address, 1)
      ).to.be.revertedWith('AICredits: insufficient credits');
    });

    it('should allow multiple spends from same user', async function () {
      await contract.connect(agent).spendCredits(user1.address, 20);
      await contract.connect(agent).spendCredits(user1.address, 30);
      expect(await contract.balanceOf(user1.address)).to.equal(50);
    });

    it('should emit CreditsSpent event', async function () {
      await expect(contract.connect(agent).spendCredits(user1.address, 30))
        .to.emit(contract, 'CreditsSpent')
        .withArgs(user1.address, 30);
    });
  });

  /* ────────────── setAgent (onlyOwner) ────────────── */

  describe('setAgent', function () {
    it('should update agent address', async function () {
      await contract.connect(owner).setAgent(user1.address);
      expect(await contract.agentAddress()).to.equal(user1.address);
    });

    it('should allow new agent to spend credits after change', async function () {
      await contract.connect(owner).setAgent(user1.address);
      await contract.connect(owner).mintCredits(user2.address, 50);
      await contract.connect(user1).spendCredits(user2.address, 50);
      expect(await contract.balanceOf(user2.address)).to.equal(0);
    });

    it('should reject setAgent from non-owner', async function () {
      await expect(
        contract.connect(agent).setAgent(user1.address)
      ).to.be.revertedWithCustomError(
        contract,
        'OwnableUnauthorizedAccount'
      ).withArgs(agent.address);
    });

    it('should reject zero address as new agent', async function () {
      await expect(
        contract.connect(owner).setAgent(ethers.ZeroAddress)
      ).to.be.revertedWith('AICredits: zero agent address');
    });

    it('should emit AgentUpdated event', async function () {
      await expect(contract.connect(owner).setAgent(user1.address))
        .to.emit(contract, 'AgentUpdated')
        .withArgs(user1.address);
    });
  });

  /* ────────────── renounceOwnership ────────────── */

  describe('renounceOwnership', function () {
    it('should revert when owner tries to renounce', async function () {
      await expect(
        contract.connect(owner).renounceOwnership()
      ).to.be.revertedWith('AICredits: cannot renounce ownership');
    });

    it('should reject renounce from non-owner', async function () {
      await expect(
        contract.connect(user1).renounceOwnership()
      ).to.be.revertedWithCustomError(
        contract,
        'OwnableUnauthorizedAccount'
      ).withArgs(user1.address);
    });

    it('should keep owner unchanged after revert', async function () {
      const ownerBefore = await contract.owner();
      try {
        await contract.connect(owner).renounceOwnership();
      } catch {}
      const ownerAfter = await contract.owner();
      expect(ownerAfter).to.equal(ownerBefore);
    });

    it('should still allow mintCredits after failed renounce', async function () {
      try {
        await contract.connect(owner).renounceOwnership();
      } catch {}
      await contract.connect(owner).mintCredits(user1.address, 50);
      expect(await contract.balanceOf(user1.address)).to.equal(50);
    });
  });

  /* ────────────── Integration: mint → spend flow ────────────── */

  describe('Integration: mint → spend', function () {
    it('should mint multiple users and spend individually', async function () {
      await contract.connect(owner).mintCredits(user1.address, 200);
      await contract.connect(owner).mintCredits(user2.address, 100);

      await contract.connect(agent).spendCredits(user1.address, 50);
      await contract.connect(agent).spendCredits(user2.address, 100);

      expect(await contract.balanceOf(user1.address)).to.equal(150);
      expect(await contract.balanceOf(user2.address)).to.equal(0);
    });

    it('should work after agent change in same flow', async function () {
      await contract.connect(owner).mintCredits(user1.address, 100);
      await contract.connect(owner).setAgent(stranger.address);

      await contract.connect(stranger).spendCredits(user1.address, 40);

      expect(await contract.balanceOf(user1.address)).to.equal(60);
      expect(await contract.agentAddress()).to.equal(stranger.address);
    });
  });
});
