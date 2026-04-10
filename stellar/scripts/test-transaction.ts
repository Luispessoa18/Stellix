/**
 * Script: test-transaction.ts
 * Testa envio de XLM entre duas contas no testnet.
 *
 * Uso: npx tsx stellar/scripts/test-transaction.ts
 */

import { createStellarAccount, sendPayment, getAccountBalance } from '../index.js';

async function main() {
  console.log('🧪 DolarPix — Teste de Transação Stellar (Testnet)\n');

  // Cria duas contas de teste
  console.log('Criando conta de origem...');
  const source = await createStellarAccount();
  console.log(`  ✅ Origem: ${source.publicKey}`);

  console.log('Criando conta de destino...');
  const dest = await createStellarAccount();
  console.log(`  ✅ Destino: ${dest.publicKey}`);

  // Mostra saldos antes
  console.log('\nSaldos ANTES da transação:');
  const sourceBalancesBefore = await getAccountBalance(source.publicKey);
  console.log(`  Origem: ${sourceBalancesBefore.find(b => b.assetCode === 'XLM')?.balance} XLM`);

  // Envia 10 XLM
  const amount = '10';
  console.log(`\nEnviando ${amount} XLM de origem para destino...`);

  const result = await sendPayment({
    sourceSecretKey: source.secretKey,
    destinationPublicKey: dest.publicKey,
    amount,
    asset: 'XLM',
    memo: 'Teste DolarPix',
  });

  console.log(`\n✅ Transação enviada!`);
  console.log(`  Hash    : ${result.hash}`);
  console.log(`  Ledger  : ${result.ledger}`);
  console.log(`  Explorer: https://stellar.expert/explorer/testnet/tx/${result.hash}`);

  // Mostra saldos depois
  console.log('\nSaldos DEPOIS da transação:');
  const sourceBalancesAfter = await getAccountBalance(source.publicKey);
  const destBalancesAfter = await getAccountBalance(dest.publicKey);
  console.log(`  Origem : ${sourceBalancesAfter.find(b => b.assetCode === 'XLM')?.balance} XLM`);
  console.log(`  Destino: ${destBalancesAfter.find(b => b.assetCode === 'XLM')?.balance} XLM`);
  console.log('\n✅ Teste concluído com sucesso!\n');
}

main().catch((err) => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
