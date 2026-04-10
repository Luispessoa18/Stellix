import { Router } from 'express';
import { db } from '../db.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadius = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

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
    linkedUserId: c.linked_user_id != null ? Number(c.linked_user_id) : null,
  })));
});

router.get('/nearby', async (req: AuthRequest, res) => {
  const latitude = Number(req.query.latitude);
  const longitude = Number(req.query.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    res.status(400).json({ error: 'latitude e longitude sao obrigatorios' });
    return;
  }

  await db.execute({
    sql: 'UPDATE users SET latitude = ?, longitude = ? WHERE id = ?',
    args: [latitude, longitude, req.userId!],
  });

  const result = await db.execute({
    sql: `
      SELECT id, name, latitude, longitude
      FROM users
      WHERE id != ?
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 50
    `,
    args: [req.userId!],
  });

  const nearby = result.rows
    .map((user: any) => {
      const userLat = Number(user.latitude);
      const userLng = Number(user.longitude);
      const dist = distanceKm(latitude, longitude, userLat, userLng);
      return {
        userId: Number(user.id),
        firstName: String(user.name || '').trim().split(/\s+/)[0] || 'Contato',
        distanceKm: dist,
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 20);

  res.json(nearby);
});

router.post('/', async (req: AuthRequest, res) => {
  const { name, identifier, stellarPublicKey, linkedUserId } = req.body;
  if (!name || !identifier) {
    res.status(400).json({ error: 'name e identifier sao obrigatorios' });
    return;
  }

  const result = await db.execute({
    sql: 'INSERT INTO contacts (user_id, name, identifier, stellar_public_key, linked_user_id) VALUES (?, ?, ?, ?, ?)',
    args: [req.userId!, name, identifier, stellarPublicKey || null, linkedUserId || null],
  });

  res.status(201).json({
    id: Number(result.lastInsertRowid),
    name,
    identifier,
    stellarPublicKey: stellarPublicKey || '',
    linkedUserId: linkedUserId || null,
    createdAt: new Date().toISOString(),
  });
});

router.post('/from-user', async (req: AuthRequest, res) => {
  const { targetUserId } = req.body;
  if (!targetUserId) {
    res.status(400).json({ error: 'targetUserId e obrigatorio' });
    return;
  }

  const targetResult = await db.execute({
    sql: 'SELECT id, name, email, stellar_public_key FROM users WHERE id = ?',
    args: [targetUserId],
  });

  const target = targetResult.rows[0] as any;
  if (!target) {
    res.status(404).json({ error: 'Usuario nao encontrado' });
    return;
  }

  const existing = await db.execute({
    sql: 'SELECT id FROM contacts WHERE user_id = ? AND linked_user_id = ?',
    args: [req.userId!, targetUserId],
  });

  if (existing.rows.length > 0) {
    res.status(409).json({ error: 'Contato ja adicionado' });
    return;
  }

  const name = String(target.name || '').trim();
  const identifier = String(target.email || '').trim();

  const insert = await db.execute({
    sql: 'INSERT INTO contacts (user_id, name, identifier, stellar_public_key, linked_user_id) VALUES (?, ?, ?, ?, ?)',
    args: [req.userId!, name, identifier, target.stellar_public_key || null, targetUserId],
  });

  res.status(201).json({
    id: Number(insert.lastInsertRowid),
    name,
    identifier,
    stellarPublicKey: target.stellar_public_key || '',
    linkedUserId: Number(targetUserId),
    createdAt: new Date().toISOString(),
  });
});

router.delete('/:id', async (req: AuthRequest, res) => {
  await db.execute({
    sql: 'DELETE FROM contacts WHERE id = ? AND user_id = ?',
    args: [req.params.id, req.userId!],
  });
  res.json({ ok: true });
});

export default router;
