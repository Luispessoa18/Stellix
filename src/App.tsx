/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { View, Transaction, User } from './types';
import Navigation from './components/Navigation';
import Home from './components/Home';
import Send from './components/Send';
import Receive from './components/Receive';
import Assets from './components/Assets';
import Profile from './components/Profile';
import AIChat from './components/AIChat';
import Login from './components/Login';
import Signup from './components/Signup';
import Deposit from './components/Deposit';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';

const EMPTY_USER: User = {
  name: '',
  email: '',
  phone: '',
  balance: 0,
  currency: 'USD',
  assets: [
    { id: 'USDC', name: 'USD Coin', amount: 0, icon: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' },
    { id: 'USDT', name: 'Tether', amount: 0, icon: 'https://cryptologos.cc/logos/tether-usdt-logo.png' },
  ],
};

async function fetchTransactions(token: string): Promise<Transaction[]> {
  try {
    const res = await fetch('/api/transactions', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) return res.json();
  } catch {}
  return [];
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState<View>('home');
  const [authView, setAuthView] = useState<'login' | 'signup'>('login');
  const [user, setUser] = useState<User>(EMPTY_USER);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [xlmUsd, setXlmUsd] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      setXlmUsd(0);
      return;
    }

    fetch('/api/stellar/price')
      .then((r) => r.json())
      .then((d) => setXlmUsd(Number(d.xlmUsd) || 0))
      .catch(() => setXlmUsd(0));
  }, [isAuthenticated]);

  const handleLogin = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('token', data.token);
        setUser(data.user);
        const txs = await fetchTransactions(data.token);
        setTransactions(txs);
        setIsAuthenticated(true);
        toast.success('Bem-vindo de volta!');
      } else {
        toast.error(data.error || 'Email ou senha invÃ¡lidos');
      }
    } catch {
      toast.error('Servidor indisponÃ­vel. Verifique sua conexÃ£o.');
    }
  };

  const handleSignup = async (name: string, email: string, phone: string, password: string) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password }),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('token', data.token);
        setUser(data.user);
        setTransactions([]);
        setIsAuthenticated(true);
        toast.success('Conta criada com sucesso!');
      } else {
        toast.error(data.error || 'Erro ao criar conta');
      }
    } catch {
      toast.error('Servidor indisponÃ­vel. Verifique sua conexÃ£o.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    setCurrentView('home');
    setAuthView('login');
    setUser(EMPTY_USER);
    setTransactions([]);
  };

  const handleSendSuccess = (amount: number, recipient: string, currency: string) => {
    const usdAmount = currency === 'XLM' && xlmUsd > 0 ? amount * xlmUsd : amount;

    const newTx: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'send',
      amount,
      currency,
      counterparty: recipient,
      timestamp: Date.now(),
      status: 'completed',
      usdPriceAtTime: currency === 'XLM' && xlmUsd > 0 ? xlmUsd : undefined,
    };

    setTransactions((prev) => [newTx, ...prev]);
    setUser((prev) => ({ ...prev, balance: prev.balance - usdAmount }));
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto h-screen bg-[#0c0f1a] text-white shadow-2xl relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={authView}
            initial={{ opacity: 0, x: authView === 'signup' ? 40 : -40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="h-full"
          >
            {authView === 'login' ? (
              <Login onLogin={handleLogin} onGoToSignup={() => setAuthView('signup')} />
            ) : (
              <Signup onSignup={handleSignup} onGoToLogin={() => setAuthView('login')} />
            )}
          </motion.div>
        </AnimatePresence>
        <Toaster position="top-center" richColors />
      </div>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case 'home':
        return (
          <Home
            user={user}
            transactions={transactions}
            onAction={(action) => setCurrentView(action)}
          />
        );
      case 'send':
        return <Send onBack={() => setCurrentView('home')} onSuccess={handleSendSuccess} />;
      case 'receive':
        return <Receive user={user} />;
      case 'deposit':
        return <Deposit user={user} onBack={() => setCurrentView('home')} />;
      case 'chat':
        return <AIChat user={user} transactions={transactions} onExecuteTransaction={handleSendSuccess} />;
      case 'assets':
        return <Assets balance={user.balance} />;
      case 'profile':
        return <Profile user={user} onLogout={handleLogout} />;
      default:
        return <Home user={user} transactions={transactions} onAction={(v) => setCurrentView(v as View)} />;
    }
  };

  const hideNav = currentView === 'deposit';

  return (
    <div className="max-w-md mx-auto h-screen bg-[#0c0f1a] text-white shadow-2xl relative overflow-hidden flex flex-col">
      <main className="flex-1 min-h-0 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="h-full"
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </main>

      {!hideNav && <Navigation currentView={currentView} onViewChange={setCurrentView} />}

      <Toaster position="top-center" richColors />
    </div>
  );
}
