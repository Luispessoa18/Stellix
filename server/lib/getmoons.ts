import { getSetting } from './settings.js';

const BASE = 'https://apibeta.getmoons.com/v2';

async function headers() {
  const [partnerId, token] = await Promise.all([
    getSetting('getmoons_partner_id', 'GETMOONS_PARTNER_ID'),
    getSetting('getmoons_token', 'GETMOONS_TOKEN'),
  ]);
  return {
    'Partner-X': partnerId,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function gm<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: await headers(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json() as any;
  if (!json.success) throw new Error(json.message ?? `GetMoons error ${res.status}`);
  return json.data as T;
}

// ─── Types ────────────────────────────────────────────────────

export interface GmAsset {
  name: string;
  asset: string;
  chain: string;
  ramp: { on: boolean; off: boolean };
  custody: { deposit: boolean; withdraw: boolean };
  swap: { in: boolean; out: boolean };
  explorerHash: string;
  protocol: string;
  tag: string;
}

export interface RampQuote {
  payout: { amount: string | number };
}

export interface RampOrder {
  id: string;
  status: string;
  payin: { amount: number; asset: string; chain: string; address: string; hash: string };
  payout: { amount: number; asset: string; chain: string; address: string; hash: string; receipt: string };
  createdAt: string;
  expiresAt: string;
  paidAt: string;
}

// ─── Assets cache (5 min TTL) ─────────────────────────────────

let _assetsCache: GmAsset[] | null = null;
let _assetsCacheAt = 0;
const CACHE_TTL = 5 * 60 * 1000;

export async function listAssets(forceRefresh = false): Promise<GmAsset[]> {
  if (!forceRefresh && _assetsCache && Date.now() - _assetsCacheAt < CACHE_TTL) {
    return _assetsCache;
  }
  const data = await gm<GmAsset[]>('GET', '/assets');
  _assetsCache = data;
  _assetsCacheAt = Date.now();
  return data;
}

/** Retorna os ativos que suportam ramp on (BRL → crypto) */
export async function rampOnAssets(): Promise<GmAsset[]> {
  const all = await listAssets();
  return all.filter((a) => a.ramp.on && a.chain !== 'FIAT');
}

/** Retorna os ativos que suportam ramp off (crypto → BRL) */
export async function rampOffAssets(): Promise<GmAsset[]> {
  const all = await listAssets();
  return all.filter((a) => a.ramp.off && a.chain !== 'FIAT');
}

/**
 * Busca qual asset/chain usar para PIX:
 * 1. Preferência salva nas settings (getmoons_asset + getmoons_chain)
 * 2. Fallback: primeiro ativo com ramp on disponível
 */
export async function resolvePixAsset(): Promise<{ asset: string; chain: string }> {
  const [savedAsset, savedChain] = await Promise.all([
    getSetting('getmoons_asset', 'GETMOONS_ASSET'),
    getSetting('getmoons_chain', 'GETMOONS_CHAIN'),
  ]);

  if (savedAsset && savedChain) {
    // Valida se o par ainda está disponível na API
    try {
      const assets = await listAssets();
      const found = assets.find(
        (a) => a.asset === savedAsset && a.chain === savedChain && a.ramp.on,
      );
      if (found) return { asset: savedAsset, chain: savedChain };
    } catch {
      // Se a API falhar, usa o salvo mesmo assim
      return { asset: savedAsset, chain: savedChain };
    }
  }

  // Auto-detect: primeiro com ramp on
  const available = await rampOnAssets();
  if (!available.length) throw new Error('Nenhum ativo com ramp on disponível no GetMoons');
  return { asset: available[0].asset, chain: available[0].chain };
}

// ─── API calls ────────────────────────────────────────────────

export const getmoons = {
  assets: {
    list: listAssets,
    rampOn: rampOnAssets,
    rampOff: rampOffAssets,
    resolve: resolvePixAsset,
  },

  rampOn: {
    quote: (amount: number, asset: string, chain: string) =>
      gm<RampQuote>('POST', '/ramp/on/quote', { gmid: '', whitelist: false, amount, asset, chain }),

    create: (amount: number, address: string, asset: string, chain: string) =>
      gm<RampOrder>('POST', '/ramp/on/create', {
        gmid: '', whitelist: false, amount, asset, chain, address, tag: '',
      }),

    status: (id: string) => gm<RampOrder>('GET', `/ramp/on/status/${id}`),
  },

  rampOff: {
    quote: (amount: number, asset: string, chain: string) =>
      gm<RampQuote>('POST', '/ramp/off/quote', { gmid: '', whitelist: false, amount, asset, chain }),

    create: (amount: number, pixKey: string, asset: string, chain: string) =>
      gm<RampOrder>('POST', '/ramp/off/create', {
        amount, asset, chain, whitelist: false, address: pixKey,
      }),

    status: (id: string) => gm<RampOrder>('GET', `/ramp/off/status/${id}`),
  },
};
