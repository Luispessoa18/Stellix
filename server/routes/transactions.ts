import { Router } from 'express';
import { randomUUID } from 'crypto';
import { db } from '../db.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { sendPayment } from '../../stellar/index.js';

const router = Router();
router.use(authMiddleware);

// GET /api/transactions
router.get('/', async (req: AuthRequest, res) => {
  const result = await db.execute({
    sql: 'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
    args: [req.userId!],
  });

  const formatted = result.rows.map((tx: any) => ({
    id: tx.id,
    type: tx.type,
    amount: Number(tx.amount),
    currency: tx.currency,
    counterparty: tx.counterparty,
    timestamp: new Date(tx.created_at as string).getTime(),
    status: tx.status,
    stellarTxHash: tx.stellar_tx_hash,
    usdPriceAtTime: tx.usd_price_at_time != null ? Number(tx.usd_price_at_time) : undefined,
  }));

  res.json(formatted);
});

// POST /api/transactions/send
router.post('/send', async (req: AuthRequest, res) => {
  const { amount, currency, recipientAddress, recipientName } = req.body;

  if (!amount || !currency || !recipientAddress) {
    res.status(400).json({ error: 'amount, currency e recipientAddress são obrigatórios' });
    return;
  }

  const userResult = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [req.userId!] });
  const user = userResult.rows[0] as any;

  if (!user) {
    res.status(404).json({ error: 'Usuário não encontrado' });
    return;
  }

  if (Number(user.balance) < amount) {
    res.status(400).json({ error: 'Saldo insuficiente' });
    return;
  }

  let stellarTxHash = '';
  let status = 'completed';

  try {
    if (user.stellar_secret_key) {
      const result = await sendPayment({
        sourceSecretKey: user.stellar_secret_key as string,
        destinationPublicKey: recipientAddress,
        amount: amount.toString(),
        asset: currency,
      });
      stellarTxHash = result.hash;
    }
  } catch (err) {
    console.error('Stellar send failed:', err);
    status = 'failed';
    res.status(500).json({ error: 'Falha ao processar transação na rede Stellar' });
    return;
  }

  const txId = randomUUID();
  await db.execute({
    sql: `INSERT INTO transactions (id, user_id, type, amount, currency, counterparty, counterparty_address, stellar_tx_hash, status)
          VALUES (?, ?, 'send', ?, ?, ?, ?, ?, ?)`,
    args: [txId, req.userId!, amount, currency, recipientName || recipientAddress, recipientAddress, stellarTxHash, status],
  });

  await db.execute({
    sql: 'UPDATE users SET balance = balance - ? WHERE id = ?',
    args: [amount, req.userId!],
  });

  res.json({
    id: txId,
    type: 'send',
    amount,
    currency,
    counterparty: recipientName || recipientAddress,
    timestamp: Date.now(),
    status,
    stellarTxHash,
  });
});

export default router;
