import { Home, Send, Download, Wallet, User, MessageSquareText } from 'lucide-react';
import { View } from '../types';
import { cn } from '@/lib/utils';

interface NavigationProps {
  currentView: View;
  onViewChange: (view: View) => void;
}

export default function Navigation({ currentView, onViewChange }: NavigationProps) {
  const items = [
    { id: 'home', icon: Home, label: 'Início' },
    { id: 'send', icon: Send, label: 'Enviar' },
    { id: 'receive', icon: Download, label: 'Receber' },
    { id: 'chat', icon: MessageSquareText, label: 'IA Chat' },
    { id: 'assets', icon: Wallet, label: 'Ativos' },
    { id: 'profile', icon: User, label: 'Perfil' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 glass-dark border-t border-white/5 px-2 py-3 flex justify-around items-center z-50 safe-area-bottom">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = currentView === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id as View)}
            className={cn(
              "flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-200",
              isActive ? "text-primary" : "text-zinc-500 hover:text-zinc-400"
            )}
          >
            <Icon className={cn("w-5 h-5 mb-1", isActive && "fill-primary/10")} />
            <span className="text-[9px] font-bold uppercase tracking-widest">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
