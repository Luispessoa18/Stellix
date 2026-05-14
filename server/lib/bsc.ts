import { ethers } from 'ethers';

const BSC_RPC = 'https://bsc-dataseed.binance.org/';
const USDT_CONTRACT = '0x55d398326f99059fF775485246999027B3197955'; // BEP-20 USDT mainnet (18 decimals)

const USDT_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
];

export async function sendUsdtBsc(toAddress: string, amount: number): Promise<string> {
  const key = process.env.GETMOONS_BSC_TREASURY_KEY;
  if (!key) throw new Error('GETMOONS_BSC_TREASURY_KEY não configurado');

  const provider = new ethers.JsonRpcProvider(BSC_RPC);
  const wallet = new ethers.Wallet(key, provider);
  const usdt = new ethers.Contract(USDT_CONTRACT, USDT_ABI, wallet);

  const amountWei = ethers.parseUnits(amount.toFixed(6), 18);
  const tx = await usdt.transfer(toAddress, amountWei);
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function getUsdtBscBalance(address: string): Promise<number> {
  const provider = new ethers.JsonRpcProvider(BSC_RPC);
  const usdt = new ethers.Contract(USDT_CONTRACT, USDT_ABI, provider);
  const raw = await usdt.balanceOf(address) as bigint;
  return Number(ethers.formatUnits(raw, 18));
}
