import * as StellarSdk from '@stellar/stellar-sdk';

const NETWORK = process.env.STELLAR_NETWORK || 'testnet';
const IS_TESTNET = NETWORK === 'testnet';

const server = IS_TESTNET
  ? new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org')
  : new StellarSdk.Horizon.Server('https://horizon.stellar.org');

const NETWORK_PASSPHRASE = IS_TESTNET
  ? StellarSdk.Networks.TESTNET
  : StellarSdk.Networks.PUBLIC;

const FRIENDBOT_URL = 'https://friendbot.stellar.org';

// Assets USDC e USDT no testnet (emitidos por Circle e Moneygram)
// Em produção trocar pelos issuer corretos
const USDC_ASSET = IS_TESTNET
  ? new StellarSdk.Asset('USDC', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5')
  : new StellarSdk.Asset('USDC', 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN');

/**
 * Busca o preço atual de XLM em USD via CoinGecko.
 */
export async function getXlmPrice(): Promise<number> {
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd');
    const data = await r.json() as any;
    return Number(data?.stellar?.usd) || 0;
  } catch {
    return 0;
  }
}

/**
 * Cria um novo par de chaves Stellar (não ativa na rede ainda).
 */
export function createKeypair() {
  const keypair = StellarSdk.Keypair.random();
  return {
    publicKey: keypair.publicKey(),
    secretKey: keypair.secret(),
  };
}

/**
 * Cria e ativa uma conta no testnet usando o Friendbot.
 * Retorna publicKey e secretKey.
 */
export async function createStellarAccount() {
  const keypair = StellarSdk.Keypair.random();
  const publicKey = keypair.publicKey();
  const secretKey = keypair.secret();

  if (IS_TESTNET) {
    await fundTestnetAccount(publicKey);
  }

  return { publicKey, secretKey };
}

/**
 * Funda uma conta no testnet via Friendbot (10.000 XLM).
 */
export async function fundTestnetAccount(publicKey: string): Promise<void> {
  const response = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(publicKey)}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Friendbot falhou: ${text}`);
  }
}

/**
 * Busca os saldos de uma conta na rede Stellar.
 */
export async function getAccountBalance(publicKey: string) {
  const account = await server.loadAccount(publicKey);
  return account.balances.map((b: any) => ({
    asset: b.asset_type === 'native' ? 'XLM' : `${b.asset_code}:${b.asset_issuer}`,
    assetCode: b.asset_type === 'native' ? 'XLM' : b.asset_code,
    balance: b.balance,
    limit: b.limit,
  }));
}

interface SendPaymentParams {
  sourceSecretKey: string;
  destinationPublicKey: string;
  amount: string;
  asset: 'USDC' | 'USDT' | 'XLM' | string;
  memo?: string;
}

/**
 * Envia um pagamento na rede Stellar.
 */
export async function sendPayment({ sourceSecretKey, destinationPublicKey, amount, asset, memo }: SendPaymentParams) {
  const sourceKeypair = StellarSdk.Keypair.fromSecret(sourceSecretKey);
  const sourceAccount = await server.loadAccount(sourceKeypair.publicKey());

  let stellarAsset: StellarSdk.Asset;
  if (asset === 'XLM') {
    stellarAsset = StellarSdk.Asset.native();
  } else if (asset === 'USDC') {
    stellarAsset = USDC_ASSET;
  } else {
    stellarAsset = new StellarSdk.Asset(asset, process.env.ASSET_ISSUER || '');
  }

  const txBuilder = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: destinationPublicKey,
        asset: stellarAsset,
        amount,
      })
    )
    .setTimeout(30);

  if (memo) {
    txBuilder.addMemo(StellarSdk.Memo.text(memo));
  }

  const transaction = txBuilder.build();
  transaction.sign(sourceKeypair);

  const result = await server.submitTransaction(transaction);
  return {
    hash: result.hash,
    ledger: result.ledger,
  };
}

/**
 * Adiciona um trustline para um asset (necessário antes de receber USDC/USDT).
 */
export async function addTrustline(secretKey: string, asset: StellarSdk.Asset) {
  const keypair = StellarSdk.Keypair.fromSecret(secretKey);
  const account = await server.loadAccount(keypair.publicKey());

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(StellarSdk.Operation.changeTrust({ asset }))
    .setTimeout(30)
    .build();

  tx.sign(keypair);
  return server.submitTransaction(tx);
}
