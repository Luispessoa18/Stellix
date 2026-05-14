/**
 * Teste do fluxo de sponsored payment na testnet.
 *
 * Setup:
 *   1. Precisa de STELLAR_SECRET_KEY no .env (conta treasury com XLM testnet)
 *   2. Cria dois keypairs novos
 *   3. Funda ambos via Friendbot (testnet)
 *   4. Configura trustline USDC no sender (patrocinada pela treasury)
 *   5. Admin credita USDC no sender (via admin panel ou diretamente)
 *   6. Executa sponsored payment
 *
 * Uso: npx tsx stellar/scripts/test-sponsored.ts
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import { calcFee, USDC_ASSET, sendSponsoredUsdc, sponsorUsdcTrustline } from '../sponsored.js';
import * as dotenv from 'dotenv';

dotenv.config();

const IS_TESTNET = (process.env.STELLAR_NETWORK || 'testnet') === 'testnet';

if (!IS_TESTNET) {
  console.error('❌  Este script só roda em STELLAR_NETWORK=testnet');
  process.exit(1);
}

const TREASURY_SECRET = process.env.STELLAR_SECRET_KEY;
const TREASURY_PUBLIC = process.env.STELLAR_PUBLIC_KEY;

if (!TREASURY_SECRET || !TREASURY_PUBLIC) {
  console.error('❌  Configure STELLAR_SECRET_KEY e STELLAR_PUBLIC_KEY no .env');
  process.exit(1);
}

const horizon = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');

async function friendbot(publicKey: string) {
  const res = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
  if (!res.ok) throw new Error(`Friendbot falhou: ${await res.text()}`);
  console.log(`  ✓ Friendbot fundou ${publicKey.slice(0, 8)}...`);
}

async function main() {
  console.log('\n🚀  Teste Sponsored Payment — StellixPay Testnet\n');
  console.log(`Treasury: ${TREASURY_PUBLIC}\n`);

  // 1. Gera keypairs para sender e recipient
  const sender = StellarSdk.Keypair.random();
  const recipient = StellarSdk.Keypair.random();
  console.log(`Sender:    ${sender.publicKey()}`);
  console.log(`Recipient: ${recipient.publicKey()}\n`);

  // 2. Funda as contas via Friendbot (testnet only)
  console.log('Fundando contas via Friendbot...');
  await friendbot(sender.publicKey());
  await friendbot(recipient.publicKey());
  await new Promise((r) => setTimeout(r, 3000)); // aguarda ledger

  // 3. Setup trustlines USDC (patrocinadas pela treasury)
  console.log('\nConfigurando trustlines USDC (patrocinadas pela treasury)...');
  await sponsorUsdcTrustline({
    userPublicKey: sender.publicKey(),
    userSecretKey: sender.secret(),
    treasurySecretKey: TREASURY_SECRET!,
  });
  console.log('  ✓ Trustline USDC configurada para sender');

  await sponsorUsdcTrustline({
    userPublicKey: recipient.publicKey(),
    userSecretKey: recipient.secret(),
    treasurySecretKey: TREASURY_SECRET!,
  });
  console.log('  ✓ Trustline USDC configurada para recipient');

  // 4. Verifica saldo sender antes (deveria ser 0 USDC)
  const senderAccountBefore = await horizon.loadAccount(sender.publicKey());
  const usdcBefore = senderAccountBefore.balances.find((b: any) => b.asset_code === 'USDC');
  console.log(`\nSaldo USDC sender antes: ${usdcBefore?.balance ?? '0'}`);
  console.log('→ Para testar o envio, credite USDC via admin panel e rode novamente.\n');

  // 5. Simula cálculo de taxa
  const testAmount = 10;
  const { fee, net } = calcFee(testAmount);
  console.log(`Simulação envio de ${testAmount} USDC:`);
  console.log(`  Destino recebe: ${net} USDC`);
  console.log(`  Taxa StellixPay: ${fee} USDC`);
  console.log(`  Gas XLM: patrocinado pela treasury ✓`);

  // 6. Se sender tiver USDC, executa o envio real
  if (usdcBefore && parseFloat(usdcBefore.balance) >= testAmount) {
    console.log('\n💸  Executando sponsored payment...');
    const result = await sendSponsoredUsdc({
      senderSecretKey: sender.secret(),
      recipientPublicKey: recipient.publicKey(),
      grossAmount: testAmount,
      treasurySecretKey: TREASURY_SECRET!,
      platformPublicKey: TREASURY_PUBLIC!,
    });
    console.log(`  ✓ Hash: ${result.hash}`);
    console.log(`  ✓ Fee: ${result.breakdown.fee} USDC`);
    console.log(`  ✓ Net: ${result.breakdown.net} USDC`);
    console.log(`  Explorer: https://stellar.expert/explorer/testnet/tx/${result.hash}`);
  } else {
    console.log('\n⚠️  Sender sem USDC suficiente. Credite via admin e rode novamente.');
    console.log(`  Endereço sender para crédito: ${sender.publicKey()}`);
  }

  console.log('\n✅  Setup concluído!');
  console.log('Mainnet migration: mude STELLAR_NETWORK=mainnet no .env\n');
}

main().catch((e) => {
  console.error('\n❌  Erro:', e?.response?.data || e?.message || e);
  process.exit(1);
});
