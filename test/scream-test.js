const hre = require('hardhat');
const chai = require('chai');
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const { expect } = chai;

const moveTimeForward = async seconds => {
  await network.provider.send('evm_increaseTime', [seconds]);
  await network.provider.send('evm_mine');
};

const moveBlocksForward = async blocks => {
  for (let i = 0; i < blocks; i++) {
    await network.provider.send('evm_increaseTime', [1]);
    await network.provider.send('evm_mine');
  }
};

const toWantUnit = (num, isUSDC = false) => {
  if (isUSDC) {
    return ethers.BigNumber.from(num * 10 ** 6);
  }
  return ethers.utils.parseEther(num);
};

describe('Vaults', function () {
  let Vault;
  let Strategy;
  let Treasury;
  let Want;
  let vault;
  let strategy;
  let treasury;
  let want;
  let self;
  let wantWhale;
  let selfAddress;
  let strategist;
  let owner;

  const treasuryAddress = '0xeb9C9b785aA7818B2EBC8f9842926c4B9f707e4B';

  const usdcAddress = '0x7F5c764cBc14f9669B88837ca1490cCa17c31607';
  const soWantAddress = '0x5569b83de187375d43FBd747598bfe64fC8f6436';
  const wantAddress = '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1';

  const wantHolder = '0x555187752Ef6d73758862B5d364AAB362c996d0e';
  const wantWhaleAddress = '0x441b02540B16B22D64A5Be8d3A4Dcf9a4E0EFA98';
  const strategistAddress = '0x1A20D7A31e5B3Bc5f02c8A146EF6f394502a10c4';

  const superAdminAddress = '0x9BC776dBb134Ef9D7014dB1823Cd755Ac5015203';
  const adminAddress = '0xeb9C9b785aA7818B2EBC8f9842926c4B9f707e4B';
  const guardianAddress = '0xb0C9D5851deF8A2Aac4A23031CA2610f8C3483F9';

  const targetLTVText = '0.78';
  const targetLtv = ethers.utils.parseEther(targetLTVText);

  beforeEach(async function () {
    //reset network
    await network.provider.request({
      method: 'hardhat_reset',
      params: [
        {
          forking: {
            jsonRpcUrl: 'https://late-fragrant-rain.optimism.quiknode.pro/70171d2e7790f3af6a833f808abe5e85ed6bd881/',
          },
        },
      ],
    });
    console.log('providers');
    //get signers
    [owner, addr1, addr2, addr3, addr4, ...addrs] = await ethers.getSigners();

    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [wantHolder],
    });
    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [wantWhaleAddress],
    });
    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [strategistAddress],
    });
    self = await ethers.provider.getSigner(wantHolder);
    wantWhale = await ethers.provider.getSigner(wantWhaleAddress);
    strategist = await ethers.provider.getSigner(strategistAddress);
    selfAddress = await self.getAddress();
    ownerAddress = await owner.getAddress();
    console.log('addresses');

    //get artifacts
    Strategy = await ethers.getContractFactory('ReaperStrategySonne');
    Vault = await ethers.getContractFactory('ReaperVaultv1_4');
    Treasury = await ethers.getContractFactory('ReaperTreasury');
    Want = await ethers.getContractFactory('@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20');
    console.log('artifacts');

    //deploy contracts
    treasury = await Treasury.deploy();
    console.log('treasury');
    want = await Want.attach(wantAddress);
    console.log('want attached');
    vault = await Vault.deploy(wantAddress, 'DAI Sonne Crypt', 'rf-soDAI', 0, ethers.constants.MaxUint256);
    console.log('vault');

    console.log(`vault.address: ${vault.address}`);
    console.log(`treasury.address: ${treasury.address}`);

    console.log('strategy');
    strategy = await hre.upgrades.deployProxy(
      Strategy,
      [
        vault.address,
        treasuryAddress,
        [strategistAddress],
        [superAdminAddress, adminAddress, guardianAddress],
        soWantAddress,
        targetLtv,
      ],
      { kind: 'uups' },
    );
    await strategy.deployed();
    // vault = Vault.attach('0x085c658E0A0Ddf485A7d848b60bc09C65dbdeF60');
    // strategy = Strategy.attach('0x3252d1Aa08D53eb5A9f6bb5c8c41F40d899864d6');

    await vault.initialize(strategy.address);

    console.log(`Strategy deployed to ${strategy.address}`);
    console.log(`Vault deployed to ${vault.address}`);
    console.log(`Treasury deployed to ${treasury.address}`);

    //approving LP token and vault share spend
    await want.approve(vault.address, ethers.constants.MaxUint256);
    // await want.connect(self).approve(vault.address, ethers.utils.parseEther('1000000000'));
    // await want.connect(wantWhale).approve(vault.address, ethers.utils.parseEther('1000000000'));
    await want.connect(wantWhale).approve(vault.address, ethers.constants.MaxUint256);
    await want.connect(self).approve(vault.address, ethers.constants.MaxUint256);
  });

  describe('Deploying the vault and strategy', function () {
    it('should initiate vault with a 0 balance', async function () {
      const totalBalance = await vault.balance();
      const availableBalance = await vault.available();
      const pricePerFullShare = await vault.getPricePerFullShare();
      expect(totalBalance).to.equal(0);
      expect(availableBalance).to.equal(0);
      expect(pricePerFullShare).to.equal(ethers.utils.parseEther('1'));
    });
  });
  describe('Vault Tests', function () {
    it('should allow deposits and account for them correctly', async function () {
      const userBalance = await want.balanceOf(selfAddress);
      console.log(`userBalance: ${userBalance}`);
      const vaultBalance = await vault.balance();
      console.log('vaultBalance');
      console.log(vaultBalance);
      const depositAmount = toWantUnit('10000');
      console.log('depositAmount');
      console.log(depositAmount);
      await vault.connect(self).deposit(depositAmount);
      const newVaultBalance = await vault.balance();
      console.log(`newVaultBalance: ${newVaultBalance}`);
      console.log(`depositAmount: ${depositAmount}`);
      const newUserBalance = await want.balanceOf(selfAddress);

      console.log(`newUserBalance: ${newUserBalance}`);
      console.log(`userBalance - depositAmount: ${userBalance - depositAmount}`);
      console.log(`userBalance - newUserBalance: ${userBalance - newUserBalance}`);
      const deductedAmount = userBalance.sub(newUserBalance);
      console.log('deductedAmount');
      console.log(deductedAmount);
      await vault.connect(self).deposit(depositAmount);
      expect(vaultBalance).to.equal(0);
      // // Compound mint reduces balance by a small amount
      //const smallDifference = depositAmount * 0.00000001; // For 1e18
      const smallDifference = depositAmount * 0.000001; // For USDC or want with smaller decimals allow bigger difference
      console.log(`depositAmount ${depositAmount}`);
      console.log(`newVaultBalance ${newVaultBalance}`);
      console.log(`depositAmount.sub(newVaultBalance) ${depositAmount.sub(newVaultBalance)}`);
      const isSmallBalanceDifference = depositAmount.sub(newVaultBalance) < smallDifference;
      expect(isSmallBalanceDifference).to.equal(true);

      // const ltv = await strategy.calculateLTV();
      // console.log(`ltv: ${ltv}`);
      // const allowedLTVDrift = toWantUnit('0.015');
      // expect(ltv).to.be.closeTo(toWantUnit('0.73'), allowedLTVDrift);
    });

    it('should trigger deleveraging on deposit when LTV is too high', async function () {
      const depositAmount = toWantUnit('10000');
      await vault.connect(self).deposit(depositAmount);
      const ltvBefore = await strategy.calculateLTV();
      console.log(`ltvBefore: ${ltvBefore}`);
      const allowedLTVDrift = toWantUnit('0.015');
      expect(ltvBefore).to.be.closeTo(toWantUnit(targetLTVText), allowedLTVDrift);
      const newLTV = toWantUnit('0');
      await strategy.setTargetLtv(newLTV);
      const smallDepositAmount = toWantUnit('1', true);
      await vault.connect(self).deposit(smallDepositAmount);
      const ltvAfter = await strategy.calculateLTV();
      console.log(`ltvAfter: ${ltvAfter}`);
      expect(ltvAfter).to.be.closeTo(newLTV, allowedLTVDrift);
    });

    it('should not change leverage when LTV is within the allowed drift on deposit', async function () {
      const depositAmount = toWantUnit('1');
      const ltv = toWantUnit(targetLTVText);
      await vault.connect(self).deposit(depositAmount);
      const ltvBefore = await strategy.calculateLTV();
      console.log(`ltvBefore: ${ltvBefore}`);
      const allowedLTVDrift = toWantUnit('0.015');
      expect(ltvBefore).to.be.closeTo(ltv, allowedLTVDrift);
      const smallDepositAmount = toWantUnit('0.005', true);
      await vault.connect(self).deposit(smallDepositAmount);
      const ltvAfter = await strategy.calculateLTV();
      console.log(`ltvAfter: ${ltvAfter}`);
      expect(ltvAfter).to.be.closeTo(ltv, allowedLTVDrift);
    });

    it('should mint user their pool share', async function () {
      console.log('---------------------------------------------');
      const userBalance = await want.balanceOf(selfAddress);
      console.log(userBalance.toString());
      const selfDepositAmount = toWantUnit('0.005');
      await vault.connect(self).deposit(selfDepositAmount);
      console.log((await vault.balance()).toString());

      const whaleDepositAmount = toWantUnit('100');
      await vault.connect(wantWhale).deposit(whaleDepositAmount);
      const selfWantBalance = await vault.balanceOf(selfAddress);
      console.log(selfWantBalance.toString());
      const ownerDepositAmount = toWantUnit('1');
      await want.connect(self).transfer(ownerAddress, ownerDepositAmount);
      const ownerBalance = await want.balanceOf(ownerAddress);

      console.log(ownerBalance.toString());
      await vault.deposit(ownerDepositAmount);
      console.log((await vault.balance()).toString());
      const ownerVaultWantBalance = await vault.balanceOf(ownerAddress);
      console.log(`ownerVaultWantBalance.toString(): ${ownerVaultWantBalance.toString()}`);
      await vault.withdrawAll();
      const ownerWantBalance = await want.balanceOf(ownerAddress);
      console.log(`ownerWantBalance: ${ownerWantBalance}`);
      const ownerVaultWantBalanceAfterWithdraw = await vault.balanceOf(ownerAddress);
      console.log(`ownerVaultWantBalanceAfterWithdraw: ${ownerVaultWantBalanceAfterWithdraw}`);
      const allowedImprecision = toWantUnit('0.01');
      // expect(ownerWantBalance).to.be.closeTo(ownerDepositAmount, allowedImprecision);
      // expect(selfWantBalance).to.equal(selfDepositAmount);
    });

    it('should allow withdrawals', async function () {
      const userBalance = await want.balanceOf(selfAddress);
      console.log(`userBalance: ${userBalance}`);
      const depositAmount = toWantUnit('1');
      await vault.connect(self).deposit(depositAmount);
      console.log(`await want.balanceOf(selfAddress): ${await want.balanceOf(selfAddress)}`);

      await vault.connect(self).withdrawAll();
      const newUserVaultBalance = await vault.balanceOf(selfAddress);
      console.log(`newUserVaultBalance: ${newUserVaultBalance}`);
      const userBalanceAfterWithdraw = await want.balanceOf(selfAddress);
      const securityFee = 10;
      const percentDivisor = 10000;
      const withdrawFee = (depositAmount * securityFee) / percentDivisor;
      const expectedBalance = userBalance.sub(withdrawFee);
      const smallDifference = expectedBalance * 0.0000001;
      console.log(`expectedBalance.sub(userBalanceAfterWithdraw): ${expectedBalance.sub(userBalanceAfterWithdraw)}`);
      console.log(`smallDifference: ${smallDifference}`);
      const isSmallBalanceDifference = expectedBalance.sub(userBalanceAfterWithdraw) < smallDifference;
      expect(isSmallBalanceDifference).to.equal(true);
    });

    it('should trigger leveraging on withdraw when LTV is too low', async function () {
      const startingLTV = toWantUnit('0.6');
      await strategy.setTargetLtv(startingLTV);
      const depositAmount = toWantUnit('100');

      await vault.connect(self).deposit(depositAmount);
      const ltvBefore = await strategy.calculateLTV();
      console.log(`ltvBefore: ${ltvBefore}`);
      const allowedLTVDrift = toWantUnit('0.01');
      expect(ltvBefore).to.be.closeTo(startingLTV, allowedLTVDrift);
      const newLTV = toWantUnit('0.7');
      await strategy.setTargetLtv(newLTV);
      const smallWithdrawAmount = toWantUnit('1');
      const userBalance = await want.balanceOf(selfAddress);
      await vault.connect(self).withdraw(smallWithdrawAmount);
      const userBalanceAfterWithdraw = await want.balanceOf(selfAddress);
      const ltvAfter = await strategy.calculateLTV();
      console.log(`ltvAfter: ${ltvAfter}`);
      expect(ltvAfter).to.be.closeTo(newLTV, allowedLTVDrift);

      const securityFee = 10;
      const percentDivisor = 10000;
      const withdrawFee = smallWithdrawAmount.mul(securityFee).div(percentDivisor);
      const expectedBalance = userBalance.add(smallWithdrawAmount).sub(withdrawFee);

      expect(userBalanceAfterWithdraw).to.be.closeTo(expectedBalance, depositAmount.div(2000));
    });

    it('should trigger deleveraging on withdraw when LTV is too high', async function () {
      const startingLTV = toWantUnit('0.7');
      await strategy.setTargetLtv(startingLTV);
      const depositAmount = toWantUnit('100');

      await vault.connect(self).deposit(depositAmount);
      const ltvBefore = await strategy.calculateLTV();
      console.log(`ltvBefore: ${ltvBefore}`);
      const allowedLTVDrift = toWantUnit('0.01');
      expect(ltvBefore).to.be.closeTo(startingLTV, allowedLTVDrift);
      const newLTV = toWantUnit('0');
      await strategy.setTargetLtv(newLTV);
      const smallWithdrawAmount = toWantUnit('1');
      const userBalance = await want.balanceOf(selfAddress);
      await vault.connect(self).withdraw(smallWithdrawAmount);
      const userBalanceAfterWithdraw = await want.balanceOf(selfAddress);
      const ltvAfter = await strategy.calculateLTV();
      console.log(`ltvAfter: ${ltvAfter}`);
      expect(ltvAfter).to.be.closeTo(newLTV, allowedLTVDrift);

      const securityFee = 10;
      const percentDivisor = 10000;
      const withdrawFee = smallWithdrawAmount.mul(securityFee).div(percentDivisor);
      const expectedBalance = userBalance.add(smallWithdrawAmount).sub(withdrawFee);

      expect(userBalanceAfterWithdraw).to.be.closeTo(expectedBalance, depositAmount.div(2000));
    });

    it('should not change leverage on withdraw when still in the allowed LTV', async function () {
      const startingLTV = toWantUnit('0.7');
      await strategy.setTargetLtv(startingLTV);
      const depositAmount = toWantUnit('100');

      await vault.connect(self).deposit(depositAmount);
      const ltvBefore = await strategy.calculateLTV();
      console.log(`ltvBefore: ${ltvBefore}`);
      const allowedLTVDrift = toWantUnit('0.01');
      expect(ltvBefore).to.be.closeTo(startingLTV, allowedLTVDrift);

      const userBalance = await want.balanceOf(selfAddress);
      const smallWithdrawAmount = toWantUnit('0.005');
      await vault.connect(self).withdraw(smallWithdrawAmount);
      const userBalanceAfterWithdraw = await want.balanceOf(selfAddress);
      const ltvAfter = await strategy.calculateLTV();
      console.log(`ltvAfter: ${ltvAfter}`);
      expect(ltvAfter).to.be.closeTo(startingLTV, allowedLTVDrift);

      const securityFee = 10;
      const percentDivisor = 10000;
      const withdrawFee = smallWithdrawAmount.mul(securityFee).div(percentDivisor);
      const expectedBalance = userBalance.add(smallWithdrawAmount).sub(withdrawFee);

      expect(userBalanceAfterWithdraw).to.be.closeTo(expectedBalance, depositAmount.div(2000));
    });

    it('should allow small withdrawal', async function () {
      const userBalance = await want.balanceOf(selfAddress);
      console.log(`userBalance: ${userBalance}`);
      const depositAmount = toWantUnit('1');
      await vault.connect(self).deposit(depositAmount);
      console.log(`await want.balanceOf(selfAddress): ${await want.balanceOf(selfAddress)}`);

      const whaleDepositAmount = toWantUnit('10000');
      await vault.connect(wantWhale).deposit(whaleDepositAmount);

      await vault.connect(self).withdrawAll();
      const newUserVaultBalance = await vault.balanceOf(selfAddress);
      console.log(`newUserVaultBalance: ${newUserVaultBalance}`);
      const userBalanceAfterWithdraw = await want.balanceOf(selfAddress);
      const securityFee = 10;
      const percentDivisor = 10000;
      const withdrawFee = (depositAmount * securityFee) / percentDivisor;
      const expectedBalance = userBalance.sub(withdrawFee);
      const smallDifference = depositAmount * 0.00001;
      console.log(`expectedBalance.sub(userBalanceAfterWithdraw): ${expectedBalance.sub(userBalanceAfterWithdraw)}`);
      console.log(`smallDifference: ${smallDifference}`);
      const isSmallBalanceDifference = expectedBalance.sub(userBalanceAfterWithdraw) < smallDifference;
      expect(isSmallBalanceDifference).to.equal(true);
    });

    it('should handle small deposit + withdraw', async function () {
      const userBalance = await want.balanceOf(selfAddress);
      console.log(`userBalance: ${userBalance}`);
      // "0.0000000000001" for 1e18
      const depositAmount = toWantUnit('0.001');

      await vault.connect(self).deposit(depositAmount);
      console.log(`await want.balanceOf(selfAddress): ${await want.balanceOf(selfAddress)}`);

      await vault.connect(self).withdraw(depositAmount);
      console.log(`await want.balanceOf(selfAddress): ${await want.balanceOf(selfAddress)}`);
      const newUserVaultBalance = await vault.balanceOf(selfAddress);
      console.log(`newUserVaultBalance: ${newUserVaultBalance}`);
      const userBalanceAfterWithdraw = await want.balanceOf(selfAddress);
      const securityFee = 10;
      const percentDivisor = 10000;
      const withdrawFee = (depositAmount * securityFee) / percentDivisor;
      const expectedBalance = userBalance.sub(withdrawFee);
      const isSmallBalanceDifference = expectedBalance.sub(userBalanceAfterWithdraw) < 1e10;
      console.log(`expectedBalance: ${expectedBalance}`);
      console.log(`userBalanceAfterWithdraw: ${userBalanceAfterWithdraw}`);
      expect(isSmallBalanceDifference).to.equal(true);
    });

    it('should be able to harvest', async function () {
      await vault.connect(self).deposit(toWantUnit('1000'));
      const estimatedGas = await strategy.estimateGas.harvest();
      console.log(`estimatedGas: ${estimatedGas}`);
      await strategy.connect(self).harvest();
    });

    it('should provide yield', async function () {
      const blocksToSkip = 100;
      const initialUserBalance = await want.balanceOf(selfAddress);
      const depositAmount = initialUserBalance.div(10);

      await vault.connect(self).deposit(depositAmount);
      const initialVaultBalance = await vault.balance();

      await strategy.updateHarvestLogCadence(1);

      const numHarvests = 2;
      for (let i = 0; i < numHarvests; i++) {
        await moveBlocksForward(blocksToSkip);
        await vault.connect(self).deposit(depositAmount);
        await strategy.harvest();
      }

      const finalVaultBalance = await vault.balance();
      expect(finalVaultBalance).to.be.gt(initialVaultBalance);

      const averageAPR = await strategy.averageAPRAcrossLastNHarvests(numHarvests);
      console.log(`Average APR across ${numHarvests} harvests is ${averageAPR} basis points.`);
    });
  });
  describe('Strategy', function () {
    it('should be able to pause and unpause', async function () {
      await strategy.pause();
      const depositAmount = toWantUnit('.05');
      await expect(vault.connect(self).deposit(depositAmount)).to.be.reverted;
      await strategy.unpause();
      await expect(vault.connect(self).deposit(depositAmount)).to.not.be.reverted;
    });

    it('should be able to panic', async function () {
      const depositAmount = toWantUnit('0.05');
      await vault.connect(self).deposit(depositAmount);
      const vaultBalance = await vault.balance();
      const strategyBalance = await strategy.balanceOf();
      // await strategy.panic();
      expect(vaultBalance).to.equal(strategyBalance);
      const newVaultBalance = await vault.balance();
      // 1e18 "0.000000001"
      const allowedImprecision = depositAmount.div(200);
      expect(newVaultBalance).to.be.closeTo(vaultBalance, allowedImprecision);
    });

    it('should be able to set withdraw slippage tolerance', async function () {
      const startingSlippageTolerance = await strategy.withdrawSlippageTolerance();
      console.log(`slippageTolerance ${startingSlippageTolerance}`);

      const newSlippage = 200;
      await strategy.setWithdrawSlippageTolerance(newSlippage);

      const endingSlippageTolerance = await strategy.withdrawSlippageTolerance();
      expect(endingSlippageTolerance).to.equal(newSlippage);
    });
  });
});
