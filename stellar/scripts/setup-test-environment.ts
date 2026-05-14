/**
 * Setup completo para testar sponsored payments na testnet.
 *
 * Estratégia: Cria um emissor de "USDC" de teste próprio
 * (conta separada na testnet) — 100% self-contained, sem faucets externos.
 *
 * O que faz:
 *   1. Funda treasury + usuário via Friendbot (XLM)
 *   2. Cria um emissor de USDC de teste (keypair novo)
 *   3. Configura trustlines para todos (patrocinadas pela treasury)
 *   4. Emite 1000 USDC de teste para o usuário
 *   5. Executa sponsored payment completo
 *   6. Mostra resultado com link para o explorer
 *
 * Uso: npm run stellar:setup-test
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import * as dotenv from 'dotenv';
import { createClient } from '@libsql/client';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if ((process.env.STELLAR_NETWORK || 'testnet') !== 'testnet') {
  console.error('❌  STELLAR_NETWORK deve ser "testnet" para este script');
  process.exit(1);
}

const horizon = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
const PASSPHRASE = StellarSdk.Networks.TESTNET;
const TREASURY_SECRET = process.env.STELLAR_SECRET_KEY!;
const TREASURY_PUBLIC = process.env.STELLAR_PUBLIC_KEY!;

if (!TREASURY_SECRET) { console.error('❌  STELLAR_SECRET_KEY não configurado'); process.exit(1); }

const db = createClient({ url: `file:${path.join(__dirname, '../../data/stellix.db')}` });

// ── helpers ────────────────────────────────────────────────────────────────

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function friendbot(pub: string) {
  const r = await fetch(`https://friendbot.stellar.org?addr=${pub}`);
  if (!r.ok) {
    const t = await r.text();
    if (!t.includes('already') && !t.includes('exists')) throw new Error(t);
  }
}

async function getBalance(pub: string, code = 'native') {
  try {
    const acc = await horizon.loadAccount(pub);
    const b = acc.balances.find((b: any) => code === 'native' ? b.asset_type === 'native' : b.asset_code === code);
    return b?.balance ?? '0';
  } catch { return null; }
}

async function submitTx(tx: any): Promise<string> {
  const r = await horizon.submitTransaction(tx);
  return r.hash;
}

// ── PASSO 1: Cria emissor de USDC de teste ─────────────────────────────────

async function createTestUsdcIssuer(): Promise<{ publicKey: string; secretKey: string }> {
  const kp = StellarSdk.Keypair.random();
  process.stdout.write(`  Fundando emissor via Friendbot…`);
  await friendbot(kp.publicKey());
  await sleep(3000);
  console.log(' ✓');
  return { publicKey: kp.publicKey(), secretKey: kp.secret() };
}

// ── PASSO 2: Setup trustline (patrocinada pela treasury) ───────────────────

async function addSponsoredTrustline(
  usdcAsset: StellarSdk.Asset,
  userPub: string,
  userSecret: string,
) {
  try {
    const acc = await horizon.loadAccount(userPub);
    if (acc.balances.some((b: any) => b.asset_code === 'USDC' && b.asset_issuer === usdcAsset.issuer)) {
      process.stdout.write(' (já existe)');
      return;
    }
  } catch {}

  const treasuryKP = StellarSdk.Keypair.fromSecret(TREASURY_SECRET);
  const userKP = StellarSdk.Keypair.fromSecret(userSecret);
  const treasuryAcc = await horizon.loadAccount(treasuryKP.publicKey());

  const tx = new StellarSdk.TransactionBuilder(treasuryAcc, { fee: StellarSdk.BASE_FEE, networkPassphrase: PASSPHRASE })
    .addOperation(StellarSdk.Operation.beginSponsoringFutureReserves({ sponsoredId: userPub, source: treasuryKP.publicKey() }))
    .addOperation(StellarSdk.Operation.changeTrust({ asset: usdcAsset, source: userPub }))
    .addOperation(StellarSdk.Operation.endSponsoringFutureReserves({ source: userPub }))
    .setTimeout(30)
    .build();

  tx.sign(treasuryKP, userKP);
  const hash = await submitTx(tx);
  process.stdout.write(` ✓ (${hash.slice(0, 10)}…)`);
}

// ── PASSO 3: Emite USDC de teste ───────────────────────────────────────────

async function issueUsdc(usdcAsset: StellarSdk.Asset, issuerSecret: string, destPub: string, amount: string) {
  const issuerKP = StellarSdk.Keypair.fromSecret(issuerSecret);
  const issuerAcc = await horizon.loadAccount(issuerKP.publicKey());

  const tx = new StellarSdk.TransactionBuilder(issuerAcc, { fee: StellarSdk.BASE_FEE, networkPassphrase: PASSPHRASE })
    .addOperation(StellarSdk.Operation.payment({ destination: destPub, asset: usdcAsset, amount }))
    .setTimeout(30)
    .build();

  tx.sign(issuerKP);
  return submitTx(tx);
}

// ── PASSO 4: Sponsored payment (fee-bump) ─────────────────────────────────

async function runSponsoredPayment(
  usdcAsset: StellarSdk.Asset,
  senderSecret: string,
  recipientPub: string,
  grossAmount: number,
) {
  const FEE = parseFloat(Math.max(grossAmount * 0.01, 0.001).toFixed(7));
  const NET = parseFloat((grossAmount - FEE).toFixed(7));

  const senderKP = StellarSdk.Keypair.fromSecret(senderSecret);
  const treasuryKP = StellarSdk.Keypair.fromSecret(TREASURY_SECRET);
  const senderAcc = await horizon.loadAccount(senderKP.publicKey());

  // Inner tx: user assina, fee=0
  const inner = new StellarSdk.TransactionBuilder(senderAcc, { fee: '0', networkPassphrase: PASSPHRASE })
    .addOperation(StellarSdk.Operation.payment({ destination: recipientPub, asset: usdcAsset, amount: NET.toFixed(7) }))
    .addOperation(StellarSdk.Operation.payment({ destination: TREASURY_PUBLIC, asset: usdcAsset, amount: FEE.toFixed(7) }))
    .setTimeout(30)
    .build();
  inner.sign(senderKP);

  // Fee bump: treasury paga XLM
  const bump = StellarSdk.TransactionBuilder.buildFeeBumpTransaction(
    treasuryKP,
    String(parseInt(StellarSdk.BASE_FEE) * 3),
    inner as StellarSdk.Transaction,
    PASSPHRASE,
  );
  bump.sign(treasuryKP);

  const hash = await submitTx(bump);
  return { hash, fee: FEE, net: NET };
}

// ── MAIN ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  StellixPay — Sponsored Payment Test (Testnet)           ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Treasury status
  const treasuryXlm = await getBalance(TREASURY_PUBLIC, 'native') ?? '0';
  console.log(`Treasury: ${TREASURY_PUBLIC}`);
  console.log(`  XLM: ${treasuryXlm}\n`);

  if (parseFloat(treasuryXlm) < 50) {
    process.stdout.write('Fundando treasury via Friendbot…');
    await friendbot(TREASURY_PUBLIC);
    await sleep(3000);
    console.log(' ✓');
  }

  // Busca usuário do DB
  const row = await db.execute({
    sql: 'SELECT name, email, stellar_public_key, stellar_secret_key FROM users ORDER BY id LIMIT 1',
    args: [],
  });
  const user = row.rows[0] as any;
  if (!user?.stellar_public_key || !user?.stellar_secret_key) {
    console.error('❌  Nenhum usuário com carteira Stellar. Registre-se no app primeiro.');
    process.exit(1);
  }

  // Funda conta do usuário se não existir
  const userXlm = await getBalance(user.stellar_public_key, 'native');
  if (!userXlm) {
    process.stdout.write(`Fundando ${user.email} via Friendbot…`);
    await friendbot(user.stellar_public_key);
    await sleep(3000);
    console.log(' ✓');
  }

  // ── Cria emissor de USDC de teste ───────────────────────────────────────
  console.log('\n[1/4] Criando emissor de USDC de teste…');
  const issuer = await createTestUsdcIssuer();
  const USDC = new StellarSdk.Asset('USDC', issuer.publicKey);
  console.log(`  Issuer: ${issuer.publicKey}`);

  // ── Configura trustlines ─────────────────────────────────────────────────
  console.log('\n[2/4] Configurando trustlines USDC…');

  // Treasury
  process.stdout.write('  Treasury:  ');
  {
    const kp = StellarSdk.Keypair.fromSecret(TREASURY_SECRET);
    const acc = await horizon.loadAccount(kp.publicKey());
    const hasTrust = acc.balances.some((b: any) => b.asset_code === 'USDC' && b.asset_issuer === USDC.issuer);
    if (!hasTrust) {
      const tx = new StellarSdk.TransactionBuilder(acc, { fee: StellarSdk.BASE_FEE, networkPassphrase: PASSPHRASE })
        .addOperation(StellarSdk.Operation.changeTrust({ asset: USDC }))
        .setTimeout(30)
        .build();
      tx.sign(kp);
      const h = await submitTx(tx);
      process.stdout.write(` ✓ (${h.slice(0, 10)}…)`);
    } else {
      process.stdout.write(' (já existe)');
    }
    console.log();
    await sleep(2000);
  }

  // Usuário (patrocinada)
  process.stdout.write(`  ${user.email}: `);
  await addSponsoredTrustline(USDC, user.stellar_public_key, user.stellar_secret_key);
  console.log();
  await sleep(2000);

  // Recipient de teste (keypair novo)
  const recipientKP = StellarSdk.Keypair.random();
  process.stdout.write(`  Recipient (novo): `);
  await friendbot(recipientKP.publicKey());
  await sleep(2000);
  await addSponsoredTrustline(USDC, recipientKP.publicKey(), recipientKP.secret());
  console.log();
  await sleep(2000);

  // ── Emite USDC ──────────────────────────────────────────────────────────
  console.log('\n[3/4] Emitindo USDC de teste para o usuário…');
  const mintHash = await issueUsdc(USDC, issuer.secretKey, user.stellar_public_key, '1000');
  console.log(`  ✓ 1000 USDC emitidos (${mintHash.slice(0, 12)}…)`);
  await sleep(3000);

  const usdcUser = await getBalance(user.stellar_public_key, 'USDC');
  console.log(`  Saldo usuário: ${usdcUser} USDC`);

  // ── Sponsored Payment! ──────────────────────────────────────────────────
  console.log('\n[4/4] Executando Sponsored Payment (10 USDC)…');
  console.log(`  Sender:    ${user.email} (${user.stellar_public_key.slice(0, 8)}…)`);
  console.log(`  Recipient: ${recipientKP.publicKey().slice(0, 8)}…`);
  console.log(`  Gross:     10 USDC`);
  console.log(`  Fee (1%):  0.10 USDC → treasury`);
  console.log(`  Gas:       0 XLM do usuário (treasury paga)`);

  const result = await runSponsoredPayment(USDC, user.stellar_secret_key, recipientKP.publicKey(), 10);
  await sleep(3000);

  const usdcAfterSender = await getBalance(user.stellar_public_key, 'USDC');
  const usdcRecipient = await getBalance(recipientKP.publicKey(), 'USDC');
  const usdcTreasuryAfter = await getBalance(TREASURY_PUBLIC, 'USDC');

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  ✅  SPONSORED PAYMENT EXECUTADO COM SUCESSO!');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`\n  Hash:               ${result.hash}`);
  console.log(`  Net ao recipient:   ${result.net} USDC`);
  console.log(`  Taxa StellixPay:    ${result.fee} USDC`);
  console.log(`  XLM pago pelo user: 0 ✓  (treasury patrocinadora)`);
  console.log(`\n  Saldo sender após:  ${usdcAfterSender} USDC`);
  console.log(`  Saldo recipient:    ${usdcRecipient} USDC`);
  console.log(`  Saldo treasury:     ${usdcTreasuryAfter} USDC (incl. fee coletada)`);
  console.log(`\n  🔗 Explorer:`);
  console.log(`  https://stellar.expert/explorer/testnet/tx/${result.hash}`);
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('Próximo passo: STELLAR_NETWORK=mainnet no .env');
  console.log('Deposite XLM na treasury e o fluxo é idêntico.');
  console.log('══════════════════════════════════════════════════════════\n');
}

main().catch((e: any) => {
  const codes = e?.response?.data?.extras?.result_codes;
  console.error('\n❌  Erro:', codes ? JSON.stringify(codes) : (e?.message ?? e));
  process.exit(1);
});
