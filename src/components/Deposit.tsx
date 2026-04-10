import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Copy, Check, Wallet, ExternalLink, AlertCircle, Star } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { User } from '../types';
import { cn } from '@/lib/utils';

interface DepositProps {
  user: User;
  onBack: () => void;
}

type Tab = 'stellar' | 'metamask';

export default function Deposit({ user, onBack }: DepositProps) {
  const [tab, setTab] = useState<Tab>('stellar');
  const [copied, setCopied] = useState(false);
  const [metaMaskAddress, setMetaMaskAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const stellarAddress = user.stellarPublicKey || '';

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success('Endereço copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConnectMetaMask = async () => {
    const eth = (window as any).ethereum;
    if (!eth) {
      toast.error('MetaMask não encontrado. Instale a extensão.');
      return;
    }
    setConnecting(true);
    try {
      const accounts: string[] = await eth.request({ method: 'eth_requestAccounts' });
      setMetaMaskAddress(accounts[0]);
      toast.success('MetaMask conectado!');
    } catch (err: any) {
      toast.error(err?.message || 'Conexão recusada');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0c0f1a] overflow-y-auto no-scrollbar">
      {/* Header */}
      <header className="px-6 pt-12 pb-4 flex items-center gap-4">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white/60 hover:text-white transition-colors"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Depositar</h1>
          <p className="text-white/40 text-xs">Adicione fundos à sua conta</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="px-6 mb-6">
        <div className="flex gap-2 p-1 rounded-2xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
          {([
            { id: 'stellar', label: 'Carteira Stellar' },
            { id: 'metamask', label: 'MetaMask' },
          ] as { id: Tab; label: string }[]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex-1 py-2.5 rounded-xl text-sm font-bold transition-all',
                tab === t.id
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                  : 'text-white/50 hover:text-white/80'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stellar Tab */}
      {tab === 'stellar' && (
        <motion.div
          key="stellar"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-6 space-y-5 pb-8"
        >
          {/* Info */}
          <div className="flex gap-3 p-4 rounded-2xl" style={{ background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.20)' }}>
            <Star className="text-blue-400 shrink-0 mt-0.5" size={16} />
            <p className="text-xs text-white/70 leading-relaxed">
              Esta é sua carteira <span className="text-blue-400 font-bold">Stellar</span> criada automaticamente no cadastro.
              Envie USDC ou USDT nesta rede para depositar.
            </p>
          </div>

          {stellarAddress ? (
            <>
              {/* QR Code */}
              <div
                className="flex flex-col items-center gap-4 p-6 rounded-3xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}
              >
                <div className="p-4 bg-white rounded-2xl shadow-xl">
                  <QRCodeSVG
                    value={stellarAddress}
                    size={180}
                    level="H"
                    includeMargin={false}
                  />
                </div>
                <div className="text-center">
                  <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest">Rede Stellar • Testnet</p>
                  <p className="text-xs text-white/60 mt-1">Escaneie para obter o endereço</p>
                </div>
              </div>

              {/* Address + Copy */}
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-white/50 uppercase tracking-widest ml-1">Endereço da Carteira</p>
                <div
                  className="flex gap-2 p-3 rounded-2xl"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}
                >
                  <p className="flex-1 font-mono text-[11px] text-white/70 truncate self-center">{stellarAddress}</p>
                  <button
                    onClick={() => handleCopyAddress(stellarAddress)}
                    className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all',
                      copied
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25'
                    )}
                  >
                    {copied ? <Check size={18} /> : <Copy size={18} />}
                  </button>
                </div>
              </div>

              {/* Supported assets */}
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-white/50 uppercase tracking-widest ml-1">Moedas aceitas</p>
                <div className="flex gap-2">
                  {[
                    { id: 'USDC', icon: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' },
                    { id: 'USDT', icon: 'https://cryptologos.cc/logos/tether-usdt-logo.png' },
                    { id: 'XLM', icon: 'https://cryptologos.cc/logos/stellar-xlm-logo.png' },
                  ].map((asset) => (
                    <div
                      key={asset.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
                    >
                      <img src={asset.icon} alt={asset.id} className="w-4 h-4 object-contain" referrerPolicy="no-referrer" />
                      <span className="text-xs font-bold text-white/70">{asset.id}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div
              className="flex flex-col items-center gap-3 p-8 rounded-3xl text-center"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.15)' }}
            >
              <AlertCircle className="text-white/30" size={32} />
              <p className="text-sm text-white/50">Carteira Stellar não encontrada.</p>
              <p className="text-xs text-white/30">Certifique-se de que o servidor está rodando ao cadastrar.</p>
            </div>
          )}
        </motion.div>
      )}

      {/* MetaMask Tab */}
      {tab === 'metamask' && (
        <motion.div
          key="metamask"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-6 space-y-5 pb-8"
        >
          <div
            className="flex flex-col items-center gap-6 p-8 rounded-3xl"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}
          >
            {/* MetaMask logo */}
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #f6851b22, #e2761b22)', border: '1px solid #f6851b30' }}
            >
              <Wallet className="text-orange-400" size={40} />
            </div>

            {metaMaskAddress ? (
              <div className="w-full space-y-4 text-center">
                <div>
                  <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-1">Carteira Conectada</p>
                  <p className="font-mono text-sm text-white/80 break-all">{metaMaskAddress}</p>
                </div>
                <div
                  className="flex gap-3 p-4 rounded-2xl"
                  style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.20)' }}
                >
                  <AlertCircle className="text-orange-400 shrink-0 mt-0.5" size={16} />
                  <p className="text-xs text-white/60 leading-relaxed text-left">
                    Depósito via bridge ETH → Stellar em breve. Por ora, use sua carteira Stellar para enviar fundos.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  className="text-white/40 text-sm hover:text-white/60"
                  onClick={() => setMetaMaskAddress(null)}
                >
                  Desconectar
                </Button>
              </div>
            ) : (
              <div className="w-full space-y-4 text-center">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Conectar MetaMask</h3>
                  <p className="text-sm text-white/50">Conecte sua carteira Ethereum para depósitos futuros via bridge.</p>
                </div>
                <Button
                  className="w-full h-14 rounded-2xl font-bold text-base"
                  style={{ background: '#f6851b' }}
                  disabled={connecting}
                  onClick={handleConnectMetaMask}
                >
                  {connecting ? 'Conectando...' : 'Conectar MetaMask'}
                </Button>
                <button
                  className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/50 transition-colors mx-auto"
                  onClick={() => window.open('https://metamask.io', '_blank')}
                >
                  Não tem MetaMask? <ExternalLink size={11} />
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
