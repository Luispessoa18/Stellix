# DolarPix

Carteira digital para envio e recebimento de stablecoins (USDC/USDT) na rede **Stellar**. Interface mobile-first com autenticação JWT, banco de dados local e integração com IA via Gemini.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/ui, Framer Motion |
| Backend | Express.js (Node.js/TypeScript) |
| Banco de dados | LibSQL (SQLite via `@libsql/client`) |
| Autenticação | JWT + bcryptjs |
| Blockchain | Stellar SDK v13 (testnet ou mainnet) |
| IA | Google Gemini (`gemini-2.0-flash-preview`) |
| QR Code | `qrcode.react` |

---

## Pré-requisitos

- **Node.js 18+** (recomendado: v20 ou v22)
- **npm** (incluso no Node)
- Conta no [Google AI Studio](https://aistudio.google.com/) para obter a `GEMINI_API_KEY`

---

## Instalação

```bash
git clone <url-do-repositorio>
cd dolarpix
npm install
```

---

## Configuração do ambiente

Copie o arquivo de exemplo e preencha as variáveis:

```bash
cp .env.example .env
```

Abra `.env` e configure cada seção conforme descrito abaixo.

### Variáveis obrigatórias

| Variável | Descrição |
|---|---|
| `GEMINI_API_KEY` | Chave da API do Google Gemini (para o chat IA) |
| `JWT_SECRET` | String aleatória longa para assinar os tokens JWT |
| `STELLAR_NETWORK` | `testnet` (desenvolvimento) ou `mainnet` (produção) |

### Configuração Stellar

O projeto suporta dois modos:

**Testnet (recomendado para desenvolvimento)**

```env
STELLAR_NETWORK=testnet
```

Cada usuário que se cadastra recebe automaticamente uma carteira Stellar testnet, financiada pelo Friendbot com 10.000 XLM de teste. Não é necessário configurar `STELLAR_PUBLIC_KEY` e `STELLAR_SECRET_KEY` para o modo testnet básico.

Para criar uma conta de operações (opcional, para testes avançados):

```bash
npm run stellar:setup
```

Isso imprime as chaves geradas no terminal — cole-as no `.env`.

**Mainnet (produção)**

```env
STELLAR_NETWORK=mainnet
STELLAR_PUBLIC_KEY=G...           # Chave pública da conta operacional
STELLAR_SECRET_KEY=S...           # Chave secreta — NUNCA exponha publicamente
ASSET_ISSUER=GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN  # USDC Circle mainnet
```

> Na mainnet o Friendbot não existe. Contas novas precisam ser ativadas manualmente com pelo menos 1 XLM.

---

## Rodando o projeto

### Opção 1 — Tudo junto (recomendado)

Inicia o frontend (porta 3000) e o backend (porta 3001) simultaneamente:

```bash
npm run dev:all
```

### Opção 2 — Separado

Terminal 1 — Backend:

```bash
npm run dev:server
```

Terminal 2 — Frontend:

```bash
npm run dev
```

Acesse: [http://localhost:3000](http://localhost:3000)

---

## Scripts disponíveis

| Comando | O que faz |
|---|---|
| `npm run dev` | Inicia o frontend Vite na porta 3000 |
| `npm run dev:server` | Inicia o backend Express na porta 3001 com hot-reload |
| `npm run dev:all` | Inicia frontend + backend juntos |
| `npm run build` | Gera o build de produção em `/dist` |
| `npm run preview` | Serve o build localmente para inspeção |
| `npm run lint` | Verifica erros de TypeScript (`tsc --noEmit`) |
| `npm run stellar:setup` | Cria e financia uma conta no testnet, imprime as chaves |
| `npm run stellar:test` | Executa uma transação de teste XLM no testnet |

---

## Banco de dados

O banco SQLite é criado automaticamente em `data/dolarpix.db` na primeira execução do servidor. Não é necessário nenhuma migração manual.

Para reiniciar o banco do zero (apaga todos os dados):

```bash
rm data/dolarpix.db
npm run dev:server
```

---

## Estrutura do projeto

```
dolarpix/
├── src/                        # Frontend React
│   ├── components/             # Telas e componentes UI
│   │   ├── Login.tsx
│   │   ├── Signup.tsx
│   │   ├── Home.tsx
│   │   ├── Send.tsx
│   │   ├── Receive.tsx
│   │   ├── Deposit.tsx         # Carteira Stellar + MetaMask
│   │   ├── Assets.tsx
│   │   ├── Profile.tsx
│   │   ├── AIChat.tsx
│   │   └── Navigation.tsx
│   ├── App.tsx                 # Roteamento e estado global
│   ├── types.ts                # Tipos TypeScript compartilhados
│   └── index.css               # Tema e variáveis CSS
│
├── server/                     # Backend Express
│   ├── index.ts                # Entry point do servidor
│   ├── db.ts                   # Conexão e schema do banco
│   ├── middleware/
│   │   └── auth.ts             # Middleware JWT
│   └── routes/
│       ├── auth.ts             # /api/auth/login, /api/auth/register
│       ├── transactions.ts     # /api/transactions
│       └── stellar.ts          # /api/stellar/*
│
├── stellar/                    # Integração Stellar SDK
│   ├── index.ts                # createStellarAccount, sendPayment, etc.
│   └── scripts/
│       ├── setup-testnet.ts    # Cria conta de teste
│       └── test-transaction.ts # Testa envio de XLM
│
├── data/                       # Banco SQLite (gerado automaticamente)
├── .env.example                # Modelo de variáveis de ambiente
├── vite.config.ts
├── tsconfig.json               # TypeScript para o frontend
└── tsconfig.server.json        # TypeScript para o backend
```

---

## API do backend

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `GET` | `/api/health` | Não | Status do servidor |
| `POST` | `/api/auth/register` | Não | Cria conta + carteira Stellar |
| `POST` | `/api/auth/login` | Não | Login, retorna JWT |
| `GET` | `/api/transactions` | JWT | Lista transações do usuário |
| `POST` | `/api/transactions/send` | JWT | Envia pagamento via Stellar |

---

## Funcionalidades

- Cadastro com criação automática de carteira Stellar
- Login/logout com JWT
- Envio de USDC/USDT na rede Stellar
- Recebimento via QR Code e chave (email)
- Depósito via endereço Stellar (QR Code real) ou conexão MetaMask
- Histórico de transações
- Chat IA com Gemini (assistente financeiro)
- Visualização de ativos

---

## Testnet vs Mainnet — resumo rápido

| | Testnet | Mainnet |
|---|---|---|
| `STELLAR_NETWORK` | `testnet` | `mainnet` |
| Friendbot (fundo automático) | Sim | Não |
| XLM real | Não | Sim |
| USDC issuer | `GBBD47IF6LWK7P7...LFLA5` | `GA5ZSEJYB37JRC5...KZVN` |
| Explorer | [stellar.expert/testnet](https://stellar.expert/explorer/testnet) | [stellar.expert/public](https://stellar.expert/explorer/public) |
| Uso recomendado | Desenvolvimento | Produção |

---

## Licença

Apache-2.0
