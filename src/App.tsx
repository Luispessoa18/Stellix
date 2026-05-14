/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { View, Transaction, User, Contact } from './types';
import Navigation from './components/Navigation';
import Home from './components/Home';
import Send from './components/Send';
import Receive from './components/Receive';
import Assets from './components/Assets';
import Profile from './components/Profile';
import AIChat from './components/AIChat';
import Login from './components/Login';
import Signup from './components/Signup';
import MarketingLayout from './components/MarketingLayout';
import Deposit from './components/Deposit';
import PIX from './components/PIX';
import Contacts from './components/Contacts';
import Statement from './components/Statement';
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

async function fetchCurrentUser(token: string): Promise<User | null> {
  try {
    const res = await fetch('/api/profile/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) return res.json();
  } catch {}
  return null;
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState<View>('home');
  const [authScreen, setAuthScreen] = useState<'landing' | 'login' | 'signup'>('landing');
  const [user, setUser] = useState<User>(EMPTY_USER);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [xlmUsd, setXlmUsd] = useState(0);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

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

  useEffect(() => {
    if (!isAuthenticated) return;

    const syncAccount = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      const [nextUser, nextTransactions] = await Promise.all([
        fetchCurrentUser(token),
        fetchTransactions(token),
      ]);

      if (nextUser) setUser(nextUser);
      setTransactions(nextTransactions);
    };

    const intervalId = window.setInterval(syncAccount, 5000);
    return () => window.clearInterval(intervalId);
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
        toast.error(data.error || 'Email ou senha invalidos');
      }
    } catch {
      toast.error('Servidor indisponivel. Verifique sua conexao.');
    }
  };

  const handleSignup = async (name: string, email: string, phone: string, password: string, currency: string, inviteCode: string) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password, currency, inviteCode }),
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
      toast.error('Servidor indisponivel. Verifique sua conexao.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    setCurrentView('home');
    setAuthScreen('landing');
    setUser(EMPTY_USER);
    setTransactions([]);
  };

  const handleUserUpdate = (nextUser: Partial<User>) => {
    setUser((prev) => ({ ...prev, ...nextUser }));
  };

  const handleSendSuccess = async (transactionOrAmount: Transaction | number, recipient?: string, currency?: string) => {
    const transaction: Transaction = typeof transactionOrAmount === 'number'
      ? {
          id: Math.random().toString(36).substr(2, 9),
          type: 'send',
          amount: transactionOrAmount,
          currency: currency || 'USDC',
          counterparty: recipient || '',
          timestamp: Date.now(),
          status: 'completed',
        }
      : transactionOrAmount;

    setTransactions((prev) => [transaction, ...prev.filter((tx) => tx.id !== transaction.id)]);

    const token = localStorage.getItem('token');
    if (!token) return;

    const [nextUser, nextTransactions] = await Promise.all([
      fetchCurrentUser(token),
      fetchTransactions(token),
    ]);

    if (nextUser) setUser(nextUser);
    setTransactions(nextTransactions);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-app text-white relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={authScreen}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className={authScreen === 'landing' ? 'min-h-screen' : 'flex min-h-screen items-center justify-center px-4 py-8'}
          >
            {authScreen === 'landing' && (
              <MarketingLayout onLogin={() => setAuthScreen('login')} onSignup={() => setAuthScreen('signup')} />
            )}
            {authScreen === 'login' && (
              <div className="w-full max-w-md h-screen max-h-[700px]">
                <Login
                  onLogin={handleLogin}
                  onGoToSignup={() => setAuthScreen('signup')}
                  onBackToLanding={() => setAuthScreen('landing')}
                />
              </div>
            )}
            {authScreen === 'signup' && (
              <div className="w-full max-w-md h-screen max-h-[800px]">
                <Signup
                  onSignup={handleSignup}
                  onGoToLogin={() => setAuthScreen('login')}
                  onBackToLanding={() => setAuthScreen('landing')}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
        <Toaster position="top-center" richColors />
      </div>
    );
  }

  const handleContactSend = (contact: Contact) => {
    setSelectedContact(contact);
    setCurrentView('send');
  };

  const renderView = () => {
    switch (currentView) {
      case 'home':
        return <Home user={user} transactions={transactions} onAction={(action) => setCurrentView(action)} />;
      case 'send':
        return (
          <Send
            onBack={() => { setCurrentView('home'); setSelectedContact(null); }}
            onSuccess={handleSendSuccess}
            initialContact={selectedContact ? { identifier: selectedContact.identifier, name: selectedContact.name } : undefined}
          />
        );
      case 'receive':
        return <Receive user={user} />;
      case 'deposit':
        return <Deposit user={user} onBack={() => setCurrentView('home')} />;
      case 'pix':
        return <PIX user={user} onBalanceRefresh={() => {
          const token = localStorage.getItem('token');
          if (token) fetchCurrentUser(token).then((u) => { if (u) setUser(u); });
        }} />;
      case 'contacts':
        return <Contacts onSendToContact={handleContactSend} />;
      case 'statement':
        return <Statement transactions={transactions} onBack={() => setCurrentView('home')} />;
      case 'chat':
        return <AIChat user={user} transactions={transactions} onExecuteTransaction={handleSendSuccess} />;
      case 'assets':
        return <Assets balance={user.balance} currency={user.currency} />;
      case 'profile':
        return <Profile user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />;
      default:
        return <Home user={user} transactions={transactions} onAction={(action) => setCurrentView(action)} />;
    }
  };

  const hideSidebar = currentView === 'deposit' || currentView === 'statement';

  return (
    <div className="h-screen overflow-hidden flex" style={{ background: 'var(--t-bg)', color: 'var(--t-text)' }}>
      {!hideSidebar && (
        <Navigation variant="sidebar" currentView={currentView} onViewChange={setCurrentView} isAdmin={user.isAdmin} />
      )}

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <main className="flex-1 min-h-0 relative overflow-hidden">
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
      </div>

      {/* Bottom nav — fixed, rendered globally */}
      {!hideSidebar && (
        <Navigation variant="bottom" currentView={currentView} onViewChange={setCurrentView} isAdmin={user.isAdmin} />
      )}

      <Toaster position="top-center" richColors />
    </div>
  );
}
