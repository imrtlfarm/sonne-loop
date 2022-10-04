require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config();
require('@openzeppelin/hardhat-upgrades');

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const OPSCAN_KEY = process.env.OPSCAN_API_KEY;

module.exports = {
  networks: {
    optimism: {
      url: 'https://late-fragrant-rain.optimism.quiknode.pro/70171d2e7790f3af6a833f808abe5e85ed6bd881/',
      chainId: 10,
      accounts: [`0x${PRIVATE_KEY}`],
    },
    opera: {
      url: 'https://late-wild-fire.fantom.quiknode.pro/',
      accounts: [`0x${PRIVATE_KEY}`],
    },
  },
  solidity: {
    compilers: [
      {
        version: '0.8.11',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: '0.6.12',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  mocha: {
    timeout: 1000000,
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: 'USD',
  },
  contractSizer: {
    runOnCompile: true,
  },
};
