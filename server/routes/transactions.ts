import { Router } from 'express';
import { randomUUID } from 'crypto';
import { db } from '../db.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { getXlmPrice, sendPayment } from '../../stellar/index.js';

const router = Router();
router.use(authMiddleware);

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

router.post('/send', async (req: AuthRequest, res) => {
  const { amount, currency, recipientAddress, recipientName } = req.body;

  if (!amount || !currency || !recipientAddress) {
    res.status(400).json({ error: 'amount, currency e recipientAddress sÃ£o obrigatÃ³rios' });
    return;
  }

  const userResult = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [req.userId!] });
  const user = userResult.rows[0] as any;

  if (!user) {
    res.status(404).json({ error: 'UsuÃ¡rio nÃ£o encontrado' });
    return;
  }

  let usdPriceAtTime: number | null = null;
  let balanceDebit = Number(amount);

  if (currency.toUpperCase() === 'XLM') {
    usdPriceAtTime = await getXlmPrice();
    if (usdPriceAtTime > 0) {
      balanceDebit = Number(amount) * usdPriceAtTime;
    }
  }

  if (Number(user.balance) < balanceDebit) {
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
    res.status(500).json({ error: 'Falha ao processar transaÃ§Ã£o na rede Stellar' });
    return;
  }

  const txId = randomUUID();
  await db.execute({
    sql: `INSERT INTO transactions (id, user_id, type, amount, currency, counterparty, counterparty_address, stellar_tx_hash, status, usd_price_at_time)
          VALUES (?, ?, 'send', ?, ?, ?, ?, ?, ?, ?)`,
    args: [txId, req.userId!, amount, currency, recipientName || recipientAddress, recipientAddress, stellarTxHash, status, usdPriceAtTime],
  });

  await db.execute({
    sql: 'UPDATE users SET balance = balance - ? WHERE id = ?',
    args: [balanceDebit, req.userId!],
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
    usdPriceAtTime,
  });
});

export default router;
