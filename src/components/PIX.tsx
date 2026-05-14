import { useState, useEffect, useRef, useCallback } from 'react';
import { QrCode, ArrowDownLeft, ArrowUpRight, CheckCircle2, Clock, Copy, RefreshCw, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { User } from '../types';
import { cn } from '@/lib/utils';

type Tab = 'depositar' | 'sacar';
type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria';
type OrderStatus = 'idle' | 'quoting' | 'creating' | 'waiting' | 'completed' | 'expired' | 'failed';

interface ActiveOrder {
  orderId: string;
  qrCode?: string;
  brlAmount: number;
  usdtAmount: number;
  expiresAt?: string;
}

interface PIXProps {
  user: User;
  onBalanceRefresh?: () => void;
}

const PIX_KEY_LABELS: Record<PixKeyType, string> = {
  cpf: 'CPF', cnpj: 'CNPJ', email: 'Email', telefone: 'Telefone', aleatoria: 'Aleatória',
};
const PIX_KEY_PLACEHOLDERS: Record<PixKeyType, string> = {
  cpf: '000.000.000-00', cnpj: '00.000.000/0000-00',
  email: 'email@exemplo.com', telefone: '+55 (11) 99999-9999',
  aleatoria: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
};

function fmtBrl(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}
function fmtUsdc(v: number) {
  return `${v.toFixed(4)} USDC`;
}

export default function PIX({ user, onBalanceRefresh }: PIXProps) {
  const token = localStorage.getItem('token') ?? '';
  const [tab, setTab] = useState<Tab>('depositar');

  // ── PIX IN state ──────────────────────────────────────────
  const [inAmount, setInAmount] = useState('');
  const [inQuote, setInQuote] = useState<number | null>(null);
  const [inStatus, setInStatus] = useState<OrderStatus>('idle');
  const [inOrder, setInOrder] = useState<ActiveOrder | null>(null);
  const [inSecondsLeft, setInSecondsLeft] = useState(0);
  const inPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── PIX OUT state ─────────────────────────────────────────
  const [outAmount, setOutAmount] = useState('');
  const [outQuote, setOutQuote] = useState<number | null>(null);
  const [outPixKey, setOutPixKey] = useState('');
  const [outPixKeyType, setOutPixKeyType] = useState<PixKeyType>('cpf');
  const [outStatus, setOutStatus] = useState<OrderStatus>('idle');
  const [outOrderId, setOutOrderId] = useState<string | null>(null);
  const [outBrlAmount, setOutBrlAmount] = useState(0);
  const outPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const api = useCallback(async (path: string, body?: object) => {
    const res = await fetch(path, {
      method: body !== undefined ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Erro desconhecido');
    return json;
  }, [token]);

  // ── Countdown timer for QR ────────────────────────────────
  useEffect(() => {
    if (inStatus !== 'waiting' || !inOrder?.expiresAt) return;
    const expMs = new Date(inOrder.expiresAt).getTime();
    const tick = () => {
      const secs = Math.max(0, Math.floor((expMs - Date.now()) / 1000));
      setInSecondsLeft(secs);
      if (secs === 0) setInStatus('expired');
    };
    tick();
    inTimerRef.current = setInterval(tick, 1000);
    return () => { if (inTimerRef.current) clearInterval(inTimerRef.current); };
  }, [inStatus, inOrder]);

  // ── PIX IN polling ────────────────────────────────────────
  useEffect(() => {
    if (inStatus !== 'waiting' || !inOrder?.orderId) return;
    inPollRef.current = setInterval(async () => {
      try {
        const data = await api(`/api/pix/on/status/${inOrder.orderId}`);
        if (data.status === 'completed') {
          setInStatus('completed');
          clearInterval(inPollRef.current!);
          clearInterval(inTimerRef.current!);
          onBalanceRefresh?.();
          toast.success('PIX recebido! USDC creditado na sua carteira.');
        } else if (data.status === 'expired') {
          setInStatus('expired');
          clearInterval(inPollRef.current!);
        }
      } catch {}
    }, 5000);
    return () => { if (inPollRef.current) clearInterval(inPollRef.current); };
  }, [inStatus, inOrder, api, onBalanceRefresh]);

  // ── PIX OUT polling ───────────────────────────────────────
  useEffect(() => {
    if (outStatus !== 'waiting' || !outOrderId) return;
    outPollRef.current = setInterval(async () => {
      try {
        const data = await api(`/api/pix/off/status/${outOrderId}`);
        if (data.status === 'completed') {
          setOutStatus('completed');
          clearInterval(outPollRef.current!);
          onBalanceRefresh?.();
          toast.success('PIX enviado com sucesso!');
        }
      } catch {}
    }, 5000);
    return () => { if (outPollRef.current) clearInterval(outPollRef.current); };
  }, [outStatus, outOrderId, api, onBalanceRefresh]);

  // ─────────────────────────────────────────────────────────
  // PIX IN handlers
  // ─────────────────────────────────────────────────────────
  const fetchInQuote = async () => {
    const num = parseFloat(inAmount);
    if (!num || num <= 0) { toast.error('Informe um valor válido'); return; }
    setInStatus('quoting');
    setInQuote(null);
    try {
      const data = await api('/api/pix/on/quote', { amount: num });
      setInQuote(data.usdtAmount);
      setInStatus('idle');
    } catch (e: any) {
      toast.error(e.message);
      setInStatus('idle');
    }
  };

  const createInOrder = async () => {
    const num = parseFloat(inAmount);
    if (!num || num <= 0) { toast.error('Informe um valor válido'); return; }
    setInStatus('creating');
    try {
      const data = await api('/api/pix/on/create', { amount: num });
      setInOrder({
        orderId: data.orderId,
        qrCode: data.qrCode,
        brlAmount: data.brlAmount,
        usdtAmount: data.usdtAmount,
        expiresAt: data.expiresAt,
      });
      setInStatus('waiting');
    } catch (e: any) {
      toast.error(e.message);
      setInStatus('idle');
    }
  };

  const resetIn = () => {
    clearInterval(inPollRef.current!);
    clearInterval(inTimerRef.current!);
    setInStatus('idle');
    setInOrder(null);
    setInQuote(null);
    setInAmount('');
  };

  // ─────────────────────────────────────────────────────────
  // PIX OUT handlers
  // ─────────────────────────────────────────────────────────
  const fetchOutQuote = async () => {
    const num = parseFloat(outAmount);
    if (!num || num <= 0) { toast.error('Informe um valor válido'); return; }
    setOutStatus('quoting');
    setOutQuote(null);
    try {
      const data = await api('/api/pix/off/quote', { amount: num });
      setOutQuote(data.brlAmount);
      setOutStatus('idle');
    } catch (e: any) {
      toast.error(e.message);
      setOutStatus('idle');
    }
  };

  const createOutOrder = async () => {
    const num = parseFloat(outAmount);
    if (!num || num <= 0) { toast.error('Informe um valor válido'); return; }
    if (!outPixKey.trim()) { toast.error('Informe a chave PIX'); return; }
    if (num > user.balance) { toast.error('Saldo USDC insuficiente'); return; }
    setOutStatus('creating');
    try {
      const data = await api('/api/pix/off/create', { amount: num, pixKey: outPixKey.trim() });
      setOutOrderId(data.orderId);
      setOutBrlAmount(data.brlAmount);
      setOutStatus('waiting');
    } catch (e: any) {
      toast.error(e.message);
      setOutStatus('idle');
    }
  };

  const resetOut = () => {
    clearInterval(outPollRef.current!);
    setOutStatus('idle');
    setOutOrderId(null);
    setOutQuote(null);
    setOutAmount('');
    setOutPixKey('');
  };

  const copyQr = () => {
    if (inOrder?.qrCode) {
      navigator.clipboard.writeText(inOrder.qrCode);
      toast.success('Código PIX copiado!');
    }
  };

  const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full pb-24 overflow-y-auto no-scrollbar md:max-w-lg md:mx-auto w-full">
      <header className="px-5 pt-12 pb-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.15)' }}>
            <QrCode size={19} className="text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--t-text)' }}>PIX</h1>
        </div>
        <p className="text-sm" style={{ color: 'var(--t-text-2)' }}>Depósito e saque via PIX · powered by GetMoons</p>
      </header>

      {/* Tabs */}
      <div className="px-5 mb-6">
        <div className="flex p-1 rounded-2xl gap-1" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {([
            { id: 'depositar' as Tab, label: 'Depositar', icon: ArrowDownLeft },
            { id: 'sacar' as Tab, label: 'Sacar', icon: ArrowUpRight },
          ] as const).map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn('flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all', isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-300')}
                style={isActive ? { background: 'rgba(59,130,246,0.22)', border: '1px solid rgba(59,130,246,0.38)' } : {}}
              >
                <Icon size={16} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-5 flex-1 pb-8">
        <AnimatePresence mode="wait">

          {/* ── PIX IN ── */}
          {tab === 'depositar' && (
            <motion.div key="depositar" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">

              {/* QR code shown */}
              {(inStatus === 'waiting' || inStatus === 'completed' || inStatus === 'expired') && inOrder ? (
                <div className="space-y-5">
                  {inStatus === 'completed' ? (
                    <div className="flex flex-col items-center gap-3 py-8">
                      <CheckCircle2 size={52} className="text-green-400" />
                      <p className="text-lg font-bold text-green-400">Pagamento confirmado!</p>
                      <p className="text-sm text-zinc-400 text-center">
                        {fmtUsdc(inOrder.usdtAmount)} creditados na sua conta Stellix.
                      </p>
                      <button onClick={resetIn} className="mt-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: 'rgba(59,130,246,0.25)', border: '1px solid rgba(59,130,246,0.4)' }}>
                        Novo depósito
                      </button>
                    </div>
                  ) : inStatus === 'expired' ? (
                    <div className="flex flex-col items-center gap-3 py-8">
                      <XCircle size={52} className="text-red-400" />
                      <p className="text-lg font-bold text-red-400">QR Code expirado</p>
                      <button onClick={resetIn} className="mt-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: 'rgba(59,130,246,0.25)', border: '1px solid rgba(59,130,246,0.4)' }}>
                        Tentar novamente
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Summary */}
                      <div className="flex justify-between items-center px-1">
                        <div>
                          <p className="text-xs text-zinc-500 uppercase tracking-widest">Pague</p>
                          <p className="text-2xl font-bold text-white">{fmtBrl(inOrder.brlAmount)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-zinc-500 uppercase tracking-widest">Receba</p>
                          <p className="text-lg font-bold text-blue-400">{fmtUsdc(inOrder.usdtAmount)}</p>
                        </div>
                      </div>

                      {/* QR */}
                      <div className="flex flex-col items-center gap-4 p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
                        <div className="p-3 bg-white rounded-2xl">
                          <QRCodeSVG value={inOrder.qrCode!} size={200} />
                        </div>
                        <button onClick={copyQr} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity active:opacity-70" style={{ background: 'rgba(59,130,246,0.25)', border: '1px solid rgba(59,130,246,0.4)' }}>
                          <Copy size={15} />
                          Copiar código PIX
                        </button>
                      </div>

                      {/* Timer + status */}
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2 text-sm text-zinc-400">
                          <Clock size={14} />
                          <span>Expira em <span className={cn('font-mono font-bold', inSecondsLeft < 120 ? 'text-red-400' : 'text-zinc-300')}>{fmtTime(inSecondsLeft)}</span></span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                          <RefreshCw size={11} className="animate-spin" />
                          Aguardando pagamento…
                        </div>
                      </div>

                      <button onClick={resetIn} className="w-full py-2.5 rounded-xl text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
                        Cancelar
                      </button>
                    </>
                  )}
                </div>
              ) : (
                /* Form */
                <>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--t-text-2)' }}>Valor em BRL</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold" style={{ color: 'var(--t-text-2)' }}>R$</span>
                      <input
                        type="number" inputMode="decimal" placeholder="0,00"
                        value={inAmount}
                        onChange={(e) => { setInAmount(e.target.value); setInQuote(null); }}
                        className="w-full h-14 pl-12 pr-4 rounded-2xl text-white text-xl font-bold placeholder:text-zinc-700 outline-none"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
                      />
                    </div>
                  </div>

                  {/* Quote result */}
                  {inStatus === 'quoting' && (
                    <div className="flex items-center gap-2 text-sm text-zinc-400 px-1">
                      <RefreshCw size={13} className="animate-spin" />
                      Consultando cotação…
                    </div>
                  )}
                  {inQuote !== null && inStatus === 'idle' && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between px-4 py-3 rounded-2xl"
                      style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.20)' }}>
                      <span className="text-sm text-zinc-400">Você recebe</span>
                      <span className="text-base font-bold text-blue-400">{fmtUsdc(inQuote)}</span>
                    </motion.div>
                  )}

                  <div className="flex gap-3">
                    <button onClick={fetchInQuote} disabled={inStatus === 'quoting' || !inAmount}
                      className="flex-1 h-13 py-3.5 rounded-2xl font-bold text-sm text-white transition-opacity disabled:opacity-40"
                      style={{ background: 'rgba(59,130,246,0.25)', border: '1px solid rgba(59,130,246,0.4)' }}>
                      Ver cotação
                    </button>
                    <button onClick={createInOrder} disabled={inStatus === 'creating' || !inAmount || inQuote === null}
                      className="flex-[2] h-13 py-3.5 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-opacity disabled:opacity-40 active:opacity-80"
                      style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)' }}>
                      {inStatus === 'creating' ? <RefreshCw size={16} className="animate-spin" /> : <QrCode size={16} />}
                      {inStatus === 'creating' ? 'Gerando…' : 'Gerar QR Code'}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* ── PIX OUT ── */}
          {tab === 'sacar' && (
            <motion.div key="sacar" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">

              {outStatus === 'completed' ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <CheckCircle2 size={52} className="text-green-400" />
                  <p className="text-lg font-bold text-green-400">PIX enviado!</p>
                  <p className="text-sm text-zinc-400 text-center">{fmtBrl(outBrlAmount)} enviados para sua chave PIX.</p>
                  <button onClick={resetOut} className="mt-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: 'rgba(59,130,246,0.25)', border: '1px solid rgba(59,130,246,0.4)' }}>
                    Novo saque
                  </button>
                </div>
              ) : outStatus === 'waiting' ? (
                <div className="flex flex-col items-center gap-4 py-8">
                  <RefreshCw size={40} className="text-blue-400 animate-spin" />
                  <p className="text-base font-bold text-white">Processando saque…</p>
                  <p className="text-sm text-zinc-400 text-center">
                    Aguardando GetMoons enviar {fmtBrl(outBrlAmount)} para sua chave PIX.
                  </p>
                  <p className="text-xs text-zinc-600 text-center">Isso pode levar alguns minutos. Não feche esta tela.</p>
                </div>
              ) : (
                <>
                  {/* Balance chip */}
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs text-zinc-500">Saldo disponível</span>
                    <span className="text-sm font-bold text-blue-400">{fmtUsdc(user.balance)}</span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--t-text-2)' }}>Valor em USDC</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold" style={{ color: 'var(--t-text-2)' }}>$</span>
                      <input
                        type="number" inputMode="decimal" placeholder="0.00"
                        value={outAmount}
                        onChange={(e) => { setOutAmount(e.target.value); setOutQuote(null); }}
                        className="w-full h-14 pl-10 pr-4 rounded-2xl text-white text-xl font-bold placeholder:text-zinc-700 outline-none"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
                      />
                    </div>
                  </div>

                  {outStatus === 'quoting' && (
                    <div className="flex items-center gap-2 text-sm text-zinc-400 px-1">
                      <RefreshCw size={13} className="animate-spin" />
                      Consultando cotação…
                    </div>
                  )}
                  {outQuote !== null && outStatus === 'idle' && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between px-4 py-3 rounded-2xl"
                      style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.20)' }}>
                      <span className="text-sm text-zinc-400">Você recebe</span>
                      <span className="text-base font-bold text-blue-400">{fmtBrl(outQuote)}</span>
                    </motion.div>
                  )}

                  {/* PIX key type selector */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--t-text-2)' }}>Tipo de chave</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(Object.keys(PIX_KEY_LABELS) as PixKeyType[]).map((type) => (
                        <button key={type}
                          onClick={() => { setOutPixKeyType(type); setOutPixKey(''); }}
                          className={cn('py-2.5 rounded-xl text-xs font-bold transition-all', outPixKeyType === type ? 'text-white' : 'text-zinc-500 hover:text-zinc-300')}
                          style={outPixKeyType === type
                            ? { background: 'rgba(59,130,246,0.20)', border: '1px solid rgba(59,130,246,0.40)' }
                            : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                          {PIX_KEY_LABELS[type]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--t-text-2)' }}>Chave PIX</label>
                    <input
                      placeholder={PIX_KEY_PLACEHOLDERS[outPixKeyType]}
                      value={outPixKey}
                      onChange={(e) => setOutPixKey(e.target.value)}
                      className="w-full h-14 px-4 rounded-2xl text-white text-sm placeholder:text-zinc-700 outline-none font-mono"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
                    />
                  </div>

                  <div className="flex gap-3">
                    <button onClick={fetchOutQuote} disabled={outStatus === 'quoting' || !outAmount}
                      className="flex-1 py-3.5 rounded-2xl font-bold text-sm text-white transition-opacity disabled:opacity-40"
                      style={{ background: 'rgba(59,130,246,0.25)', border: '1px solid rgba(59,130,246,0.4)' }}>
                      Ver cotação
                    </button>
                    <button onClick={createOutOrder} disabled={outStatus === 'creating' || !outAmount || !outPixKey || outQuote === null}
                      className="flex-[2] py-3.5 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-opacity disabled:opacity-40 active:opacity-80"
                      style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)' }}>
                      {outStatus === 'creating' ? <RefreshCw size={16} className="animate-spin" /> : <ArrowUpRight size={16} />}
                      {outStatus === 'creating' ? 'Processando…' : 'Sacar via PIX'}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
