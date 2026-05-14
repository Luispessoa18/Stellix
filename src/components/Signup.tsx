import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, User, Phone, ArrowLeft, Coins, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SignupProps {
  onSignup: (name: string, email: string, phone: string, password: string, currency: string, inviteCode: string) => void;
  onGoToLogin: () => void;
  onBackToLanding: () => void;
}

const CURRENCIES = [
  { id: 'BRL', label: 'Real brasileiro' },
  { id: 'USD', label: 'Dolar americano' },
  { id: 'EUR', label: 'Euro' },
  { id: 'GBP', label: 'Libra' },
];

export default function Signup({ onSignup, onGoToLogin, onBackToLanding }: SignupProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [currency, setCurrency] = useState('BRL');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    await onSignup(name, email, phone, password, currency, inviteCode);
    setLoading(false);
  };

  return (
    <div className="flex min-h-full flex-col overflow-y-auto bg-app px-8 pb-10 pt-12 no-scrollbar">
      <button
        type="button"
        onClick={onBackToLanding}
        className="mb-8 flex h-10 w-10 items-center justify-center self-start rounded-xl border border-white/10 bg-white/[0.06] text-zinc-400 transition-colors hover:text-white"
      >
        <ArrowLeft size={20} />
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold tracking-tight mb-2 text-white">Criar conta</h1>
        <p className="text-sm text-white/50">Acesso beta por convite para pagamentos globais na rede Stellar.</p>
      </motion.div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-white/60 uppercase tracking-widest ml-1">Nome completo</label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 w-5 h-5" />
            <Input
              placeholder="Seu nome"
                className="h-14 rounded-2xl border-white/15 bg-white/8 pl-12 text-white placeholder:text-white/30 transition-all focus:border-primary/55 focus:bg-white/10"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-bold text-white/60 uppercase tracking-widest ml-1">Email</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 w-5 h-5" />
            <Input
              type="email"
              placeholder="seu@email.com"
                className="h-14 rounded-2xl border-white/15 bg-white/8 pl-12 text-white placeholder:text-white/30 transition-all focus:border-primary/55 focus:bg-white/10"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-bold text-white/60 uppercase tracking-widest ml-1">Telefone</label>
          <div className="relative">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 w-5 h-5" />
            <Input
              placeholder="+55 11 99999-9999"
                className="h-14 rounded-2xl border-white/15 bg-white/8 pl-12 text-white placeholder:text-white/30 transition-all focus:border-primary/55 focus:bg-white/10"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-bold text-white/60 uppercase tracking-widest ml-1">Moeda principal</label>
          <div className="relative">
            <Coins className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 w-5 h-5" />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="h-14 w-full rounded-2xl border border-white/15 bg-white/8 pl-12 pr-4 text-white outline-none transition-all focus:border-primary/55 focus:bg-white/10"
            >
              {CURRENCIES.map((option) => (
                <option key={option.id} value={option.id} className="text-zinc-900">
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-bold text-white/60 uppercase tracking-widest ml-1">Senha</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 w-5 h-5" />
            <Input
              type="password"
              placeholder="........"
                className="h-14 rounded-2xl border-white/15 bg-white/8 pl-12 text-white placeholder:text-white/30 transition-all focus:border-primary/55 focus:bg-white/10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-bold text-white/60 uppercase tracking-widest ml-1">Codigo de convite</label>
          <div className="relative">
            <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 w-5 h-5" />
            <Input
              placeholder="Seu codigo de acesso"
              className="h-14 rounded-2xl border-white/15 bg-white/8 pl-12 text-white placeholder:text-white/30 transition-all focus:border-primary/55 focus:bg-white/10"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="pt-2 pb-6">
          <Button type="submit" disabled={loading} className="h-14 w-full rounded-2xl text-base font-bold shadow-lg shadow-indigo-500/20 disabled:opacity-60">
            {loading ? 'Criando conta...' : 'Criar conta'}
          </Button>
        </div>
      </form>

      <div className="text-center mt-auto">
        <p className="text-white/40 text-sm">
          Ja tem uma conta?{' '}
          <button type="button" onClick={onGoToLogin} className="font-bold text-primary transition-colors hover:text-primary/85">
            Entrar
          </button>
        </p>
      </div>
    </div>
  );
}
