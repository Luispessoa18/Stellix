import { useState, useEffect, useCallback } from 'react';
import {
  Users, ArrowUpDown, DollarSign, Activity, LogOut, RefreshCw,
  ExternalLink, ChevronDown, ChevronUp, Send, X, Check,
  AlertCircle, Wallet, Database, LayoutDashboard, Sun, Moon,
  TrendingUp, Globe, Zap, BadgeDollarSign, Flame, Settings, Eye, EyeOff,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';

interface Stats {
  totalUsers: number;
  totalBalance: number;
  totalTransactions: number;
  totalVolume: number;
}
interface AdminUser {
  id: number; name: string; email: string; phone: string;
  balance: number; currency: string;
  stellarPublicKey: string;
  testnetPublicKey: string;
  mainnetPublicKey: string;
  isAdmin: boolean; createdAt: string;
}
interface UserWallets {
  testnet: { publicKey: string; secretKey: string };
  mainnet: { publicKey: string; secretKey: string };
}
interface AdminTx {
  id: string; userId: number; userName: string; userEmail: string;
  type: string; amount: number; currency: string; counterparty: string;
  counterpartyAddress: string; stellarTxHash: string; status: string; createdAt: string;
}
interface MasterBalance {
  publicKey: string | null;
  balances: { assetCode: string; balance: string }[];
  error?: string;
}
interface CreditForm {
  userId: number; userName: string; amount: string; asset: string; onChain: boolean;
}
interface Analytics {
  daily: { day: string; sent: number; received: number; count: number; newUsers: number }[];
  currencies: { currency: string; volume: number; count: number }[];
}

interface ProfitData {
  totals: {
    txCount: number;
    totalVolume: number;
    totalFeeUsd: number;
    totalGasXlm: number;
    totalGasUsd: number;
    netProfitUsd: number;
    marginPct: number;
  };
  daily: { day: string; txCount: number; feeUsd: number; gasUsd: number; profitUsd: number; volume: number }[];
  transactions: {
    id: string; userName: string; amount: number; currency: string;
    feeUsd: number; gasXlm: number; gasUsd: number; profitUsd: number;
    txHash: string; createdAt: string;
  }[];
}

const PIE_COLORS = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

function fmt(n: number) { return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(s: string) { return new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); }
function shortKey(key: string) { if (!key) return '-'; return key.slice(0, 6) + '…' + key.slice(-6); }
function fmtDay(day: string) { return new Date(day + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); }

const STELLAR_EXPLORER = 'https://stellar.expert/explorer/public';

type Tab = 'dashboard' | 'financeiro' | 'users' | 'transactions' | 'database' | 'config';

interface Props { token: string; onLogout: () => void; }

export default function AdminDashboard({ token, onLogout }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [txs, setTxs] = useState<AdminTx[]>([]);
  const [masterBalance, setMasterBalance] = useState<MasterBalance | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [profit, setProfit] = useState<ProfitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [activeNetwork, setActiveNetwork] = useState<'testnet' | 'mainnet'>('testnet');
  const [switchingNetwork, setSwitchingNetwork] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [creditForm, setCreditForm] = useState<CreditForm | null>(null);
  const [creditLoading, setCreditLoading] = useState(false);
  const [creditResult, setCreditResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [dbSchema, setDbSchema] = useState<any>(null);
  const [dbSql, setDbSql] = useState('SELECT id, name, email, balance, currency FROM users ORDER BY id DESC LIMIT 20');
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState('');
  const [dbResultRows, setDbResultRows] = useState<Record<string, any>[]>([]);
  const [dbRowsAffected, setDbRowsAffected] = useState<number | null>(null);

  // wallets
  const [userWallets, setUserWallets] = useState<Record<number, UserWallets>>({});
  const [walletLoading, setWalletLoading] = useState<number | null>(null);
  const [showWalletKey, setShowWalletKey] = useState<Record<string, boolean>>({});

  // settings
  const [configForm, setConfigForm] = useState<Record<string, string>>({});
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [gmAssets, setGmAssets] = useState<{ asset: string; chain: string; name: string }[]>([]);
  const [gmAssetsLoading, setGmAssetsLoading] = useState(false);
  const [gmAssetsError, setGmAssetsError] = useState('');

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // theme
  const bg = isDark ? '#070b14' : '#f0f4fb';
  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.85)';
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const sidebarBg = isDark ? '#0d1120' : '#1e1b4b';
  const headerBg = isDark ? 'rgba(7,11,20,0.95)' : 'rgba(255,255,255,0.95)';
  const text = isDark ? '#ffffff' : '#111827';
  const textMuted = isDark ? '#71717a' : '#6b7280';
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const rowHover = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)';

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const [sRes, uRes, tRes, mbRes, schemaRes, analRes, profitRes] = await Promise.all([
        fetch('/api/admin/stats', { headers }),
        fetch('/api/admin/users', { headers }),
        fetch('/api/admin/transactions', { headers }),
        fetch('/api/admin/master-balance', { headers }),
        fetch('/api/admin/db/schema', { headers }),
        fetch('/api/admin/analytics', { headers }),
        fetch('/api/admin/profit', { headers }),
      ]);
      if (sRes.status === 401) { onLogout(); return; }
      setStats(await sRes.json());
      setUsers(await uRes.json());
      setTxs(await tRes.json());
      setMasterBalance(await mbRes.json());
      setDbSchema(await schemaRes.json());
      setAnalytics(await analRes.json());
      setProfit(await profitRes.json());
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); const id = window.setInterval(() => load(false), 10000); return () => clearInterval(id); }, [load]);

  useEffect(() => {
    fetch('/api/settings', { headers })
      .then((r) => r.json())
      .then((d) => setConfigForm(d))
      .catch(() => {});
    fetch('/api/admin/active-network', { headers })
      .then((r) => r.json())
      .then((d) => setActiveNetwork(d.network))
      .catch(() => {});
  }, [token]);

  const switchNetwork = async (network: 'testnet' | 'mainnet') => {
    if (network === activeNetwork) return;
    setSwitchingNetwork(true);
    try {
      const res = await fetch('/api/admin/switch-network', {
        method: 'POST',
        headers,
        body: JSON.stringify({ network }),
      });
      const data = await res.json();
      if (data.ok) {
        setActiveNetwork(data.network);
        // Recarrega dados com a nova rede
        await load(false);
      }
    } finally {
      setSwitchingNetwork(false);
    }
  };

  const saveConfig = async () => {
    setConfigLoading(true);
    setConfigSaved(false);
    await fetch('/api/settings', { method: 'PUT', headers, body: JSON.stringify(configForm) });
    setConfigLoading(false);
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 2500);
  };

  const loadUserWallets = async (userId: number) => {
    if (userWallets[userId]) return; // já carregado
    setWalletLoading(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/wallets`, { headers });
      const data = await res.json();
      setUserWallets((p) => ({ ...p, [userId]: data }));
    } catch {}
    setWalletLoading(null);
  };

  const loadGmAssets = async () => {
    setGmAssetsLoading(true);
    setGmAssetsError('');
    try {
      const res = await fetch('/api/pix/assets');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao buscar ativos');
      const items = (data.rampOn as { asset: string; chain: string; name: string }[]) ?? [];
      setGmAssets(items);
      // auto-seleciona o ativo ativo
      if (data.active) {
        setConfigForm((p) => ({ ...p, getmoons_asset: data.active.asset, getmoons_chain: data.active.chain }));
      }
    } catch (e: any) {
      setGmAssetsError(e.message);
    } finally {
      setGmAssetsLoading(false);
    }
  };

  const runDbQuery = async () => {
    setDbLoading(true); setDbError('');
    try {
      const res = await fetch('/api/admin/db/query', { method: 'POST', headers, body: JSON.stringify({ sql: dbSql }) });
      const data = await res.json();
      if (!res.ok) { setDbError(data.error || 'Falha ao executar SQL'); return; }
      setDbResultRows(data.rows || []);
      setDbRowsAffected(data.rowsAffected ?? null);
      load(false);
    } finally { setDbLoading(false); }
  };

  const handleCredit = async () => {
    if (!creditForm || !creditForm.amount || Number(creditForm.amount) <= 0) return;
    setCreditLoading(true); setCreditResult(null);
    try {
      const res = await fetch('/api/admin/credit', { method: 'POST', headers, body: JSON.stringify({ userId: creditForm.userId, amount: Number(creditForm.amount), asset: creditForm.asset, onChain: creditForm.onChain }) });
      const data = await res.json();
      if (res.ok) { setCreditResult({ ok: true, message: data.message }); load(false); setTimeout(() => { setCreditForm(null); setCreditResult(null); }, 2500); }
      else setCreditResult({ ok: false, message: data.error });
    } catch { setCreditResult({ ok: false, message: 'Erro de conexão' }); }
    finally { setCreditLoading(false); }
  };

  const todayVol = analytics?.daily.slice(-1)[0];
  const yesterday = analytics?.daily.slice(-2)[0];
  const volChange = todayVol && yesterday && yesterday.received > 0
    ? ((todayVol.received - yesterday.received) / yesterday.received) * 100 : null;

  const NAV = [
    { id: 'dashboard' as Tab, icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'financeiro' as Tab, icon: BadgeDollarSign, label: 'Financeiro' },
    { id: 'users' as Tab, icon: Users, label: `Usuários (${users.length})` },
    { id: 'transactions' as Tab, icon: ArrowUpDown, label: `Transações (${txs.length})` },
    { id: 'database' as Tab, icon: Database, label: 'DB Editor' },
    { id: 'config' as Tab, icon: Settings, label: 'Configurações' },
  ];

  const KPI = stats ? [
    { label: 'Usuários', value: stats.totalUsers.toString(), icon: Users, color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', trend: null },
    { label: 'Volume Total', value: `$${fmt(stats.totalVolume)}`, icon: TrendingUp, color: '#7c3aed', bg: 'rgba(124,58,237,0.12)', trend: volChange },
    { label: 'Custódia', value: `$${fmt(stats.totalBalance)}`, icon: DollarSign, color: '#10b981', bg: 'rgba(16,185,129,0.12)', trend: null },
    { label: 'Transações', value: stats.totalTransactions.toString(), icon: Activity, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', trend: null },
  ] : [];

  const txTypeLabel: Record<string, string> = { send: 'Envio', receive: 'Recebimento', deposit: 'Depósito', withdraw: 'Saque' };
  const txStatusColor: Record<string, string> = { completed: '#10b981', pending: '#f59e0b', failed: '#ef4444' };
  const dbColumns = dbResultRows[0] ? Object.keys(dbResultRows[0]) : [];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-xl px-3 py-2 text-xs" style={{ background: isDark ? '#1a1f35' : '#fff', border: `1px solid ${cardBorder}`, color: text }}>
        <p className="font-bold mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }}>{p.name}: ${fmt(p.value)}</p>
        ))}
      </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: bg, color: text }}>
      {/* Sidebar */}
      <aside className="w-56 flex flex-col shrink-0 h-full" style={{ background: sidebarBg }}>
        <div className="p-5 pb-4">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.25)' }}>
              <Globe size={16} className="text-violet-400" />
            </div>
            <div>
              <p className="font-bold text-white text-sm leading-tight">Stellix</p>
              <p className="text-[10px] text-white/30 leading-tight">Admin Panel</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1 pb-4">
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive = tab === item.id;
            return (
              <button key={item.id} onClick={() => setTab(item.id)}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm transition-all"
                style={{
                  background: isActive ? 'rgba(124,58,237,0.20)' : 'transparent',
                  color: isActive ? '#a78bfa' : 'rgba(255,255,255,0.45)',
                }}>
                <Icon size={16} />
                <span className="font-medium truncate">{item.label}</span>
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />}
              </button>
            );
          })}
        </nav>

        {/* Master balance widget */}
        <div className="mx-3 mb-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={13} className="text-violet-400" />
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Master Wallet</p>
          </div>
          {masterBalance?.error ? (
            <p className="text-[10px] text-yellow-400/70">{masterBalance.error}</p>
          ) : (
            <div className="space-y-1">
              {(masterBalance?.balances || []).map((b) => (
                <div key={b.assetCode} className="flex justify-between items-center">
                  <span className="text-[10px] text-white/40 font-bold">{b.assetCode}</span>
                  <span className="text-[11px] font-bold text-white">{parseFloat(b.balance).toFixed(4)}</span>
                </div>
              ))}
              {masterBalance?.publicKey && (
                <a href={`${STELLAR_EXPLORER}/account/${masterBalance.publicKey}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-[9px] text-white/20 hover:text-blue-400 mt-1">
                  {shortKey(masterBalance.publicKey)} <ExternalLink size={9} />
                </a>
              )}
            </div>
          )}
        </div>

        <div className="px-4 pb-4 border-t border-white/8 pt-3">
          <p className="text-[10px] text-white/20 text-center">Mainnet · Stellix v1.0</p>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <header className="px-6 py-3 flex items-center justify-between shrink-0 border-b"
          style={{ background: headerBg, borderColor: cardBorder, backdropFilter: 'blur(12px)' }}>
          <div>
            <p className="text-sm font-semibold capitalize" style={{ color: text }}>
              {tab === 'dashboard' ? 'Dashboard' : tab === 'financeiro' ? 'Financeiro' : tab === 'users' ? 'Usuários' : tab === 'transactions' ? 'Transações' : tab === 'database' ? 'DB Editor' : 'Configurações'}
            </p>
            <p className="text-[10px]" style={{ color: textMuted }}>
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Badge de rede ativa */}
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold"
              style={{
                background: activeNetwork === 'mainnet' ? 'rgba(52,211,153,0.15)' : 'rgba(251,191,36,0.15)',
                border: `1px solid ${activeNetwork === 'mainnet' ? 'rgba(52,211,153,0.4)' : 'rgba(251,191,36,0.4)'}`,
                color: activeNetwork === 'mainnet' ? '#34d399' : '#fbbf24',
              }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: activeNetwork === 'mainnet' ? '#34d399' : '#fbbf24' }} />
              {activeNetwork.toUpperCase()}
            </div>
            <button onClick={() => setIsDark(!isDark)}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
              style={{ background: cardBg, border: `1px solid ${cardBorder}`, color: textMuted }}>
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button onClick={() => load(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors"
              style={{ background: cardBg, border: `1px solid ${cardBorder}`, color: textMuted }}>
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Atualizar
            </button>
            <button onClick={onLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.20)', color: '#f87171' }}>
              <LogOut size={13} />
              Sair
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ── DASHBOARD ── */}
          {tab === 'dashboard' && (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {loading
                  ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-2xl p-5 animate-pulse h-28" style={{ background: cardBg, border: `1px solid ${cardBorder}` }} />
                  ))
                  : KPI.map((c) => {
                    const Icon = c.icon;
                    return (
                      <div key={c.label} className="rounded-2xl p-5 relative overflow-hidden" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                        <div className="flex justify-between items-start mb-3">
                          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: textMuted }}>{c.label}</p>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: c.bg }}>
                            <Icon size={15} style={{ color: c.color }} />
                          </div>
                        </div>
                        <p className="text-2xl font-bold" style={{ color: text }}>{c.value}</p>
                        {c.trend !== null && c.trend !== undefined && (
                          <p className={`text-xs mt-1 font-semibold ${c.trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {c.trend >= 0 ? '+' : ''}{c.trend.toFixed(1)}% hoje
                          </p>
                        )}
                      </div>
                    );
                  })}
              </div>

              {/* Charts row */}
              <div className="grid lg:grid-cols-3 gap-4">
                {/* Area chart */}
                <div className="lg:col-span-2 rounded-2xl p-5" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                  <div className="flex justify-between items-center mb-5">
                    <div>
                      <p className="font-bold text-sm" style={{ color: text }}>Volume de Transações</p>
                      <p className="text-xs" style={{ color: textMuted }}>Últimos 14 dias</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block bg-violet-500" />Enviado</span>
                      <span className="flex items-center gap-1.5" style={{ color: textMuted }}><span className="w-2.5 h-2.5 rounded-full inline-block bg-emerald-500" />Recebido</span>
                    </div>
                  </div>
                  {analytics?.daily.length ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={analytics.daily} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gradSent" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gradReceived" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.20} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="day" tickFormatter={fmtDay} tick={{ fontSize: 10, fill: textMuted }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: textMuted }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                        <ReTooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="sent" name="Enviado" stroke="#7c3aed" strokeWidth={2} fill="url(#gradSent)" dot={false} />
                        <Area type="monotone" dataKey="received" name="Recebido" stroke="#10b981" strokeWidth={2} fill="url(#gradReceived)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-48 flex items-center justify-center" style={{ color: textMuted }}>
                      <div className="text-center">
                        <Activity size={28} className="mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Nenhuma transação ainda</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Pie chart */}
                <div className="rounded-2xl p-5" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                  <p className="font-bold text-sm mb-1" style={{ color: text }}>Distribuição por Moeda</p>
                  <p className="text-xs mb-4" style={{ color: textMuted }}>Volume acumulado</p>
                  {analytics?.currencies.length ? (
                    <>
                      <ResponsiveContainer width="100%" height={140}>
                        <PieChart>
                          <Pie data={analytics.currencies} dataKey="volume" nameKey="currency" cx="50%" cy="50%" outerRadius={60} innerRadius={36}>
                            {analytics.currencies.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <ReTooltip formatter={(val: any) => `$${fmt(val)}`} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2 mt-2">
                        {analytics.currencies.map((c, i) => (
                          <div key={c.currency} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                              <span style={{ color: textMuted }}>{c.currency}</span>
                            </div>
                            <span className="font-bold" style={{ color: text }}>${fmt(c.volume)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="h-36 flex items-center justify-center" style={{ color: textMuted }}>
                      <p className="text-sm text-center opacity-50">Sem dados ainda</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent transactions */}
              <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                <div className="px-5 py-4 flex justify-between items-center border-b" style={{ borderColor: cardBorder }}>
                  <p className="font-bold text-sm" style={{ color: text }}>Transações Recentes</p>
                  <button onClick={() => setTab('transactions')} className="text-xs font-semibold text-violet-400 hover:text-violet-300">Ver todas →</button>
                </div>
                {txs.slice(0, 6).map((tx, i) => {
                  const isCredit = tx.type === 'receive' || tx.type === 'deposit';
                  return (
                    <div key={tx.id} className="flex items-center gap-4 px-5 py-3.5 transition-colors"
                      style={{ borderTop: i > 0 ? `1px solid ${cardBorder}` : 'none' }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: isCredit ? 'rgba(16,185,129,0.12)' : 'rgba(124,58,237,0.12)' }}>
                        <ArrowUpDown size={14} style={{ color: isCredit ? '#10b981' : '#7c3aed' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: text }}>{tx.counterparty || txTypeLabel[tx.type]}</p>
                        <p className="text-xs truncate" style={{ color: textMuted }}>{tx.userName} · {fmtDate(tx.createdAt)}</p>
                      </div>
                      <p className={`text-sm font-bold shrink-0 ${isCredit ? 'text-emerald-400' : ''}`}
                        style={!isCredit ? { color: text } : {}}>
                        {isCredit ? '+' : '-'}${fmt(tx.amount)}
                      </p>
                    </div>
                  );
                })}
                {txs.length === 0 && (
                  <div className="py-10 text-center" style={{ color: textMuted }}>
                    <p className="text-sm">Nenhuma transação ainda</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── FINANCEIRO ── */}
          {tab === 'financeiro' && (
            <>
              {/* KPI Financeiro */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    label: 'Receita (Fees)',
                    value: `$${fmt(profit?.totals.totalFeeUsd ?? 0)}`,
                    sub: `${profit?.totals.txCount ?? 0} txs patrocinadas`,
                    icon: BadgeDollarSign, color: '#10b981', bg: 'rgba(16,185,129,0.12)',
                  },
                  {
                    label: 'Gas Gasto (XLM)',
                    value: `$${(profit?.totals.totalGasUsd ?? 0).toFixed(6)}`,
                    sub: `${(profit?.totals.totalGasXlm ?? 0).toFixed(5)} XLM`,
                    icon: Zap, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',
                  },
                  {
                    label: 'Lucro Líquido',
                    value: `$${fmt(profit?.totals.netProfitUsd ?? 0)}`,
                    sub: 'receita - gas',
                    icon: TrendingUp, color: '#7c3aed', bg: 'rgba(124,58,237,0.12)',
                  },
                  {
                    label: 'Margem Bruta',
                    value: `${(profit?.totals.marginPct ?? 0).toFixed(3)}%`,
                    sub: 'sobre receita',
                    icon: Flame, color: '#ef4444', bg: 'rgba(239,68,68,0.12)',
                  },
                ].map((c) => {
                  const Icon = c.icon;
                  return (
                    <div key={c.label} className="rounded-2xl p-5" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                      <div className="flex justify-between items-start mb-3">
                        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: textMuted }}>{c.label}</p>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: c.bg }}>
                          <Icon size={15} style={{ color: c.color }} />
                        </div>
                      </div>
                      <p className="text-2xl font-bold" style={{ color: text }}>{c.value}</p>
                      <p className="text-xs mt-1" style={{ color: textMuted }}>{c.sub}</p>
                    </div>
                  );
                })}
              </div>

              {/* Exemplo de referência — uma transação */}
              <div className="rounded-2xl p-5" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                <p className="text-sm font-bold mb-1" style={{ color: text }}>Exemplo de margem por transação</p>
                <p className="text-xs mb-4" style={{ color: textMuted }}>Baseado em 10 USDC enviados (fee bump, 2 ops)</p>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Receita (1% fee)', value: '$0.10 USDC', color: '#10b981' },
                    { label: 'Custo gas (300 stroops)', value: '0.00003 XLM ≈ $0.000003', color: '#f59e0b' },
                    { label: 'Lucro por tx', value: '≈ $0.099997', color: '#7c3aed' },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl p-4 text-center" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', border: `1px solid ${cardBorder}` }}>
                      <p className="text-xs mb-2" style={{ color: textMuted }}>{item.label}</p>
                      <p className="font-bold text-sm" style={{ color: item.color }}>{item.value}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs mt-3 text-center" style={{ color: textMuted }}>
                  Margem bruta: <span style={{ color: '#10b981', fontWeight: 700 }}>~99.997%</span> — gas é 0.003% da receita
                </p>
              </div>

              {/* Gráfico lucro diário */}
              <div className="rounded-2xl p-5" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                <p className="font-bold text-sm mb-1" style={{ color: text }}>Receita vs Custo de Gas (diário)</p>
                <p className="text-xs mb-4" style={{ color: textMuted }}>Últimos 30 dias — escala logarítmica por causa da diferença</p>
                {(profit?.daily.length ?? 0) > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={profit!.daily}>
                      <XAxis dataKey="day" tickFormatter={(d) => new Date(d+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})} tick={{ fontSize: 10, fill: textMuted }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: textMuted }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                      <ReTooltip formatter={(v: any, n: string) => [`$${Number(v).toFixed(6)}`, n]} contentStyle={{ background: isDark ? '#1a1f35' : '#fff', border: `1px solid ${cardBorder}`, color: text, borderRadius: 12 }} />
                      <Bar dataKey="feeUsd" name="Receita" fill="#10b981" radius={[4,4,0,0]} />
                      <Bar dataKey="gasUsd" name="Gas" fill="#f59e0b" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-44 flex items-center justify-center" style={{ color: textMuted }}>
                    <p className="text-sm opacity-50">Nenhuma tx patrocinada ainda</p>
                  </div>
                )}
              </div>

              {/* Tabela por transação */}
              <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                <div className="px-5 py-3.5 border-b" style={{ borderColor: cardBorder }}>
                  <p className="font-bold text-sm" style={{ color: text }}>Breakdown por Transação</p>
                </div>
                <div className="grid px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest"
                  style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr', background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', color: textMuted }}>
                  <span>Data</span><span>Usuário</span><span>Volume</span><span>Fee $</span><span>Gas $</span><span>Lucro $</span>
                </div>
                {(profit?.transactions.length ?? 0) === 0 ? (
                  <div className="py-12 text-center" style={{ color: textMuted }}>
                    <Zap size={24} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhuma transação patrocinada ainda</p>
                  </div>
                ) : profit!.transactions.map((tx, i) => (
                  <div key={tx.id}
                    className="grid px-5 py-3 items-center text-sm"
                    style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr', borderTop: i > 0 ? `1px solid ${cardBorder}` : 'none' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = rowHover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <span className="text-xs" style={{ color: textMuted }}>{fmtDate(tx.createdAt)}</span>
                    <span className="text-xs truncate" style={{ color: text }}>{tx.userName}</span>
                    <span className="font-bold" style={{ color: text }}>${fmt(tx.amount)}</span>
                    <span className="font-bold text-emerald-400">${tx.feeUsd.toFixed(4)}</span>
                    <div>
                      <span className="text-xs" style={{ color: '#f59e0b' }}>${tx.gasUsd.toFixed(6)}</span>
                      <p className="text-[9px]" style={{ color: textMuted }}>{tx.gasXlm.toFixed(5)} XLM</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-emerald-400">${tx.profitUsd.toFixed(4)}</span>
                      {tx.txHash && (
                        <a href={`${STELLAR_EXPLORER}/tx/${tx.txHash}`} target="_blank" rel="noreferrer" className="text-blue-400/50 hover:text-blue-400">
                          <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── USERS ── */}
          {tab === 'users' && (
            <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
              <div className="grid grid-cols-12 px-5 py-3 text-[10px] font-bold uppercase tracking-widest"
                style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', color: textMuted, borderBottom: `1px solid ${cardBorder}` }}>
                <span className="col-span-3">Nome / Email</span>
                <span className="col-span-2">Saldo</span>
                <span className="col-span-3">Carteira Stellar</span>
                <span className="col-span-2">Cadastro</span>
                <span className="col-span-2 text-right">Ações</span>
              </div>

              {loading ? <div className="p-10 text-center" style={{ color: textMuted }}>Carregando...</div>
                : users.length === 0 ? (
                  <div className="p-16 text-center" style={{ color: textMuted }}>
                    <Users size={28} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Nenhum usuário ainda</p>
                  </div>
                ) : users.map((u) => (
                  <div key={u.id} style={{ borderTop: `1px solid ${cardBorder}` }}>
                    <div className="grid grid-cols-12 px-5 py-4 items-center transition-colors" style={{ background: 'transparent' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = rowHover)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                      <div className="col-span-3 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm truncate" style={{ color: text }}>{u.name}</p>
                          {u.isAdmin && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                              style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>ADM</span>
                          )}
                        </div>
                        <p className="text-xs truncate" style={{ color: textMuted }}>{u.email}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="font-bold text-emerald-400 text-sm">${fmt(u.balance)}</p>
                        <p className="text-[10px] uppercase" style={{ color: textMuted }}>{u.currency}</p>
                      </div>
                      <div className="col-span-3">
                        {u.stellarPublicKey ? (
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono" style={{ color: textMuted }}>{shortKey(u.stellarPublicKey)}</code>
                            <a href={`${STELLAR_EXPLORER}/account/${u.stellarPublicKey}`} target="_blank" rel="noreferrer" className="text-blue-400/60 hover:text-blue-400">
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        ) : <span className="text-xs" style={{ color: textMuted }}>Sem carteira</span>}
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs" style={{ color: textMuted }}>{fmtDate(u.createdAt)}</p>
                      </div>
                      <div className="col-span-2 flex justify-end items-center gap-2">
                        <button
                          onClick={async () => {
                            await fetch(`/api/admin/users/${u.id}/toggle-admin`, { method: 'POST', headers });
                            load(false);
                          }}
                          title={u.isAdmin ? 'Remover admin' : 'Tornar admin'}
                          className="h-7 px-2 rounded-lg text-[10px] font-bold transition-colors"
                          style={u.isAdmin
                            ? { background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.30)', color: '#f87171' }
                            : { background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', border: `1px solid ${cardBorder}`, color: textMuted }
                          }>
                          {u.isAdmin ? 'ADM ✓' : 'ADM'}
                        </button>
                        <button onClick={() => { const next = expandedUser === u.id ? null : u.id; setExpandedUser(next); if (next) loadUserWallets(next); }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-violet-400 text-xs font-bold"
                          style={{ border: '1px solid rgba(124,58,237,0.30)', background: 'rgba(124,58,237,0.08)' }}>
                          <Send size={11} />
                          {expandedUser === u.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        </button>
                      </div>
                    </div>

                    {expandedUser === u.id && (
                      <div className="px-5 pb-5 pt-4 space-y-5" style={{ background: 'rgba(124,58,237,0.04)', borderTop: `1px solid rgba(124,58,237,0.12)` }}>

                        {/* ── Carteiras ── */}
                        <div>
                          <p className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-3">Carteiras Stellar</p>
                          {walletLoading === u.id ? (
                            <div className="flex items-center gap-2 text-xs" style={{ color: textMuted }}>
                              <RefreshCw size={11} className="animate-spin" /> Carregando…
                            </div>
                          ) : userWallets[u.id] ? (
                            <div className="grid sm:grid-cols-2 gap-3">
                              {(['testnet', 'mainnet'] as const).map((net) => {
                                const w = userWallets[u.id][net];
                                const netColor = net === 'testnet' ? '#fbbf24' : '#34d399';
                                return (
                                  <div key={net} className="rounded-xl p-3 space-y-2"
                                    style={{ background: inputBg, border: `1px solid ${cardBorder}` }}>
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: netColor }} />
                                      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: netColor }}>{net}</span>
                                    </div>
                                    {[
                                      { label: 'Pública', val: w.publicKey, id: `${u.id}-${net}-pub` },
                                      { label: 'Privada', val: w.secretKey, id: `${u.id}-${net}-sec` },
                                    ].map(({ label, val, id }) => (
                                      <div key={id} className="space-y-0.5">
                                        <p className="text-[10px] uppercase tracking-widest" style={{ color: textMuted }}>{label}</p>
                                        <div className="flex items-center gap-1.5">
                                          <code className="text-[10px] font-mono flex-1 truncate" style={{ color: text }}>
                                            {showWalletKey[id] ? val : (val ? val.slice(0, 6) + '…' + val.slice(-4) : '—')}
                                          </code>
                                          <button type="button"
                                            onClick={() => setShowWalletKey((p) => ({ ...p, [id]: !p[id] }))}
                                            className="opacity-40 hover:opacity-100 shrink-0">
                                            {showWalletKey[id] ? <EyeOff size={11} /> : <Eye size={11} />}
                                          </button>
                                          {val && (
                                            <button type="button"
                                              onClick={() => { navigator.clipboard.writeText(val); }}
                                              className="opacity-40 hover:opacity-100 shrink-0">
                                              <ExternalLink size={11} />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <button onClick={() => loadUserWallets(u.id)}
                              className="text-xs text-violet-400 hover:text-violet-300">
                              Ver carteiras
                            </button>
                          )}
                        </div>

                        {/* ── Creditar ── */}
                        <div>
                        <p className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-4">Creditar para {u.name}</p>
                        {creditResult ? (
                          <div className={`flex items-center gap-3 p-4 rounded-xl text-sm font-medium ${creditResult.ok ? 'text-emerald-400' : 'text-red-400'}`}
                            style={{ background: creditResult.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)' }}>
                            {creditResult.ok ? <Check size={18} /> : <AlertCircle size={18} />}
                            {creditResult.message}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-3 items-end">
                            {[
                              { label: 'Valor', content: (
                                <input type="number" placeholder="0.00" min="0.01" step="0.01"
                                  className="w-32 h-10 px-3 rounded-xl text-sm font-mono outline-none"
                                  style={{ background: inputBg, border: `1px solid ${cardBorder}`, color: text }}
                                  value={creditForm?.userId === u.id ? creditForm.amount : ''}
                                  onChange={(e) => setCreditForm({ userId: u.id, userName: u.name, amount: e.target.value, asset: creditForm?.userId === u.id ? creditForm.asset : 'XLM', onChain: creditForm?.userId === u.id ? creditForm.onChain : false })} />
                              )},
                              { label: 'Ativo', content: (
                                <select className="h-10 px-3 rounded-xl text-sm outline-none"
                                  style={{ background: inputBg, border: `1px solid ${cardBorder}`, color: text }}
                                  value={creditForm?.userId === u.id ? creditForm.asset : 'XLM'}
                                  onChange={(e) => setCreditForm((f) => f ? { ...f, asset: e.target.value } : { userId: u.id, userName: u.name, amount: '', asset: e.target.value, onChain: false })}>
                                  <option value="XLM">XLM</option>
                                  <option value="USDC">USDC</option>
                                  <option value="USDT">USDT</option>
                                </select>
                              )},
                              { label: 'Modo', content: (
                                <select className="h-10 px-3 rounded-xl text-sm outline-none"
                                  style={{ background: inputBg, border: `1px solid ${cardBorder}`, color: text }}
                                  value={creditForm?.userId === u.id && creditForm.onChain ? 'onchain' : 'offchain'}
                                  onChange={(e) => setCreditForm((f) => f ? { ...f, onChain: e.target.value === 'onchain' } : { userId: u.id, userName: u.name, amount: '', asset: 'XLM', onChain: e.target.value === 'onchain' })}>
                                  <option value="offchain">Off-chain</option>
                                  <option value="onchain">On-chain</option>
                                </select>
                              )},
                            ].map(({ label, content }) => (
                              <div key={label} className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: textMuted }}>{label}</label>
                                {content}
                              </div>
                            ))}
                            <button disabled={creditLoading || !creditForm?.amount || Number(creditForm?.amount) <= 0} onClick={handleCredit}
                              className="h-10 px-5 rounded-xl font-bold text-sm text-white flex items-center gap-2 disabled:opacity-40"
                              style={{ background: '#7c3aed' }}>
                              {creditLoading ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                              Creditar
                            </button>
                            <button onClick={() => { setExpandedUser(null); setCreditForm(null); }}
                              className="h-10 px-3 rounded-xl transition-colors" style={{ color: textMuted }}>
                              <X size={18} />
                            </button>
                          </div>
                        )}
                        </div>{/* fim Creditar */}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}

          {/* ── TRANSACTIONS ── */}
          {tab === 'transactions' && (
            <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
              <div className="grid grid-cols-12 px-5 py-3 text-[10px] font-bold uppercase tracking-widest"
                style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', color: textMuted, borderBottom: `1px solid ${cardBorder}` }}>
                <span className="col-span-2">Data</span>
                <span className="col-span-2">Usuário</span>
                <span className="col-span-1">Tipo</span>
                <span className="col-span-2">Valor</span>
                <span className="col-span-3">Para / De</span>
                <span className="col-span-1">Hash</span>
                <span className="col-span-1 text-right">Status</span>
              </div>
              {loading ? <div className="p-10 text-center" style={{ color: textMuted }}>Carregando...</div>
                : txs.length === 0 ? (
                  <div className="p-16 text-center" style={{ color: textMuted }}>
                    <Activity size={28} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Nenhuma transação ainda</p>
                  </div>
                ) : txs.map((tx) => (
                  <div key={tx.id} className="grid grid-cols-12 px-5 py-3.5 items-center text-sm transition-colors"
                    style={{ borderTop: `1px solid ${cardBorder}` }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = rowHover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <div className="col-span-2"><p className="text-xs" style={{ color: textMuted }}>{fmtDate(tx.createdAt)}</p></div>
                    <div className="col-span-2 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: text }}>{tx.userName}</p>
                      <p className="text-[10px] truncate" style={{ color: textMuted }}>{tx.userEmail}</p>
                    </div>
                    <div className="col-span-1">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                        style={{ color: tx.type === 'receive' || tx.type === 'deposit' ? '#10b981' : '#a78bfa', background: tx.type === 'receive' || tx.type === 'deposit' ? 'rgba(16,185,129,0.10)' : 'rgba(124,58,237,0.10)' }}>
                        {txTypeLabel[tx.type] || tx.type}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <p className="font-bold" style={{ color: text }}>${fmt(tx.amount)}</p>
                      <p className="text-[10px] uppercase" style={{ color: textMuted }}>{tx.currency}</p>
                    </div>
                    <div className="col-span-3 min-w-0">
                      <p className="text-xs truncate" style={{ color: textMuted }}>{tx.counterparty}</p>
                      {tx.counterpartyAddress && <p className="text-[10px] font-mono truncate" style={{ color: isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.25)' }}>{shortKey(tx.counterpartyAddress)}</p>}
                    </div>
                    <div className="col-span-1">
                      {tx.stellarTxHash ? (
                        <a href={`${STELLAR_EXPLORER}/tx/${tx.stellarTxHash}`} target="_blank" rel="noreferrer"
                          className="text-blue-400/60 hover:text-blue-400 text-[10px] font-mono flex items-center gap-1">
                          {tx.stellarTxHash.slice(0, 6)}… <ExternalLink size={10} />
                        </a>
                      ) : <span className="text-[10px]" style={{ color: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.2)' }}>-</span>}
                    </div>
                    <div className="col-span-1 text-right">
                      <span className="text-[10px] font-bold uppercase" style={{ color: txStatusColor[tx.status] || textMuted }}>{tx.status}</span>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* ── DATABASE ── */}
          {tab === 'database' && (
            <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
              <div className="rounded-2xl p-5" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                <div className="flex items-center gap-2 mb-4">
                  <Database size={15} className="text-violet-400" />
                  <h3 className="font-bold text-sm" style={{ color: text }}>Schema</h3>
                </div>
                <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                  {dbSchema?.tables.map((table: string) => (
                    <div key={table} className="rounded-xl p-3" style={{ background: inputBg, border: `1px solid ${cardBorder}` }}>
                      <button onClick={() => setDbSql(`SELECT * FROM ${table} LIMIT 50`)}
                        className="text-sm font-bold text-violet-400 hover:text-violet-300 mb-2 block">{table}</button>
                      {(dbSchema.schema[table] || []).map((col: any) => (
                        <p key={col.name} className="text-[11px] font-mono" style={{ color: textMuted }}>
                          {col.name} <span style={{ color: isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.25)' }}>{col.type}</span>
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl p-5 space-y-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm" style={{ color: text }}>DB Editor</h3>
                    <p className="text-xs" style={{ color: textMuted }}>Uma instrução SQL por vez. Use com cuidado.</p>
                  </div>
                  <button onClick={runDbQuery} disabled={dbLoading}
                    className="h-10 px-4 rounded-xl font-bold text-sm text-white disabled:opacity-50"
                    style={{ background: '#7c3aed' }}>
                    {dbLoading ? 'Executando...' : 'Executar SQL'}
                  </button>
                </div>

                <textarea value={dbSql} onChange={(e) => setDbSql(e.target.value)}
                  className="w-full min-h-[130px] rounded-2xl p-4 text-sm font-mono outline-none"
                  style={{ background: isDark ? '#0b1220' : '#f8faff', border: `1px solid ${cardBorder}`, color: text }} />

                {dbError && (
                  <div className="rounded-xl px-4 py-3 text-sm text-red-300" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)' }}>
                    {dbError}
                  </div>
                )}
                {dbRowsAffected !== null && (
                  <p className="text-sm" style={{ color: textMuted }}>Linhas afetadas: {dbRowsAffected}</p>
                )}

                <div className="overflow-auto rounded-2xl" style={{ border: `1px solid ${cardBorder}` }}>
                  {dbResultRows.length === 0
                    ? <div className="p-6 text-sm" style={{ color: textMuted }}>Sem resultados para exibir.</div>
                    : (
                      <table className="min-w-full text-sm">
                        <thead style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}>
                          <tr>
                            {dbColumns.map((col) => (
                              <th key={col} className="px-3 py-2 text-left text-[10px] uppercase tracking-widest" style={{ color: textMuted }}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {dbResultRows.map((row, i) => (
                            <tr key={i} style={{ borderTop: `1px solid ${cardBorder}` }}>
                              {dbColumns.map((col) => (
                                <td key={col} className="px-3 py-2 align-top whitespace-pre-wrap" style={{ color: row[col] == null ? textMuted : text }}>
                                  {row[col] == null ? 'null' : String(row[col])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                </div>
              </div>
            </div>
          )}

          {/* ── Configurações ── */}
          {tab === 'config' && (
            <div className="p-6 space-y-8 max-w-2xl">

              {/* Stellar Network */}
              <div className="rounded-2xl p-5 space-y-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                <div className="flex items-center gap-2 mb-1">
                  <Zap size={16} className="text-yellow-400" />
                  <h3 className="font-bold text-sm" style={{ color: text }}>Rede Stellar</h3>
                </div>

                {/* Toggle testnet / mainnet */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-widest" style={{ color: textMuted }}>Rede ativa</label>
                  <div className="flex gap-2 pt-1">
                    {(['testnet', 'mainnet'] as const).map((net) => {
                      const isActive = activeNetwork === net;
                      const col = net === 'testnet' ? '#fbbf24' : '#34d399';
                      return (
                        <button key={net}
                          disabled={switchingNetwork || isActive}
                          onClick={() => {
                            if (window.confirm(`Trocar para ${net.toUpperCase()}?\n\nIsso usará um banco de dados separado (stellix-${net}.db).\nUsuários, saldos e transações são isolados por rede.\n\nO servidor será reiniciado automaticamente.`)) {
                              switchNetwork(net);
                            }
                          }}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-60"
                          style={isActive
                            ? { background: `${col}22`, border: `1px solid ${col}66`, color: col }
                            : { background: inputBg, border: `1px solid ${cardBorder}`, color: textMuted }}>
                          {switchingNetwork && !isActive
                            ? <RefreshCw size={13} className="animate-spin" />
                            : <span className="w-2 h-2 rounded-full" style={{ background: isActive ? col : 'currentColor' }} />}
                          {net.charAt(0).toUpperCase() + net.slice(1)}
                          {isActive && <span className="text-[10px] opacity-60">(ativa)</span>}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] pt-1" style={{ color: textMuted }}>
                    Usuários são compartilhados. Saldos e transações são isolados por rede. Troca instantânea.
                  </p>
                </div>

                {/* Horizon URLs */}
                {[
                  { key: 'stellar_horizon_testnet', label: 'Horizon Testnet RPC' },
                  { key: 'stellar_horizon_mainnet', label: 'Horizon Mainnet RPC' },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-widest" style={{ color: textMuted }}>{label}</label>
                    <input
                      placeholder={key.includes('testnet') ? 'https://horizon-testnet.stellar.org' : 'https://horizon.stellar.org'}
                      value={configForm[key] ?? ''}
                      onChange={(e) => setConfigForm((p) => ({ ...p, [key]: e.target.value }))}
                      className="w-full h-10 px-3 rounded-xl text-sm outline-none font-mono"
                      style={{ background: inputBg, border: `1px solid ${cardBorder}`, color: text }}
                    />
                  </div>
                ))}
              </div>

              {/* GetMoons */}
              <div className="rounded-2xl p-5 space-y-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Globe size={16} className="text-violet-400" />
                    <h3 className="font-bold text-sm" style={{ color: text }}>GetMoons — PIX In/Out</h3>
                  </div>
                  <button
                    onClick={loadGmAssets}
                    disabled={gmAssetsLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-opacity disabled:opacity-50"
                    style={{ background: 'rgba(124,58,237,0.18)', border: '1px solid rgba(124,58,237,0.35)', color: '#a78bfa' }}
                  >
                    <RefreshCw size={11} className={gmAssetsLoading ? 'animate-spin' : ''} />
                    Buscar ativos
                  </button>
                </div>

                {/* Credenciais */}
                {[
                  { key: 'getmoons_partner_id', label: 'Partner ID (Partner-X)', secret: false, placeholder: 'seu-partner-id' },
                  { key: 'getmoons_token', label: 'Token (Bearer)', secret: true, placeholder: '••••••••' },
                ].map(({ key, label, secret, placeholder }) => (
                  <div key={key} className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-widest" style={{ color: textMuted }}>{label}</label>
                    <div className="relative">
                      <input
                        type={secret && !showSecrets[key] ? 'password' : 'text'}
                        placeholder={placeholder}
                        value={configForm[key] ?? ''}
                        onChange={(e) => setConfigForm((p) => ({ ...p, [key]: e.target.value }))}
                        className="w-full h-10 px-3 rounded-xl text-sm outline-none font-mono"
                        style={{ background: inputBg, border: `1px solid ${cardBorder}`, color: text }}
                      />
                      {secret && (
                        <button type="button" onClick={() => setShowSecrets((p) => ({ ...p, [key]: !p[key] }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100">
                          {showSecrets[key] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Erro ao buscar ativos */}
                {gmAssetsError && (
                  <div className="flex items-center gap-2 text-xs text-red-400 px-1">
                    <AlertCircle size={12} />
                    {gmAssetsError}
                  </div>
                )}

                {/* Seletor de ativo/rede */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-widest" style={{ color: textMuted }}>
                    Rede ativa para PIX
                  </label>

                  {gmAssets.length > 0 ? (
                    /* Botões de seleção vindos da API */
                    <div className="flex flex-wrap gap-2 pt-1">
                      {gmAssets.map((a) => {
                        const isActive = configForm.getmoons_asset === a.asset && configForm.getmoons_chain === a.chain;
                        return (
                          <button
                            key={`${a.asset}-${a.chain}`}
                            onClick={() => setConfigForm((p) => ({ ...p, getmoons_asset: a.asset, getmoons_chain: a.chain }))}
                            className="px-3 py-2 rounded-xl text-xs font-bold transition-all"
                            style={isActive
                              ? { background: 'rgba(124,58,237,0.25)', border: '1px solid rgba(124,58,237,0.55)', color: '#a78bfa' }
                              : { background: inputBg, border: `1px solid ${cardBorder}`, color: textMuted }}
                          >
                            {a.name} · {a.chain}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    /* Inputs manuais enquanto não busca */
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'getmoons_asset', placeholder: 'USDT' },
                        { key: 'getmoons_chain', placeholder: 'XLM' },
                      ].map(({ key, placeholder }) => (
                        <input
                          key={key}
                          placeholder={placeholder}
                          value={configForm[key] ?? ''}
                          onChange={(e) => setConfigForm((p) => ({ ...p, [key]: e.target.value }))}
                          className="h-10 px-3 rounded-xl text-sm outline-none font-mono"
                          style={{ background: inputBg, border: `1px solid ${cardBorder}`, color: text }}
                        />
                      ))}
                    </div>
                  )}

                  {(configForm.getmoons_asset || configForm.getmoons_chain) && (
                    <p className="text-[11px] pt-1 font-mono" style={{ color: textMuted }}>
                      Ativo: <span style={{ color: text }}>{configForm.getmoons_asset}</span>
                      {' · '}Chain: <span style={{ color: text }}>{configForm.getmoons_chain}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* IA */}
              <div className="rounded-2xl p-5 space-y-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                <div className="flex items-center gap-2 mb-1">
                  <Zap size={16} className="text-blue-400" />
                  <h3 className="font-bold text-sm" style={{ color: text }}>Inteligência Artificial</h3>
                </div>
                {[
                  { key: 'ai_provider', label: 'Provedor', secret: false, placeholder: 'gemini | openai' },
                  { key: 'ai_model', label: 'Modelo', secret: false, placeholder: 'gemini-2.0-flash' },
                  { key: 'ai_api_key', label: 'Chave API', secret: true, placeholder: '••••••••' },
                ].map(({ key, label, secret, placeholder }) => (
                  <div key={key} className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-widest" style={{ color: textMuted }}>{label}</label>
                    <div className="relative">
                      <input
                        type={secret && !showSecrets[key] ? 'password' : 'text'}
                        placeholder={placeholder}
                        value={configForm[key] ?? ''}
                        onChange={(e) => setConfigForm((p) => ({ ...p, [key]: e.target.value }))}
                        className="w-full h-10 px-3 rounded-xl text-sm outline-none font-mono"
                        style={{ background: inputBg, border: `1px solid ${cardBorder}`, color: text }}
                      />
                      {secret && (
                        <button type="button" onClick={() => setShowSecrets((p) => ({ ...p, [key]: !p[key] }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100">
                          {showSecrets[key] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={saveConfig}
                disabled={configLoading}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-60"
                style={{ background: configSaved ? 'rgba(16,185,129,0.25)' : 'rgba(124,58,237,0.30)', border: configSaved ? '1px solid rgba(16,185,129,0.5)' : '1px solid rgba(124,58,237,0.5)' }}
              >
                {configLoading ? <RefreshCw size={15} className="animate-spin" /> : configSaved ? <Check size={15} className="text-green-400" /> : <Check size={15} />}
                {configSaved ? 'Salvo!' : configLoading ? 'Salvando…' : 'Salvar configurações'}
              </button>

              <p className="text-xs" style={{ color: textMuted }}>
                Configurações salvas no banco de dados sobrescrevem variáveis de ambiente.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
