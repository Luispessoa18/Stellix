import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, User, Phone, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SignupProps {
  onSignup: (name: string, email: string, phone: string, password: string) => void;
  onGoToLogin: () => void;
}

export default function Signup({ onSignup, onGoToLogin }: SignupProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    await onSignup(name, email, phone, password);
    setLoading(false);
  };

  return (
    <div className="flex flex-col min-h-full px-8 pt-12 pb-10 bg-[#0c0f1a] overflow-y-auto no-scrollbar">
      <button
        onClick={onGoToLogin}
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-8 text-white/60 hover:text-white transition-colors self-start"
        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
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
        <p className="text-white/50 text-sm">Comece a usar o DolarPix hoje</p>
      </motion.div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-white/60 uppercase tracking-widest ml-1">Nome Completo</label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 w-5 h-5" />
            <Input
              placeholder="Seu nome"
              className="h-14 pl-12 rounded-2xl bg-white/8 border-white/15 text-white placeholder:text-white/30 focus:border-blue-400/60 focus:bg-white/10 transition-all"
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
              className="h-14 pl-12 rounded-2xl bg-white/8 border-white/15 text-white placeholder:text-white/30 focus:border-blue-400/60 focus:bg-white/10 transition-all"
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
              className="h-14 pl-12 rounded-2xl bg-white/8 border-white/15 text-white placeholder:text-white/30 focus:border-blue-400/60 focus:bg-white/10 transition-all"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-bold text-white/60 uppercase tracking-widest ml-1">Senha</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 w-5 h-5" />
            <Input
              type="password"
              placeholder="••••••••"
              className="h-14 pl-12 rounded-2xl bg-white/8 border-white/15 text-white placeholder:text-white/30 focus:border-blue-400/60 focus:bg-white/10 transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
        </div>

        <div className="pt-2 pb-6">
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-14 rounded-2xl font-bold text-base shadow-lg shadow-blue-500/20"
            style={{ background: loading ? 'rgba(59,130,246,0.5)' : '#3b82f6' }}
          >
            {loading ? 'Criando conta...' : 'Criar Conta'}
          </Button>
        </div>
      </form>

      <div className="text-center mt-auto">
        <p className="text-white/40 text-sm">
          Já tem uma conta?{' '}
          <button onClick={onGoToLogin} className="text-blue-400 font-bold hover:text-blue-300 transition-colors">
            Entrar
          </button>
        </p>
      </div>
    </div>
  );
}
