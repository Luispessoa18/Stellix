import React, { useState } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';

interface AdminLoginProps {
  onLogin: (token: string) => void;
}

export default function AdminLogin({ onLogin }: AdminLoginProps) {
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret }),
      });
      const data = await res.json();
      if (res.ok) {
        onLogin(data.token);
      } else {
        setError(data.error || 'Senha incorreta');
      }
    } catch {
      setError('Servidor indisponível');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0f1a] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.30)' }}>
            <ShieldCheck className="text-blue-400 w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white">DolarPix Admin</h1>
          <p className="text-white/40 text-sm mt-1">Acesso restrito</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 w-5 h-5" />
            <input
              type="password"
              placeholder="Senha de administrador"
              className="w-full h-14 pl-12 pr-4 rounded-2xl text-white placeholder:text-white/30 outline-none transition-all"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              required
              autoFocus
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center font-medium">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 rounded-2xl font-bold text-base text-white transition-opacity disabled:opacity-60"
            style={{ background: '#3b82f6' }}
          >
            {loading ? 'Verificando...' : 'Acessar Painel'}
          </button>
        </form>

        <p className="text-white/20 text-xs text-center mt-8">
          Configure <code className="font-mono">ADMIN_SECRET</code> no <code className="font-mono">.env</code>
        </p>
      </div>
    </div>
  );
}
