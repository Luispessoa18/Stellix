import { Router } from 'express';
import { db } from '../db.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

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
    sql: 'SELECT id, name, email, phone, balance, currency, stellar_public_key FROM users WHERE id = ?',
    args: [req.userId!],
  });

  const user = result.rows[0] as any;
  res.json({
    id: Number(user.id),
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    balance: Number(user.balance),
    currency: user.currency || 'USD',
    stellarPublicKey: user.stellar_public_key || '',
  });
});

export default router;
