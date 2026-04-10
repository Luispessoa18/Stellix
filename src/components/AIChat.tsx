import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Bot, Loader2, Plus, MapPin, Send as SendIcon, ArrowUpRight, ArrowDownLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChatMessage, Contact, NearbyContact, Transaction, User } from '../types';
import { GoogleGenAI, Type } from '@google/genai';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AIChatProps {
  user: User;
  transactions: Transaction[];
  onExecuteTransaction: (amount: number, recipient: string, currency: string) => void;
}

type FriendMessage = {
  id: string;
  role: 'me' | 'contact' | 'system';
  content: string;
  timestamp: number;
};

type RequestDraft = {
  amount: string;
  currency: string;
};

function getToken() {
  return localStorage.getItem('token') || '';
}

const HEADERS = () => ({ Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' });
const REQUEST_CURRENCIES = ['QUALQUER', 'USD', 'USDC', 'USDT', 'XLM'];

export default function AIChat({ user, transactions, onExecuteTransaction }: AIChatProps) {
  const [assistantMessages, setAssistantMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: `Ola ${user.name.split(' ')[0]}! Eu fico no topo da sua inbox para ajudar com saldo, analises e transferencias.` },
  ]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedThread, setSelectedThread] = useState<'assistant' | number>('assistant');
  const [friendThreads, setFriendThreads] = useState<Record<number, FriendMessage[]>>({});
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionMode, setActionMode] = useState<'send' | 'request'>('send');
  const [newContactName, setNewContactName] = useState('');
  const [newContactIdentifier, setNewContactIdentifier] = useState('');
  const [savingContact, setSavingContact] = useState(false);
  const [nearbyContacts, setNearbyContacts] = useState<NearbyContact[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [addingNearbyUserId, setAddingNearbyUserId] = useState<number | null>(null);
  const [requestDraft, setRequestDraft] = useState<RequestDraft>({ amount: '', currency: 'QUALQUER' });
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/contacts', { headers: HEADERS() })
      .then((r) => r.ok ? r.json() : [])
      .then((data: Contact[]) => {
        setContacts(data);
        setFriendThreads((prev) => {
          const next = { ...prev };
          for (const contact of data) {
            if (!next[contact.id]) {
              next[contact.id] = [
                {
                  id: `seed-${contact.id}`,
                  role: 'contact',
                  content: `Conversa pronta com ${contact.name.split(' ')[0]}. Use os botoes de enviar ou receber para movimentar valores por aqui.`,
                  timestamp: Date.now() - 60_000,
                },
              ];
            }
          }
          return next;
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [assistantMessages, friendThreads, selectedThread, isLoading]);

  const selectedContact = typeof selectedThread === 'number'
    ? contacts.find((contact) => contact.id === selectedThread) || null
    : null;

  const activeFriendMessages = selectedContact ? friendThreads[selectedContact.id] || [] : [];

  const appendFriendMessages = (contactId: number, ...messages: FriendMessage[]) => {
    setFriendThreads((prev) => ({
      ...prev,
      [contactId]: [...(prev[contactId] || []), ...messages],
    }));
  };

  const threads = useMemo(() => {
    const assistantPreview = assistantMessages[assistantMessages.length - 1]?.content || 'Assistente pronto';
    const contactThreads = contacts.map((contact) => {
      const lastMessage = friendThreads[contact.id]?.[friendThreads[contact.id].length - 1];
      return {
        id: contact.id,
        title: contact.name,
        subtitle: lastMessage?.content || 'Conversa iniciada',
      };
    });
    return [
      { id: 'assistant' as const, title: 'IA DolarPix', subtitle: assistantPreview },
      ...contactThreads,
    ];
  }, [assistantMessages, contacts, friendThreads]);

  const handleAssistantSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setAssistantMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const systemInstruction = `
        Voce e o assistente do DolarPix.
        Nome: ${user.name}
        Saldo em USD: ${user.balance}
        Moeda principal: ${user.currency}
        Contatos: ${contacts.map((c) => `${c.name} (${c.identifier})`).join(', ')}
        Historico: ${transactions.slice(0, 5).map((t) => `${t.type} ${t.amount} ${t.currency} com ${t.counterparty}`).join(' | ')}
        So execute transferencias apos confirmacao explicita.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          ...assistantMessages.map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] })),
          { role: 'user', parts: [{ text: userMessage }] },
        ],
        config: {
          systemInstruction,
          tools: [{
            functionDeclarations: [{
              name: 'executeTransaction',
              description: 'Executa uma transferencia',
              parameters: {
                type: Type.OBJECT,
                properties: {
                  amount: { type: Type.NUMBER },
                  recipient: { type: Type.STRING },
                  currency: { type: Type.STRING, enum: ['USDC', 'USDT', 'XLM'] },
                },
                required: ['amount', 'recipient', 'currency'],
              },
            }],
          }],
        },
      });

      const functionCalls = response.functionCalls;
      if (functionCalls?.length) {
        const call = functionCalls[0];
        if (call.name === 'executeTransaction') {
          const { amount, recipient, currency } = call.args as any;
          onExecuteTransaction(Number(amount), String(recipient), String(currency));
          setAssistantMessages((prev) => [...prev, {
            role: 'assistant',
            content: `Transferencia preparada: ${amount} ${currency} para ${recipient}.`,
          }]);
        }
      } else {
        setAssistantMessages((prev) => [...prev, {
          role: 'assistant',
          content: response.text || 'Nao consegui responder agora.',
        }]);
      }
    } catch (error) {
      console.error(error);
      setAssistantMessages((prev) => [...prev, {
        role: 'assistant',
        content: 'Tive um problema tecnico agora. Tente novamente.',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContactMessage = () => {
    if (!selectedContact || !input.trim()) return;

    const message = input.trim();
    setInput('');

    appendFriendMessages(
      selectedContact.id,
      {
        id: `${Date.now()}-me`,
        role: 'me',
        content: message,
        timestamp: Date.now(),
      },
      {
        id: `${Date.now()}-reply`,
        role: 'contact',
        content: 'Mensagem recebida. Se quiser movimentar valores, use os botoes abaixo da conversa.',
        timestamp: Date.now(),
      },
    );
  };

  const saveManualContact = async () => {
    if (!newContactName.trim() || !newContactIdentifier.trim()) return;

    setSavingContact(true);
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: HEADERS(),
        body: JSON.stringify({
          name: newContactName.trim(),
          identifier: newContactIdentifier.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setContacts((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedThread(data.id);
        setShowAddModal(false);
        setNewContactName('');
        setNewContactIdentifier('');
        toast.success('Contato adicionado');
      } else {
        toast.error(data.error || 'Erro ao adicionar contato');
      }
    } finally {
      setSavingContact(false);
    }
  };

  const fetchNearbyContacts = () => {
    if (!navigator.geolocation) {
      toast.error('GPS nao disponivel neste aparelho');
      return;
    }

    setLoadingNearby(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(`/api/contacts/nearby?latitude=${coords.latitude}&longitude=${coords.longitude}`, {
            headers: HEADERS(),
          });
          const data = await res.json();
          if (res.ok) {
            setNearbyContacts(data);
          } else {
            toast.error(data.error || 'Nao foi possivel buscar contatos proximos');
          }
        } finally {
          setLoadingNearby(false);
        }
      },
      () => {
        setLoadingNearby(false);
        toast.error('Permissao de localizacao negada');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const addNearbyContact = async (targetUserId: number) => {
    setAddingNearbyUserId(targetUserId);
    try {
      const res = await fetch('/api/contacts/from-user', {
        method: 'POST',
        headers: HEADERS(),
        body: JSON.stringify({ targetUserId }),
      });
      const data = await res.json();
      if (res.ok) {
        setContacts((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedThread(data.id);
        toast.success('Contato proximo adicionado');
      } else {
        toast.error(data.error || 'Nao foi possivel adicionar este contato');
      }
    } finally {
      setAddingNearbyUserId(null);
    }
  };

  const openActionModal = (mode: 'send' | 'request') => {
    setActionMode(mode);
    setRequestDraft({ amount: '', currency: 'QUALQUER' });
    setShowActionModal(true);
  };

  const submitConversationAction = () => {
    if (!selectedContact) return;

    const amount = Number(requestDraft.amount.replace(',', '.'));
    const currency = requestDraft.currency;
    const label = currency === 'QUALQUER' ? 'qualquer moeda' : currency;

    if (actionMode === 'send') {
      if (!amount || amount <= 0 || currency === 'QUALQUER') {
        toast.error('Defina valor e moeda para enviar');
        return;
      }
      onExecuteTransaction(amount, selectedContact.name, currency);
      appendFriendMessages(
        selectedContact.id,
        {
          id: `${Date.now()}-send-me`,
          role: 'me',
          content: `Enviei ${amount} ${currency} para voce.`,
          timestamp: Date.now(),
        },
        {
          id: `${Date.now()}-send-system`,
          role: 'system',
          content: `Transferencia enviada para ${selectedContact.name}.`,
          timestamp: Date.now(),
        },
      );
      toast.success('Transferencia enviada');
    } else {
      appendFriendMessages(
        selectedContact.id,
        {
          id: `${Date.now()}-request-system`,
          role: 'system',
          content: `Pedido de pagamento criado: ${amount > 0 ? amount : 'valor livre'} ${label}.`,
          timestamp: Date.now(),
        },
        {
          id: `${Date.now()}-request-contact`,
          role: 'contact',
          content: `Recebi seu pedido. Posso pagar ${amount > 0 ? `${amount} ${label}` : 'com valor definido por mim'}.`,
          timestamp: Date.now(),
        },
      );
      toast.success('Pedido enviado no chat');
    }

    setShowActionModal(false);
  };

  const conversationTitle = selectedThread === 'assistant'
    ? 'IA DolarPix'
    : selectedContact?.name || 'Contato';

  return (
    <div className="flex h-full flex-col bg-[#f5f7fb] text-zinc-900">
      <header className="border-b border-zinc-200 bg-white px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold">Chat</h1>
            <p className="text-xs text-zinc-500">IA no topo e sua lista de contatos logo abaixo</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchNearbyContacts}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 text-zinc-600"
              title="Buscar por proximidade"
            >
              {loadingNearby ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-white"
              title="Adicionar contato"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="border-b border-zinc-200 bg-white px-3 py-3">
        <div className="space-y-2">
          {threads.map((thread) => {
            const isSelected = selectedThread === thread.id;
            return (
              <button
                key={String(thread.id)}
                onClick={() => setSelectedThread(thread.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors',
                  isSelected ? 'bg-zinc-900 text-white' : 'bg-zinc-50 text-zinc-900 hover:bg-zinc-100'
                )}
              >
                <Avatar className="h-11 w-11 shrink-0">
                  {thread.id === 'assistant' ? (
                    <AvatarFallback className={cn(isSelected ? 'bg-white/15 text-white' : 'bg-primary/10 text-primary')}>
                      <Bot size={18} />
                    </AvatarFallback>
                  ) : (
                    <AvatarFallback className={cn(isSelected ? 'bg-white/15 text-white' : 'bg-blue-100 text-blue-700')}>
                      {String(thread.title).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{thread.title}</p>
                  <p className={cn('truncate text-xs', isSelected ? 'text-white/70' : 'text-zinc-500')}>{thread.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-b border-zinc-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{conversationTitle}</p>
            <p className="text-xs text-zinc-500">
              {selectedThread === 'assistant' ? 'Assistente financeiro e operacional' : 'Conversa com contato'}
            </p>
          </div>
          {selectedContact && (
            <div className="flex gap-2">
              <button
                onClick={() => openActionModal('send')}
                className="flex items-center gap-1 rounded-full bg-zinc-900 px-3 py-2 text-xs font-bold text-white"
              >
                <ArrowUpRight size={14} />
                Enviar
              </button>
              <button
                onClick={() => openActionModal('request')}
                className="flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-2 text-xs font-bold text-zinc-700"
              >
                <ArrowDownLeft size={14} />
                Receber
              </button>
            </div>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 px-4 py-4">
        <div className="space-y-4">
          {selectedThread === 'assistant' && assistantMessages.map((msg, i) => (
            <motion.div
              key={`assistant-${i}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div className={cn('flex max-w-[88%] gap-3', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                <Avatar className="h-8 w-8 shrink-0 border border-zinc-200">
                  {msg.role === 'assistant' ? (
                    <AvatarFallback className="bg-primary text-white"><Bot size={16} /></AvatarFallback>
                  ) : (
                    <AvatarImage src="https://i.pravatar.cc/150?u=me" />
                  )}
                </Avatar>
                <div className={cn(
                  'rounded-2xl p-4 text-sm shadow-sm',
                  msg.role === 'user' ? 'rounded-tr-none bg-zinc-900 text-white' : 'rounded-tl-none border border-zinc-200 bg-white text-zinc-800'
                )}>
                  {msg.content}
                </div>
              </div>
            </motion.div>
          ))}

          {selectedContact && activeFriendMessages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'flex',
                msg.role === 'me' ? 'justify-end' : msg.role === 'system' ? 'justify-center' : 'justify-start'
              )}
            >
              {msg.role === 'system' ? (
                <div className="rounded-full bg-zinc-200 px-3 py-1.5 text-[11px] font-bold text-zinc-600">
                  {msg.content}
                </div>
              ) : (
                <div className={cn('max-w-[88%] rounded-2xl p-4 text-sm shadow-sm', msg.role === 'me' ? 'rounded-tr-none bg-zinc-900 text-white' : 'rounded-tl-none border border-zinc-200 bg-white text-zinc-800')}>
                  {msg.content}
                </div>
              )}
            </motion.div>
          ))}

          {isLoading && selectedThread === 'assistant' && (
            <div className="flex justify-start">
              <div className="flex gap-3 items-center bg-white p-3 rounded-2xl border border-zinc-200 shadow-sm">
                <Loader2 size={16} className="animate-spin text-primary" />
                <span className="text-xs text-zinc-400 font-medium">Pensando...</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-zinc-200 bg-white p-4">
        <div className="relative flex items-center">
          <Input
            placeholder={selectedThread === 'assistant' ? 'Pergunte algo para a IA...' : `Mensagem para ${selectedContact?.name || 'contato'}`}
            className="h-14 rounded-2xl border-zinc-200 bg-zinc-50 pr-12"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (selectedThread === 'assistant' ? handleAssistantSend() : handleContactMessage())}
          />
          <Button
            size="icon"
            className="absolute right-2 h-10 w-10 rounded-xl"
            onClick={selectedThread === 'assistant' ? handleAssistantSend : handleContactMessage}
            disabled={isLoading || !input.trim()}
          >
            <SendIcon size={18} />
          </Button>
        </div>
      </div>

      {(showAddModal || showActionModal) && (
        <div className="absolute inset-0 z-50 flex items-end bg-black/40 p-3">
          <div className="w-full rounded-[28px] bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">{showAddModal ? 'Adicionar contato' : actionMode === 'send' ? 'Enviar pelo chat' : 'Cobrar pelo chat'}</h2>
                <p className="text-sm text-zinc-500">
                  {showAddModal ? 'Manual ou por proximidade' : selectedContact ? `Conversa com ${selectedContact.name}` : ''}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowActionModal(false);
                }}
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-600"
              >
                <X size={18} />
              </button>
            </div>

            {showAddModal && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Manual</p>
                  <Input placeholder="Nome do contato" value={newContactName} onChange={(e) => setNewContactName(e.target.value)} />
                  <Input placeholder="Email, telefone ou chave" value={newContactIdentifier} onChange={(e) => setNewContactIdentifier(e.target.value)} />
                  <Button className="w-full" onClick={saveManualContact} disabled={savingContact}>
                    {savingContact ? 'Salvando...' : 'Salvar contato'}
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Por proximidade</p>
                    <button onClick={fetchNearbyContacts} className="text-xs font-bold text-primary">Atualizar GPS</button>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {nearbyContacts.map((contact) => (
                      <div key={contact.userId} className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3">
                        <div>
                          <p className="text-sm font-bold">{contact.firstName}</p>
                          <p className="text-xs text-zinc-500">{contact.distanceKm.toFixed(1)} km de voce</p>
                        </div>
                        <Button size="sm" onClick={() => addNearbyContact(contact.userId)} disabled={addingNearbyUserId === contact.userId}>
                          {addingNearbyUserId === contact.userId ? '...' : 'Adicionar'}
                        </Button>
                      </div>
                    ))}
                    {!loadingNearby && nearbyContacts.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-zinc-200 p-4 text-center text-sm text-zinc-500">
                        Nenhum contato proximo encontrado ainda.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {showActionModal && selectedContact && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-zinc-100 p-1">
                  <button
                    onClick={() => setActionMode('send')}
                    className={cn('rounded-xl px-3 py-2 text-sm font-bold', actionMode === 'send' ? 'bg-white text-zinc-900' : 'text-zinc-500')}
                  >
                    Enviar
                  </button>
                  <button
                    onClick={() => setActionMode('request')}
                    className={cn('rounded-xl px-3 py-2 text-sm font-bold', actionMode === 'request' ? 'bg-white text-zinc-900' : 'text-zinc-500')}
                  >
                    Receber
                  </button>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Valor</p>
                  <Input
                    type="number"
                    placeholder={actionMode === 'request' ? 'Opcional' : '0.00'}
                    value={requestDraft.amount}
                    onChange={(e) => setRequestDraft((prev) => ({ ...prev, amount: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Moeda</p>
                  <select
                    value={requestDraft.currency}
                    onChange={(e) => setRequestDraft((prev) => ({ ...prev, currency: e.target.value }))}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none"
                  >
                    {REQUEST_CURRENCIES.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency === 'QUALQUER' ? 'Qualquer moeda' : currency}
                      </option>
                    ))}
                  </select>
                </div>

                <Button className="w-full" onClick={submitConversationAction}>
                  {actionMode === 'send' ? 'Confirmar envio' : 'Enviar pedido no chat'}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
