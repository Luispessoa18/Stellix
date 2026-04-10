import { Wallet, TrendingUp, ArrowRight, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface AssetsProps {
  balance: number;
}

export default function Assets({ balance }: AssetsProps) {
  const assets = [
    { name: 'USDC', full: 'USD Coin', amount: balance, color: 'bg-blue-600', icon: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' },
    { name: 'USDT', full: 'Tether', amount: 0, color: 'bg-emerald-500', icon: 'https://cryptologos.cc/logos/tether-usdt-logo.png' },
  ];

  return (
    <div className="flex flex-col h-full px-6 pt-8 pb-24 overflow-y-auto no-scrollbar">
      <header className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Seus Ativos</h1>
        <p className="text-zinc-500 text-sm">Gerencie suas moedas digitais de forma simples.</p>
      </header>

      <div className="glass rounded-3xl p-6 border border-white/10 shadow-2xl mb-8">
        <div className="flex justify-between items-start mb-6">
          <div className="space-y-1">
            <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Patrimônio Total</p>
            <h2 className="text-3xl font-bold tracking-tighter">${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h2>
          </div>
          <div className="w-10 h-10 rounded-full glass-dark flex items-center justify-center">
            <TrendingUp size={20} className="text-emerald-400" />
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
            <span className="text-zinc-400">Alocação em Dólar</span>
            <span className="text-primary">100%</span>
          </div>
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-primary w-full rounded-full" />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Moedas</h3>
        <div className="space-y-3">
          {assets.map((asset) => (
            <div key={asset.name} className="flex items-center justify-between p-4 rounded-3xl glass border border-white/5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl glass-dark flex items-center justify-center overflow-hidden p-1.5">
                  <img src={asset.icon} alt={asset.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                </div>
                <div>
                  <p className="font-bold text-zinc-100">{asset.name}</p>
                  <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">{asset.full}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-zinc-100">${asset.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Rede Stellar</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 p-5 rounded-3xl glass border border-dashed border-white/10 flex items-center justify-between group cursor-pointer hover:border-primary/50 transition-all">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl glass-dark flex items-center justify-center text-zinc-500 group-hover:text-primary transition-colors">
            <ShieldCheck size={18} />
          </div>
          <span className="text-xs font-bold text-zinc-400 group-hover:text-zinc-200 transition-colors uppercase tracking-wider">Segurança da conta</span>
        </div>
        <ArrowRight size={18} className="text-zinc-600 group-hover:text-primary transition-colors" />
      </div>
    </div>
  );
}
