import { Router } from 'express';
import crypto from 'crypto';
import { x402Middleware, X402Request } from '../middleware/x402.js';
import db, { ACTIVE_NETWORK, balanceCol } from '../db.js';

const router = Router();
router.use(x402Middleware);

router.get('/balance', async (req: X402Request, res) => {
  const user = await db.execute({
    sql: `SELECT ${balanceCol()} as balance FROM users WHERE id = ?`,
    args: [req.apiKey!.userId],
  });
  res.json({ balance: Number((user.rows[0] as any)?.balance ?? 0), currency: 'USDC', network: ACTIVE_NETWORK });
});

router.get('/statement', async (req: X402Request, res) => {
  const txs = await db.execute({
    sql: `SELECT id, type, amount, currency, counterparty, status, network, created_at
          FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
    args: [req.apiKey!.userId],
  });
  res.json(txs.rows);
});

router.post('/send', async (req: X402Request, res) => {
  const { recipient, amount, memo } = req.body;
  if (!recipient?.trim() || !amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'recipient and amount required' });
  }

  const user = await db.execute({
    sql: `SELECT ${balanceCol()} as balance FROM users WHERE id = ?`,
    args: [req.apiKey!.userId],
  });
  const balance = Number((user.rows[0] as any)?.balance ?? 0);
  if (balance < Number(amount)) return res.status(400).json({ error: 'Insufficient balance' });

  const col = balanceCol();
  await db.execute({ sql: `UPDATE users SET ${col} = ${col} - ? WHERE id = ?`, args: [Number(amount), req.apiKey!.userId] });

  const txId = crypto.randomUUID();
  await db.execute({
    sql: "INSERT INTO transactions (id, user_id, type, amount, currency, counterparty, status, network) VALUES (?, ?, 'send', ?, 'USDC', ?, 'completed', ?)",
    args: [txId, req.apiKey!.userId, Number(amount), recipient.trim(), ACTIVE_NETWORK],
  });

  res.json({ success: true, txId, amount: Number(amount), recipient: recipient.trim(), memo: memo ?? null });
});

router.post('/charge', async (req: X402Request, res) => {
  const { title, amount_usdc, description, expires_in_hours, webhook_url } = req.body;
  if (!title?.trim() || !amount_usdc || Number(amount_usdc) <= 0) {
    return res.status(400).json({ error: 'title and amount_usdc required' });
  }

  const user = await db.execute({
    sql: 'SELECT stellar_public_key, stellar_testnet_public FROM users WHERE id = ?',
    args: [req.apiKey!.userId],
  });
  const u = user.rows[0] as any;
  const paymentAddress = u.stellar_testnet_public || u.stellar_public_key;
  if (!paymentAddress) return res.status(400).json({ error: 'No Stellar wallet configured' });

  const id = crypto.randomUUID();
  const shortId = id.slice(0, 8).toUpperCase();
  const expiresAt = expires_in_hours ? new Date(Date.now() + Number(expires_in_hours) * 3_600_000).toISOString() : null;
  const appUrl = (process.env.APP_URL || 'https://stellixpay.com').replace(/\/$/, '');
  const qrData = `${appUrl}/?charge=${id}`;

  const bizProfile = await db.execute({ sql: 'SELECT id FROM business_profiles WHERE user_id = ?', args: [req.apiKey!.userId] });
  const businessId = bizProfile.rows.length ? (bizProfile.rows[0] as any).id : null;

  await db.execute({
    sql: 'INSERT INTO charges (id, user_id, business_id, title, description, amount_usdc, payment_address, qr_data, expires_at, webhook_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [id, req.apiKey!.userId, businessId, title.trim(), description ?? null, Number(amount_usdc), paymentAddress, qrData, expiresAt, webhook_url ?? null],
  });

  res.json({ id, title, amount_usdc: Number(amount_usdc), qrData, paymentAddress, expiresAt, memo: `CHG-${shortId}` });
});

router.post('/transfer', async (req: X402Request, res) => {
  const { toUserId, amount, description } = req.body;
  if (!toUserId || !amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'toUserId and amount required' });
  }
  if (Number(toUserId) === req.apiKey!.userId) return res.status(400).json({ error: 'Cannot transfer to self' });

  const col = balanceCol();
  const payer = await db.execute({ sql: `SELECT ${col} as balance FROM users WHERE id = ?`, args: [req.apiKey!.userId] });
  if (Number((payer.rows[0] as any)?.balance ?? 0) < Number(amount)) return res.status(400).json({ error: 'Insufficient balance' });

  const recipient = await db.execute({ sql: 'SELECT id FROM users WHERE id = ?', args: [Number(toUserId)] });
  if (!recipient.rows.length) return res.status(404).json({ error: 'Recipient not found' });

  await db.execute({ sql: `UPDATE users SET ${col} = ${col} - ? WHERE id = ?`, args: [Number(amount), req.apiKey!.userId] });
  await db.execute({ sql: `UPDATE users SET ${col} = ${col} + ? WHERE id = ?`, args: [Number(amount), Number(toUserId)] });

  const txId = crypto.randomUUID();
  await db.execute({
    sql: "INSERT INTO transactions (id, user_id, type, amount, currency, counterparty, status, network) VALUES (?, ?, 'send', ?, 'USDC', ?, 'completed', ?)",
    args: [txId, req.apiKey!.userId, Number(amount), description ?? `Transferência para #${toUserId}`, ACTIVE_NETWORK],
  });

  res.json({ success: true, txId, amount: Number(amount), toUserId: Number(toUserId) });
});

export default router;
