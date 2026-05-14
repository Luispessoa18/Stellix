import { db } from '../db.js';

// Lê uma configuração: DB primeiro, fallback para env var
export async function getSetting(key: string, envFallback?: string): Promise<string> {
  const res = await db.execute({ sql: 'SELECT value FROM app_meta WHERE key = ?', args: [key] });
  const dbVal = res.rows[0]?.value as string | undefined;
  return dbVal || process.env[envFallback ?? ''] || '';
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.execute({
    sql: `INSERT INTO app_meta (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    args: [key, value],
  });
}

export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const k of keys) out[k] = await getSetting(k);
  return out;
}
