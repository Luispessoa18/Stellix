import { Router } from 'express';
import { adminAuthMiddleware } from '../middleware/adminAuth.js';
import { getSetting, setSetting } from '../lib/settings.js';

const router = Router();

// Mapeamento: chave do DB → env var de fallback → valor padrão
const KEYS: { key: string; env: string; default?: string; secret?: boolean }[] = [
  // Stellar
  { key: 'stellar_network',           env: 'STELLAR_NETWORK',          default: 'testnet' },
  { key: 'stellar_horizon_testnet',   env: 'STELLAR_HORIZON_TESTNET',  default: 'https://horizon-testnet.stellar.org' },
  { key: 'stellar_horizon_mainnet',   env: 'STELLAR_HORIZON_MAINNET',  default: 'https://horizon.stellar.org' },
  // GetMoons
  { key: 'getmoons_partner_id', env: 'GETMOONS_PARTNER_ID' },
  { key: 'getmoons_token',      env: 'GETMOONS_TOKEN',      secret: true },
  { key: 'getmoons_asset',      env: 'GETMOONS_ASSET',      default: 'USDT' },
  { key: 'getmoons_chain',      env: 'GETMOONS_CHAIN',      default: 'BSC' },
  // IA
  { key: 'ai_provider',         env: 'AI_PROVIDER',         default: 'gemini' },
  { key: 'ai_model',            env: 'AI_MODEL',            default: 'gemma-3-27b-it' },
  { key: 'ai_api_key',          env: 'GEMINI_API_KEY',      secret: true },
];

router.get('/', adminAuthMiddleware, async (_req, res) => {
  const out: Record<string, string> = {};
  for (const { key, env, default: def, secret } of KEYS) {
    const val = await getSetting(key, env) || def || '';
    // Para segredos: retorna placeholder se tem valor, vazio se não tem
    out[key] = secret ? (val ? '••••••••' : '') : val;
  }
  res.json(out);
});

router.put('/', adminAuthMiddleware, async (req, res) => {
  const allowed = KEYS.map((k) => k.key);
  const secretKeys = KEYS.filter((k) => k.secret).map((k) => k.key);
  for (const [key, value] of Object.entries(req.body)) {
    if (!allowed.includes(key)) continue;
    if (typeof value !== 'string') continue;
    if (secretKeys.includes(key) && value === '••••••••') continue;
    await setSetting(key, value as string);
  }
  res.json({ ok: true });
});

export default router;
