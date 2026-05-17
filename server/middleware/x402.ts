import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import db, { balanceCol } from '../db.js';

export const ENDPOINT_COSTS: Record<string, number> = {
  'POST /send': 0.01,
  'POST /transfer': 0.01,
  'POST /charge': 0.005,
  'GET /balance': 0.001,
  'GET /statement': 0.001,
};

export interface X402Request extends Request {
  apiKey?: {
    id: number;
    userId: number;
    name: string;
    balanceUsdc: number;
  };
}

export async function x402Middleware(req: X402Request, res: Response, next: NextFunction) {
  const apiKeyHeader = req.headers['x-api-key'] as string | undefined;
  const authHeader = req.headers.authorization;
  const rawKey =
    apiKeyHeader ||
    (authHeader?.startsWith('Bearer sk_') ? authHeader.slice(7) : undefined);

  if (!rawKey || !rawKey.startsWith('sk_')) {
    return res.status(401).json({
      error: 'API key required',
      hint: 'Set X-API-Key: sk_live_... header or Authorization: Bearer sk_live_...',
    });
  }

  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  let row: any;
  try {
    const result = await db.execute({
      sql: 'SELECT id, user_id, name, is_active FROM api_keys WHERE key_hash = ?',
      args: [keyHash],
    });
    row = result.rows[0];
  } catch {
    return res.status(500).json({ error: 'Internal error' });
  }

  if (!row) return res.status(401).json({ error: 'Invalid API key' });
  if (!row.is_active) return res.status(403).json({ error: 'API key is disabled' });

  const endpointKey = `${req.method} ${req.path}`;
  const cost = ENDPOINT_COSTS[endpointKey] ?? 0;

  // Check user's main USDC balance (not per-key balance)
  const col = balanceCol();
  if (cost > 0) {
    const userRow = await db.execute({
      sql: `SELECT ${col} as balance FROM users WHERE id = ?`,
      args: [Number(row.user_id)],
    });
    const userBalance = Number((userRow.rows[0] as any)?.balance ?? 0);
    if (userBalance < cost) {
      return res.status(402).json({
        error: 'Saldo USDC insuficiente',
        balance: userBalance,
        required: cost,
        hint: 'Deposite USDC na sua conta Stellix para usar a API',
      });
    }
  }

  req.apiKey = {
    id: Number(row.id),
    userId: Number(row.user_id),
    name: String(row.name),
    balanceUsdc: 0,
  };

  if (cost > 0) {
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Deduct from user's main balance
        db.execute({
          sql: `UPDATE users SET ${col} = MAX(${col} - ?, 0) WHERE id = ?`,
          args: [cost, Number(row.user_id)],
        }).catch(() => {});
        // Track usage on the API key (for analytics only)
        db.execute({
          sql: 'UPDATE api_keys SET total_spent = total_spent + ?, total_calls = total_calls + 1 WHERE id = ?',
          args: [cost, row.id],
        }).catch(() => {});
        db.execute({
          sql: 'INSERT INTO api_usage (api_key_id, endpoint, method, cost_usdc, status_code, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
          args: [row.id, req.path, req.method, cost, res.statusCode, req.ip || ''],
        }).catch(() => {});
      }
    });
  }

  next();
}
