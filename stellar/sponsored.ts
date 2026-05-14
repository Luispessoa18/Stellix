/**
 * Sponsored / Abstracted Payments — StellixPay
 *
 * Fluxo:
 *   1. User assina inner transaction (move USDC)
 *   2. Treasury envolve em fee-bump transaction (paga XLM gas)
 *   3. Usuário NUNCA precisa ter XLM
 *
 * Testnet → Mainnet: só mude STELLAR_NETWORK no .env
 */

import * as StellarSdk from '@stellar/stellar-sdk';

const NETWORK = process.env.STELLAR_NETWORK || 'testnet';
const IS_TESTNET = NETWORK === 'testnet';

const server = IS_TESTNET
  ? new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org')
  : new StellarSdk.Horizon.Server('https://horizon.stellar.org');

const NETWORK_PASSPHRASE = IS_TESTNET
  ? StellarSdk.Networks.TESTNET
  : StellarSdk.Networks.PUBLIC;

// Circle USDC issuer
const USDC_ISSUER = IS_TESTNET
  ? 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
  : 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';

export const USDC_ASSET = new StellarSdk.Asset('USDC', USDC_ISSUER);

// Platform fee: 1% com mínimo de 0.001 USDC
export const FEE_RATE = 0.01;
export const FEE_MIN = 0.001;

export interface FeeBreakdown {
  gross: number;    // valor total enviado
  fee: number;      // taxa StellixPay
  net: number;      // valor que chega no destino
  feeRate: number;  // e.g. 0.01 = 1%
  sponsored: boolean;
}

export function calcFee(grossAmount: number): FeeBreakdown {
  const fee = parseFloat(Math.max(grossAmount * FEE_RATE, FEE_MIN).toFixed(7));
  const net = parseFloat((grossAmount - fee).toFixed(7));
  return { gross: grossAmount, fee, net, feeRate: FEE_RATE, sponsored: true };
}

/**
 * Envia USDC com taxa embutida e gas pago pela treasury.
 * O usuário assina a transação interna; a treasury cobre o XLM fee.
 */
export async function sendSponsoredUsdc({
  senderSecretKey,
  recipientPublicKey,
  grossAmount,
  treasurySecretKey,
  platformPublicKey,
}: {
  senderSecretKey: string;
  recipientPublicKey: string;
  grossAmount: number;
  treasurySecretKey: string;
  platformPublicKey: string;  // onde vai a taxa 1%
}): Promise<{ hash: string; breakdown: FeeBreakdown }> {
  const breakdown = calcFee(grossAmount);

  const senderKP = StellarSdk.Keypair.fromSecret(senderSecretKey);
  const treasuryKP = StellarSdk.Keypair.fromSecret(treasurySecretKey);

  // Carrega a conta do usuário na rede
  const senderAccount = await server.loadAccount(senderKP.publicKey());

  /**
   * Inner transaction:
   *   Op 1: sender → recipient  (valor líquido)
   *   Op 2: sender → platform   (taxa 1%)
   *   fee = "0" porque será coberto pelo fee bump
   */
  const innerTx = new StellarSdk.TransactionBuilder(senderAccount, {
    fee: '0',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(StellarSdk.Operation.payment({
      destination: recipientPublicKey,
      asset: USDC_ASSET,
      amount: breakdown.net.toFixed(7),
    }))
    .addOperation(StellarSdk.Operation.payment({
      destination: platformPublicKey,
      asset: USDC_ASSET,
      amount: breakdown.fee.toFixed(7),
    }))
    .setTimeout(30)
    .build();

  // Usuário assina a inner tx
  innerTx.sign(senderKP);

  /**
   * Fee bump transaction:
   *   Treasury paga o XLM gas
   *   Usuário jamais precisa ter XLM
   */
  const feeBumpTx = StellarSdk.TransactionBuilder.buildFeeBumpTransaction(
    treasuryKP,
    String(parseInt(StellarSdk.BASE_FEE) * 3), // 3x base fee = prioridade
    innerTx as StellarSdk.Transaction,
    NETWORK_PASSPHRASE,
  );
  feeBumpTx.sign(treasuryKP);

  const result = await server.submitTransaction(feeBumpTx);

  // fee_charged vem em stroops (1 XLM = 10_000_000 stroops)
  const gasXlm = parseInt((result as any).fee_charged ?? '0') / 10_000_000;

  return { hash: result.hash, breakdown, gasXlm };
}

/**
 * Cria e patrocina uma conta de usuário nova.
 * Treasury paga:
 *   - Base reserve da conta (1 XLM)
 *   - Reserve da trustline USDC (0.5 XLM)
 * Usuário final: 0 XLM necessário.
 *
 * Requer: ambos treasury e user assinam.
 */
export async function createSponsoredAccount({
  userPublicKey,
  userSecretKey,
  treasurySecretKey,
}: {
  userPublicKey: string;
  userSecretKey: string;
  treasurySecretKey: string;
}): Promise<void> {
  const treasuryKP = StellarSdk.Keypair.fromSecret(treasurySecretKey);
  const userKP = StellarSdk.Keypair.fromSecret(userSecretKey);

  const treasuryAccount = await server.loadAccount(treasuryKP.publicKey());

  const tx = new StellarSdk.TransactionBuilder(treasuryAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    // — Bloco 1: patrocina criação da conta —
    .addOperation(StellarSdk.Operation.beginSponsoringFutureReserves({
      sponsoredId: userPublicKey,
      source: treasuryKP.publicKey(),
    }))
    .addOperation(StellarSdk.Operation.createAccount({
      destination: userPublicKey,
      startingBalance: '0', // 0 XLM — treasury cobre o base reserve
    }))
    .addOperation(StellarSdk.Operation.endSponsoringFutureReserves({
      source: userPublicKey,
    }))
    // — Bloco 2: patrocina trustline USDC —
    .addOperation(StellarSdk.Operation.beginSponsoringFutureReserves({
      sponsoredId: userPublicKey,
      source: treasuryKP.publicKey(),
    }))
    .addOperation(StellarSdk.Operation.changeTrust({
      asset: USDC_ASSET,
      source: userPublicKey,
    }))
    .addOperation(StellarSdk.Operation.endSponsoringFutureReserves({
      source: userPublicKey,
    }))
    .setTimeout(30)
    .build();

  // Ambos assinam — treasury paga, user autoriza os ops com source=userPublicKey
  tx.sign(treasuryKP);
  tx.sign(userKP);

  await server.submitTransaction(tx);
}

/**
 * Configura apenas a trustline USDC para uma conta existente.
 * Treasury patrocina o reserve da trustline (0.5 XLM).
 */
export async function sponsorUsdcTrustline({
  userPublicKey,
  userSecretKey,
  treasurySecretKey,
}: {
  userPublicKey: string;
  userSecretKey: string;
  treasurySecretKey: string;
}): Promise<void> {
  const treasuryKP = StellarSdk.Keypair.fromSecret(treasurySecretKey);
  const userKP = StellarSdk.Keypair.fromSecret(userSecretKey);

  const treasuryAccount = await server.loadAccount(treasuryKP.publicKey());

  const tx = new StellarSdk.TransactionBuilder(treasuryAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(StellarSdk.Operation.beginSponsoringFutureReserves({
      sponsoredId: userPublicKey,
      source: treasuryKP.publicKey(),
    }))
    .addOperation(StellarSdk.Operation.changeTrust({
      asset: USDC_ASSET,
      source: userPublicKey,
    }))
    .addOperation(StellarSdk.Operation.endSponsoringFutureReserves({
      source: userPublicKey,
    }))
    .setTimeout(30)
    .build();

  tx.sign(treasuryKP);
  tx.sign(userKP);

  await server.submitTransaction(tx);
}

/**
 * Envia qualquer asset via feebump — sem taxa de plataforma.
 * Usado no PIX OUT: user envia USDC para endereço de payin do GetMoons,
 * treasury patrocina o XLM gas (fee bump).
 */
export async function sendFeeBumped({
  senderSecretKey,
  destinationPublicKey,
  amount,
  asset = USDC_ASSET,
  treasurySecretKey,
}: {
  senderSecretKey: string;
  destinationPublicKey: string;
  amount: number;
  asset?: StellarSdk.Asset;
  treasurySecretKey: string;
}): Promise<{ hash: string; gasXlm: number }> {
  const senderKP = StellarSdk.Keypair.fromSecret(senderSecretKey);
  const treasuryKP = StellarSdk.Keypair.fromSecret(treasurySecretKey);
  const senderAccount = await server.loadAccount(senderKP.publicKey());

  const innerTx = new StellarSdk.TransactionBuilder(senderAccount, {
    fee: '0',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(StellarSdk.Operation.payment({
      destination: destinationPublicKey,
      asset,
      amount: amount.toFixed(7),
    }))
    .setTimeout(30)
    .build();

  innerTx.sign(senderKP);

  const feeBumpTx = StellarSdk.TransactionBuilder.buildFeeBumpTransaction(
    treasuryKP,
    String(parseInt(StellarSdk.BASE_FEE) * 3),
    innerTx as StellarSdk.Transaction,
    NETWORK_PASSPHRASE,
  );
  feeBumpTx.sign(treasuryKP);

  const result = await server.submitTransaction(feeBumpTx);
  const gasXlm = parseInt((result as any).fee_charged ?? '0') / 10_000_000;
  return { hash: result.hash, gasXlm };
}

/**
 * Verifica se uma conta tem trustline USDC ativa.
 */
export async function hasUsdcTrustline(publicKey: string): Promise<boolean> {
  try {
    const account = await server.loadAccount(publicKey);
    return account.balances.some(
      (b: any) => b.asset_type !== 'native' && b.asset_code === 'USDC',
    );
  } catch {
    return false;
  }
}
