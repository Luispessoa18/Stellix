import { Router } from 'express';
import { db } from '../db.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// GET /api/contacts
router.get('/', async (req: AuthRequest, res) => {
  const result = await db.execute({
    sql: 'SELECT * FROM contacts WHERE user_id = ? ORDER BY name ASC',
    args: [req.userId!],
  });
  res.json(result.rows.map((c: any) => ({
    id: Number(c.id),
    name: c.name,
    identifier: c.identifier,
    stellarPublicKey: c.stellar_public_key || '',
    createdAt: c.created_at,
  })));
});

// POST /api/contacts
router.post('/', async (req: AuthRequest, res) => {
  const { name, identifier, stellarPublicKey } = req.body;
  if (!name || !identifier) {
    res.status(400).json({ error: 'name e identifier são obrigatórios' });
    return;
  }
  const result = await db.execute({
    sql: 'INSERT INTO contacts (user_id, name, identifier, stellar_public_key) VALUES (?, ?, ?, ?)',
    args: [req.userId!, name, identifier, stellarPublicKey || null],
  });
  res.status(201).json({ id: Number(result.lastInsertRowid), name, identifier, stellarPublicKey: stellarPublicKey || '' });
});

// DELETE /api/contacts/:id
router.delete('/:id', async (req: AuthRequest, res) => {
  await db.execute({
    sql: 'DELETE FROM contacts WHERE id = ? AND user_id = ?',
    args: [req.params.id, req.userId!],
  });
  res.json({ ok: true });
});

export default router;
