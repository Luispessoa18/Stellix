import { Router } from 'express';
import crypto from 'crypto';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import db, { balanceCol } from '../db.js';
import { encryptText, decryptText } from '../lib/encryption.js';
import { verifyTotp } from '../lib/totp.js';

const router = Router();
router.use(authMiddleware);

router.get('/keys', async (req: AuthRequest, res) => {
  const keys = await db.execute({
    sql: 'SELECT id, name, key_prefix, balance_usdc, total_spent, total_calls, is_active, created_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC',
    args: [req.userId!],
  });
  res.json(keys.rows);
});

router.post('/keys', async (req: AuthRequest, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

  const rawKey = `sk_live_${crypto.randomBytes(24).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.slice(0, 16) + '...';

  const encryptedKey = encryptText(rawKey);

  const result = await db.execute({
    sql: 'INSERT INTO api_keys (user_id, name, key_hash, key_prefix, encrypted_key) VALUES (?, ?, ?, ?, ?)',
    args: [req.userId!, name.trim(), keyHash, keyPrefix, encryptedKey],
  });

  res.json({ id: result.lastInsertRowid, name, key: rawKey, keyPrefix, balanceUsdc: 0 });
});

router.patch('/keys/:id', async (req: AuthRequest, res) => {
  const { name, is_active } = req.body;
  await db.execute({
    sql: 'UPDATE api_keys SET name = COALESCE(?, name), is_active = COALESCE(?, is_active) WHERE id = ? AND user_id = ?',
    args: [name ?? null, is_active ?? null, req.params.id, req.userId!],
  });
  res.json({ success: true });
});

// Revelar chave completa (com verificação 2FA se ativo)
router.post('/keys/:id/reveal', async (req: AuthRequest, res) => {
  const { totpCode } = req.body;
  const keyRow = await db.execute({
    sql: 'SELECT encrypted_key FROM api_keys WHERE id = ? AND user_id = ? AND is_active = 1',
    args: [req.params.id, req.userId!],
  });
  if (!keyRow.rows.length) { res.status(404).json({ error: 'Chave não encontrada' }); return; }
  const k = keyRow.rows[0] as any;
  if (!k.encrypted_key) { res.status(400).json({ error: 'Esta chave foi criada antes do recurso de revelar. Crie uma nova chave.' }); return; }

  const userRow = await db.execute({
    sql: 'SELECT totp_enabled, totp_secret FROM users WHERE id = ?',
    args: [req.userId!],
  });
  const u = userRow.rows[0] as any;
  if (u?.totp_enabled && u?.totp_secret) {
    if (!totpCode || !verifyTotp(u.totp_secret, String(totpCode))) {
      res.status(401).json({ error: 'Código 2FA obrigatório para ver a chave', requires2fa: true }); return;
    }
  }

  try {
    const fullKey = decryptText(k.encrypted_key);
    res.json({ key: fullKey });
  } catch {
    res.status(500).json({ error: 'Erro ao descriptografar chave' });
  }
});

// Logs de uso de uma chave
router.get('/keys/:id/logs', async (req: AuthRequest, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);

  const keyRow = await db.execute({
    sql: 'SELECT id FROM api_keys WHERE id = ? AND user_id = ?',
    args: [req.params.id, req.userId!],
  });
  if (!keyRow.rows.length) { res.status(404).json({ error: 'Chave não encontrada' }); return; }

  const logs = await db.execute({
    sql: `SELECT endpoint, method, cost_usdc, status_code, ip_address, created_at
          FROM api_usage WHERE api_key_id = ?
          ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    args: [req.params.id, limit, offset],
  });
  const total = await db.execute({ sql: 'SELECT COUNT(*) as n FROM api_usage WHERE api_key_id = ?', args: [req.params.id] });
  res.json({ logs: logs.rows, total: Number((total.rows[0] as any).n) });
});

router.delete('/keys/:id', async (req: AuthRequest, res) => {
  await db.execute({
    sql: 'UPDATE api_keys SET is_active = 0 WHERE id = ? AND user_id = ?',
    args: [req.params.id, req.userId!],
  });
  res.json({ success: true });
});

router.get('/usage', async (req: AuthRequest, res) => {
  const keys = await db.execute({
    sql: 'SELECT id FROM api_keys WHERE user_id = ?',
    args: [req.userId!],
  });
  if (!keys.rows.length) return res.json([]);
  const ids = keys.rows.map((r: any) => r.id);

  const usage = await db.execute({
    sql: `SELECT endpoint, method, COUNT(*) as calls, SUM(cost_usdc) as cost, date(created_at) as day
          FROM api_usage WHERE api_key_id IN (${ids.map(() => '?').join(',')})
          GROUP BY endpoint, method, day ORDER BY day DESC LIMIT 200`,
    args: ids,
  });
  res.json(usage.rows);
});

router.get('/summary', async (req: AuthRequest, res) => {
  const [keysRow, userRow] = await Promise.all([
    db.execute({
      sql: 'SELECT SUM(total_calls) as calls, SUM(total_spent) as spent FROM api_keys WHERE user_id = ? AND is_active = 1',
      args: [req.userId!],
    }),
    db.execute({
      sql: `SELECT ${balanceCol()} as balance FROM users WHERE id = ?`,
      args: [req.userId!],
    }),
  ]);
  const k = keysRow.rows[0] as any;
  const u = userRow.rows[0] as any;
  res.json({ calls: Number(k?.calls ?? 0), spent: Number(k?.spent ?? 0), balance: Number(u?.balance ?? 0) });
});

router.get('/webhooks', async (req: AuthRequest, res) => {
  const hooks = await db.execute({
    sql: 'SELECT id, name, url, events, is_active, created_at FROM webhooks WHERE user_id = ? ORDER BY created_at DESC',
    args: [req.userId!],
  });
  res.json(hooks.rows);
});

router.post('/webhooks', async (req: AuthRequest, res) => {
  const { name, url, events } = req.body;
  if (!url?.trim()) return res.status(400).json({ error: 'URL is required' });

  const { isSafeWebhookUrl } = await import('../lib/safeUrl.js');
  if (!isSafeWebhookUrl(url.trim())) {
    return res.status(400).json({ error: 'URL inválida ou não permitida (endereços internos bloqueados)' });
  }

  const secret = `whsec_${crypto.randomBytes(32).toString('hex')}`;
  const result = await db.execute({
    sql: 'INSERT INTO webhooks (user_id, name, url, events, secret) VALUES (?, ?, ?, ?, ?)',
    args: [req.userId!, name ?? null, url.trim(), JSON.stringify(events || ['charge.paid', 'transfer.completed']), secret],
  });
  res.json({ id: result.lastInsertRowid, name, url, events, secret });
});

router.delete('/webhooks/:id', async (req: AuthRequest, res) => {
  await db.execute({
    sql: 'DELETE FROM webhooks WHERE id = ? AND user_id = ?',
    args: [req.params.id, req.userId!],
  });
  res.json({ success: true });
});

router.post('/topup-instructions', async (req: AuthRequest, res) => {
  const { keyId } = req.body;
  const key = await db.execute({
    sql: 'SELECT id, name, balance_usdc FROM api_keys WHERE id = ? AND user_id = ?',
    args: [keyId, req.userId!],
  });
  if (!key.rows.length) return res.status(404).json({ error: 'Key not found' });

  const k = key.rows[0] as any;
  res.json({
    paymentAddress: process.env.STELLAR_PUBLIC_KEY || '',
    memo: `APIKEY-${k.id}`,
    asset: 'USDC',
    network: 'Stellar',
    minimumAmount: 1.0,
    currentBalance: k.balance_usdc,
    keyName: k.name,
  });
});

export default router;
