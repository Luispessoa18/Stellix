import { Router } from 'express';
import { randomUUID } from 'crypto';
import { db, ACTIVE_NETWORK, setActiveNetwork, balanceCol } from '../db.js';
import { adminAuthMiddleware, signAdminToken } from '../middleware/adminAuth.js';
import { sendPayment, getAccountBalance, getXlmPrice } from '../../stellar/index.js';

const router = Router();

router.post('/login', (req, res) => {
  const { secret } = req.body;
  const ADMIN_SECRET = process.env.ADMIN_SECRET;

  if (!ADMIN_SECRET) {
    res.status(500).json({ error: 'ADMIN_SECRET nao configurado no servidor' });
    return;
  }
  if (!secret || secret !== ADMIN_SECRET) {
    res.status(401).json({ error: 'Senha incorreta' });
    return;
  }

  res.json({ token: signAdminToken() });
});

router.use(adminAuthMiddleware);

router.get('/master-balance', async (_req, res) => {
  const publicKey = process.env.STELLAR_PUBLIC_KEY;
  if (!publicKey) {
    res.json({ balances: [], publicKey: null, error: 'STELLAR_PUBLIC_KEY nao configurado' });
    return;
  }
  try {
    const balances = await getAccountBalance(publicKey);
    res.json({ publicKey, balances });
  } catch (err: any) {
    res.json({ publicKey, balances: [], error: err.message });
  }
});

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

router.get('/users', async (_req, res) => {
  const result = await db.execute({
    sql: `SELECT id, name, email, phone, balance, balance_mainnet, currency,
                 stellar_public_key,
                 stellar_testnet_public, stellar_mainnet_public,
                 is_admin, created_at
          FROM users ORDER BY created_at DESC`,
    args: [],
  });

  res.json(result.rows.map((u: any) => ({
    id: Number(u.id),
    name: u.name,
    email: u.email,
    phone: u.phone || '',
    balance: ACTIVE_NETWORK === 'mainnet' ? Number(u.balance_mainnet ?? 0) : Number(u.balance ?? 0),
    currency: u.currency || 'USD',
    stellarPublicKey: u.stellar_public_key || '',
    testnetPublicKey: u.stellar_testnet_public || u.stellar_public_key || '',
    mainnetPublicKey: u.stellar_mainnet_public || '',
    isAdmin: Boolean(u.is_admin),
    createdAt: u.created_at,
  })));
});

// Retorna chaves completas (pública + privada) de um usuário — somente admin
router.get('/users/:id/wallets', async (req, res) => {
  const userId = Number(req.params.id);
  const result = await db.execute({
    sql: `SELECT stellar_testnet_public, stellar_testnet_secret,
                 stellar_mainnet_public, stellar_mainnet_secret,
                 stellar_public_key, stellar_secret_key
          FROM users WHERE id = ?`,
    args: [userId],
  });
  if (!result.rows[0]) { res.status(404).json({ error: 'Usuário não encontrado' }); return; }
  const u = result.rows[0] as any;
  res.json({
    testnet: {
      publicKey: u.stellar_testnet_public || u.stellar_public_key || '',
      secretKey: u.stellar_testnet_secret || u.stellar_secret_key || '',
    },
    mainnet: {
      publicKey: u.stellar_mainnet_public || '',
      secretKey: u.stellar_mainnet_secret || '',
    },
  });
});

router.post('/users/:id/toggle-admin', async (req, res) => {
  const userId = Number(req.params.id);
  const current = await db.execute({ sql: 'SELECT is_admin FROM users WHERE id = ?', args: [userId] });
  if (!current.rows[0]) { res.status(404).json({ error: 'Usuário não encontrado' }); return; }
  const newVal = current.rows[0].is_admin ? 0 : 1;
  await db.execute({ sql: 'UPDATE users SET is_admin = ? WHERE id = ?', args: [newVal, userId] });
  res.json({ isAdmin: Boolean(newVal) });
});

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

router.get('/db/schema', async (_req, res) => {
  const tables = await db.execute({
    sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC",
    args: [],
  });

  const tableNames = tables.rows.map((row: any) => row.name as string);
  const schema: Record<string, any[]> = {};

  for (const tableName of tableNames) {
    const columns = await db.execute({
      sql: `PRAGMA table_info(${tableName})`,
      args: [],
    });
    schema[tableName] = columns.rows as any[];
  }

  res.json({ tables: tableNames, schema });
});

router.post('/db/query', async (req, res) => {
  const { sql } = req.body;

  if (!sql || typeof sql !== 'string') {
    res.status(400).json({ error: 'sql e obrigatorio' });
    return;
  }

  const trimmed = sql.trim();
  if (!trimmed) {
    res.status(400).json({ error: 'sql vazio' });
    return;
  }

  if (trimmed.includes(';')) {
    res.status(400).json({ error: 'Use apenas uma instrucao por vez' });
    return;
  }

  try {
    const result = await db.execute({ sql: trimmed, args: [] });
    res.json({
      rows: result.rows || [],
      rowsAffected: Number(result.rowsAffected || 0),
      lastInsertRowid: result.lastInsertRowid != null ? Number(result.lastInsertRowid) : null,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Falha ao executar SQL' });
  }
});

router.get('/analytics', async (_req, res) => {
  const [daily, currencies, newUsers] = await Promise.all([
    db.execute({
      sql: `SELECT date(created_at) as day,
              COALESCE(SUM(CASE WHEN type IN ('send','withdraw') THEN amount ELSE 0 END),0) as sent,
              COALESCE(SUM(CASE WHEN type IN ('receive','deposit') THEN amount ELSE 0 END),0) as received,
              COUNT(*) as count
            FROM transactions WHERE status='completed' AND created_at >= date('now','-13 days')
            GROUP BY date(created_at) ORDER BY day ASC`,
      args: [],
    }),
    db.execute({
      sql: `SELECT currency, COALESCE(SUM(amount),0) as volume, COUNT(*) as count
            FROM transactions WHERE status='completed' GROUP BY currency ORDER BY volume DESC`,
      args: [],
    }),
    db.execute({
      sql: `SELECT date(created_at) as day, COUNT(*) as count
            FROM users WHERE created_at >= date('now','-13 days')
            GROUP BY date(created_at) ORDER BY day ASC`,
      args: [],
    }),
  ]);

  // fill missing days
  const days: Record<string, any> = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days[key] = { day: key, sent: 0, received: 0, count: 0, newUsers: 0 };
  }
  for (const r of daily.rows as any[]) days[r.day] = { ...days[r.day], ...r, sent: Number(r.sent), received: Number(r.received), count: Number(r.count) };
  for (const r of newUsers.rows as any[]) if (days[r.day]) days[r.day].newUsers = Number(r.count);

  res.json({
    daily: Object.values(days),
    currencies: (currencies.rows as any[]).map((r) => ({ currency: r.currency, volume: Number(r.volume), count: Number(r.count) })),
  });
});

router.get('/config', (_req, res) => {
  res.json({ network: process.env.STELLAR_NETWORK || 'testnet' });
});

router.get('/profit', async (_req, res) => {
  const [totals, daily, perTx] = await Promise.all([
    // totais gerais
    db.execute({
      sql: `SELECT
              COUNT(*) as tx_count,
              COALESCE(SUM(platform_fee_usdc), 0)  as total_fee_usd,
              COALESCE(SUM(gas_cost_xlm), 0)        as total_gas_xlm,
              COALESCE(SUM(gas_cost_usd), 0)        as total_gas_usd,
              COALESCE(SUM(platform_fee_usdc - gas_cost_usd), 0) as net_profit_usd,
              COALESCE(SUM(amount), 0) as total_volume
            FROM transactions
            WHERE sponsored = 1 AND status = 'completed'`,
      args: [],
    }),
    // por dia (últimos 30 dias)
    db.execute({
      sql: `SELECT
              date(created_at) as day,
              COUNT(*) as tx_count,
              COALESCE(SUM(platform_fee_usdc), 0) as fee_usd,
              COALESCE(SUM(gas_cost_usd), 0)       as gas_usd,
              COALESCE(SUM(platform_fee_usdc - gas_cost_usd), 0) as profit_usd,
              COALESCE(SUM(amount), 0) as volume
            FROM transactions
            WHERE sponsored = 1 AND status = 'completed'
              AND created_at >= date('now', '-29 days')
            GROUP BY date(created_at)
            ORDER BY day ASC`,
      args: [],
    }),
    // últimas transações patrocinadas com breakdown
    db.execute({
      sql: `SELECT t.id, u.name as user_name, t.amount, t.currency,
                   t.platform_fee_usdc, t.gas_cost_xlm, t.gas_cost_usd,
                   (t.platform_fee_usdc - t.gas_cost_usd) as profit_usd,
                   t.stellar_tx_hash, t.created_at
            FROM transactions t
            JOIN users u ON u.id = t.user_id
            WHERE t.sponsored = 1 AND t.status = 'completed'
            ORDER BY t.created_at DESC
            LIMIT 50`,
      args: [],
    }),
  ]);

  const t = totals.rows[0] as any;
  const marginPct = Number(t.total_fee_usd) > 0
    ? ((Number(t.net_profit_usd) / Number(t.total_fee_usd)) * 100)
    : 0;

  res.json({
    totals: {
      txCount:      Number(t.tx_count),
      totalVolume:  Number(t.total_volume),
      totalFeeUsd:  Number(t.total_fee_usd),
      totalGasXlm:  Number(t.total_gas_xlm),
      totalGasUsd:  Number(t.total_gas_usd),
      netProfitUsd: Number(t.net_profit_usd),
      marginPct:    parseFloat(marginPct.toFixed(4)),
    },
    daily: (daily.rows as any[]).map(r => ({
      day:       r.day,
      txCount:   Number(r.tx_count),
      feeUsd:    Number(r.fee_usd),
      gasUsd:    Number(r.gas_usd),
      profitUsd: Number(r.profit_usd),
      volume:    Number(r.volume),
    })),
    transactions: (perTx.rows as any[]).map(r => ({
      id:           r.id,
      userName:     r.user_name,
      amount:       Number(r.amount),
      currency:     r.currency,
      feeUsd:       Number(r.platform_fee_usdc),
      gasXlm:       Number(r.gas_cost_xlm),
      gasUsd:       Number(r.gas_cost_usd),
      profitUsd:    Number(r.profit_usd),
      txHash:       r.stellar_tx_hash,
      createdAt:    r.created_at,
    })),
  });
});

router.post('/credit', async (req, res) => {
  const { userId, amount, asset = 'XLM', onChain = false } = req.body;

  if (!userId || !amount || Number(amount) <= 0) {
    res.status(400).json({ error: 'userId e amount sao obrigatorios' });
    return;
  }

  const userResult = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [userId] });
  const user = userResult.rows[0] as any;

  if (!user) {
    res.status(404).json({ error: 'Usuario nao encontrado' });
    return;
  }

  let stellarTxHash = '';
  let usdPriceAtTime: number | null = null;

  if (asset.toUpperCase() === 'XLM') {
    usdPriceAtTime = await getXlmPrice();
  }

  if (onChain) {
    const adminSecret = process.env.STELLAR_SECRET_KEY;
    if (!adminSecret) {
      res.status(400).json({ error: 'STELLAR_SECRET_KEY nao configurado no .env' });
      return;
    }
    if (!user.stellar_public_key) {
      res.status(400).json({ error: 'Usuario nao possui carteira Stellar cadastrada' });
      return;
    }
    try {
      const result = await sendPayment({
        sourceSecretKey: adminSecret,
        destinationPublicKey: user.stellar_public_key as string,
        amount: String(amount),
        asset,
        memo: 'Stellix Admin Credit',
      });
      stellarTxHash = result.hash;
    } catch (err: any) {
      res.status(500).json({ error: `Falha na transacao Stellar: ${err.message}` });
      return;
    }
  }

  const isStablecoin = ['USDC', 'USDT'].includes(asset.toUpperCase());
  const shouldUpdateBalance = isStablecoin;

  if (shouldUpdateBalance) {
    await db.execute({
      sql: `UPDATE users SET ${balanceCol()} = ${balanceCol()} + ? WHERE id = ?`,
      args: [Number(amount), userId],
    });
  }

  const txId = randomUUID();
  await db.execute({
    sql: `INSERT INTO transactions (id, user_id, type, amount, currency, counterparty, stellar_tx_hash, status, usd_price_at_time, network)
          VALUES (?, ?, 'deposit', ?, ?, 'Admin Credit', ?, 'completed', ?, ?)`,
    args: [txId, userId, Number(amount), asset, stellarTxHash, usdPriceAtTime, ACTIVE_NETWORK],
  });

  const currentBalance = ACTIVE_NETWORK === 'mainnet' ? Number(user.balance_mainnet ?? 0) : Number(user.balance ?? 0);
  const newBalance = shouldUpdateBalance ? currentBalance + Number(amount) : currentBalance;

  res.json({
    success: true,
    txId,
    stellarTxHash: stellarTxHash || null,
    onChain,
    balanceUpdated: shouldUpdateBalance,
    newBalance,
    message: onChain
      ? isStablecoin
        ? `${amount} ${asset} enviados on-chain e saldo USD atualizado`
        : `${amount} ${asset} enviados on-chain sem alterar saldo USD`
      : shouldUpdateBalance
        ? `$${amount} creditados diretamente no saldo de ${user.name}`
        : `${amount} ${asset} registrados sem alterar o saldo USD`,
  });
});

// ── Rede ──────────────────────────────────────────────────────

router.get('/active-network', (_req, res) => {
  res.json({ network: ACTIVE_NETWORK });
});

// Troca rede instantaneamente (sem restart — live binding no módulo db.ts)
router.post('/switch-network', (req, res) => {
  const { network } = req.body as { network: 'testnet' | 'mainnet' };
  if (network !== 'testnet' && network !== 'mainnet') {
    res.status(400).json({ error: 'Rede inválida' });
    return;
  }
  setActiveNetwork(network);
  res.json({ ok: true, network, message: `Rede alterada para ${network}` });
});

export default router;
