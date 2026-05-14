import { ArrowUpRight, ArrowDownLeft, ArrowLeft, Landmark } from 'lucide-react';
import { Transaction } from '../types';
import { cn } from '@/lib/utils';

interface StatementProps {
  transactions: Transaction[];
  onBack: () => void;
}

export default function Statement({ transactions, onBack }: StatementProps) {
  const formatUSD = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  const formatDateLabel = (ts: number) => {
    const d = new Date(ts);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Hoje';
    if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  };

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const txTypeLabel = (type: Transaction['type']) => {
    if (type === 'receive') return 'Recebido';
    if (type === 'deposit') return 'Depósito';
    if (type === 'withdraw') return 'Saque';
    return 'Enviado';
  };

  const grouped: Record<string, Transaction[]> = {};
  for (const tx of transactions) {
    const label = formatDateLabel(tx.timestamp);
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(tx);
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto no-scrollbar md:max-w-lg md:mx-auto w-full">
      <header className="px-5 pt-12 pb-5 flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white/60 hover:text-white transition-colors shrink-0"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Extrato</h1>
          <p className="text-zinc-500 text-xs">{transactions.length} transações</p>
        </div>
      </header>

      <div className="px-5 flex-1 pb-8">
        {Object.keys(grouped).length === 0 ? (
          <div className="flex flex-col items-center py-20 text-zinc-600">
            <Landmark size={32} className="mb-3 opacity-40" />
            <p className="text-sm">Nenhuma transação ainda</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([date, txs]) => (
              <div key={date}>
                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mb-2">{date}</p>
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{ border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  {txs.map((tx, i) => {
                    const isCredit = tx.type === 'receive' || tx.type === 'deposit';
                    const usdValue = tx.currency === 'XLM'
                      ? tx.amount * (tx.usdPriceAtTime || 0)
                      : tx.amount;
                    return (
                      <div
                        key={tx.id}
                        className={cn(
                          'flex items-center gap-3 px-4 py-4',
                          i > 0 && 'border-t border-white/5'
                        )}
                        style={{ background: 'rgba(255,255,255,0.02)' }}
                      >
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                          style={{
                            background: isCredit ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.10)',
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

                        <div className="text-right shrink-0">
                          <p className={cn('text-sm font-bold', isCredit ? 'text-emerald-400' : 'text-zinc-300')}>
                            {isCredit ? '+' : '-'}{formatUSD(usdValue)}
                          </p>
                          {tx.currency === 'XLM' && (
                            <p className="text-[10px] text-zinc-600">{tx.amount} XLM</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
