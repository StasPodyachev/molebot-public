import { expect } from 'chai';
import { ethers } from 'hardhat';
import { MolebotNFT, MoleVault, MockAgniRouter } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { Contract } from 'ethers';

const PLACEHOLDER = 'ipfs://placeholder/';
const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

const EIP712_DOMAIN = {
  name: 'MoleVault',
  version: '1',
  chainId: 5003,
} as const;

const SESSION_TYPES = {
  Session: [
    { name: 'tokenId', type: 'uint256' },
    { name: 'sessionAgent', type: 'address' },
    { name: 'maxTradeAmount', type: 'uint256' },
    { name: 'validUntil', type: 'uint256' },
    { name: 'allowedTokens', type: 'address[]' },
  ],
} as const;

describe('MoleVault', function () {
  let nft: MolebotNFT;
  let vault: MoleVault;
  let router: MockAgniRouter;
  let deployer: SignerWithAddress;
  let agent: SignerWithAddress;
  let user: SignerWithAddress;
  let attacker: SignerWithAddress;
  let sessionAgent: SignerWithAddress;
  let sessionAgent2: SignerWithAddress;

  let tokenA: Contract;
  let tokenB: Contract;

  const TOKEN_ID = 1;
  const DEPOSIT_MNT = ethers.parseEther('10');

  before(async function () {
    [deployer, agent, user, attacker, sessionAgent, sessionAgent2] = await ethers.getSigners();
  });

  async function deployERC20Mock(name: string, symbol: string): Promise<Contract> {
    const factory = await ethers.getContractFactory('MockERC20');
    const token = await factory.deploy(name, symbol);
    await token.waitForDeployment();
    return token;
  }

  async function deployVault(): Promise<MoleVault> {
    const VaultFactory = await ethers.getContractFactory('MoleVault');
    const v = await VaultFactory.deploy(
      await router.getAddress(),
      await nft.getAddress(),
      agent.address,
    );
    await v.waitForDeployment();
    return v;
  }

  async function signSession(
    signer: SignerWithAddress,
    vaultAddr: string,
    tokenId: number | bigint,
    sAgent: string,
    maxAmt: bigint,
    until: number,
    allowedTokens: string[] = []
  ): Promise<string> {
    const domain = {
      ...EIP712_DOMAIN,
      verifyingContract: vaultAddr,
    };
    const value = {
      tokenId: BigInt(tokenId),
      sessionAgent: sAgent,
      maxTradeAmount: maxAmt,
      validUntil: BigInt(until),
      allowedTokens,
    };
    return signer.signTypedData(domain, SESSION_TYPES, value);
  }

  /* ──────────────────────────────────────────────
   * Setup
   * ────────────────────────────────────────────── */

  describe('Deployment', function () {
    before(async function () {
      const RouterFactory = await ethers.getContractFactory('MockAgniRouter');
      router = await RouterFactory.deploy();
      await router.waitForDeployment();

      const NftFactory = await ethers.getContractFactory('MolebotNFT');
      nft = await NftFactory.deploy(PLACEHOLDER, agent.address);
      await nft.waitForDeployment();
    });

    it('should deploy with correct immutable addresses', async function () {
      vault = await deployVault();

      expect(await vault.ROUTER()).to.equal(await router.getAddress());
      expect(await vault.NFT()).to.equal(await nft.getAddress());
      expect(await vault.AGENT()).to.equal(agent.address);
    });

    it('should set EIP-712 domain separator', async function () {
      const ds = await vault.getDomainSeparator();
      expect(ds).to.not.equal(ethers.ZeroHash);
    });

    it('should reject zero address for ROUTER', async function () {
      const VaultFactory = await ethers.getContractFactory('MoleVault');
      await expect(
        VaultFactory.deploy(ZERO_ADDR, await nft.getAddress(), agent.address)
      ).to.be.revertedWithCustomError(VaultFactory, 'ZeroAddress');
    });

    it('should reject zero address for NFT', async function () {
      const VaultFactory = await ethers.getContractFactory('MoleVault');
      await expect(
        VaultFactory.deploy(await router.getAddress(), ZERO_ADDR, agent.address)
      ).to.be.revertedWithCustomError(VaultFactory, 'ZeroAddress');
    });

    it('should reject zero address for AGENT', async function () {
      const VaultFactory = await ethers.getContractFactory('MoleVault');
      await expect(
        VaultFactory.deploy(await router.getAddress(), await nft.getAddress(), ZERO_ADDR)
      ).to.be.revertedWithCustomError(VaultFactory, 'ZeroAddress');
    });

    it('ROUTER should be immutable (no setter)', async function () {
      vault = await deployVault();
      expect(await vault.ROUTER()).to.equal(await router.getAddress());
    });
  });

  /* ──────────────────────────────────────────────
   * Deposit MNT
   * ────────────────────────────────────────────── */

  describe('Deposit MNT', function () {
    before(async function () {
      vault = await deployVault();
      await nft.connect(user).mint({ value: ethers.parseEther('0.05') });
    });

    it('should allow NFT owner to deposit MNT', async function () {
      const tx = await vault.connect(user).deposit(TOKEN_ID, { value: DEPOSIT_MNT });
      await expect(tx)
        .to.emit(vault, 'Deposited')
        .withArgs(TOKEN_ID, ZERO_ADDR, DEPOSIT_MNT);
      expect(await vault.mntBalance(TOKEN_ID)).to.equal(DEPOSIT_MNT);
    });

    it('should reject deposit from non-owner', async function () {
      await expect(
        vault.connect(attacker).deposit(TOKEN_ID, { value: ethers.parseEther('1') })
      ).to.be.revertedWithCustomError(vault, 'NotNFTOwner');
    });

    it('should reject deposit with zero value', async function () {
      await expect(
        vault.connect(user).deposit(TOKEN_ID, { value: 0 })
      ).to.be.revertedWithCustomError(vault, 'InsufficientBalance');
    });

    it('should accumulate multiple deposits', async function () {
      await vault.connect(user).deposit(TOKEN_ID, { value: ethers.parseEther('5') });
      await vault.connect(user).deposit(TOKEN_ID, { value: ethers.parseEther('3') });
      expect(await vault.mntBalance(TOKEN_ID)).to.equal(ethers.parseEther('18'));
    });
  });

  /* ──────────────────────────────────────────────
   * Deposit ERC20
   * ────────────────────────────────────────────── */

  describe('Deposit ERC20', function () {
    let ownerNftUser: SignerWithAddress;

    before(async function () {
      const signers = await ethers.getSigners();
      ownerNftUser = signers[6];
      vault = await deployVault();
      await nft.connect(ownerNftUser).mint({ value: ethers.parseEther('0.05') });
      tokenA = await deployERC20Mock('Token A', 'TKA');
    });

    it('should allow NFT owner to deposit ERC20', async function () {
      const amount = ethers.parseEther('100');
      await tokenA.mint(ownerNftUser.address, amount);
      await tokenA.connect(ownerNftUser).approve(await vault.getAddress(), amount);
      await expect(
        vault.connect(ownerNftUser).depositToken(2, await tokenA.getAddress(), amount)
      ).to.emit(vault, 'Deposited');
      expect(await vault.tokenBalance(2, await tokenA.getAddress())).to.equal(amount);
    });

    it('should reject deposit from non-owner', async function () {
      const amount = ethers.parseEther('10');
      await tokenA.mint(attacker.address, amount);
      await tokenA.connect(attacker).approve(await vault.getAddress(), amount);
      await expect(
        vault.connect(attacker).depositToken(2, await tokenA.getAddress(), amount)
      ).to.be.revertedWithCustomError(vault, 'NotNFTOwner');
    });
  });

  /* ──────────────────────────────────────────────
   * Withdraw
   * ────────────────────────────────────────────── */

  describe('Withdraw', function () {
    const WITHDRAW_AMOUNT = ethers.parseEther('2');

    before(async function () {
      vault = await deployVault();
      if (!(await nft.ownerOf(TOKEN_ID).catch(() => null))) {
        await nft.connect(user).mint({ value: ethers.parseEther('0.05') });
      }
      await vault.connect(user).deposit(TOKEN_ID, { value: DEPOSIT_MNT });
      tokenA = await deployERC20Mock('Token A', 'TKA');
      const amount = ethers.parseEther('50');
      await tokenA.mint(user.address, amount);
      await tokenA.connect(user).approve(await vault.getAddress(), amount);
      await vault.connect(user).depositToken(TOKEN_ID, await tokenA.getAddress(), amount);
    });

    it('should allow owner to withdraw MNT', async function () {
      const balanceBefore = await ethers.provider.getBalance(user.address);
      const tx = await vault.connect(user).withdraw(TOKEN_ID, ZERO_ADDR, WITHDRAW_AMOUNT, user.address);
      const receipt = await tx.wait();
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(user.address);
      await expect(tx).to.emit(vault, 'Withdrawn');
      expect(balanceAfter + gasCost - balanceBefore).to.equal(WITHDRAW_AMOUNT);
    });

    it('should reject withdraw from non-owner', async function () {
      await expect(
        vault.connect(attacker).withdraw(TOKEN_ID, ZERO_ADDR, ethers.parseEther('1'), attacker.address)
      ).to.be.revertedWithCustomError(vault, 'NotNFTOwner');
    });

    it('should reject withdraw exceeding balance', async function () {
      await expect(
        vault.connect(user).withdraw(TOKEN_ID, ZERO_ADDR, ethers.parseEther('100000'), user.address)
      ).to.be.revertedWithCustomError(vault, 'InsufficientBalance');
    });
  });

  /* ──────────────────────────────────────────────
   * executeSwap — Agent only through ROUTER
   * ────────────────────────────────────────────── */

  describe('executeSwap', function () {
    const SWAP_AMOUNT = ethers.parseEther('5');

    before(async function () {
      vault = await deployVault();
      if (!(await nft.ownerOf(TOKEN_ID).catch(() => null))) {
        await nft.connect(user).mint({ value: ethers.parseEther('0.05') });
      }
      tokenA = await deployERC20Mock('TokenA', 'TKA');
      tokenB = await deployERC20Mock('TokenB', 'TKB');
      const depositAmt = ethers.parseEther('100');
      await tokenA.mint(user.address, depositAmt);
      await tokenA.connect(user).approve(await vault.getAddress(), depositAmt);
      await vault.connect(user).depositToken(TOKEN_ID, await tokenA.getAddress(), depositAmt);
      const routerAddr = await router.getAddress();
      await tokenB.mint(routerAddr, ethers.parseEther('1000'));
    });

    it('should allow agent to execute swap through ROUTER', async function () {
      const tokenInAddr = await tokenA.getAddress();
      const tokenOutAddr = await tokenB.getAddress();
      const swapIface = new ethers.Interface([
        'function swapExactTokensForTokens(uint256,uint256,address[],address,uint256) returns (uint256[])',
      ]);
      const path = [tokenInAddr, tokenOutAddr];
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const swapData = swapIface.encodeFunctionData('swapExactTokensForTokens', [
        SWAP_AMOUNT, 0, path, await vault.getAddress(), deadline,
      ]);
      const vaultAddr = await vault.getAddress();
      const tokBBefore = await tokenB.balanceOf(vaultAddr);
      await expect(
        vault.connect(agent).executeSwap(TOKEN_ID, tokenInAddr, SWAP_AMOUNT, swapData)
      ).to.emit(vault, 'SwapExecuted');
      const tokBAfter = await tokenB.balanceOf(vaultAddr);
      expect(tokBAfter - tokBBefore).to.equal(SWAP_AMOUNT);
    });

    it('should reject executeSwap from non-agent (no session)', async function () {
      await expect(
        vault.connect(attacker).executeSwap(TOKEN_ID, await tokenA.getAddress(), ethers.parseEther('1'), '0x')
      ).to.be.revertedWithCustomError(vault, 'NotAgent');
    });

    it('should reject swap exceeding vault balance', async function () {
      const swapIface = new ethers.Interface([
        'function swapExactTokensForTokens(uint256,uint256,address[],address,uint256) returns (uint256[])',
      ]);
      const path = [await tokenA.getAddress(), await tokenB.getAddress()];
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const swapData = swapIface.encodeFunctionData('swapExactTokensForTokens', [
        ethers.parseEther('999999'), 0, path, await vault.getAddress(), deadline,
      ]);
      await expect(
        vault.connect(agent).executeSwap(TOKEN_ID, await tokenA.getAddress(), ethers.parseEther('999999'), swapData)
      ).to.be.revertedWithCustomError(vault, 'InsufficientBalance');
    });
  });

  /* ──────────────────────────────────────────────────────────
   * Session Keys (EIP-712) — T-VAULT-02
   * ────────────────────────────────────────────────────────── */

  describe('Session Keys', function () {
    const MAX_AMOUNT = ethers.parseEther('10');
    const SWAP_AMOUNT = ethers.parseEther('2');

    before(async function () {
      vault = await deployVault();
      if (!(await nft.ownerOf(TOKEN_ID).catch(() => null))) {
        await nft.connect(user).mint({ value: ethers.parseEther('0.05') });
      }
      // Deposit MNT for session swap tests
      await vault.connect(user).deposit(TOKEN_ID, { value: DEPOSIT_MNT });

      tokenA = await deployERC20Mock('SessTKA', 'STKA');
      tokenB = await deployERC20Mock('SessTKB', 'STKB');
      const depositAmt = ethers.parseEther('50');
      await tokenA.mint(user.address, depositAmt);
      await tokenA.connect(user).approve(await vault.getAddress(), depositAmt);
      await vault.connect(user).depositToken(TOKEN_ID, await tokenA.getAddress(), depositAmt);
      const routerAddr = await router.getAddress();
      await tokenB.mint(routerAddr, ethers.parseEther('500'));
    });

    async function swapData(): Promise<string> {
      const swapIface = new ethers.Interface([
        'function swapExactTokensForTokens(uint256,uint256,address[],address,uint256) returns (uint256[])',
      ]);
      const path = [await tokenA.getAddress(), await tokenB.getAddress()];
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      return swapIface.encodeFunctionData('swapExactTokensForTokens', [
        SWAP_AMOUNT, 0, path, await vault.getAddress(), deadline,
      ]);
    }

    // ── 1. register ──

    it('should register session with valid EIP-712 signature', async function () {
      const validUntil = Math.floor(Date.now() / 1000) + 7200;
      const sig = await signSession(user, await vault.getAddress(), TOKEN_ID, sessionAgent.address, MAX_AMOUNT, validUntil);

      await expect(
        vault.connect(user).registerSession(TOKEN_ID, sessionAgent.address, MAX_AMOUNT, validUntil, [], sig)
      )
        .to.emit(vault, 'SessionRegistered')
        .withArgs(TOKEN_ID, sessionAgent.address, MAX_AMOUNT, validUntil);
    });

    it('should reject register with invalid signature (wrong signer)', async function () {
      const validUntil = Math.floor(Date.now() / 1000) + 7200;
      // Attacker signs — NOT the NFT owner
      const sig = await signSession(attacker, await vault.getAddress(), TOKEN_ID, sessionAgent.address, MAX_AMOUNT, validUntil);

      await expect(
        vault.connect(user).registerSession(TOKEN_ID, sessionAgent.address, MAX_AMOUNT, validUntil, [], sig)
      ).to.be.revertedWithCustomError(vault, 'InvalidSignature');
    });

    it('should reject register from non-owner (even with valid sig)', async function () {
      const validUntil = Math.floor(Date.now() / 1000) + 7200;
      const sig = await signSession(user, await vault.getAddress(), TOKEN_ID, sessionAgent.address, MAX_AMOUNT, validUntil);

      await expect(
        vault.connect(attacker).registerSession(TOKEN_ID, sessionAgent.address, MAX_AMOUNT, validUntil, [], sig)
      ).to.be.revertedWithCustomError(vault, 'NotNFTOwner');
    });

    it('should reject register with expired validUntil', async function () {
      const pastUntil = Math.floor(Date.now() / 1000) - 100;
      const sig = await signSession(user, await vault.getAddress(), TOKEN_ID, sessionAgent.address, MAX_AMOUNT, pastUntil);

      await expect(
        vault.connect(user).registerSession(TOKEN_ID, sessionAgent.address, MAX_AMOUNT, pastUntil, [], sig)
      ).to.be.revertedWithCustomError(vault, 'SessionExpired');
    });

    it('should reject register with zero maxTradeAmount', async function () {
      const validUntil = Math.floor(Date.now() / 1000) + 7200;
      const sig = await signSession(user, await vault.getAddress(), TOKEN_ID, sessionAgent.address, 0n, validUntil);

      await expect(
        vault.connect(user).registerSession(TOKEN_ID, sessionAgent.address, 0, validUntil, [], sig)
      ).to.be.revertedWithCustomError(vault, 'InsufficientBalance');
    });

    it('should reject register with zero sessionAgent address', async function () {
      const validUntil = Math.floor(Date.now() / 1000) + 7200;
      const sig = await signSession(user, await vault.getAddress(), TOKEN_ID, ZERO_ADDR, MAX_AMOUNT, validUntil);

      await expect(
        vault.connect(user).registerSession(TOKEN_ID, ZERO_ADDR, MAX_AMOUNT, validUntil, [], sig)
      ).to.be.revertedWithCustomError(vault, 'ZeroAddress');
    });

    // ── 2. session agent can executeSwap ──

    it('should allow session agent to executeSwap', async function () {
      // Register fresh session
      const validUntil = Math.floor(Date.now() / 1000) + 7200;
      const sig = await signSession(user, await vault.getAddress(), TOKEN_ID, sessionAgent.address, MAX_AMOUNT, validUntil);
      await vault.connect(user).registerSession(TOKEN_ID, sessionAgent.address, MAX_AMOUNT, validUntil, [], sig);

      // Session agent swaps
      const sd = await swapData();
      await expect(
        vault.connect(sessionAgent).executeSwap(TOKEN_ID, await tokenA.getAddress(), SWAP_AMOUNT, sd)
      ).to.emit(vault, 'SwapExecuted');
    });

    // ── 3. session limit enforcement ──

    it('should reject session swap exceeding maxTradeAmount', async function () {
      const smallLimit = ethers.parseEther('1');
      const validUntil = Math.floor(Date.now() / 1000) + 7200;
      const sig = await signSession(user, await vault.getAddress(), TOKEN_ID, sessionAgent.address, smallLimit, validUntil);
      // Re-register (overwrites)
      await vault.connect(user).registerSession(TOKEN_ID, sessionAgent.address, smallLimit, validUntil, [], sig);

      const sd = await swapData();
      // SWAP_AMOUNT is 2 ETH, but limit is 1
      await expect(
        vault.connect(sessionAgent).executeSwap(TOKEN_ID, await tokenA.getAddress(), SWAP_AMOUNT, sd)
      ).to.be.revertedWithCustomError(vault, 'SessionLimitExceeded');
    });

    // ── 4. usedAmount tracks correctly ──

    it('should track usedAmount and auto-revoke on limit reached', async function () {
      const exactLimit = SWAP_AMOUNT; // exactly one swap worth
      const validUntil = Math.floor(Date.now() / 1000) + 7200;
      const sig = await signSession(user, await vault.getAddress(), TOKEN_ID, sessionAgent.address, exactLimit, validUntil);
      await vault.connect(user).registerSession(TOKEN_ID, sessionAgent.address, exactLimit, validUntil, [], sig);

      const sd = await swapData();
      // First swap should succeed and consume entire limit
      await expect(
        vault.connect(sessionAgent).executeSwap(TOKEN_ID, await tokenA.getAddress(), SWAP_AMOUNT, sd)
      ).to.emit(vault, 'SwapExecuted');

      // Session should be auto-revoked
      const [active] = await vault.checkSession(TOKEN_ID, sessionAgent.address);
      expect(active).to.equal(false);

      // Second swap should fail (session inactive)
      await expect(
        vault.connect(sessionAgent).executeSwap(TOKEN_ID, await tokenA.getAddress(), ethers.parseEther('1'), sd)
      ).to.be.revertedWithCustomError(vault, 'NotAgent');
    });

    // ── 5. expired session cannot swap ──

    it('should reject swap from session agent after expiry', async function () {
      // Get current block timestamp for accurate expiry
      const block = await ethers.provider.getBlock('latest');
      const shortUntil = block!.timestamp + 30;
      const sig = await signSession(user, await vault.getAddress(), TOKEN_ID, sessionAgent.address, MAX_AMOUNT, shortUntil);
      await vault.connect(user).registerSession(TOKEN_ID, sessionAgent.address, MAX_AMOUNT, shortUntil, [], sig);

      // Fast-forward past expiry
      await ethers.provider.send('evm_setNextBlockTimestamp', [shortUntil + 10]);
      await ethers.provider.send('evm_mine', []);

      const sd = await swapData();
      await expect(
        vault.connect(sessionAgent).executeSwap(TOKEN_ID, await tokenA.getAddress(), SWAP_AMOUNT, sd)
      ).to.be.revertedWithCustomError(vault, 'SessionExpired');
    });

    // ── 6. revoke ──

    it('should revoke active session', async function () {
      const validUntil = Math.floor(Date.now() / 1000) + 7200;
      const sig = await signSession(user, await vault.getAddress(), TOKEN_ID, sessionAgent.address, MAX_AMOUNT, validUntil);
      await vault.connect(user).registerSession(TOKEN_ID, sessionAgent.address, MAX_AMOUNT, validUntil, [], sig);

      await expect(
        vault.connect(user).revokeSession(TOKEN_ID)
      ).to.emit(vault, 'SessionRevoked').withArgs(TOKEN_ID);

      // Session agent can no longer swap
      const sd = await swapData();
      await expect(
        vault.connect(sessionAgent).executeSwap(TOKEN_ID, await tokenA.getAddress(), SWAP_AMOUNT, sd)
      ).to.be.revertedWithCustomError(vault, 'NotAgent');
    });

    it('should reject revoke from non-owner', async function () {
      const validUntil = Math.floor(Date.now() / 1000) + 7200;
      const sig = await signSession(user, await vault.getAddress(), TOKEN_ID, sessionAgent.address, MAX_AMOUNT, validUntil);
      await vault.connect(user).registerSession(TOKEN_ID, sessionAgent.address, MAX_AMOUNT, validUntil, [], sig);

      await expect(
        vault.connect(attacker).revokeSession(TOKEN_ID)
      ).to.be.revertedWithCustomError(vault, 'NotNFTOwner');
    });

    it('should reject revoke non-existent session', async function () {
      // Ensure no session
      const [active] = await vault.checkSession(TOKEN_ID, sessionAgent.address);
      if (active) {
        await vault.connect(user).revokeSession(TOKEN_ID);
      }
      await expect(
        vault.connect(user).revokeSession(TOKEN_ID)
      ).to.be.revertedWithCustomError(vault, 'NoActiveSession');
    });

    // ── 7. checkSession ──

    it('checkSession should return correct active status and remaining', async function () {
      const validUntil = Math.floor(Date.now() / 1000) + 7200;
      const bigLimit = ethers.parseEther('50');
      const sig = await signSession(user, await vault.getAddress(), TOKEN_ID, sessionAgent.address, bigLimit, validUntil);
      await vault.connect(user).registerSession(TOKEN_ID, sessionAgent.address, bigLimit, validUntil, [], sig);

      const [active, remaining] = await vault.checkSession(TOKEN_ID, sessionAgent.address);
      expect(active).to.equal(true);
      expect(remaining).to.equal(bigLimit);

      // Check with wrong caller
      const [active2, rem2] = await vault.checkSession(TOKEN_ID, attacker.address);
      expect(active2).to.equal(false);
      expect(rem2).to.equal(0);
    });

    it('checkSession should return false for non-existent tokenId', async function () {
      const [active, remaining] = await vault.checkSession(999, sessionAgent.address);
      expect(active).to.equal(false);
      expect(remaining).to.equal(0);
    });

    // ── 8. double registration overwrites ──

    it('should replace old session on re-registration', async function () {
      const validUntil = Math.floor(Date.now() / 1000) + 7200;
      const sig1 = await signSession(user, await vault.getAddress(), TOKEN_ID, sessionAgent.address, MAX_AMOUNT, validUntil);
      await vault.connect(user).registerSession(TOKEN_ID, sessionAgent.address, MAX_AMOUNT, validUntil, [], sig1);

      // Register new session with sessionAgent2
      const sig2 = await signSession(user, await vault.getAddress(), TOKEN_ID, sessionAgent2.address, MAX_AMOUNT, validUntil);
      await vault.connect(user).registerSession(TOKEN_ID, sessionAgent2.address, MAX_AMOUNT, validUntil, [], sig2);

      // Old session agent can't trade
      const sd = await swapData();
      await expect(
        vault.connect(sessionAgent).executeSwap(TOKEN_ID, await tokenA.getAddress(), SWAP_AMOUNT, sd)
      ).to.be.revertedWithCustomError(vault, 'NotAgent');

      // New session agent can
      await expect(
        vault.connect(sessionAgent2).executeSwap(TOKEN_ID, await tokenA.getAddress(), SWAP_AMOUNT, sd)
      ).to.emit(vault, 'SwapExecuted');
    });

    // ── 9. concurrent sessions for different tokenIds ──

    it('should allow concurrent sessions for different tokenIds', async function () {
      const tokenId2 = 3; // tokenIds 1-2 already minted
      const user2 = sessionAgent2;
      await nft.connect(user2).mint({ value: ethers.parseEther('0.05') });
      await vault.connect(user2).deposit(tokenId2, { value: DEPOSIT_MNT });

      const validUntil = Math.floor(Date.now() / 1000) + 7200;
      const sig1 = await signSession(user, await vault.getAddress(), TOKEN_ID, sessionAgent.address, MAX_AMOUNT, validUntil);
      const sig2 = await signSession(user2, await vault.getAddress(), tokenId2, sessionAgent2.address, MAX_AMOUNT, validUntil);

      await vault.connect(user).registerSession(TOKEN_ID, sessionAgent.address, MAX_AMOUNT, validUntil, [], sig1);
      await vault.connect(user2).registerSession(tokenId2, sessionAgent2.address, MAX_AMOUNT, validUntil, [], sig2);

      // Both sessions are active
      const [a1] = await vault.checkSession(TOKEN_ID, sessionAgent.address);
      const [a2] = await vault.checkSession(tokenId2, sessionAgent2.address);
      expect(a1).to.equal(true);
      expect(a2).to.equal(true);

      // tokenId 2 session agent can't trade on tokenId 1
      const sd = await swapData();
      await expect(
        vault.connect(sessionAgent2).executeSwap(TOKEN_ID, await tokenA.getAddress(), SWAP_AMOUNT, sd)
      ).to.be.revertedWithCustomError(vault, 'NotAgent');
    });

    // ── 10. immutable AGENT always has access ──

    it('should allow immutable AGENT to swap regardless of session', async function () {
      // Revoke any session
      try { await vault.connect(user).revokeSession(TOKEN_ID); } catch {}

      const sd = await swapData();
      await expect(
        vault.connect(agent).executeSwap(TOKEN_ID, await tokenA.getAddress(), SWAP_AMOUNT, sd)
      ).to.emit(vault, 'SwapExecuted');
    });

    // ── 11. wrong chain domain fails ──

    it('should reject signature signed for wrong vault address', async function () {
      const validUntil = Math.floor(Date.now() / 1000) + 7200;
      // Sign for a wrong verifying contract
      const domain = {
        ...EIP712_DOMAIN,
        verifyingContract: attacker.address, // wrong vault!
      };
      const value = {
        tokenId: BigInt(TOKEN_ID),
        sessionAgent: sessionAgent.address,
        maxTradeAmount: MAX_AMOUNT,
        validUntil: BigInt(validUntil),
        allowedTokens: [],
      };
      const sig = await user.signTypedData(domain, SESSION_TYPES, value);

      await expect(
        vault.connect(user).registerSession(TOKEN_ID, sessionAgent.address, MAX_AMOUNT, validUntil, [], sig)
      ).to.be.revertedWithCustomError(vault, 'InvalidSignature');
    });
  });
});
