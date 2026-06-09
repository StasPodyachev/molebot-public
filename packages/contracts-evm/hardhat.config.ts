import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import * as dotenv from 'dotenv';

dotenv.config();

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY ?? '0x0000000000000000000000000000000000000000000000000000000000000000';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.28',
    settings: {
      evmVersion: 'cancun',
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    mantle_sepolia: {
      url: 'https://rpc.sepolia.mantle.xyz',
      chainId: 5003,
      accounts: [DEPLOYER_PRIVATE_KEY],
    },
    mantle_mainnet: {
      url: 'https://rpc.mantle.xyz',
      chainId: 5000,
      accounts: [DEPLOYER_PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: {
      mantle_sepolia: process.env.MANTLE_SCAN_API_KEY ?? '',
      mantle_mainnet: process.env.MANTLE_SCAN_API_KEY ?? '',
    },
    customChains: [
      {
        network: 'mantle_sepolia',
        chainId: 5003,
        urls: {
          apiURL: 'https://explorer.sepolia.mantle.xyz/api',
          browserURL: 'https://explorer.sepolia.mantle.xyz',
        },
      },
      {
        network: 'mantle_mainnet',
        chainId: 5000,
        urls: {
          apiURL: 'https://explorer.mantle.xyz/api',
          browserURL: 'https://explorer.mantle.xyz',
        },
      },
    ],
  },
};

export default config;
