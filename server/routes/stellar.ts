import { Router } from 'express';
import { db } from '../db.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { getAccountBalance, fundTestnetAccount } from '../../stellar/index.js';

const router = Router();

// GET /api/stellar/price — público, sem auth
router.get('/price', async (_req, res) => {
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd');
    const data = await r.json() as any;
    res.json({ xlmUsd: data?.stellar?.usd ?? 0 });
  } catch {
    res.json({ xlmUsd: 0 });
  }
});

router.use(authMiddleware);

// GET /api/stellar/balance
router.get('/balance', async (req: AuthRequest, res) => {
  const result = await db.execute({
    sql: 'SELECT stellar_public_key FROM users WHERE id = ?',
    args: [req.userId!],
  });
  const user = result.rows[0] as any;

  if (!user?.stellar_public_key) {
    res.status(404).json({ error: 'Conta Stellar não encontrada para este usuário' });
    return;
  }

  try {
    const balances = await getAccountBalance(user.stellar_public_key as string);
    res.json({ publicKey: user.stellar_public_key, balances });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao buscar saldo Stellar' });
  }
});

// POST /api/stellar/fund (apenas testnet)
router.post('/fund', async (req: AuthRequest, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({ error: 'Disponível apenas em testnet' });
    return;
  }

  const result = await db.execute({
    sql: 'SELECT stellar_public_key FROM users WHERE id = ?',
    args: [req.userId!],
  });
  const user = result.rows[0] as any;

  if (!user?.stellar_public_key) {
    res.status(404).json({ error: 'Conta Stellar não encontrada' });
    return;
  }

  try {
    await fundTestnetAccount(user.stellar_public_key as string);
    res.json({ message: 'Conta financiada com 10.000 XLM no testnet!', publicKey: user.stellar_public_key });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao financiar conta' });
  }
});

export default router;
