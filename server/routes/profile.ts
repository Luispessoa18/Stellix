import { Router } from 'express';
import { db, ACTIVE_NETWORK } from '../db.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

function formatUser(user: any) {
  const balance = ACTIVE_NETWORK === 'mainnet' ? Number(user.balance_mainnet ?? 0) : Number(user.balance ?? 0);
  const stellarPublicKey = ACTIVE_NETWORK === 'mainnet'
    ? (user.stellar_mainnet_public || user.stellar_public_key || '')
    : (user.stellar_testnet_public || user.stellar_public_key || '');
  return {
    id: Number(user.id),
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    balance,
    currency: user.currency || 'USD',
    stellarPublicKey,
    isAdmin: Boolean(user.is_admin),
    assets: [
      { id: 'USDC', name: 'USD Coin', amount: balance, icon: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' },
      { id: 'USDT', name: 'Tether', amount: 0, icon: 'https://cryptologos.cc/logos/tether-usdt-logo.png' },
    ],
  };
}

router.get('/me', async (req: AuthRequest, res) => {
  const result = await db.execute({
    sql: 'SELECT id, name, email, phone, balance, currency, stellar_public_key, is_admin FROM users WHERE id = ?',
    args: [req.userId!],
  });

  const user = result.rows[0] as any;
  if (!user) {
    res.status(404).json({ error: 'Usuario nao encontrado' });
    return;
  }

  res.json(formatUser(user));
});

router.patch('/preferences', async (req: AuthRequest, res) => {
  const { currency } = req.body;
  const allowed = ['USD', 'BRL', 'EUR', 'GBP'];

  if (!currency || !allowed.includes(currency)) {
    res.status(400).json({ error: 'currency invalida' });
    return;
  }

  await db.execute({
    sql: 'UPDATE users SET currency = ? WHERE id = ?',
    args: [currency, req.userId!],
  });

  const result = await db.execute({
    sql: 'SELECT id, name, email, phone, balance, currency, stellar_public_key, is_admin FROM users WHERE id = ?',
    args: [req.userId!],
  });

  const user = result.rows[0] as any;
  res.json(formatUser(user));
});

export default router;
