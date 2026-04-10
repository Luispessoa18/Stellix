import { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Send as SendIcon, Bot, User as UserIcon, Loader2, Sparkles, MessageCircleMore, Command, ArrowDownLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChatMessage, Contact, User, Transaction } from '../types';
import { GoogleGenAI, Type } from "@google/genai";
import { cn } from '@/lib/utils';

interface AIChatProps {
  user: User;
  transactions: Transaction[];
  onExecuteTransaction: (amount: number, recipient: string, currency: string) => void;
}

type ChatMode = 'assistant' | 'friends';

type FriendMessage = {
  id: string;
  role: 'me' | 'friend' | 'system';
  content: string;
  timestamp: number;
};

const FRIEND_COMMAND_HINTS = ['/enviar 25 USDC', '/receber 10 USDT', '/enviar 18.5 XLM'];

function getToken() {
  return localStorage.getItem('token') || '';
}

const HEADERS = () => ({ Authorization: `Bearer ${getToken()}` });

export default function AIChat({ user, transactions, onExecuteTransaction }: AIChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: `OlÃ¡ ${user.name.split(' ')[0]}! Sou seu assistente DolarPix. Tenho acesso ao seu saldo, contatos e histÃ³rico para te ajudar. Como posso ser Ãºtil?` }
  ]);
  const [chatMode, setChatMode] = useState<ChatMode>('assistant');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [friendThreads, setFriendThreads] = useState<Record<number, FriendMessage[]>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/contacts', { headers: HEADERS() })
      .then((r) => r.ok ? r.json() : [])
      .then((data: Contact[]) => {
        setContacts(data);
        setSelectedContactId((prev) => prev ?? data[0]?.id ?? null);
        setFriendThreads((prev) => {
          const next = { ...prev };
          for (const contact of data) {
            if (!next[contact.id]) {
              next[contact.id] = [
                {
                  id: `seed-${contact.id}`,
                  role: 'friend',
                  content: `Oi ${user.name.split(' ')[0]}, sou ${contact.name}. Pode me chamar por aqui ou usar /enviar e /receber direto no chat.`,
                  timestamp: Date.now() - 60_000,
                },
              ];
            }
          }
          return next;
        });
      })
      .catch(() => {});
  }, [user.name]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, friendThreads, selectedContactId, chatMode, isLoading]);

  const activeContact = contacts.find((contact) => contact.id === selectedContactId) ?? null;
  const activeFriendMessages = activeContact ? friendThreads[activeContact.id] || [] : [];

  const appendFriendMessages = (contactId: number, ...newMessages: FriendMessage[]) => {
    setFriendThreads((prev) => ({
      ...prev,
      [contactId]: [...(prev[contactId] || []), ...newMessages],
    }));
  };

  const handleAssistantSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      const systemInstruction = `
        VocÃª Ã© o assistente inteligente do DolarPix. VocÃª tem acesso total aos dados do usuÃ¡rio para fornecer ajuda personalizada.

        DADOS DO USUÃRIO:
        - Nome: ${user.name}
        - Saldo Total: $${user.balance}
        - Moedas em Carteira: ${user.assets.filter(a => a.amount > 0).map(a => `${a.name} (${a.id}): $${a.amount}`).join(', ')}
        - Moedas Zeradas: ${user.assets.filter(a => a.amount <= 0).map(a => a.id).join(', ')}

        CONTATOS:
        ${contacts.map(c => `- ${c.name} (${c.identifier})`).join('\n')}

        HISTÃ“RICO RECENTE:
        ${transactions.slice(0, 5).map(t => `- ${t.type === 'send' ? 'Enviou' : 'Recebeu'} $${t.amount} ${t.currency} de/para ${t.counterparty} em ${new Date(t.timestamp).toLocaleDateString()}`).join('\n')}

        REGRAS CRÃTICAS:
        1. MEMÃ“RIA: VocÃª deve lembrar do que foi dito anteriormente na conversa.
        2. SALDO: Nunca recomende ou tente enviar uma moeda que o usuÃ¡rio nÃ£o possui saldo suficiente. Se o usuÃ¡rio pedir para enviar uma moeda que ele nÃ£o tem, explique educadamente que ele nÃ£o possui saldo nessa moeda e sugira as que ele tem.
        3. CONTATOS: Use a lista de contatos para sugerir destinatÃ¡rios se o usuÃ¡rio mencionar apenas um nome parcial.
        4. ANÃLISE: Se o usuÃ¡rio perguntar sobre gastos, use o histÃ³rico fornecido para dar insights.
        5. TRANSAÃ‡ÃƒO: SÃ³ chame 'executeTransaction' apÃ³s confirmaÃ§Ã£o explÃ­cita do usuÃ¡rio.
        6. TOM: AmigÃ¡vel, estilo Fintech moderna.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          ...messages.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] })),
          { role: 'user', parts: [{ text: userMessage }] }
        ],
        config: {
          systemInstruction,
          tools: [{
            functionDeclarations: [{
              name: "executeTransaction",
              description: "Executa uma transferÃªncia de valores entre usuÃ¡rios",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  amount: { type: Type.NUMBER, description: "O valor numÃ©rico a ser enviado" },
                  recipient: { type: Type.STRING, description: "O nome, email ou chave do destinatÃ¡rio" },
                  currency: { type: Type.STRING, description: "A moeda (USDC ou USDT)", enum: ["USDC", "USDT"] }
                },
                required: ["amount", "recipient", "currency"]
              }
            }]
          }]
        }
      });

      const functionCalls = response.functionCalls;
      if (functionCalls) {
        const call = functionCalls[0];
        if (call.name === "executeTransaction") {
          const { amount, recipient, currency } = call.args as any;
          const asset = user.assets.find(a => a.id === currency);

          if (!asset || asset.amount < amount) {
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: `Desculpe, mas vocÃª nÃ£o tem saldo suficiente em ${currency} para realizar essa operaÃ§Ã£o. Seu saldo atual em ${currency} Ã© de $${asset?.amount || 0}.`
            }]);
          } else {
            onExecuteTransaction(amount, recipient, currency);
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: `âœ… Confirmado! Enviei $${amount} ${currency} para ${recipient}. O comprovante jÃ¡ estÃ¡ no seu histÃ³rico.`
            }]);
          }
        }
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: response.text || "Desculpe, nÃ£o entendi. Pode repetir?" }]);
      }
    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Ops, tive um probleminha tÃ©cnico. Pode tentar novamente?" }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFriendCommand = (rawInput: string, contact: Contact) => {
    const [command, amountToken, currencyToken] = rawInput.trim().split(/\s+/);
    const normalizedCommand = command.toLowerCase();
    const amount = Number((amountToken || '').replace(',', '.'));
    const currency = (currencyToken || 'USDC').toUpperCase();
    const allowedCurrencies = ['USDC', 'USDT', 'XLM'];

    if (!amount || amount <= 0 || !allowedCurrencies.includes(currency)) {
      appendFriendMessages(contact.id, {
        id: `${Date.now()}-system-invalid`,
        role: 'system',
        content: 'Use /enviar 25 USDC ou /receber 10 XLM.',
        timestamp: Date.now(),
      });
      return;
    }

    const baseMessage: FriendMessage = {
      id: `${Date.now()}-me-command`,
      role: 'me',
      content: rawInput,
      timestamp: Date.now(),
    };

    if (normalizedCommand === '/enviar') {
      onExecuteTransaction(amount, contact.name, currency);
      appendFriendMessages(
        contact.id,
        baseMessage,
        {
          id: `${Date.now()}-system-send`,
          role: 'system',
          content: `TransferÃªncia de ${amount} ${currency} enviada para ${contact.name}.`,
          timestamp: Date.now(),
        },
        {
          id: `${Date.now()}-friend-send`,
          role: 'friend',
          content: `Recebi ${amount} ${currency} aqui. Obrigado!`,
          timestamp: Date.now(),
        }
      );
      return;
    }

    if (normalizedCommand === '/receber') {
      appendFriendMessages(
        contact.id,
        baseMessage,
        {
          id: `${Date.now()}-system-request`,
          role: 'system',
          content: `Pedido de ${amount} ${currency} enviado para ${contact.name}.`,
          timestamp: Date.now(),
        },
        {
          id: `${Date.now()}-friend-request`,
          role: 'friend',
          content: `Vi seu pedido de ${amount} ${currency}. Te respondo por aqui.`,
          timestamp: Date.now(),
        }
      );
      return;
    }

    appendFriendMessages(contact.id, {
      id: `${Date.now()}-system-unknown`,
      role: 'system',
      content: 'Comando nÃ£o reconhecido. Use /enviar ou /receber.',
      timestamp: Date.now(),
    });
  };

  const handleFriendSend = () => {
    if (!activeContact || !input.trim()) return;

    const message = input.trim();
    setInput('');

    if (message.startsWith('/')) {
      handleFriendCommand(message, activeContact);
      return;
    }

    appendFriendMessages(
      activeContact.id,
      {
        id: `${Date.now()}-me`,
        role: 'me',
        content: message,
        timestamp: Date.now(),
      },
      {
        id: `${Date.now()}-friend`,
        role: 'friend',
        content: `Mensagem recebida. Se quiser movimentar saldo por aqui, use ${FRIEND_COMMAND_HINTS[0]} ou ${FRIEND_COMMAND_HINTS[1]}.`,
        timestamp: Date.now(),
      }
    );
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50">
      <header className="px-6 py-4 bg-white border-b border-zinc-100 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          {chatMode === 'assistant' ? <Sparkles size={20} /> : <MessageCircleMore size={20} />}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold">
            {chatMode === 'assistant' ? 'Assistente DolarPix' : 'Conversas'}
          </h1>
          <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">
            {chatMode === 'assistant' ? 'Online â€¢ IA Ativa' : 'Contatos â€¢ Comandos no chat'}
          </p>
        </div>
        <div className="rounded-2xl bg-zinc-100 p-1 flex items-center gap-1">
          <button
            onClick={() => setChatMode('assistant')}
            className={cn(
              'rounded-xl px-3 py-2 text-[11px] font-bold transition-colors',
              chatMode === 'assistant' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'
            )}
          >
            IA
          </button>
          <button
            onClick={() => setChatMode('friends')}
            className={cn(
              'rounded-xl px-3 py-2 text-[11px] font-bold transition-colors',
              chatMode === 'friends' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'
            )}
          >
            Amigos
          </button>
        </div>
      </header>

      {chatMode === 'friends' && (
        <div className="border-b border-zinc-100 bg-white px-4 py-3">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {contacts.map((contact) => (
              <button
                key={contact.id}
                onClick={() => setSelectedContactId(contact.id)}
                className={cn(
                  'min-w-[140px] rounded-2xl border px-3 py-3 text-left transition-colors',
                  selectedContactId === contact.id ? 'border-primary bg-primary/5' : 'border-zinc-200 bg-zinc-50'
                )}
              >
                <p className="text-sm font-bold text-zinc-900 truncate">{contact.name}</p>
                <p className="text-[10px] text-zinc-500 truncate">{contact.identifier}</p>
              </button>
            ))}
            {contacts.length === 0 && (
              <div className="w-full rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-5 text-center text-sm text-zinc-500">
                Salve contatos na tela de envio para conversar aqui.
              </div>
            )}
          </div>
        </div>
      )}

      <ScrollArea className="flex-1 p-6">
        <div className="space-y-6 pb-4">
          {chatMode === 'assistant' && messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <Avatar className="w-8 h-8 shrink-0 border border-zinc-100">
                  {msg.role === 'assistant' ? (
                    <AvatarFallback className="bg-primary text-white"><Bot size={16} /></AvatarFallback>
                  ) : (
                    <AvatarImage src="https://i.pravatar.cc/150?u=me" />
                  )}
                </Avatar>
                <div className={`p-4 rounded-2xl text-sm shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-white rounded-tr-none'
                    : 'bg-white text-zinc-800 rounded-tl-none border border-zinc-100'
                }`}>
                  {msg.content}
                </div>
              </div>
            </motion.div>
          ))}

          {chatMode === 'friends' && activeContact && (
            <>
              <div className="rounded-3xl border border-blue-100 bg-blue-50/70 p-4">
                <div className="flex items-center gap-2 text-blue-700">
                  <Command size={16} />
                  <p className="text-xs font-bold uppercase tracking-widest">Comandos rÃ¡pidos</p>
                </div>
                <p className="mt-2 text-sm text-blue-900">
                  Use <span className="font-bold">/enviar</span> para transferir e <span className="font-bold">/receber</span> para cobrar direto no chat.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {FRIEND_COMMAND_HINTS.map((hint) => (
                    <button
                      key={hint}
                      onClick={() => setInput(hint)}
                      className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-blue-700 shadow-sm"
                    >
                      {hint}
                    </button>
                  ))}
                </div>
              </div>

              {activeFriendMessages.map((msg) => (
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
                    <div className={cn('flex max-w-[85%] gap-3', msg.role === 'me' ? 'flex-row-reverse' : 'flex-row')}>
                      <Avatar className="h-8 w-8 shrink-0 border border-zinc-100">
                        <AvatarFallback className={cn(msg.role === 'me' ? 'bg-zinc-900 text-white' : 'bg-blue-100 text-blue-700')}>
                          {msg.role === 'me' ? <UserIcon size={16} /> : <ArrowDownLeft size={16} />}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={cn(
                          'rounded-2xl p-4 text-sm shadow-sm',
                          msg.role === 'me'
                            ? 'rounded-tr-none bg-zinc-900 text-white'
                            : 'rounded-tl-none border border-zinc-100 bg-white text-zinc-800'
                        )}
                      >
                        {msg.content}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </>
          )}

          {chatMode === 'friends' && !activeContact && contacts.length === 0 && (
            <div className="rounded-3xl border border-dashed border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
              Nenhum amigo disponÃ­vel no chat ainda.
            </div>
          )}

          {isLoading && chatMode === 'assistant' && (
            <div className="flex justify-start">
              <div className="flex gap-3 items-center bg-white p-3 rounded-2xl border border-zinc-100 shadow-sm">
                <Loader2 size={16} className="animate-spin text-primary" />
                <span className="text-xs text-zinc-400 font-medium">Analisando seus dados...</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="p-4 bg-white border-t border-zinc-100">
        <div className="relative flex items-center">
          <Input
            placeholder={
              chatMode === 'assistant'
                ? 'Diga o que vocÃª precisa...'
                : activeContact
                  ? `Converse com ${activeContact.name} ou use /enviar e /receber`
                  : 'Selecione um contato para conversar'
            }
            className="pr-12 h-14 rounded-2xl bg-zinc-50 border-none focus-visible:ring-primary"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (chatMode === 'assistant' ? handleAssistantSend() : handleFriendSend())}
            disabled={chatMode === 'friends' && !activeContact}
          />
          <Button
            size="icon"
            className="absolute right-2 h-10 w-10 rounded-xl shadow-lg shadow-primary/20"
            onClick={chatMode === 'assistant' ? handleAssistantSend : handleFriendSend}
            disabled={(chatMode === 'assistant' && (isLoading || !input.trim())) || (chatMode === 'friends' && (!activeContact || !input.trim()))}
          >
            <SendIcon size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
}
