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
import profileRoutes from './routes/profile.js';
import marketRoutes from './routes/market.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV || 'development' });
});

app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/stellar', stellarRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/profile/keys', profileKeyRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/market', marketRoutes);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Rota nao encontrada' });
});

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor DolarPix -> http://localhost:${PORT}`);
    console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Stellar: ${process.env.STELLAR_NETWORK || 'testnet'}`);
  });
}).catch((err) => {
  console.error('Falha ao inicializar banco de dados:', err);
  process.exit(1);
});
