import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import AdminApp from './admin/AdminApp.tsx';
import { ThemeProvider } from './contexts/ThemeContext.tsx';
import './index.css';

const isAdmin = window.location.pathname.startsWith('/admin');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      {isAdmin ? <AdminApp /> : <App />}
    </ThemeProvider>
  </StrictMode>,
);
