import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send as SendIcon, Bot, User as UserIcon, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChatMessage, User, Transaction } from '../types';
import { GoogleGenAI, Type } from "@google/genai";

interface AIChatProps {
  user: User;
  transactions: Transaction[];
  onExecuteTransaction: (amount: number, recipient: string, currency: string) => void;
}

const CONTACTS = [
  { name: 'João Silva', identifier: 'joao@email.com' },
  { name: 'Maria Santos', identifier: '+55 11 99999-9999' },
  { name: 'Pedro Oliveira', identifier: 'pedro@stellar.org' },
];

export default function AIChat({ user, transactions, onExecuteTransaction }: AIChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: `Olá ${user.name.split(' ')[0]}! Sou seu assistente DolarPix. Tenho acesso ao seu saldo, contatos e histórico para te ajudar. Como posso ser útil?` }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const systemInstruction = `
        Você é o assistente inteligente do DolarPix. Você tem acesso total aos dados do usuário para fornecer ajuda personalizada.
        
        DADOS DO USUÁRIO:
        - Nome: ${user.name}
        - Saldo Total: $${user.balance}
        - Moedas em Carteira: ${user.assets.filter(a => a.amount > 0).map(a => `${a.name} (${a.id}): $${a.amount}`).join(', ')}
        - Moedas Zeradas: ${user.assets.filter(a => a.amount <= 0).map(a => a.id).join(', ')}
        
        CONTATOS:
        ${CONTACTS.map(c => `- ${c.name} (${c.identifier})`).join('\n')}
        
        HISTÓRICO RECENTE:
        ${transactions.slice(0, 5).map(t => `- ${t.type === 'send' ? 'Enviou' : 'Recebeu'} $${t.amount} ${t.currency} de/para ${t.counterparty} em ${new Date(t.timestamp).toLocaleDateString()}`).join('\n')}
        
        REGRAS CRÍTICAS:
        1. MEMÓRIA: Você deve lembrar do que foi dito anteriormente na conversa.
        2. SALDO: Nunca recomende ou tente enviar uma moeda que o usuário não possui saldo suficiente. Se o usuário pedir para enviar uma moeda que ele não tem, explique educadamente que ele não possui saldo nessa moeda e sugira as que ele tem.
        3. CONTATOS: Use a lista de contatos para sugerir destinatários se o usuário mencionar apenas um nome parcial.
        4. ANÁLISE: Se o usuário perguntar sobre gastos, use o histórico fornecido para dar insights (ex: "Você gastou X com Starbucks nos últimos dias").
        5. TRANSAÇÃO: Só chame 'executeTransaction' após confirmação explícita do usuário.
        6. TOM: Amigável, estilo Fintech moderna.
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
              description: "Executa uma transferência de valores entre usuários",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  amount: { type: Type.NUMBER, description: "O valor numérico a ser enviado" },
                  recipient: { type: Type.STRING, description: "O nome, email ou chave do destinatário" },
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
          
          // Double check balance in AI logic too
          const asset = user.assets.find(a => a.id === currency);
          if (!asset || asset.amount < amount) {
            setMessages(prev => [...prev, { 
              role: 'assistant', 
              content: `Desculpe, mas você não tem saldo suficiente em ${currency} para realizar essa operação. Seu saldo atual em ${currency} é de $${asset?.amount || 0}.` 
            }]);
          } else {
            onExecuteTransaction(amount, recipient, currency);
            setMessages(prev => [...prev, { 
              role: 'assistant', 
              content: `✅ Confirmado! Enviei $${amount} ${currency} para ${recipient}. O comprovante já está no seu histórico.` 
            }]);
          }
        }
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: response.text || "Desculpe, não entendi. Pode repetir?" }]);
      }
    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Ops, tive um probleminha técnico. Pode tentar novamente?" }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50">
      <header className="px-6 py-4 bg-white border-b border-zinc-100 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <Sparkles size={20} />
        </div>
        <div>
          <h1 className="text-lg font-bold">Assistente DolarPix</h1>
          <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">Online • IA Ativa</p>
        </div>
      </header>

      <ScrollArea className="flex-1 p-6" ref={scrollRef}>
        <div className="space-y-6 pb-4">
          {messages.map((msg, i) => (
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
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex gap-3 items-center bg-white p-3 rounded-2xl border border-zinc-100 shadow-sm">
                <Loader2 size={16} className="animate-spin text-primary" />
                <span className="text-xs text-zinc-400 font-medium">Analisando seus dados...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 bg-white border-t border-zinc-100 pb-24">
        <div className="relative flex items-center">
          <Input
            placeholder="Diga o que você precisa..."
            className="pr-12 h-14 rounded-2xl bg-zinc-50 border-none focus-visible:ring-primary"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <Button 
            size="icon" 
            className="absolute right-2 h-10 w-10 rounded-xl shadow-lg shadow-primary/20"
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
          >
            <SendIcon size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
}
