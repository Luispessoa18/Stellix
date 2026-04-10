export type View = 'home' | 'send' | 'receive' | 'deposit' | 'withdraw' | 'assets' | 'profile' | 'chat' | 'login' | 'signup';

export interface Transaction {
  id: string;
  type: 'send' | 'receive' | 'deposit' | 'withdraw';
  amount: number;
  currency: string;
  counterparty: string;
  timestamp: number;
  status: 'completed' | 'pending' | 'failed';
  usdPriceAtTime?: number;  // preço XLM/USD no momento da transação
}

export interface Asset {
  id: string;
  name: string;
  amount: number;
  icon: string;
  walletAddress?: string;
}

export interface User {
  name: string;
  email: string;
  phone: string;
  balance: number;
  currency: string;
  assets: Asset[];
  stellarPublicKey?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface Contact {
  id: number;
  name: string;
  identifier: string;
  stellarPublicKey: string;
  createdAt: string;
}

export interface PaymentKey {
  id: number;
  type: 'email' | 'phone' | 'random';
  keyValue: string;
  createdAt: string;
}
