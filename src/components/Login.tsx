import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface LoginProps {
  onLogin: (email: string, password: string) => void;
  onGoToSignup: () => void;
}

export default function Login({ onLogin, onGoToSignup }: LoginProps) {
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
    <div className="flex flex-col h-full px-8 bg-[#0c0f1a] overflow-y-auto no-scrollbar">
      <div className="flex-1 flex flex-col justify-center py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-10 text-center"
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-blue-400/30"
            style={{ background: 'rgba(59,130,246,0.15)' }}>
            <Zap className="text-blue-400 w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 text-white">Bem-vindo de volta</h1>
          <p className="text-white/50 text-sm">Acesse sua conta DolarPix</p>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              />
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-14 rounded-2xl font-bold text-base shadow-lg shadow-blue-500/20 mt-2"
              style={{ background: loading ? 'rgba(59,130,246,0.5)' : '#3b82f6' }}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </div>
        </form>
      </div>

      <div className="text-center pb-10">
        <p className="text-white/40 text-sm">
          Não tem uma conta?{' '}
          <button onClick={onGoToSignup} className="text-blue-400 font-bold hover:text-blue-300 transition-colors">
            Cadastre-se
          </button>
        </p>
      </div>
    </div>
  );
}
