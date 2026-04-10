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
  `);
  // Migrações não-destrutivas — ignoram erro se coluna já existir
  try { await db.execute({ sql: 'ALTER TABLE transactions ADD COLUMN usd_price_at_time REAL', args: [] }); } catch {}
  console.log('  ✅ Banco de dados inicializado');
}

export default db;
