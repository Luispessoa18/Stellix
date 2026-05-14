import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { signToken, authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { signAdminToken } from '../middleware/adminAuth.js';
import { createTestnetKeypair, createKeypair } from '../../stellar/index.js';
import { ACTIVE_NETWORK } from '../db.js';

const router = Router();

router.post('/register', async (req, res) => {
  const { name, email, phone, password, currency = 'USD', inviteCode } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ error: 'Nome, email e senha sao obrigatorios' });
    return;
  }

  const expectedInviteCode = process.env.INVITE_CODE || 'STELLIX37';
  if (!inviteCode || String(inviteCode).trim() !== expectedInviteCode) {
    res.status(403).json({ error: 'Codigo de convite invalido' });
    return;
  }

  const existing = await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email] });
  if (existing.rows.length > 0) {
    res.status(409).json({ error: 'Este email ja esta cadastrado' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  let testnetPublic = '', testnetSecret = '';
  let mainnetPublic = '', mainnetSecret = '';
  try {
    const [testnet, mainnet] = await Promise.all([
      createTestnetKeypair(),
      Promise.resolve(createKeypair()),
    ]);
    testnetPublic = testnet.publicKey;
    testnetSecret = testnet.secretKey;
    mainnetPublic = mainnet.publicKey;
    mainnetSecret = mainnet.secretKey;
  } catch (err) {
    console.error('Stellar account creation failed:', err);
  }

  const result = await db.execute({
    sql: `INSERT INTO users
            (name, email, phone, password,
             stellar_public_key, stellar_secret_key,
             stellar_testnet_public, stellar_testnet_secret,
             stellar_mainnet_public, stellar_mainnet_secret,
             balance, currency)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    args: [
      name, email, phone || null, passwordHash,
      testnetPublic, testnetSecret,
      testnetPublic, testnetSecret,
      mainnetPublic, mainnetSecret,
      currency,
    ],
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
      balance: ACTIVE_NETWORK === 'mainnet' ? Number(user.balance_mainnet ?? 0) : Number(user.balance ?? 0),
      currency: user.currency || 'USD',
      stellarPublicKey: ACTIVE_NETWORK === 'mainnet' ? (user.stellar_mainnet_public || user.stellar_public_key) : (user.stellar_testnet_public || user.stellar_public_key),
      assets: [
        { id: 'USDC', name: 'USD Coin', amount: ACTIVE_NETWORK === 'mainnet' ? Number(user.balance_mainnet ?? 0) : Number(user.balance ?? 0), icon: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' },
        { id: 'USDT', name: 'Tether', amount: 0, icon: 'https://cryptologos.cc/logos/tether-usdt-logo.png' },
      ],
    },
  });
});

// Troca token de usuário por token admin (apenas se is_admin = 1)
router.post('/admin-token', authMiddleware, async (req: AuthRequest, res) => {
  const result = await db.execute({
    sql: 'SELECT is_admin FROM users WHERE id = ?',
    args: [req.userId!],
  });
  const user = result.rows[0] as any;
  if (!user || !user.is_admin) {
    res.status(403).json({ error: 'Acesso negado — usuário não é admin' });
    return;
  }
  res.json({ adminToken: signAdminToken() });
});

export default router;
