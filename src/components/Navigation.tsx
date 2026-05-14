import { Home, QrCode, Users, Bot, Globe, Sun, Moon, ShieldCheck, LogOut, User } from 'lucide-react';
import { View } from '../types';
import { cn } from '@/lib/utils';
import { useTheme } from '../contexts/ThemeContext';
import { useState } from 'react';

interface NavigationProps {
  currentView: View;
  onViewChange: (view: View) => void;
  variant?: 'sidebar' | 'bottom';
  isAdmin?: boolean;
  onLogout?: () => void;
  userName?: string;
}

const items = [
  { id: 'home' as View, icon: Home, label: 'Início' },
  { id: 'pix' as View, icon: QrCode, label: 'PIX' },
  { id: 'contacts' as View, icon: Users, label: 'Contatos' },
  { id: 'chat' as View, icon: Bot, label: 'IA' },
];

export default function Navigation({ currentView, onViewChange, variant, isAdmin, onLogout, userName }: NavigationProps) {
  const { toggle, isDark } = useTheme();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const initials = userName ? userName.charAt(0).toUpperCase() : '?';

  const openAdmin = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/auth/admin-token', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const { adminToken } = await res.json();
      localStorage.setItem('adminToken', adminToken);
      window.open('/admin', '_blank');
    } catch {}
  };

  if (variant === 'sidebar') {
    return (
      <aside
        className="hidden md:flex flex-col w-60 h-full shrink-0"
        style={{
          background: isDark ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.92)',
          borderRight: '1px solid var(--t-border)',
          backdropFilter: 'blur(16px)',
        }}
      >
        {/* Logo */}
        <div className="p-6 pb-4" style={{ borderBottom: '1px solid var(--t-border)' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(124,58,237,0.20)', border: '1px solid rgba(124,58,237,0.30)' }}
            >
              <Globe className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <p className="font-bold text-base leading-tight" style={{ color: 'var(--t-text)' }}>Stellix</p>
              <p className="text-[10px] leading-tight" style={{ color: 'var(--t-text-2)' }}>Pagamentos globais</p>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onViewChange(item.id)}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm transition-all duration-200"
                style={{
                  background: isActive ? 'rgba(124,58,237,0.15)' : 'transparent',
                  color: isActive ? 'var(--t-text)' : 'var(--t-text-2)',
                }}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" style={{ color: isActive ? '#a78bfa' : undefined }} />
                <span className={cn('font-medium', isActive && 'font-semibold')}>{item.label}</span>
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />}
              </button>
            );
          })}

          {isAdmin && (
            <button
              type="button"
              onClick={openAdmin}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm transition-all duration-200 mt-2"
              style={{
                background: 'rgba(239,68,68,0.10)',
                border: '1px solid rgba(239,68,68,0.20)',
                color: '#f87171',
              }}
            >
              <ShieldCheck className="h-[18px] w-[18px] shrink-0" />
              <span className="font-medium">Admin</span>
            </button>
          )}
        </nav>

        {/* Footer: theme + profile */}
        <div className="p-3 space-y-1" style={{ borderTop: '1px solid var(--t-border)' }}>
          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggle}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm transition-all duration-200"
            style={{ color: 'var(--t-text-2)' }}
          >
            {isDark
              ? <Sun className="h-[18px] w-[18px] shrink-0" />
              : <Moon className="h-[18px] w-[18px] shrink-0" />}
            <span className="font-medium">{isDark ? 'Modo claro' : 'Modo escuro'}</span>
          </button>

          {/* Profile / logout */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowProfileMenu((v) => !v)}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm transition-all duration-200"
              style={{ color: 'var(--t-text-2)' }}
            >
              <div
                className="h-[18px] w-[18px] rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
                style={{ background: 'rgba(124,58,237,0.30)', color: '#a78bfa' }}
              >
                {initials}
              </div>
              <span className="font-medium truncate flex-1 text-left" style={{ color: 'var(--t-text)' }}>
                {userName ?? 'Perfil'}
              </span>
            </button>

            {showProfileMenu && (
              <div
                className="absolute bottom-full left-0 right-0 mb-1 rounded-xl overflow-hidden shadow-lg"
                style={{ background: isDark ? 'rgba(20,20,30,0.98)' : 'rgba(255,255,255,0.98)', border: '1px solid var(--t-border)' }}
              >
                <button
                  type="button"
                  onClick={() => { setShowProfileMenu(false); onViewChange('profile' as View); }}
                  className="flex items-center gap-3 w-full px-4 py-3 text-sm transition-all duration-200 hover:bg-violet-500/10"
                  style={{ color: 'var(--t-text)' }}
                >
                  <User className="h-[16px] w-[16px] shrink-0" />
                  <span>Meu perfil</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setShowProfileMenu(false); onLogout?.(); }}
                  className="flex items-center gap-3 w-full px-4 py-3 text-sm transition-all duration-200 hover:bg-red-500/10"
                  style={{ color: '#f87171' }}
                >
                  <LogOut className="h-[16px] w-[16px] shrink-0" />
                  <span>Sair</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    );
  }

  /* ── Bottom nav (mobile) ── */
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-2 pb-safe"
      style={{
        background: isDark ? 'rgba(10,10,18,0.92)' : 'rgba(255,255,255,0.92)',
        borderTop: '1px solid var(--t-border)',
        backdropFilter: 'blur(16px)',
        height: '60px',
      }}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = currentView === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onViewChange(item.id)}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all duration-200"
            style={{ color: isActive ? '#a78bfa' : 'var(--t-text-2)' }}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        );
      })}

      {/* Theme toggle */}
      <button
        type="button"
        onClick={toggle}
        className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all duration-200"
        style={{ color: 'var(--t-text-2)' }}
      >
        {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        <span className="text-[10px] font-medium">Tema</span>
      </button>

      {/* Logout */}
      <button
        type="button"
        onClick={onLogout}
        className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all duration-200"
        style={{ color: '#f87171' }}
      >
        <LogOut className="h-5 w-5" />
        <span className="text-[10px] font-medium">Sair</span>
      </button>
    </nav>
  );
}
