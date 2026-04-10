import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Share2, Check, Download, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { motion } from 'motion/react';

interface ReceiveProps {
  user: {
    email: string;
    phone: string;
  };
}

const CURRENCIES = [
  { id: 'QUALQUER', name: 'Qualquer Moeda', icon: null },
  { id: 'USDC', name: 'USD Coin', icon: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' },
  { id: 'USDT', name: 'Tether', icon: 'https://cryptologos.cc/logos/tether-usdt-logo.png' },
];

export default function Receive({ user }: ReceiveProps) {
  const [amount, setAmount] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState(CURRENCIES[0]);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(user.email);
    setCopied(true);
    toast.success('Chave copiada!');
    setTimeout(() => setCopied(false), 2000);
  };

  const qrValue = `stellar-pix:${user.email}${amount ? `?amount=${amount}` : ''}${selectedCurrency.id !== 'QUALQUER' ? `&currency=${selectedCurrency.id}` : ''}`;

  return (
    <div className="flex flex-col h-full px-6 pt-8 pb-32 overflow-y-auto no-scrollbar">
      <header className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Receber</h1>
        <p className="text-zinc-500 text-sm">Mostre o QR Code ou compartilhe sua chave para receber pagamentos instantâneos.</p>
      </header>

      <Card className="p-6 flex flex-col items-center gap-4 rounded-3xl border-none shadow-xl shadow-zinc-200/50 bg-white">
        <div className="p-3 bg-white rounded-2xl border border-zinc-100">
          <QRCodeSVG 
            value={qrValue} 
            size={180} 
            level="H"
            includeMargin={false}
            className="w-full h-full"
          />
        </div>
        
        <div className="text-center space-y-1">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Sua chave Pix</p>
          <p className="text-lg font-semibold text-zinc-900">{user.email}</p>
          {selectedCurrency.id !== 'QUALQUER' && (
            <Badge variant="secondary" className="bg-primary/10 text-primary border-none mt-2">
              Somente {selectedCurrency.id}
            </Badge>
          )}
        </div>

        <div className="flex gap-3 w-full">
          <Button variant="outline" className="flex-1 h-11 rounded-xl gap-2 text-sm" onClick={handleCopy}>
            {copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
            {copied ? 'Copiado' : 'Copiar'}
          </Button>
          <Button variant="outline" className="flex-1 h-11 rounded-xl gap-2 text-sm">
            <Share2 size={16} />
            Compartilhar
          </Button>
        </div>
      </Card>

      <div className="mt-8 space-y-6">
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Limitar moeda (opcional)</h2>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            {CURRENCIES.map((curr) => (
              <button
                key={curr.id}
                onClick={() => setSelectedCurrency(curr)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 whitespace-nowrap transition-all ${
                  selectedCurrency.id === curr.id ? 'border-primary bg-primary/5 text-primary' : 'border-zinc-100 bg-white text-zinc-500'
                }`}
              >
                {curr.icon ? (
                  <img src={curr.icon} alt={curr.id} className="w-4 h-4 object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <Coins size={14} />
                )}
                <span className="text-xs font-bold">{curr.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Solicitar valor específico</h2>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-zinc-400">$</span>
            <Input
              type="number"
              placeholder="0.00"
              className="pl-8 h-14 rounded-2xl bg-white border-zinc-200 focus-visible:ring-primary text-lg font-bold"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          {amount && (
            <motion.p 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-zinc-400 font-medium px-1"
            >
              QR Code atualizado para receber exatamente ${amount}
            </motion.p>
          )}
        </div>

        <div className="mt-auto pt-8">
          <div className="bg-emerald-50 p-4 rounded-2xl flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <Download size={18} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-emerald-900">Transferência Grátis</p>
              <p className="text-xs text-emerald-700/80">Você não paga nada para receber. O dinheiro cai na hora na sua conta.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
