import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { signToken } from '../middleware/auth.js';
import { createStellarAccount } from '../../stellar/index.js';

const router = Router();

router.post('/register', async (req, res) => {
  const { name, email, phone, password, currency = 'USD' } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ error: 'Nome, email e senha sao obrigatorios' });
    return;
  }

  const existing = await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email] });
  if (existing.rows.length > 0) {
    res.status(409).json({ error: 'Este email ja esta cadastrado' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  let stellarPublicKey = '';
  let stellarSecretKey = '';
  try {
    const account = await createStellarAccount();
    stellarPublicKey = account.publicKey;
    stellarSecretKey = account.secretKey;
  } catch (err) {
    console.error('Stellar account creation failed:', err);
  }

  const result = await db.execute({
    sql: `INSERT INTO users (name, email, phone, password, stellar_public_key, stellar_secret_key, balance, currency)
          VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    args: [name, email, phone || null, passwordHash, stellarPublicKey, stellarSecretKey, currency],
  });

  const userId = Number(result.lastInsertRowid);
  const token = signToken(userId);

  res.status(201).json({
    token,
    user: {
      id: userId,
      name,
      email,
      phone: phone || '',
      balance: 0,
      currency,
      stellarPublicKey,
      assets: [
        { id: 'USDC', name: 'USD Coin', amount: 0, icon: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' },
        { id: 'USDT', name: 'Tether', amount: 0, icon: 'https://cryptologos.cc/logos/tether-usdt-logo.png' },
      ],
    },
  });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email e senha sao obrigatorios' });
    return;
  }

  const result = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] });
  const user = result.rows[0] as any;

  if (!user) {
    res.status(401).json({ error: 'Email ou senha invalidos' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password as string);
  if (!valid) {
    res.status(401).json({ error: 'Email ou senha invalidos' });
    return;
  }

  const userId = Number(user.id);
  const token = signToken(userId);

  res.json({
    token,
    user: {
      id: userId,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      balance: Number(user.balance),
      currency: user.currency || 'USD',
      stellarPublicKey: user.stellar_public_key,
      assets: [
        { id: 'USDC', name: 'USD Coin', amount: Number(user.balance), icon: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' },
        { id: 'USDT', name: 'Tether', amount: 0, icon: 'https://cryptologos.cc/logos/tether-usdt-logo.png' },
      ],
    },
  });
});

export default router;
