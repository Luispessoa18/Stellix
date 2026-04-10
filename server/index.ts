import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDb } from './db.js';
import authRoutes from './routes/auth.js';
import transactionRoutes from './routes/transactions.js';
import stellarRoutes from './routes/stellar.js';
import adminRoutes from './routes/admin.js';
import contactRoutes from './routes/contacts.js';
import profileKeyRoutes from './routes/profileKeys.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV || 'development' });
});

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/stellar', stellarRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/profile/keys', profileKeyRoutes);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// Inicializa banco e sobe servidor
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 Servidor DolarPix → http://localhost:${PORT}`);
    console.log(`   Ambiente : ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Stellar  : ${process.env.STELLAR_NETWORK || 'testnet'}\n`);
  });
}).catch((err) => {
  console.error('Falha ao inicializar banco de dados:', err);
  process.exit(1);
});
