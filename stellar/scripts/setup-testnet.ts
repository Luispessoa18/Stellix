/**
 * Script: setup-testnet.ts
 * Cria e financia uma conta no testnet Stellar.
 *
 * Uso: npx tsx stellar/scripts/setup-testnet.ts
 */

import { createStellarAccount, getAccountBalance } from '../index.js';

async function main() {
  console.log('🌟 DolarPix — Setup Stellar Testnet\n');
  console.log('Criando nova conta no testnet...');

  const account = await createStellarAccount();

  console.log('\n✅ Conta criada e financiada com sucesso!\n');
  console.log('─────────────────────────────────────────────');
  console.log(`  Public Key : ${account.publicKey}`);
  console.log(`  Secret Key : ${account.secretKey}`);
  console.log('─────────────────────────────────────────────');
  console.log('\n⚠️  GUARDE A SECRET KEY em segurança! Nunca compartilhe.\n');

  console.log('Verificando saldo...');
  const balances = await getAccountBalance(account.publicKey);

  console.log('\n💰 Saldos da conta:');
  for (const b of balances) {
    console.log(`  ${b.assetCode}: ${b.balance}`);
  }

  console.log('\n📋 Adicione ao seu .env:');
  console.log(`  STELLAR_PUBLIC_KEY=${account.publicKey}`);
  console.log(`  STELLAR_SECRET_KEY=${account.secretKey}`);
  console.log(`  STELLAR_NETWORK=testnet`);
  console.log('\n🔗 Veja a conta no explorer:');
  console.log(`  https://stellar.expert/explorer/testnet/account/${account.publicKey}`);
  console.log('\n');
}

main().catch((err) => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
