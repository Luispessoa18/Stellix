import { Home, Send, Download, Wallet, User, MessageSquareText } from 'lucide-react';
import { View } from '../types';
import { cn } from '@/lib/utils';

interface NavigationProps {
  currentView: View;
  onViewChange: (view: View) => void;
}

export default function Navigation({ currentView, onViewChange }: NavigationProps) {
  const items = [
    { id: 'home', icon: Home, label: 'InÃ­cio' },
    { id: 'send', icon: Send, label: 'Enviar' },
    { id: 'receive', icon: Download, label: 'Receber' },
    { id: 'chat', icon: MessageSquareText, label: 'IA Chat' },
    { id: 'assets', icon: Wallet, label: 'Ativos' },
    { id: 'profile', icon: User, label: 'Perfil' },
  ];

  return (
    <nav className="glass-dark border-t border-white/8 px-1 py-2 shrink-0">
      <div className="grid grid-cols-6 gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id as View)}
              className={cn(
                'flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 transition-all duration-200',
                isActive ? 'text-primary' : 'text-zinc-500 hover:text-zinc-400'
              )}
            >
              <Icon className={cn('h-5 w-5 shrink-0', isActive && 'fill-primary/10')} />
              <span className="truncate text-[8px] font-bold uppercase tracking-[0.18em]">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
