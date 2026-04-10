import { ArrowUpRight, ArrowDownLeft, Plus, Eye, EyeOff, Clock, ChevronRight, Landmark, TrendingUp, TrendingDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Transaction, User } from '../types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const CURRENCY_LABELS: Record<string, string> = {
  USD: 'USD',
  BRL: 'BRL',
  EUR: 'EUR',
  GBP: 'GBP',
};

function XlmValue({ tx, xlmUsd, isCredit }: { tx: Transaction; xlmUsd: number; isCredit: boolean }) {
  const effectiveUsdPrice = xlmUsd > 0 ? xlmUsd : (tx.usdPriceAtTime || 0);
  const currentUsd = effectiveUsdPrice > 0 ? tx.amount * effectiveUsdPrice : null;
  const priceAtTime = tx.usdPriceAtTime;
  const pctChange = (priceAtTime && priceAtTime > 0 && xlmUsd > 0)
    ? ((xlmUsd - priceAtTime) / priceAtTime) * 100
    : null;
  const gained = pctChange !== null && pctChange >= 0;

  return (
    <div className="text-right">
      <p className={cn('text-sm font-bold', isCredit ? 'text-emerald-400' : 'text-zinc-200')}>
        {isCredit ? '+' : '-'}{tx.amount} XLM
      </p>
      {currentUsd !== null && (
        <p className="text-[10px] text-zinc-500">
          ~ ${currentUsd.toFixed(2)}
        </p>
      )}
      {pctChange !== null && (
        <div className={cn('flex items-center justify-end gap-0.5 text-[9px] font-bold', gained ? 'text-emerald-400' : 'text-rose-400')}>
          {gained ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
          {gained ? '+' : ''}{pctChange.toFixed(2)}%
        </div>
      )}
    </div>
  );
}

interface HomeProps {
  user: User;
  transactions: Transaction[];
  onAction: (action: 'send' | 'receive' | 'deposit' | 'withdraw') => void;
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

  const formatCurrency = (val: number, currency = 'USD') =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(val);

  const formatDateLabel = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Hoje';
    if (date.toDateString() === yesterday.toDateString()) return 'Ontem';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
  };

  const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const txTypeLabel = (type: Transaction['type']) => {
    if (type === 'receive') return 'Recebido';
    if (type === 'deposit') return 'Deposito';
    if (type === 'withdraw') return 'Saque';
    return 'Enviado';
  };

  const getEffectiveXlmPrice = (tx?: Transaction) => {
    if (xlmUsd > 0) return xlmUsd;
    return tx?.usdPriceAtTime && tx.usdPriceAtTime > 0 ? tx.usdPriceAtTime : 0;
  };

  const xlmNetUsd = transactions.reduce((total, tx) => {
    if (tx.currency !== 'XLM') return total;

    const usdValue = tx.amount * getEffectiveXlmPrice(tx);
    if (tx.type === 'receive' || tx.type === 'deposit') return total + usdValue;
    if (tx.type === 'send' || tx.type === 'withdraw') return total - usdValue;
    return total;
  }, 0);

  const xlmNetAmount = transactions.reduce((total, tx) => {
    if (tx.currency !== 'XLM') return total;

    if (tx.type === 'receive' || tx.type === 'deposit') return total + tx.amount;
    if (tx.type === 'send' || tx.type === 'withdraw') return total - tx.amount;
    return total;
  }, 0);

  const totalUsdBalance = user.balance + xlmNetUsd;
  const displayRate = rates[user.currency] && rates[user.currency] > 0 ? rates[user.currency] : 1;
  const totalPrimaryBalance = totalUsdBalance * displayRate;

  const grouped: Record<string, Transaction[]> = {};
  for (const tx of transactions) {
    const label = formatDateLabel(tx.timestamp);
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(tx);
  }

  const initials = user.name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  const todayLabel = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="flex flex-col h-full pb-24 overflow-y-auto no-scrollbar">
      <header className="px-6 pt-10 pb-3 flex justify-between items-center">
        <div>
          <p className="text-zinc-400 text-sm">Ola, {user.name.split(' ')[0]}</p>
          <h1 className="text-base font-semibold text-zinc-300 capitalize">{todayLabel}</h1>
        </div>
        <Avatar className="w-10 h-10 border-2 border-blue-400/30">
          <AvatarFallback className="bg-blue-500/20 text-blue-300 text-xs font-bold">{initials}</AvatarFallback>
        </Avatar>
      </header>

      <section className="px-6 pt-2 pb-4">
        <motion.div
          initial={{ scale: 0.97, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="relative overflow-hidden rounded-3xl p-6 border border-white/10 shadow-2xl"
          style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0f1a2e 60%, #1a1b1e 100%)' }}
        >
          <div className="absolute top-0 left-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

          <div className="flex justify-between items-start mb-1">
            <p className="text-zinc-400 text-xs font-medium">Saldo disponivel</p>
            <button
              onClick={() => setShowBalance(!showBalance)}
              className="text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              {showBalance ? <Eye size={15} /> : <EyeOff size={15} />}
            </button>
          </div>

          <h2 className="text-4xl font-bold tracking-tight text-white">
            {showBalance ? formatCurrency(totalPrimaryBalance, user.currency) : '......'}
          </h2>

          <p className="mt-1 text-sm text-zinc-400">
            {showBalance ? formatCurrency(totalUsdBalance, 'USD') : '$ ......'} em dolar
          </p>

          <div className="mt-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-[11px] text-zinc-400 font-medium">Rede Stellar - Testnet</p>
            </div>
            <div className="flex gap-1">
              {user.assets.map((a) => (
                <span key={a.id} className="text-[9px] bg-white/10 text-zinc-300 px-2 py-0.5 rounded-full font-bold">
                  {a.id}
                </span>
              ))}
            </div>
          </div>

          {showBalance && xlmNetAmount > 0 && (
            <p className="mt-4 text-[11px] text-zinc-400">
              Inclui {xlmNetAmount.toFixed(2)} XLM (~ {formatCurrency(xlmNetUsd, 'USD')}) e moeda principal {CURRENCY_LABELS[user.currency] || user.currency}
            </p>
          )}
        </motion.div>
      </section>

      <section className="px-6 pb-4">
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Enviar', icon: ArrowUpRight, color: 'text-primary', bg: 'bg-primary/15', action: 'send' as const },
            { label: 'Receber', icon: ArrowDownLeft, color: 'text-emerald-400', bg: 'bg-emerald-500/15', action: 'receive' as const },
            { label: 'Depositar', icon: Plus, color: 'text-orange-400', bg: 'bg-orange-500/15', action: 'deposit' as const },
            { label: 'Extrato', icon: Clock, color: 'text-purple-400', bg: 'bg-purple-500/15', action: null },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => item.action && onAction(item.action)}
              className="flex flex-col items-center gap-2 group"
            >
              <div
                className={cn(
                  'w-14 h-14 rounded-2xl border border-white/10 flex items-center justify-center transition-transform group-hover:scale-105',
                  item.bg
                )}
              >
                <item.icon size={22} className={item.color} />
              </div>
              <span className="text-[10px] text-zinc-400 font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="px-6 flex-1">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-bold text-zinc-200">Transacoes</h2>
          <button className="text-[10px] text-primary font-bold flex items-center gap-1 hover:text-primary/80 transition-colors">
            Ver todas <ChevronRight size={11} />
          </button>
        </div>

        {Object.keys(grouped).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
            <Landmark size={32} className="mb-3 opacity-40" />
            <p className="text-sm">Nenhuma transacao encontrada</p>
          </div>
        ) : (
          <div className="space-y-5 pb-4">
            {Object.entries(grouped).map(([date, txs]) => (
              <div key={date}>
                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider mb-2">{date}</p>
                <div className="space-y-2">
                  {txs.map((tx) => {
                    const isCredit = tx.type === 'receive' || tx.type === 'deposit';
                    return (
                      <motion.div
                        key={tx.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="rounded-2xl p-4 border border-white/5 flex items-center gap-3"
                        style={{ background: 'rgba(255,255,255,0.03)' }}
                      >
                        <div
                          className={cn(
                            'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                            isCredit ? 'bg-emerald-500/15' : 'bg-rose-500/15'
                          )}
                        >
                          {isCredit ? (
                            tx.type === 'deposit' ? (
                              <Plus size={18} className="text-emerald-400" />
                            ) : (
                              <ArrowDownLeft size={18} className="text-emerald-400" />
                            )
                          ) : (
                            <ArrowUpRight size={18} className="text-rose-400" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-zinc-100 truncate">{tx.counterparty}</p>
                          <p className="text-[10px] text-zinc-500">
                            {txTypeLabel(tx.type)} - {formatTime(tx.timestamp)}
                          </p>
                        </div>

                        <div className="text-right flex-shrink-0">
                          {tx.currency === 'XLM' ? (
                            <XlmValue tx={tx} xlmUsd={xlmUsd} isCredit={isCredit} />
                          ) : (
                            <>
                              <p className={cn('text-sm font-bold', isCredit ? 'text-emerald-400' : 'text-zinc-200')}>
                                {isCredit ? '+' : '-'}{formatCurrency(tx.amount, 'USD')}
                              </p>
                              <p className="text-[9px] text-zinc-600 uppercase">{tx.currency}</p>
                            </>
                          )}
                        </div>
                      </motion.div>
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
