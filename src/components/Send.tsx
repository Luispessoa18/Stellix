import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Check, Delete, UserPlus, X, Trash2, Search } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Contact } from '../types';
import { cn } from '@/lib/utils';

interface SendProps {
  onBack: () => void;
  onSuccess: (amount: number, recipient: string, currency: string) => void;
}

const CURRENCIES = [
  { id: 'USDC', name: 'USD Coin', icon: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png', isStable: true },
  { id: 'USDT', name: 'Tether', icon: 'https://cryptologos.cc/logos/tether-usdt-logo.png', isStable: true },
  { id: 'XLM', name: 'Stellar Lumens', icon: 'https://cryptologos.cc/logos/stellar-xlm-logo.png', isStable: false },
];

function getToken() { return localStorage.getItem('token') || ''; }
const HEADERS = () => ({ Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' });

export default function Send({ onBack, onSuccess }: SendProps) {
  const [step, setStep] = useState<'recipient' | 'currency' | 'amount' | 'confirm' | 'success'>('recipient');
  const [search, setSearch] = useState('');
  const [recipient, setRecipient] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState(CURRENCIES[0]);
  const [amount, setAmount] = useState('0');
  const [isProcessing, setIsProcessing] = useState(false);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [xlmUsd, setXlmUsd] = useState(0);

  // Add contact modal
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [savingContact, setSavingContact] = useState(false);

  useEffect(() => {
    fetch('/api/contacts', { headers: HEADERS() })
      .then(r => r.json())
      .then(setContacts)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/stellar/price')
      .then(r => r.json())
      .then(d => setXlmUsd(d.xlmUsd || 0))
      .catch(() => {});
  }, []);

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.identifier.toLowerCase().includes(search.toLowerCase())
  );

  const selectRecipient = (c: Contact) => {
    setRecipient(c.identifier);
    setRecipientName(c.name);
    setStep('currency');
  };

  const handleManualRecipient = () => {
    if (!recipient.trim()) return;
    setRecipientName(recipient);
    setStep('currency');
  };

  const handleSaveContact = async () => {
    if (!newContactName.trim() || !recipient.trim()) return;
    setSavingContact(true);
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: HEADERS(),
        body: JSON.stringify({ name: newContactName, identifier: recipient }),
      });
      if (res.ok) {
        const c = await res.json();
        setContacts(prev => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)));
        setNewContactName('');
        setShowAddContact(false);
        toast.success('Contato salvo!');
      }
    } finally {
      setSavingContact(false);
    }
  };

  const handleDeleteContact = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/contacts/${id}`, { method: 'DELETE', headers: HEADERS() });
    setContacts(prev => prev.filter(c => c.id !== id));
    toast.success('Contato removido');
  };

  const handleKeypad = (key: string) => {
    if (key === 'delete') {
      setAmount(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
      return;
    }
    if (key === '.' && amount.includes('.')) return;
    if (amount.includes('.') && amount.split('.')[1]?.length >= 7) return;
    setAmount(prev => prev === '0' && key !== '.' ? key : prev + key);
  };

  const amountNum = parseFloat(amount) || 0;
  const usdEquiv = selectedCurrency.id === 'XLM' && xlmUsd > 0
    ? `≈ $${(amountNum * xlmUsd).toFixed(2)} USD`
    : null;

  const handleSend = async () => {
    setIsProcessing(true);
    await new Promise(r => setTimeout(r, 1500));
    setIsProcessing(false);
    setStep('success');
    onSuccess(amountNum, recipientName || recipient, selectedCurrency.id);
  };

  const initials = (name: string) => name.trim().split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() || '?';

  return (
    <div className="flex flex-col h-full bg-[#0c0f1a]">
      {/* Header */}
      <header className="px-5 pt-10 pb-3 flex items-center gap-3">
        {step !== 'success' && (
          <button onClick={step === 'recipient' ? onBack : () => setStep(step === 'currency' ? 'recipient' : step === 'amount' ? 'currency' : 'amount')}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white/60 hover:text-white transition-colors shrink-0"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}>
            <ArrowLeft size={20} />
          </button>
        )}
        <h1 className="text-xl font-bold text-white">
          {step === 'recipient' && 'Para quem?'}
          {step === 'currency' && 'Qual moeda?'}
          {step === 'amount' && 'Quanto?'}
          {step === 'confirm' && 'Confirmar envio'}
          {step === 'success' && 'Enviado!'}
        </h1>
      </header>

      <div className="flex-1 flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">

          {/* ─── Step: recipient ─── */}
          {step === 'recipient' && (
            <motion.div key="recipient" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="flex flex-col flex-1 overflow-hidden px-5 gap-4">

              {/* Input */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4" />
                <input
                  placeholder="Endereço Stellar, email ou buscar contato..."
                  className="w-full h-13 pl-11 pr-4 py-3.5 rounded-2xl text-white text-sm placeholder:text-white/30 outline-none transition-all font-mono"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setRecipient(e.target.value); }}
                  autoFocus
                />
              </div>

              {/* Continue with typed value */}
              {search.trim() && !filteredContacts.some(c => c.identifier === search) && (
                <div className="flex gap-2">
                  <button onClick={handleManualRecipient}
                    className="flex-1 h-11 rounded-xl font-bold text-sm text-white transition-opacity"
                    style={{ background: '#3b82f6' }}>
                    Enviar para este endereço
                  </button>
                  <button onClick={() => { setShowAddContact(true); setNewContactName(''); }}
                    className="h-11 px-3 rounded-xl text-blue-400 flex items-center gap-1.5 text-sm font-bold"
                    style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)' }}>
                    <UserPlus size={16} />
                    Salvar
                  </button>
                </div>
              )}

              {/* Save contact mini form */}
              {showAddContact && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-2xl space-y-3"
                  style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.20)' }}>
                  <p className="text-xs font-bold text-blue-400 uppercase tracking-widest">Salvar contato</p>
                  <input
                    placeholder="Nome do contato"
                    className="w-full h-11 px-4 rounded-xl text-white text-sm placeholder:text-white/30 outline-none"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
                    value={newContactName}
                    onChange={e => setNewContactName(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button onClick={handleSaveContact} disabled={savingContact || !newContactName.trim()}
                      className="flex-1 h-10 rounded-xl font-bold text-sm text-white disabled:opacity-40"
                      style={{ background: '#3b82f6' }}>
                      {savingContact ? 'Salvando...' : 'Salvar'}
                    </button>
                    <button onClick={() => setShowAddContact(false)}
                      className="h-10 w-10 rounded-xl flex items-center justify-center text-white/40 hover:text-white"
                      style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <X size={16} />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Contacts list */}
              <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 pb-4">
                {filteredContacts.length === 0 && !search && (
                  <div className="flex flex-col items-center py-10 text-white/20">
                    <UserPlus size={28} className="mb-2" />
                    <p className="text-sm">Nenhum contato ainda</p>
                    <p className="text-xs mt-1">Digite um endereço acima e salve</p>
                  </div>
                )}
                {filteredContacts.map(c => (
                  <button key={c.id} onClick={() => selectRecipient(c)}
                    className="w-full flex items-center gap-3 p-3.5 rounded-2xl text-left transition-colors hover:bg-white/5 group"
                    style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                    <Avatar className="w-10 h-10 shrink-0">
                      <AvatarFallback className="bg-blue-500/20 text-blue-300 text-sm font-bold">
                        {initials(c.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm">{c.name}</p>
                      <p className="text-white/40 text-xs font-mono truncate">{c.identifier}</p>
                    </div>
                    <button onClick={(e) => handleDeleteContact(c.id, e)}
                      className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg flex items-center justify-center text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-all">
                      <Trash2 size={14} />
                    </button>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ─── Step: currency ─── */}
          {step === 'currency' && (
            <motion.div key="currency" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="px-5 space-y-3 pt-2">
              <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">
                Enviando para <span className="text-white/70">{recipientName || recipient}</span>
              </p>
              {CURRENCIES.map(curr => (
                <button key={curr.id} onClick={() => { setSelectedCurrency(curr); setStep('amount'); }}
                  className={cn('w-full flex items-center justify-between p-4 rounded-2xl transition-all',
                    selectedCurrency.id === curr.id ? 'border-blue-400/50' : 'border-white/8 hover:border-white/15')}
                  style={{ background: selectedCurrency.id === curr.id ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${selectedCurrency.id === curr.id ? 'rgba(59,130,246,0.40)' : 'rgba(255,255,255,0.08)'}` }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/5 p-1.5">
                      <img src={curr.icon} alt={curr.id} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-white">{curr.id}</p>
                      <p className="text-xs text-white/40">{curr.name}</p>
                    </div>
                  </div>
                  {!curr.isStable && xlmUsd > 0 && (
                    <span className="text-xs text-white/40 font-mono">${xlmUsd.toFixed(4)}/XLM</span>
                  )}
                  {selectedCurrency.id === curr.id && <Check size={18} className="text-blue-400" />}
                </button>
              ))}
            </motion.div>
          )}

          {/* ─── Step: amount ─── */}
          {step === 'amount' && (
            <motion.div key="amount" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 flex flex-col items-center justify-center px-5">
                <div className="flex items-center gap-3 mb-8">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-blue-500/20 text-blue-300 text-sm font-bold">{initials(recipientName || recipient)}</AvatarFallback>
                  </Avatar>
                  <span className="text-white/60 text-sm">{recipientName || recipient}</span>
                </div>
                <div className="text-center space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-3xl font-bold text-white/40">
                      {selectedCurrency.isStable ? '$' : selectedCurrency.id}
                    </span>
                    <span className="text-6xl font-bold tracking-tight text-white">{amount}</span>
                  </div>
                  <Badge className="bg-blue-500/15 text-blue-300 border-blue-400/20 border px-3 py-1 font-bold">
                    {selectedCurrency.id}
                  </Badge>
                  {usdEquiv && (
                    <p className="text-white/40 text-sm font-medium">{usdEquiv}</p>
                  )}
                </div>
              </div>

              {/* Keypad */}
              <div className="px-4 pb-2 grid grid-cols-3 gap-3"
                style={{ background: 'rgba(0,0,0,0.20)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {['1','2','3','4','5','6','7','8','9','.','0','delete'].map(key => (
                  <button key={key} onClick={() => handleKeypad(key)}
                    className="h-14 flex items-center justify-center text-2xl font-semibold text-white active:scale-90 active:bg-white/10 rounded-xl transition-all">
                    {key === 'delete' ? <Delete size={22} className="text-white/60" /> : key}
                  </button>
                ))}
                <div className="col-span-3 mt-1 mb-1">
                  <button className="w-full h-13 rounded-2xl font-bold text-base text-white disabled:opacity-40 py-3.5"
                    disabled={amountNum <= 0}
                    style={{ background: amountNum > 0 ? '#3b82f6' : 'rgba(59,130,246,0.3)' }}
                    onClick={() => setStep('confirm')}>
                    Continuar
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── Step: confirm ─── */}
          {step === 'confirm' && (
            <motion.div key="confirm" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="px-5 flex-1 flex flex-col justify-center gap-6 pb-4">
              <div className="text-center space-y-4">
                <Avatar className="w-20 h-20 mx-auto">
                  <AvatarFallback className="bg-blue-500/20 text-blue-300 text-2xl font-bold">{initials(recipientName || recipient)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-white/50 text-sm">Enviando</p>
                  <h2 className="text-4xl font-bold text-white mt-1">
                    {selectedCurrency.isStable ? `$${amount}` : `${amount} XLM`}
                  </h2>
                  {usdEquiv && <p className="text-white/40 text-sm mt-1">{usdEquiv}</p>}
                  <p className="text-white/50 text-sm mt-1">para <span className="text-white font-semibold">{recipientName || recipient}</span></p>
                </div>
              </div>
              <div className="rounded-2xl p-4 space-y-3"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Moeda</span>
                  <span className="text-white font-bold">{selectedCurrency.id}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Taxa de rede</span>
                  <span className="text-emerald-400 font-bold text-xs uppercase tracking-widest">Grátis</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Tempo estimado</span>
                  <span className="text-white">~3 segundos</span>
                </div>
              </div>
              <button className="w-full h-14 rounded-2xl font-bold text-base text-white disabled:opacity-50 flex items-center justify-center"
                style={{ background: '#3b82f6' }}
                disabled={isProcessing} onClick={handleSend}>
                {isProcessing
                  ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                      className="w-6 h-6 border-2 border-white border-t-transparent rounded-full" />
                  : 'Confirmar Envio'}
              </button>
              <button className="text-white/30 text-sm font-medium text-center" onClick={() => setStep('amount')}>
                Voltar e editar
              </button>
            </motion.div>
          )}

          {/* ─── Step: success ─── */}
          {step === 'success' && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              className="flex-1 flex flex-col items-center justify-center px-5 text-center gap-6">
              <div className="w-24 h-24 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(52,211,153,0.15)', border: '2px solid rgba(52,211,153,0.30)' }}>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 12, stiffness: 200 }}>
                  <Check size={48} strokeWidth={2.5} className="text-emerald-400" />
                </motion.div>
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-bold text-white">Sucesso!</h2>
                <p className="text-white/50">
                  {selectedCurrency.isStable ? `$${amount}` : `${amount} XLM`}
                  {usdEquiv && ` (${usdEquiv})`} enviado para{' '}
                  <span className="text-white font-semibold">{recipientName || recipient}</span>
                </p>
              </div>
              <button className="w-full h-14 rounded-2xl font-bold text-base text-white mt-4"
                style={{ background: '#3b82f6' }} onClick={onBack}>
                Voltar ao Início
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
