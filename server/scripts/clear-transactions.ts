import { createClient } from '@libsql/client';
import path from 'path';

const dbPath = path.resolve('data', 'stellix.db');
const db = createClient({ url: `file:${dbPath}` });

const before = await db.execute({
  sql: 'SELECT COUNT(*) AS count FROM transactions',
  args: [],
});

await db.execute({
  sql: 'DELETE FROM transactions',
  args: [],
});

const after = await db.execute({
  sql: 'SELECT COUNT(*) AS count FROM transactions',
  args: [],
});

console.log(`Historico de transacoes zerado: ${before.rows[0].count} -> ${after.rows[0].count}`);
