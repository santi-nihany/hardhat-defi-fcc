const { getNamedAccounts, ethers } = require("hardhat");
const { getWeth, AMOUNT } = require("../scripts/getWeth");

async function main() {
  await getWeth();
  const { deployer } = await getNamedAccounts();
  // Lending pool address provider: 0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5
  //
  const lendingPool = await getLendingPool(deployer);
  console.log(`Lending pool address: ${lendingPool.address}`);

  // approve aave contract & then deposit
  const wethTokenAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  await approveErc20(wethTokenAddress, lendingPool.address, AMOUNT, deployer);
  console.log("Depositing...");
  await lendingPool.deposit(wethTokenAddress, AMOUNT, deployer, 0);
  console.log("Deposited!");

  let { availableBorrowsETH, totalDebtETH } = await getBorrowUserData(
    lendingPool,
    deployer
  );

  const daiPriceFeedAddress = "0x773616E4d11A78F511299002da57A0a94577F1f4";
  const daiPrice = await getPrice(daiPriceFeedAddress, "DAI");
  const amountDAIToBorrow =
    availableBorrowsETH.toString() * 0.95 * (1 / daiPrice.toNumber());
  console.log(`You can borrow ${amountDAIToBorrow} DAI`);
  const amountDAIToBorrowWei = ethers.utils.parseEther(
    amountDAIToBorrow.toString()
  );
  //borrow
  const daiTokenAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
  await borrowDai(daiTokenAddress, lendingPool, amountDAIToBorrowWei, deployer);
  await getBorrowUserData(lendingPool, deployer);
  await repay(amountDAIToBorrowWei, daiTokenAddress, lendingPool, deployer);
  await getBorrowUserData(lendingPool, deployer);
}

async function repay(amount, daiAddress, lendingPool, account) {
  await approveErc20(daiAddress, lendingPool.address, amount, account);
  const repayTx = await lendingPool.repay(daiAddress, amount, 1, account);
  await repayTx.wait(1);
  console.log("Repaid!");
}

async function borrowDai(
  daiAddress,
  lendingPool,
  amountDaiToBorrowWei,
  account
) {
  const borrowTx = await lendingPool.borrow(
    daiAddress,
    amountDaiToBorrowWei,
    1,
    0,
    account
  );
  await borrowTx.wait(1);
  console.log("You've borrowed!!");
}

async function getPrice(address, crypto) {
  // since we are reading from the contract, we don't need a signer
  // sending -> need signer
  const daiEthPriceFeed = await ethers.getContractAt(
    "AggregatorV3Interface",
    address
  );
  const price = (await daiEthPriceFeed.latestRoundData())[1];
  console.log(`The ${crypto}/ETH price is ${price.toString()}`);
  return price;
}
async function getUSDTPrice() {
  // since we are reading from the contract, we don't need a signer
  // sending -> need signer
  const USDTEthPriceFeed = await ethers.getContractAt(
    "AggregatorV3Interface",
    "0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46"
  );
  const price = (await USDTEthPriceFeed.latestRoundData())[1];
  console.log(`The USDT/ETH price is ${price.toString()}`);
  return price;
}

async function getBorrowUserData(lendingPool, account) {
  const { totalCollateralETH, totalDebtETH, availableBorrowsETH } =
    await lendingPool.getUserAccountData(account);
  console.log(`You have ${totalCollateralETH} worth of ETH deposited.`);
  console.log(`You have ${totalDebtETH} worth of ETH borrowed.`);
  console.log(`You can borrow ${availableBorrowsETH} worth of ETH.`);
  return { availableBorrowsETH, totalDebtETH };
}

async function approveErc20(
  ERC20Address,
  spenderAddress,
  amountToSpend,
  account
) {
  const erc20Token = await ethers.getContractAt(
    "IERC20",
    ERC20Address,
    account
  );
  const tx = await erc20Token.approve(spenderAddress, amountToSpend);
  await tx.wait(1);
  console.log("Approved!");
}

async function getLendingPool(account) {
  const lendingPoolAddressProvider = await ethers.getContractAt(
    "ILendingPoolAddressesProvider",
    "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5",
    account //deployer
  );
  const lendingPoolAddress = await lendingPoolAddressProvider.getLendingPool();
  const lendingPool = await ethers.getContractAt(
    "ILendingPool",
    lendingPoolAddress,
    account
  );
  return lendingPool;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
