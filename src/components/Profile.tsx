import React, { useState, useEffect } from 'react';
import { User, Settings, Shield, Bell, HelpCircle, LogOut, ChevronRight, Smartphone, Mail, Key, Plus, Copy, Trash2, Check, Hash } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { PaymentKey } from '../types';

interface ProfileProps {
  user: { name: string; email: string; phone: string };
  onLogout?: () => void;
}

function getToken() { return localStorage.getItem('token') || ''; }
const HEADERS = () => ({ Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' });

const KEY_LABELS: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  email:  { label: 'Email',           icon: Mail,       color: 'text-blue-400',    bg: 'rgba(59,130,246,0.12)'  },
  phone:  { label: 'Telefone',        icon: Smartphone, color: 'text-emerald-400', bg: 'rgba(52,211,153,0.12)'  },
  random: { label: 'Chave Aleatória', icon: Hash,       color: 'text-purple-400',  bg: 'rgba(167,139,250,0.12)' },
};

export default function Profile({ user, onLogout }: ProfileProps) {
  const [keys, setKeys] = useState<PaymentKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const menuItems = [
    { icon: Shield,      label: 'Segurança e PIN',   sub: 'Biometria ativa' },
    { icon: Bell,        label: 'Notificações',       sub: 'Push e Email' },
    { icon: Settings,    label: 'Configurações',      sub: 'Idioma, Moeda base' },
    { icon: HelpCircle,  label: 'Ajuda e Suporte',    sub: 'Chat 24h' },
  ];

  useEffect(() => {
    fetch('/api/profile/keys', { headers: HEADERS() })
      .then(r => r.json())
      .then(setKeys)
      .catch(() => {})
      .finally(() => setLoadingKeys(false));
  }, []);

  const hasKeyOfType = (type: string) => keys.some(k => k.type === type);

  const createKey = async (type: 'email' | 'phone' | 'random') => {
    setCreating(type);
    try {
      const res = await fetch('/api/profile/keys', {
        method: 'POST',
        headers: HEADERS(),
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (res.ok) {
        setKeys(prev => [...prev, data]);
        toast.success('Chave criada com sucesso!');
      } else {
        toast.error(data.error || 'Erro ao criar chave');
      }
    } finally {
      setCreating(null);
    }
  };

  const deleteKey = async (id: number) => {
    await fetch(`/api/profile/keys/${id}`, { method: 'DELETE', headers: HEADERS() });
    setKeys(prev => prev.filter(k => k.id !== id));
    toast.success('Chave removida');
  };

  const copyKey = (key: PaymentKey) => {
    navigator.clipboard.writeText(key.keyValue);
    setCopiedId(key.id);
    toast.success('Chave copiada!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const initials = user.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();

  return (
    <div className="flex flex-col h-full px-6 pt-12 pb-24 overflow-y-auto no-scrollbar">
      {/* Avatar */}
      <div className="flex flex-col items-center mb-8">
        <div className="relative mb-4">
          <Avatar className="w-24 h-24 border-4 border-blue-400/20 shadow-2xl">
            <AvatarFallback className="bg-blue-500/20 text-blue-300 text-2xl font-bold">{initials}</AvatarFallback>
          </Avatar>
          <div className="absolute bottom-0 right-0 bg-blue-500 text-white p-2 rounded-full border-2 border-[#0c0f1a] shadow-lg">
            <Settings size={14} />
          </div>
        </div>
        <h2 className="text-xl font-bold text-white">{user.name}</h2>
        <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest">Membro DolarPix</p>
      </div>

      <div className="space-y-6">
        {/* Info pessoal */}
        <div className="glass rounded-3xl border border-white/5 overflow-hidden">
          <div className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl glass-dark flex items-center justify-center text-white/40">
              <Mail size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Email</p>
              <p className="text-sm font-medium text-white/80 truncate">{user.email}</p>
            </div>
          </div>
          {user.phone && (
            <>
              <div className="h-px bg-white/5 mx-4" />
              <div className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl glass-dark flex items-center justify-center text-white/40">
                  <Smartphone size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Telefone</p>
                  <p className="text-sm font-medium text-white/80">{user.phone}</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Chaves de recebimento */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
              <Key size={11} />
              Chaves DolarPix
            </h3>
            <span className="text-[9px] text-white/20">Para receber pagamentos</span>
          </div>

          {/* Existing keys */}
          {loadingKeys ? (
            <div className="space-y-2">
              {[1, 2].map(i => (
                <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
              ))}
            </div>
          ) : keys.length > 0 ? (
            <div className="space-y-2">
              {keys.map(k => {
                const meta = KEY_LABELS[k.type] || KEY_LABELS.random;
                const Icon = meta.icon;
                return (
                  <div key={k.id} className="flex items-center gap-3 p-3.5 rounded-2xl"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: meta.bg }}>
                      <Icon size={16} className={meta.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">{meta.label}</p>
                      <p className="text-sm font-mono text-white/80 truncate">{k.keyValue}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => copyKey(k)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                        style={{ background: copiedId === k.id ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.06)' }}>
                        {copiedId === k.id
                          ? <Check size={14} className="text-emerald-400" />
                          : <Copy size={14} className="text-white/40" />}
                      </button>
                      <button onClick={() => deleteKey(k.id)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400/40 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-6 text-center text-white/20 text-sm rounded-2xl"
              style={{ border: '1px dashed rgba(255,255,255,0.10)' }}>
              Nenhuma chave cadastrada ainda
            </div>
          )}

          {/* Add key buttons */}
          <div className="flex gap-2 flex-wrap">
            {!hasKeyOfType('email') && user.email && (
              <button onClick={() => createKey('email')} disabled={creating === 'email'}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-blue-400 disabled:opacity-50 transition-opacity"
                style={{ background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.20)' }}>
                <Plus size={13} />
                {creating === 'email' ? 'Criando...' : '+ Email'}
              </button>
            )}
            {!hasKeyOfType('phone') && user.phone && (
              <button onClick={() => createKey('phone')} disabled={creating === 'phone'}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-emerald-400 disabled:opacity-50 transition-opacity"
                style={{ background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.20)' }}>
                <Plus size={13} />
                {creating === 'phone' ? 'Criando...' : '+ Telefone'}
              </button>
            )}
            <button onClick={() => createKey('random')} disabled={creating === 'random'}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-purple-400 disabled:opacity-50 transition-opacity"
              style={{ background: 'rgba(167,139,250,0.10)', border: '1px solid rgba(167,139,250,0.20)' }}>
              <Hash size={13} />
              {creating === 'random' ? 'Gerando...' : '+ Chave Aleatória'}
            </button>
          </div>
        </div>

        {/* Menu */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Preferências</h3>
          <div className="glass rounded-3xl border border-white/5 overflow-hidden">
            {menuItems.map((item, i) => (
              <div key={item.label}>
                <button className="w-full p-4 flex items-center justify-between group transition-all hover:bg-white/5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl glass-dark flex items-center justify-center text-white/40 group-hover:text-blue-400 transition-colors">
                      <item.icon size={18} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-white/80">{item.label}</p>
                      <p className="text-[10px] text-white/30">{item.sub}</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-white/20 group-hover:text-blue-400 transition-colors" />
                </button>
                {i < menuItems.length - 1 && <div className="h-px bg-white/5 mx-4" />}
              </div>
            ))}
          </div>
        </div>

        <Button onClick={onLogout} variant="ghost"
          className="w-full h-14 rounded-3xl text-rose-400 font-bold gap-2 hover:bg-rose-500/10 hover:text-rose-300">
          <LogOut size={20} />
          Sair da conta
        </Button>
      </div>

      <div className="mt-8 text-center">
        <p className="text-[9px] text-white/15 font-bold uppercase tracking-[0.3em]">DolarPix v1.0.0</p>
      </div>
    </div>
  );
}
