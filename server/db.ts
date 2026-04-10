import { createClient } from '@libsql/client';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const DB_PATH = path.join(dataDir, 'dolarpix.db');

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
  `);

  try { await db.execute({ sql: 'ALTER TABLE transactions ADD COLUMN usd_price_at_time REAL', args: [] }); } catch {}
  try { await db.execute({ sql: 'ALTER TABLE contacts ADD COLUMN linked_user_id INTEGER', args: [] }); } catch {}
  try { await db.execute({ sql: 'ALTER TABLE users ADD COLUMN latitude REAL', args: [] }); } catch {}
  try { await db.execute({ sql: 'ALTER TABLE users ADD COLUMN longitude REAL', args: [] }); } catch {}

  await runOffchainXlmBalanceFix();
  console.log('  Banco de dados inicializado');
}

export default db;
