import { Router } from 'express';
import { randomUUID } from 'crypto';
import { db, ACTIVE_NETWORK, balanceCol } from '../db.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { getXlmPrice, sendPayment } from '../../stellar/index.js';
import { sendSponsoredUsdc, calcFee, hasUsdcTrustline } from '../../stellar/sponsored.js';

const router = Router();
router.use(authMiddleware);

async function resolveRecipient(recipientAddress: string) {
  const normalizedRecipient = recipientAddress.trim();
  const directUser = await db.execute({
    sql: `
      SELECT id, name, email, phone, stellar_public_key
      FROM users
      WHERE lower(email) = lower(?)
         OR phone = ?
         OR stellar_public_key = ?
      LIMIT 1
    `,
    args: [normalizedRecipient, normalizedRecipient, normalizedRecipient],
  });

  if (directUser.rows[0]) return directUser.rows[0] as any;

  const keyUser = await db.execute({
    sql: `
      SELECT u.id, u.name, u.email, u.phone, u.stellar_public_key
      FROM payment_keys pk
      JOIN users u ON u.id = pk.user_id
      WHERE pk.key_value = ?
      LIMIT 1
    `,
    args: [normalizedRecipient],
  });

  return (keyUser.rows[0] as any) || null;
}

router.get('/', async (req: AuthRequest, res) => {
  const result = await db.execute({
    sql: `SELECT * FROM transactions WHERE user_id = ? AND network = '${ACTIVE_NETWORK}' ORDER BY created_at DESC LIMIT 50`,
    args: [req.userId!],
  });

  const formatted = result.rows.map((tx: any) => ({
    id: tx.id,
    type: tx.type,
    amount: Number(tx.amount),
    currency: tx.currency,
    counterparty: tx.counterparty,
    timestamp: new Date(tx.created_at as string).getTime(),
    status: tx.status,
    stellarTxHash: tx.stellar_tx_hash,
    usdPriceAtTime: tx.usd_price_at_time != null ? Number(tx.usd_price_at_time) : undefined,
  }));

  res.json(formatted);
});

// Retorna o breakdown de taxa antes do envio
router.get('/fee-preview', async (req: AuthRequest, res) => {
  const amount = parseFloat(String(req.query.amount || '0'));
  const currency = String(req.query.currency || '').toUpperCase();

  if (!amount || amount <= 0) {
    res.status(400).json({ error: 'amount invalido' });
    return;
  }

  if (currency !== 'USDC') {
    res.json({ sponsored: false, fee: 0, net: amount, feeRate: 0 });
    return;
  }

  const breakdown = calcFee(amount);
  res.json({
    sponsored: Boolean(process.env.STELLAR_SECRET_KEY),
    fee: breakdown.fee,
    net: breakdown.net,
    feeRate: breakdown.feeRate,
    gross: amount,
  });
});

// Setup trustline USDC (patrocinada pela treasury)
router.post('/setup-trustline', async (req: AuthRequest, res) => {
  const userResult = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [req.userId!] });
  const user = userResult.rows[0] as any;

  if (!user?.stellar_public_key || !user?.stellar_secret_key) {
    res.status(400).json({ error: 'Carteira Stellar nao encontrada' });
    return;
  }

  const treasurySecret = process.env.STELLAR_SECRET_KEY;
  if (!treasurySecret) {
    res.status(400).json({ error: 'STELLAR_SECRET_KEY nao configurado' });
    return;
  }

  try {
    const hasTrustline = await hasUsdcTrustline(user.stellar_public_key);
    if (hasTrustline) {
      res.json({ message: 'Trustline USDC ja existe', alreadyExists: true });
      return;
    }

    const { sponsorUsdcTrustline } = await import('../../stellar/sponsored.js');
    await sponsorUsdcTrustline({
      userPublicKey: user.stellar_public_key,
      userSecretKey: user.stellar_secret_key,
      treasurySecretKey: treasurySecret,
    });

    res.json({ message: 'Trustline USDC configurada com sucesso (patrocinada pela treasury)', sponsored: true });
  } catch (err: any) {
    console.error('Trustline setup failed:', err?.response?.data || err);
    res.status(500).json({ error: 'Falha ao configurar trustline: ' + (err?.message || 'erro desconhecido') });
  }
});

router.post('/send', async (req: AuthRequest, res) => {
  const { amount, currency, recipientAddress, recipientName } = req.body;
  const numericAmount = Number(amount);
  const normalizedCurrency = String(currency || '').toUpperCase();
  const destination = String(recipientAddress || '').trim();

  if (!Number.isFinite(numericAmount) || numericAmount <= 0 || !normalizedCurrency || !destination) {
    res.status(400).json({ error: 'amount, currency e recipientAddress sao obrigatorios' });
    return;
  }

  const senderResult = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [req.userId!] });
  const sender = senderResult.rows[0] as any;

  if (!sender) {
    res.status(404).json({ error: 'Usuario nao encontrado' });
    return;
  }

  let usdPriceAtTime: number | null = null;
  let balanceDebit = numericAmount;

  if (normalizedCurrency === 'XLM') {
    usdPriceAtTime = await getXlmPrice();
    if (usdPriceAtTime > 0) {
      balanceDebit = numericAmount * usdPriceAtTime;
    }
  }

  const senderBalance = ACTIVE_NETWORK === 'mainnet' ? Number(sender.balance_mainnet ?? 0) : Number(sender.balance ?? 0);
  if (senderBalance < balanceDebit) {
    res.status(400).json({ error: 'Saldo insuficiente' });
    return;
  }

  const recipientUser = await resolveRecipient(destination);
  const isInternal = recipientUser && Number(recipientUser.id) !== Number(req.userId!);

  let stellarTxHash = '';
  let status = 'completed';
  let feeAmount = 0;
  let netAmount = numericAmount;
  let sponsoredByTreasury = false;

  if (!isInternal) {
    const looksLikeStellarKey = destination.startsWith('G');

    if (!looksLikeStellarKey) {
      res.status(404).json({ error: 'Destinatario nao encontrado' });
      return;
    }

    if (!sender.stellar_secret_key) {
      res.status(400).json({ error: 'Carteira Stellar do usuario nao possui chave privada' });
      return;
    }

    const treasurySecret = process.env.STELLAR_SECRET_KEY;
    const platformAddress = process.env.STELLAR_PUBLIC_KEY;

    const isUsdcSend = normalizedCurrency === 'USDC';
    const canSponsored = isUsdcSend && Boolean(treasurySecret) && Boolean(platformAddress);

    try {
      if (canSponsored) {
        // ── Sponsored flow: user não precisa de XLM, taxa 1% ──
        const xlmSpotPrice = await getXlmPrice();
        const result = await sendSponsoredUsdc({
          senderSecretKey: sender.stellar_secret_key as string,
          recipientPublicKey: destination,
          grossAmount: numericAmount,
          treasurySecretKey: treasurySecret!,
          platformPublicKey: platformAddress!,
        });
        stellarTxHash = result.hash;
        feeAmount = result.breakdown.fee;
        netAmount = result.breakdown.net;
        sponsoredByTreasury = true;

        // guarda custo de gas para cálculo de lucro
        const gasCostXlm = result.gasXlm;
        const gasCostUsd = gasCostXlm * xlmSpotPrice;
        console.log(`[sponsored] ${numericAmount} USDC → ${destination} | fee: $${feeAmount} | gas: ${gasCostXlm} XLM ($${gasCostUsd.toFixed(8)}) | hash: ${stellarTxHash}`);

        // insere a tx com dados de profit
        const senderTxId = randomUUID();
        await db.execute({
          sql: `INSERT INTO transactions
                  (id, user_id, type, amount, currency, counterparty, counterparty_address,
                   stellar_tx_hash, status, usd_price_at_time,
                   platform_fee_usdc, gas_cost_xlm, gas_cost_usd, sponsored, network)
                VALUES (?, ?, 'send', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
          args: [
            senderTxId, req.userId!, numericAmount, normalizedCurrency,
            recipientName || recipientUser?.name || destination,
            recipientUser?.stellar_public_key || destination,
            stellarTxHash, 'completed', usdPriceAtTime,
            feeAmount, gasCostXlm, gasCostUsd, ACTIVE_NETWORK,
          ],
        });
        await db.execute({ sql: `UPDATE users SET ${balanceCol()} = ${balanceCol()} - ? WHERE id = ?`, args: [numericAmount, req.userId!] });

        res.json({
          id: senderTxId, type: 'send', amount: numericAmount,
          currency: normalizedCurrency,
          counterparty: recipientName || recipientUser?.name || destination,
          timestamp: Date.now(), status: 'completed',
          stellarTxHash, usdPriceAtTime,
          internalTransfer: false,
          sponsored: true, feeAmount, netAmount,
          gasCostXlm, gasCostUsd,
          profitUsd: feeAmount - gasCostUsd,
        });
        return;
      } else {
        // ── Fallback: envio direto (XLM / USDT / sem chave treasury) ──
        const result = await sendPayment({
          sourceSecretKey: sender.stellar_secret_key as string,
          destinationPublicKey: destination,
          amount: numericAmount.toString(),
          asset: normalizedCurrency,
        });
        stellarTxHash = result.hash;
      }
    } catch (err: any) {
      console.error('Stellar send failed:', err?.response?.data || err);
      status = 'failed';
      res.status(500).json({ error: 'Falha ao processar transacao na rede Stellar' });
      return;
    }
  }

  await db.execute({
    sql: `UPDATE users SET ${balanceCol()} = ${balanceCol()} - ? WHERE id = ?`,
    args: [balanceDebit, req.userId!],
  });

  const senderTxId = randomUUID();
  await db.execute({
    sql: `INSERT INTO transactions (id, user_id, type, amount, currency, counterparty, counterparty_address, stellar_tx_hash, status, usd_price_at_time, network)
          VALUES (?, ?, 'send', ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      senderTxId,
      req.userId!,
      numericAmount,
      normalizedCurrency,
      recipientName || recipientUser?.name || destination,
      recipientUser?.stellar_public_key || destination,
      stellarTxHash,
      status,
      usdPriceAtTime,
      ACTIVE_NETWORK,
    ],
  });

  if (isInternal) {
    const shouldCreditRecipientBalance = ['USDC', 'USDT', 'USD'].includes(normalizedCurrency);

    if (shouldCreditRecipientBalance) {
      await db.execute({
        sql: `UPDATE users SET ${balanceCol()} = ${balanceCol()} + ? WHERE id = ?`,
        args: [numericAmount, Number(recipientUser.id)],
      });
    }

    const receiveTxId = randomUUID();
    await db.execute({
      sql: `INSERT INTO transactions (id, user_id, type, amount, currency, counterparty, counterparty_address, stellar_tx_hash, status, usd_price_at_time, network)
            VALUES (?, ?, 'receive', ?, ?, ?, ?, ?, 'completed', ?, ?)`,
      args: [
        receiveTxId,
        Number(recipientUser.id),
        numericAmount,
        normalizedCurrency,
        sender.name || sender.email,
        sender.stellar_public_key || '',
        stellarTxHash,
        usdPriceAtTime,
        ACTIVE_NETWORK,
      ],
    });
  }

  res.json({
    id: senderTxId,
    type: 'send',
    amount: numericAmount,
    currency: normalizedCurrency,
    counterparty: recipientName || recipientUser?.name || destination,
    timestamp: Date.now(),
    status,
    stellarTxHash,
    usdPriceAtTime,
    internalTransfer: Boolean(isInternal),
    // sponsored payment metadata
    sponsored: sponsoredByTreasury,
    feeAmount: feeAmount || 0,
    netAmount: netAmount,
  });
});

export default router;
