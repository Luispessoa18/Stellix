import { ACTIVE_NETWORK } from '../db.js';

export type NetworkName = 'testnet' | 'mainnet';

export function getActiveNetwork(): NetworkName {
  return ACTIVE_NETWORK;
}

export function getActiveWallet(user: any): {
  publicKey: string;
  secretKey: string;
  network: NetworkName;
} {
  if (ACTIVE_NETWORK === 'mainnet') {
    return {
      publicKey: (user.stellar_mainnet_public || user.stellar_public_key || '') as string,
      secretKey: (user.stellar_mainnet_secret || user.stellar_secret_key || '') as string,
      network: 'mainnet',
    };
  }
  return {
    publicKey: (user.stellar_testnet_public || user.stellar_public_key || '') as string,
    secretKey: (user.stellar_testnet_secret || user.stellar_secret_key || '') as string,
    network: 'testnet',
  };
}
