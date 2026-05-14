import { ArrowUpRight, ArrowDownLeft, Eye, EyeOff, ChevronRight, Landmark, QrCode, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Transaction, User, View } from '../types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface HomeProps {
  user: User;
  transactions: Transaction[];
  onAction: (action: View) => void;
}

export default function Home({ user, transactions, onAction }: HomeProps) {
  const [showBalance, setShowBalance] = useState(true);
  const [xlmUsd, setXlmUsd] = useState(0);
  const [rates, setRates] = useState<Record<string, number>>({ USD: 1 });

  useEffect(() => {
    fetch('/api/stellar/price')
      .then((r) => r.json())
      .then((d) => setXlmUsd(Number(d.xlmUsd) || 0))
      .catch(() => {});

    fetch('/api/market/rates')
      .then((r) => r.json())
      .then((d) => setRates(d.rates || { USD: 1 }))
      .catch(() => {});
  }, []);

  const formatUSD = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  const formatLocal = (val: number, currency: string) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(val);

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const formatDateLabel = (ts: number) => {
    const d = new Date(ts);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Hoje';
    if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
  };

  const txTypeLabel = (type: Transaction['type']) => {
    if (type === 'receive') return 'Recebido';
    if (type === 'deposit') return 'Depósito';
    if (type === 'withdraw') return 'Saque';
    return 'Enviado';
  };

  const xlmNetAmount = transactions.reduce((acc, tx) => {
    if (tx.currency !== 'XLM') return acc;
    if (tx.type === 'receive' || tx.type === 'deposit') return acc + tx.amount;
    if (tx.type === 'send' || tx.type === 'withdraw') return acc - tx.amount;
    return acc;
  }, 0);

  const xlmNetUsd = xlmNetAmount * (xlmUsd || 0);
  const totalUsd = user.balance + xlmNetUsd;
  const displayRate = rates[user.currency] || 1;
  const totalLocal = totalUsd * displayRate;

  const initials = user.name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  const recentTxs = transactions.slice(0, 8);
  const grouped: Record<string, Transaction[]> = {};
  for (const tx of recentTxs) {
    const label = formatDateLabel(tx.timestamp);
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(tx);
  }

  const actions = [
    { label: 'Pagar', icon: ArrowUpRight, color: '#8B5CF6', action: 'send' as View },
    { label: 'Receber', icon: ArrowDownLeft, color: '#10B981', action: 'receive' as View },
    { label: 'PIX', icon: QrCode, color: '#3B82F6', action: 'pix' as View },
    { label: 'Extrato', icon: Clock, color: '#F59E0B', action: 'statement' as View },
  ];

  return (
    <div className="flex flex-col h-full pb-24 overflow-y-auto no-scrollbar md:max-w-lg md:mx-auto w-full">
      {/* Header */}
      <header className="px-5 pt-12 pb-6 flex justify-between items-center">
        <div>
          <p className="text-zinc-500 text-sm">Olá,</p>
          <p className="text-white text-xl font-bold leading-tight">{user.name.split(' ')[0]}</p>
        </div>
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-violet-500/25 text-violet-200 text-sm font-bold">{initials}</AvatarFallback>
        </Avatar>
      </header>

      {/* Balance Card */}
      <section className="px-5 mb-6">
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="rounded-3xl p-6 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #1e1040 0%, #2d1b69 50%, #1a0f3d 100%)' }}
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-violet-500/20 blur-3xl" />
          <div className="pointer-events-none absolute left-0 bottom-0 h-32 w-32 -translate-x-1/2 translate-y-1/2 rounded-full bg-indigo-500/15 blur-3xl" />

          <div className="relative">
            <div className="flex justify-between items-center mb-3">
              <p className="text-violet-300/60 text-xs font-medium uppercase tracking-widest">Saldo disponível</p>
              <button
                onClick={() => setShowBalance(!showBalance)}
                className="text-violet-300/50 hover:text-violet-200 transition-colors"
              >
                {showBalance ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>

            <h2 className="text-4xl font-bold text-white tracking-tight">
              {showBalance ? formatUSD(totalUsd) : '$ ••••••'}
            </h2>

            {user.currency !== 'USD' && (
              <p className="mt-1.5 text-violet-300/50 text-base font-medium">
                {showBalance
                  ? `≈ ${formatLocal(totalLocal, user.currency)}`
                  : `${user.currency} ••••••`}
              </p>
            )}
          </div>
        </motion.div>
      </section>

      {/* Action Buttons */}
      <section className="px-5 mb-6">
        <div className="grid grid-cols-4 gap-2">
          {actions.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={() => onAction(item.action)}
                className="flex flex-col items-center gap-2.5 group"
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center transition-transform group-active:scale-90"
                  style={{
                    background: `${item.color}18`,
                    border: `1.5px solid ${item.color}35`,
                  }}
                >
                  <Icon size={22} style={{ color: item.color }} />
                </div>
                <span className="text-xs text-zinc-400 font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Transactions */}
      <section className="px-5 flex-1">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-zinc-200">Últimas transações</h3>
          <button
            onClick={() => onAction('statement')}
            className="text-xs text-violet-400 font-semibold flex items-center gap-1 hover:text-violet-300 transition-colors"
          >
            Ver todas <ChevronRight size={12} />
          </button>
        </div>

        {Object.keys(grouped).length === 0 ? (
          <div className="flex flex-col items-center py-16 text-zinc-600">
            <Landmark size={32} className="mb-3 opacity-40" />
            <p className="text-sm">Nenhuma transação ainda</p>
          </div>
        ) : (
          <div className="space-y-5 pb-6">
            {Object.entries(grouped).map(([date, txs]) => (
              <div key={date}>
                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mb-2">{date}</p>
                <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                  {txs.map((tx, i) => {
                    const isCredit = tx.type === 'receive' || tx.type === 'deposit';
                    const usdValue =
                      tx.currency === 'XLM'
                        ? tx.amount * (xlmUsd || tx.usdPriceAtTime || 0)
                        : tx.amount;
                    return (
                      <div
                        key={tx.id}
                        className={cn(
                          'flex items-center gap-3 px-4 py-3.5',
                          i > 0 && 'border-t border-white/5'
                        )}
                        style={{ background: 'rgba(255,255,255,0.02)' }}
                      >
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                          style={{
                            background: isCredit
                              ? 'rgba(16,185,129,0.12)'
                              : 'rgba(239,68,68,0.10)',
                          }}
                        >
                          {isCredit
                            ? <ArrowDownLeft size={16} style={{ color: '#10B981' }} />
                            : <ArrowUpRight size={16} style={{ color: '#EF4444' }} />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-zinc-100 truncate">
                            {tx.counterparty || txTypeLabel(tx.type)}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {txTypeLabel(tx.type)} · {formatTime(tx.timestamp)}
                          </p>
                        </div>

                        <p
                          className={cn(
                            'text-sm font-bold shrink-0',
                            isCredit ? 'text-emerald-400' : 'text-zinc-300'
                          )}
                        >
                          {isCredit ? '+' : '-'}{formatUSD(usdValue)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
