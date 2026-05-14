import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, Landmark, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface LoginProps {
  onLogin: (email: string, password: string) => void;
  onGoToSignup: () => void;
  onBackToLanding: () => void;
}

export default function Login({ onLogin, onGoToSignup, onBackToLanding }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    await onLogin(email, password);
    setLoading(false);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-app px-8 no-scrollbar">
      <div className="pt-8">
        <button
          type="button"
          onClick={onBackToLanding}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-zinc-400 transition-colors hover:text-white"
        >
          <ArrowLeft size={20} />
        </button>
      </div>

      <div className="flex flex-1 flex-col justify-center py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-10 text-center"
        >
          <div
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-indigo-400/35"
            style={{ background: 'rgba(99, 102, 241, 0.18)' }}
          >
            <Landmark className="h-8 w-8 text-indigo-300" />
          </div>
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-white">Bem-vindo de volta</h1>
          <p className="text-sm text-white/50">Sua conta Stellix, com a mesma simplicidade de sempre.</p>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="ml-1 text-[11px] font-bold uppercase tracking-widest text-white/60">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
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
            <label className="ml-1 text-[11px] font-bold uppercase tracking-widest text-white/60">Senha</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
              <Input
                type="password"
                placeholder="••••••••"
                className="h-14 rounded-2xl border-white/15 bg-white/8 pl-12 text-white placeholder:text-white/30 transition-all focus:border-primary/55 focus:bg-white/10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              disabled={loading}
              className="mt-2 h-14 w-full rounded-2xl text-base font-bold shadow-lg shadow-indigo-500/20 disabled:opacity-60"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </div>
        </form>
      </div>

      <div className="pb-10 text-center">
        <p className="text-sm text-white/40">
          Não tem uma conta?{' '}
          <button type="button" onClick={onGoToSignup} className="font-bold text-primary transition-colors hover:text-primary/85">
            Cadastre-se
          </button>
        </p>
      </div>
    </div>
  );
}
