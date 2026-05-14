import { useState, useEffect } from 'react';
import { Search, Users, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Contact } from '../types';
import { toast } from 'sonner';

interface ContactsProps {
  onSendToContact: (contact: Contact) => void;
}

function getToken() { return localStorage.getItem('token') || ''; }
const authHeaders = () => ({ Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' });

export default function Contacts({ onSendToContact }: ContactsProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/contacts', { headers: authHeaders() })
      .then((r) => r.json())
      .then(setContacts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.identifier.toLowerCase().includes(search.toLowerCase())
  );

  const initials = (name: string) =>
    name.trim().split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase() || '?';

  const handleDelete = async (id: number) => {
    await fetch(`/api/contacts/${id}`, { method: 'DELETE', headers: authHeaders() });
    setContacts((prev) => prev.filter((c) => c.id !== id));
    toast.success('Contato removido');
  };

  return (
    <div className="flex flex-col h-full pb-24 overflow-y-auto no-scrollbar md:max-w-lg md:mx-auto w-full">
      <header className="px-5 pt-12 pb-5">
        <h1 className="text-2xl font-bold text-white mb-4">Contatos</h1>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" />
          <input
            placeholder="Buscar contato..."
            className="w-full h-12 pl-11 pr-4 rounded-2xl text-white text-sm placeholder:text-zinc-600 outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </header>

      <div className="px-5 flex-1 pb-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-zinc-600">
            <Users size={32} className="mb-3 opacity-40" />
            <p className="text-sm">{search ? 'Nenhum contato encontrado' : 'Nenhum contato ainda'}</p>
            {!search && (
              <p className="text-xs mt-1 text-zinc-700">Adicione ao enviar dinheiro pela primeira vez</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 p-4 rounded-2xl group"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <Avatar className="w-11 h-11 shrink-0">
                  <AvatarFallback className="bg-violet-500/20 text-violet-300 font-bold text-sm">
                    {initials(c.name)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm">{c.name}</p>
                  <p className="text-zinc-500 text-xs font-mono truncate">{c.identifier}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onSendToContact(c)}
                    className="h-9 px-4 rounded-xl text-xs font-bold text-violet-300 hover:text-white transition-colors"
                    style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)' }}
                  >
                    Enviar
                  </button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-600 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                    style={{ background: 'rgba(255,255,255,0.04)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
