import { Router } from 'express';
import { randomUUID } from 'crypto';
import { db } from '../db.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { getmoons } from '../lib/getmoons.js';
import { getActiveWallet } from '../lib/wallet.js';
import { sendFeeBumped, USDC_ASSET } from '../../stellar/sponsored.js';
import { ACTIVE_NETWORK, balanceCol } from '../db.js';

const router = Router();

// ─── Assets list (público — sem auth) ────────────────────────
router.get('/assets', async (_req, res) => {
  try {
    const [allAssets, onAssets, offAssets] = await Promise.all([
      getmoons.assets.list(),
      getmoons.assets.rampOn(),
      getmoons.assets.rampOff(),
    ]);
    const active = await getmoons.assets.resolve().catch(() => null);
    res.json({
      all: allAssets,
      rampOn: onAssets,
      rampOff: offAssets,
      active,
    });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

router.use(authMiddleware);


// ─────────────────────────────────────────────
// PIX IN  (BRL → USDC na Stellar)
// ─────────────────────────────────────────────

router.post('/on/quote', async (req: AuthRequest, res) => {
  const amount = Number(req.body.amount);
  if (!amount || amount <= 0) { res.status(400).json({ error: 'Valor inválido' }); return; }
  try {
    const { asset, chain } = await getmoons.assets.resolve();
    const quote = await getmoons.rampOn.quote(amount, asset, chain);
    res.json({ cryptoAmount: Number(quote.payout.amount), asset, chain });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

router.post('/on/create', async (req: AuthRequest, res) => {
  const amount = Number(req.body.amount);
  if (!amount || amount <= 0) { res.status(400).json({ error: 'Valor inválido' }); return; }

  // Busca carteira Stellar do usuário
  const userRes = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [req.userId!] });
  const user = userRes.rows[0] as any;
  const activeWallet = await getActiveWallet(user);
  if (!activeWallet.publicKey) {
    res.status(400).json({ error: 'Carteira Stellar não encontrada. Configure sua conta.' });
    return;
  }

  try {
    const { asset, chain } = await getmoons.assets.resolve();
    // GetMoons envia o crypto diretamente para a carteira do usuário na rede ativa
    const order = await getmoons.rampOn.create(amount, activeWallet.publicKey, asset, chain);

    await db.execute({
      sql: `INSERT INTO pix_orders
              (id, user_id, type, status, brl_amount, usdt_amount, qr_code, getmoons_data, network)
            VALUES (?, ?, 'on', ?, ?, ?, ?, ?, ?)`,
      args: [
        order.id, req.userId!, order.status,
        Number(order.payin.amount),
        Number(order.payout.amount),
        order.payin.address,
        JSON.stringify(order),
        ACTIVE_NETWORK,
      ],
    });

    res.json({
      orderId: order.id,
      qrCode: order.payin.address,
      brlAmount: order.payin.amount,
      cryptoAmount: order.payout.amount,
      asset: order.payout.asset,
      chain: order.payout.chain,
      expiresAt: order.expiresAt,
    });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

router.get('/on/status/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;

  const local = await db.execute({
    sql: 'SELECT * FROM pix_orders WHERE id = ? AND user_id = ?',
    args: [id, req.userId!],
  });
  if (!local.rows[0]) { res.status(404).json({ error: 'Ordem não encontrada' }); return; }

  const row = local.rows[0] as any;
  if (row.status === 'completed') {
    res.json({ status: 'completed', orderId: id });
    return;
  }

  try {
    const order = await getmoons.rampOn.status(id);

    if (order.status === 'completed' && row.status !== 'completed') {
      const cryptoAmount = Number(order.payout.amount);

      // Credita o saldo interno
      await db.execute({
        sql: `UPDATE users SET ${balanceCol()} = ${balanceCol()} + ? WHERE id = ?`,
        args: [cryptoAmount, req.userId!],
      });

      const txId = randomUUID();
      await db.execute({
        sql: `INSERT INTO transactions
                (id, user_id, type, amount, currency, counterparty, status, network)
              VALUES (?, ?, 'receive', ?, 'USDC', 'PIX Depósito', 'completed', ?)`,
        args: [txId, req.userId!, cryptoAmount, ACTIVE_NETWORK],
      });

      // GetMoons já enviou direto para a carteira Stellar do usuário.
      // Apenas marcamos como concluído.
      await db.execute({
        sql: `UPDATE pix_orders SET status = 'completed', updated_at = datetime('now') WHERE id = ?`,
        args: [id],
      });
    }

    res.json({ status: order.status, orderId: id, paidAt: order.paidAt });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// PIX OUT  (USDC Stellar → BRL via PIX)
// ─────────────────────────────────────────────

router.post('/off/quote', async (req: AuthRequest, res) => {
  const amount = Number(req.body.amount);
  if (!amount || amount <= 0) { res.status(400).json({ error: 'Valor inválido' }); return; }
  try {
    const { asset, chain } = await getmoons.assets.resolve();
    const quote = await getmoons.rampOff.quote(amount, asset, chain);
    res.json({ brlAmount: Number(quote.payout.amount) });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

router.post('/off/create', async (req: AuthRequest, res) => {
  const amount = Number(req.body.amount);
  const pixKey = String(req.body.pixKey ?? '').trim();

  if (!amount || amount <= 0 || !pixKey) {
    res.status(400).json({ error: 'Valor e chave PIX obrigatórios' });
    return;
  }

  const userRes = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [req.userId!] });
  const user = userRes.rows[0] as any;

  const userBalance = ACTIVE_NETWORK === 'mainnet' ? Number(user?.balance_mainnet ?? 0) : Number(user?.balance ?? 0);
  if (userBalance < amount) {
    res.status(400).json({ error: 'Saldo USDC insuficiente' });
    return;
  }
  const activeWallet = await getActiveWallet(user);
  if (!activeWallet.secretKey) {
    res.status(400).json({ error: 'Carteira Stellar não configurada para esta rede' });
    return;
  }

  const treasurySecret = process.env.STELLAR_SECRET_KEY;
  if (!treasurySecret) {
    res.status(500).json({ error: 'STELLAR_SECRET_KEY não configurado' });
    return;
  }

  // Cria ordem GetMoons (endereço PIX como destino BRL)
  let order: Awaited<ReturnType<typeof getmoons.rampOff.create>>;
  try {
    const { asset, chain } = await getmoons.assets.resolve();
    order = await getmoons.rampOff.create(amount, pixKey, asset, chain);
  } catch (err: any) {
    res.status(502).json({ error: err.message });
    return;
  }

  // Debita saldo do usuário
  await db.execute({
    sql: `UPDATE users SET ${balanceCol()} = ${balanceCol()} - ? WHERE id = ?`,
    args: [amount, req.userId!],
  });

  const txId = randomUUID();
  await db.execute({
    sql: `INSERT INTO transactions
            (id, user_id, type, amount, currency, counterparty, status, network)
          VALUES (?, ?, 'send', ?, 'USDC', 'PIX Saque', 'pending', ?)`,
    args: [txId, req.userId!, amount, ACTIVE_NETWORK],
  });

  await db.execute({
    sql: `INSERT INTO pix_orders
            (id, user_id, type, status, brl_amount, usdt_amount, pix_key, tx_id, getmoons_data, network)
          VALUES (?, ?, 'off', ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      order.id, req.userId!, order.status,
      Number(order.payout.amount), amount,
      pixKey, txId,
      JSON.stringify(order),
      ACTIVE_NETWORK,
    ],
  });

  // Envia USDC da carteira do usuário para o endereço de payin do GetMoons
  // Treasury patrocina o XLM gas via fee bump
  let stellarTxHash = '';
  try {
    const result = await sendFeeBumped({
      senderSecretKey: activeWallet.secretKey,
      destinationPublicKey: order.payin.address,
      amount,
      asset: USDC_ASSET,
      treasurySecretKey: treasurySecret,
    });
    stellarTxHash = result.hash;

    await db.execute({
      sql: `UPDATE pix_orders SET bsc_tx_hash = ?, updated_at = datetime('now') WHERE id = ?`,
      args: [stellarTxHash, order.id],
    });
  } catch (e: any) {
    // Reembolsa saldo se envio Stellar falhou
    await db.execute({ sql: `UPDATE users SET ${balanceCol()} = ${balanceCol()} + ? WHERE id = ?`, args: [amount, req.userId!] });
    await db.execute({ sql: `UPDATE transactions SET status = 'failed' WHERE id = ?`, args: [txId] });
    await db.execute({ sql: `UPDATE pix_orders SET status = 'failed', updated_at = datetime('now') WHERE id = ?`, args: [order.id] });
    res.status(502).json({ error: 'Falha ao enviar USDC na Stellar: ' + e.message });
    return;
  }

  res.json({
    orderId: order.id,
    brlAmount: order.payout.amount,
    cryptoAmount: amount,
    status: order.status,
    stellarTxHash,
  });
});

router.get('/off/status/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;

  const local = await db.execute({
    sql: 'SELECT * FROM pix_orders WHERE id = ? AND user_id = ?',
    args: [id, req.userId!],
  });
  if (!local.rows[0]) { res.status(404).json({ error: 'Ordem não encontrada' }); return; }

  const row = local.rows[0] as any;
  if (row.status === 'completed') {
    res.json({ status: 'completed', orderId: id });
    return;
  }

  try {
    const order = await getmoons.rampOff.status(id);

    if (order.status === 'completed' && row.status !== 'completed') {
      if (row.tx_id) {
        await db.execute({ sql: `UPDATE transactions SET status = 'completed' WHERE id = ?`, args: [row.tx_id] });
      }
      await db.execute({
        sql: `UPDATE pix_orders SET status = 'completed', updated_at = datetime('now') WHERE id = ?`,
        args: [id],
      });
    }

    res.json({
      status: order.status,
      orderId: id,
      paidAt: order.paidAt,
      receipt: order.payout?.receipt ?? '',
    });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

export default router;
