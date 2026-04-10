import { Router } from 'express';
import { randomUUID } from 'crypto';
import { db } from '../db.js';
import { adminAuthMiddleware, signAdminToken } from '../middleware/adminAuth.js';
import { sendPayment, getAccountBalance, getXlmPrice } from '../../stellar/index.js';

const router = Router();

// POST /api/admin/login
router.post('/login', (req, res) => {
  const { secret } = req.body;
  const ADMIN_SECRET = process.env.ADMIN_SECRET;

  if (!ADMIN_SECRET) {
    res.status(500).json({ error: 'ADMIN_SECRET não configurado no servidor' });
    return;
  }
  if (!secret || secret !== ADMIN_SECRET) {
    res.status(401).json({ error: 'Senha incorreta' });
    return;
  }

  res.json({ token: signAdminToken() });
});

// Todas as rotas abaixo exigem JWT de admin
router.use(adminAuthMiddleware);

// GET /api/admin/master-balance
router.get('/master-balance', async (_req, res) => {
  const publicKey = process.env.STELLAR_PUBLIC_KEY;
  if (!publicKey) {
    res.json({ balances: [], publicKey: null, error: 'STELLAR_PUBLIC_KEY não configurado' });
    return;
  }
  try {
    const balances = await getAccountBalance(publicKey);
    res.json({ publicKey, balances });
  } catch (err: any) {
    res.json({ publicKey, balances: [], error: err.message });
  }
});

// GET /api/admin/stats
router.get('/stats', async (_req, res) => {
  const [usersRow, txRow] = await Promise.all([
    db.execute({ sql: 'SELECT COUNT(*) as count, COALESCE(SUM(balance),0) as total_balance FROM users', args: [] }),
    db.execute({ sql: "SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as total_volume FROM transactions WHERE status = 'completed'", args: [] }),
  ]);

  res.json({
    totalUsers: Number(usersRow.rows[0].count),
    totalBalance: Number(usersRow.rows[0].total_balance),
    totalTransactions: Number(txRow.rows[0].count),
    totalVolume: Number(txRow.rows[0].total_volume),
  });
});

// GET /api/admin/users
router.get('/users', async (_req, res) => {
  const result = await db.execute({
    sql: 'SELECT id, name, email, phone, balance, currency, stellar_public_key, created_at FROM users ORDER BY created_at DESC',
    args: [],
  });

  res.json(result.rows.map((u: any) => ({
    id: Number(u.id),
    name: u.name,
    email: u.email,
    phone: u.phone || '',
    balance: Number(u.balance),
    currency: u.currency || 'USD',
    stellarPublicKey: u.stellar_public_key || '',
    createdAt: u.created_at,
  })));
});

// GET /api/admin/transactions
router.get('/transactions', async (_req, res) => {
  const result = await db.execute({
    sql: `SELECT t.*, u.name as user_name, u.email as user_email
          FROM transactions t
          JOIN users u ON u.id = t.user_id
          ORDER BY t.created_at DESC
          LIMIT 200`,
    args: [],
  });

  res.json(result.rows.map((t: any) => ({
    id: t.id,
    userId: Number(t.user_id),
    userName: t.user_name,
    userEmail: t.user_email,
    type: t.type,
    amount: Number(t.amount),
    currency: t.currency,
    counterparty: t.counterparty,
    counterpartyAddress: t.counterparty_address || '',
    stellarTxHash: t.stellar_tx_hash || '',
    status: t.status,
    createdAt: t.created_at,
  })));
});

// POST /api/admin/credit
// Body: { userId, amount, asset, onChain }
// onChain=true → envia XLM/USDC via Stellar da conta admin para a carteira do usuário
// onChain=false → apenas atualiza o saldo no banco (crédito off-chain)
router.post('/credit', async (req, res) => {
  const { userId, amount, asset = 'XLM', onChain = false } = req.body;

  if (!userId || !amount || Number(amount) <= 0) {
    res.status(400).json({ error: 'userId e amount são obrigatórios' });
    return;
  }

  const userResult = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [userId] });
  const user = userResult.rows[0] as any;

  if (!user) {
    res.status(404).json({ error: 'Usuário não encontrado' });
    return;
  }

  let stellarTxHash = '';
  let usdPriceAtTime: number | null = null;

  // Para XLM, registra o preço no momento da transação
  if (asset.toUpperCase() === 'XLM') {
    usdPriceAtTime = await getXlmPrice();
  }

  if (onChain) {
    const adminSecret = process.env.STELLAR_SECRET_KEY;
    if (!adminSecret) {
      res.status(400).json({ error: 'STELLAR_SECRET_KEY não configurado no .env' });
      return;
    }
    if (!user.stellar_public_key) {
      res.status(400).json({ error: 'Usuário não possui carteira Stellar cadastrada' });
      return;
    }
    try {
      const result = await sendPayment({
        sourceSecretKey: adminSecret,
        destinationPublicKey: user.stellar_public_key as string,
        amount: String(amount),
        asset,
        memo: 'DolarPix Admin Credit',
      });
      stellarTxHash = result.hash;
    } catch (err: any) {
      res.status(500).json({ error: `Falha na transação Stellar: ${err.message}` });
      return;
    }
  }

  // Só atualiza o saldo USD no banco se:
  // - off-chain (crédito manual de teste, sempre em USD)
  // - on-chain com USDC ou USDT (stablecoins 1:1 com USD)
  // XLM on-chain NÃO altera o saldo USD — são ativos diferentes
  const isStablecoin = ['USDC', 'USDT'].includes(asset.toUpperCase());
  const shouldUpdateBalance = !onChain || isStablecoin;

  if (shouldUpdateBalance) {
    await db.execute({
      sql: 'UPDATE users SET balance = balance + ? WHERE id = ?',
      args: [Number(amount), userId],
    });
  }

  const txId = randomUUID();
  await db.execute({
    sql: `INSERT INTO transactions (id, user_id, type, amount, currency, counterparty, stellar_tx_hash, status, usd_price_at_time)
          VALUES (?, ?, 'deposit', ?, ?, 'Admin Credit', ?, 'completed', ?)`,
    args: [txId, userId, Number(amount), asset, stellarTxHash, usdPriceAtTime],
  });

  const newBalance = shouldUpdateBalance ? Number(user.balance) + Number(amount) : Number(user.balance);

  res.json({
    success: true,
    txId,
    stellarTxHash: stellarTxHash || null,
    onChain,
    balanceUpdated: shouldUpdateBalance,
    newBalance,
    message: onChain
      ? isStablecoin
        ? `${amount} ${asset} enviados on-chain → saldo USD atualizado`
        : `${amount} ${asset} enviados on-chain (XLM não altera saldo USD)`
      : `$${amount} creditados diretamente no saldo de ${user.name}`,
  });
});

export default router;
