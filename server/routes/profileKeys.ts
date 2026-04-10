import { Router } from 'express';
import { randomUUID } from 'crypto';
import { db } from '../db.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// GET /api/profile/keys
router.get('/', async (req: AuthRequest, res) => {
  const result = await db.execute({
    sql: 'SELECT * FROM payment_keys WHERE user_id = ? ORDER BY created_at ASC',
    args: [req.userId!],
  });
  res.json(result.rows.map((k: any) => ({
    id: Number(k.id),
    type: k.type,
    keyValue: k.key_value,
    createdAt: k.created_at,
  })));
});

// POST /api/profile/keys
// body: { type: 'email' | 'phone' | 'random' }
router.post('/', async (req: AuthRequest, res) => {
  const { type } = req.body;
  if (!['email', 'phone', 'random'].includes(type)) {
    res.status(400).json({ error: 'type deve ser email, phone ou random' });
    return;
  }

  const userResult = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [req.userId!] });
  const user = userResult.rows[0] as any;

  let keyValue: string;
  if (type === 'email') {
    if (!user.email) { res.status(400).json({ error: 'Usuário não possui email' }); return; }
    keyValue = user.email;
  } else if (type === 'phone') {
    if (!user.phone) { res.status(400).json({ error: 'Usuário não possui telefone cadastrado' }); return; }
    keyValue = user.phone;
  } else {
    keyValue = randomUUID();
  }

  // Verifica se já existe
  const existing = await db.execute({ sql: 'SELECT id FROM payment_keys WHERE user_id = ? AND type = ?', args: [req.userId!, type === 'random' ? 'random-ignore' : type] });
  if (type !== 'random' && existing.rows.length > 0) {
    res.status(409).json({ error: `Chave do tipo ${type} já cadastrada` });
    return;
  }

  const result = await db.execute({
    sql: 'INSERT INTO payment_keys (user_id, type, key_value) VALUES (?, ?, ?)',
    args: [req.userId!, type, keyValue],
  });

  res.status(201).json({ id: Number(result.lastInsertRowid), type, keyValue, createdAt: new Date().toISOString() });
});

// DELETE /api/profile/keys/:id
router.delete('/:id', async (req: AuthRequest, res) => {
  await db.execute({
    sql: 'DELETE FROM payment_keys WHERE id = ? AND user_id = ?',
    args: [req.params.id, req.userId!],
  });
  res.json({ ok: true });
});

export default router;
