import { createClient } from '@libsql/client';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// ── Rede ativa ────────────────────────────────────────────────
// Um único banco de dados — usuários são compartilhados.
// Só balances e transações são isolados por rede.

const networkFile = path.join(dataDir, '.network');

function readNetworkFromFile(): 'testnet' | 'mainnet' {
  if (fs.existsSync(networkFile)) {
    const v = fs.readFileSync(networkFile, 'utf8').trim();
    if (v === 'mainnet') return 'mainnet';
  }
  return process.env.STELLAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
}

// Live binding — importadores sempre veem o valor atual
export let ACTIVE_NETWORK: 'testnet' | 'mainnet' = readNetworkFromFile();

export function setActiveNetwork(network: 'testnet' | 'mainnet') {
  ACTIVE_NETWORK = network;
  fs.writeFileSync(networkFile, network, 'utf8');
}

// Coluna de saldo da rede ativa (template-safe, só dois valores)
export const balanceCol = () =>
  ACTIVE_NETWORK === 'mainnet' ? 'balance_mainnet' : 'balance';

// Banco único — contém dados de ambas as redes
const DB_PATH = path.join(dataDir, 'stellix.db');

// Migração de nome: stellix-testnet.db → stellix.db
const legacyTestnet = path.join(dataDir, 'stellix-testnet.db');
if (fs.existsSync(legacyTestnet) && !fs.existsSync(DB_PATH)) {
  fs.renameSync(legacyTestnet, DB_PATH);
}

export const db = createClient({
  url: `file:${DB_PATH}`,
});

async function runOffchainXlmBalanceFix() {
  const migrationKey = 'fix_offchain_xlm_balance_v1';

  const existing = await db.execute({
    sql: 'SELECT value FROM app_meta WHERE key = ?',
    args: [migrationKey],
  });

  if (existing.rows.length > 0) return;

  const rows = await db.execute({
    sql: `
      SELECT user_id, COALESCE(SUM(amount), 0) AS total_xlm_credit
      FROM transactions
      WHERE status = 'completed'
        AND type = 'deposit'
        AND currency = 'XLM'
        AND counterparty = 'Admin Credit'
        AND (stellar_tx_hash IS NULL OR stellar_tx_hash = '')
      GROUP BY user_id
    `,
    args: [],
  });

  for (const row of rows.rows as any[]) {
    const userId = Number(row.user_id);
    const totalXlmCredit = Number(row.total_xlm_credit) || 0;
    if (totalXlmCredit <= 0) continue;

    await db.execute({
      sql: 'UPDATE users SET balance = MAX(balance - ?, 0) WHERE id = ?',
      args: [totalXlmCredit, userId],
    });
  }

  await db.execute({
    sql: 'INSERT INTO app_meta (key, value) VALUES (?, ?)',
    args: [migrationKey, new Date().toISOString()],
  });
}

export async function initDb() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      email       TEXT    NOT NULL UNIQUE,
      phone       TEXT,
      password    TEXT    NOT NULL,
      stellar_public_key  TEXT,
      stellar_secret_key  TEXT,
      balance     REAL    DEFAULT 0,
      currency    TEXT    DEFAULT 'USD',
      created_at  TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id              TEXT    PRIMARY KEY,
      user_id         INTEGER NOT NULL REFERENCES users(id),
      type            TEXT    NOT NULL,
      amount          REAL    NOT NULL,
      currency        TEXT    NOT NULL DEFAULT 'USDC',
      counterparty    TEXT    NOT NULL,
      counterparty_address TEXT,
      stellar_tx_hash TEXT,
      status          TEXT    NOT NULL DEFAULT 'pending',
      created_at      TEXT    DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);

    CREATE TABLE IF NOT EXISTS contacts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name        TEXT    NOT NULL,
      identifier  TEXT    NOT NULL,
      stellar_public_key TEXT,
      created_at  TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payment_keys (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type        TEXT    NOT NULL,
      key_value   TEXT    NOT NULL UNIQUE,
      created_at  TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS app_meta (
      key         TEXT PRIMARY KEY,
      value       TEXT
    );

    CREATE TABLE IF NOT EXISTS pix_orders (
      id            TEXT    PRIMARY KEY,
      user_id       INTEGER NOT NULL REFERENCES users(id),
      type          TEXT    NOT NULL,
      status        TEXT    NOT NULL DEFAULT 'waiting',
      brl_amount    REAL    NOT NULL,
      usdt_amount   REAL    NOT NULL,
      pix_key       TEXT,
      qr_code       TEXT,
      tx_id         TEXT,
      bsc_tx_hash   TEXT,
      getmoons_data TEXT,
      created_at    TEXT    DEFAULT (datetime('now')),
      updated_at    TEXT    DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_pix_orders_user ON pix_orders(user_id);
  `);

  // carteiras separadas por rede
  try { await db.execute({ sql: 'ALTER TABLE users ADD COLUMN stellar_testnet_public TEXT', args: [] }); } catch {}
  try { await db.execute({ sql: 'ALTER TABLE users ADD COLUMN stellar_testnet_secret TEXT', args: [] }); } catch {}
  try { await db.execute({ sql: 'ALTER TABLE users ADD COLUMN stellar_mainnet_public TEXT', args: [] }); } catch {}
  try { await db.execute({ sql: 'ALTER TABLE users ADD COLUMN stellar_mainnet_secret TEXT', args: [] }); } catch {}
  // balance mainnet separado (testnet usa coluna balance original)
  try { await db.execute({ sql: 'ALTER TABLE users ADD COLUMN balance_mainnet REAL DEFAULT 0', args: [] }); } catch {}
  // network em transactions e pix_orders
  try { await db.execute({ sql: "ALTER TABLE transactions ADD COLUMN network TEXT NOT NULL DEFAULT 'testnet'", args: [] }); } catch {}
  try { await db.execute({ sql: "ALTER TABLE pix_orders ADD COLUMN network TEXT NOT NULL DEFAULT 'testnet'", args: [] }); } catch {}
  // copia chaves existentes para colunas testnet (migração de usuários antigos)
  await db.execute({
    sql: `UPDATE users SET stellar_testnet_public = stellar_public_key, stellar_testnet_secret = stellar_secret_key
          WHERE stellar_testnet_public IS NULL AND stellar_public_key IS NOT NULL`,
    args: [],
  });
  try { await db.execute({ sql: 'ALTER TABLE transactions ADD COLUMN usd_price_at_time REAL', args: [] }); } catch {}
  try { await db.execute({ sql: 'ALTER TABLE contacts ADD COLUMN linked_user_id INTEGER', args: [] }); } catch {}
  try { await db.execute({ sql: 'ALTER TABLE users ADD COLUMN latitude REAL', args: [] }); } catch {}
  try { await db.execute({ sql: 'ALTER TABLE users ADD COLUMN longitude REAL', args: [] }); } catch {}
  // profit tracking (sponsored payments)
  try { await db.execute({ sql: 'ALTER TABLE transactions ADD COLUMN platform_fee_usdc REAL DEFAULT 0', args: [] }); } catch {}
  try { await db.execute({ sql: 'ALTER TABLE transactions ADD COLUMN gas_cost_xlm REAL DEFAULT 0', args: [] }); } catch {}
  try { await db.execute({ sql: 'ALTER TABLE transactions ADD COLUMN gas_cost_usd REAL DEFAULT 0', args: [] }); } catch {}
  try { await db.execute({ sql: 'ALTER TABLE transactions ADD COLUMN sponsored INTEGER DEFAULT 0', args: [] }); } catch {}

  await runOffchainXlmBalanceFix();
  await generateMissingMainnetWallets();
  console.log(`  Banco de dados inicializado [${ACTIVE_NETWORK}]`);
}

async function generateMissingMainnetWallets() {
  // Importa createKeypair de forma lazy para não depender de stellar no topo do módulo
  const { createKeypair } = await import('../stellar/index.js');

  const rows = await db.execute({
    sql: 'SELECT id FROM users WHERE stellar_mainnet_public IS NULL OR stellar_mainnet_public = \'\'',
    args: [],
  });

  if (rows.rows.length === 0) return;

  console.log(`  Gerando carteiras mainnet para ${rows.rows.length} usuário(s)…`);
  for (const row of rows.rows) {
    const { publicKey, secretKey } = createKeypair();
    await db.execute({
      sql: 'UPDATE users SET stellar_mainnet_public = ?, stellar_mainnet_secret = ? WHERE id = ?',
      args: [publicKey, secretKey, row.id as number],
    });
  }
  console.log('  Carteiras mainnet geradas.');
}

export default db;
