import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Zap, QrCode, Users, ArrowRight, Wifi, MapPin, Store, Shield, Check, MessageCircle, Trophy, ExternalLink, Globe, CheckCircle2, DollarSign, Radar, Smartphone } from 'lucide-react';
import GlobeCanvas from '../GlobeCanvas';
import { cn } from '@/lib/utils';

interface Props {
  onSignup: () => void;
  onLogin: () => void;
  onGoTo: (page: string) => void;
}

const howItWorks = [
  {
    num: '01',
    title: 'Crie sua conta em 2 minutos',
    body: 'Sem burocracia, sem documentos. Só nome, e-mail e senha.',
  },
  {
    num: '02',
    title: 'Escolha como pagar',
    body: 'Busque um contato da agenda, escaneie um QR Code ou chegue perto e pronto.',
  },
  {
    num: '03',
    title: 'O dinheiro chega na hora',
    body: 'Em qualquer lugar do mundo, sem taxas escondidas, sem esperar dias.',
  },
];

const features = [
  {
    icon: Users,
    title: 'Mande pelo contato',
    body: 'Igual mandar uma mensagem. Encontre o contato na sua agenda e mande o valor. Simples assim.',
    color: 'text-cyan-400',
    bg: 'bg-cyan-400/10 border-cyan-400/20',
  },
  {
    icon: QrCode,
    title: 'Escaneie ou mostre o QR',
    body: 'Pague no café, na loja, num evento. Só apontar a câmera e confirmar.',
    color: 'text-indigo-400',
    bg: 'bg-indigo-400/10 border-indigo-400/20',
  },
  {
    icon: Wifi,
    title: 'Pague por aproximação',
    body: 'Deixe o cartão em casa. Chegue perto do terminal e o pagamento acontece com segurança biométrica.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10 border-emerald-400/20',
  },
  {
    icon: MapPin,
    title: 'Ache quem está perto',
    body: 'Veja usuários e lojas Stellix a sua volta no mapa e mande ou receba direto, sem precisar do contato salvo.',
    color: 'text-violet-400',
    bg: 'bg-violet-400/10 border-violet-400/20',
  },
];

const nearbyUsers = [
  { name: '@lucas', dist: '200m', color: 'border-cyan-400', style: { top: '18%', left: '20%' }, delay: '1s' },
  { name: '@maria', dist: '450m', color: 'border-purple-400', style: { bottom: '26%', right: '16%' }, delay: '2.5s' },
  { name: 'Star Coffee', color: 'border-emerald-400', style: { top: '38%', right: '12%' }, delay: '0.5s', isStore: true },
  { name: 'Padaria', color: 'border-emerald-400', style: { bottom: '18%', left: '12%' }, delay: '3s', isStore: true },
];

type SendMockupKind = 'qr' | 'contact' | 'nfc' | 'nearby';

interface SendFlow {
  kind: SendMockupKind;
  title: string;
  label: string;
  description: string;
  recipient: string;
  handle: string;
  amount: string;
  currency: string;
  accent: string;
  icon: typeof QrCode;
}

const sendFlows: SendFlow[] = [
  {
    kind: 'qr',
    title: 'Escaneie um QR Code',
    label: 'QR payment',
    description: 'Aponte a camera, confira o perfil de quem vai receber e confirme o envio em dolar digital.',
    recipient: 'Nina Coffee',
    handle: '@ninacoffee',
    amount: '$18.50',
    currency: 'USDC',
    accent: 'cyan',
    icon: QrCode,
  },
  {
    kind: 'contact',
    title: 'Envie por contato',
    label: 'Contact transfer',
    description: 'Escolha alguem da agenda, defina o valor em dolar e envie em segundos.',
    recipient: 'Marina Costa',
    handle: '@marina',
    amount: '$42.00',
    currency: 'USDC',
    accent: 'indigo',
    icon: Users,
  },
  {
    kind: 'nfc',
    title: 'Pague por NFC',
    label: 'Tap to pay',
    description: 'Aproxime o celular do terminal, valide o valor e conclua o pagamento em tempo real.',
    recipient: 'Rio Market',
    handle: 'Terminal #042',
    amount: '$9.90',
    currency: 'USDC',
    accent: 'emerald',
    icon: Smartphone,
  },
  {
    kind: 'nearby',
    title: 'Envie para quem esta proximo',
    label: 'Nearby users',
    description: 'Encontre pessoas e lojas ao redor, selecione o perfil certo e envie sem trocar chaves.',
    recipient: 'Lucas Silva',
    handle: '120m de distancia',
    amount: '$25.00',
    currency: 'USDC',
    accent: 'violet',
    icon: Radar,
  },
];

const flowSteps = ['scan', 'confirm', 'success'] as const;

function MockQr() {
  return (
    <div className="grid h-28 w-28 grid-cols-5 grid-rows-5 gap-1 rounded-2xl bg-white p-3">
      {Array.from({ length: 25 }).map((_, i) => {
        const filled = [0, 1, 2, 5, 7, 10, 11, 12, 18, 20, 21, 23, 24, 4, 9, 14, 16].includes(i);
        return <span key={i} className={cn('rounded-[3px]', filled ? 'bg-slate-950' : 'bg-slate-200')} />;
      })}
    </div>
  );
}

function PhoneSendMockup({ flow }: { flow: SendFlow }) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = flowSteps[stepIndex];
  const Icon = flow.icon;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStepIndex((current) => (current + 1) % flowSteps.length);
    }, 2200);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setStepIndex(0);
  }, [flow.kind]);

  return (
    <div className="relative mx-auto w-full max-w-[310px]">
      <div className="absolute -inset-6 rounded-[2.5rem] bg-cyan-500/10 blur-3xl" />
      <div className="relative rounded-[2.2rem] border border-white/15 bg-slate-950 p-3 shadow-2xl shadow-black/40">
        <div className="overflow-hidden rounded-[1.7rem] border border-white/10 bg-[#07101c]">
          <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400/10">
                <DollarSign className="h-4 w-4 text-cyan-300" />
              </div>
              <span className="text-sm font-bold text-white">Stellix Pay</span>
            </div>
            <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-bold text-emerald-300">Live</span>
          </div>

          <div className="min-h-[420px] p-5">
            <div className="mb-5 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">{flow.label}</span>
              <span className="text-xs font-semibold text-zinc-400">{stepIndex + 1}/3</span>
            </div>

            <motion.div
              key={`${flow.kind}-${step}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="flex min-h-[330px] flex-col"
            >
              {step === 'scan' && (
                <div className="flex flex-1 flex-col items-center justify-center text-center">
                  <div className="relative mb-8 flex h-44 w-44 items-center justify-center rounded-[2rem] border border-cyan-400/20 bg-cyan-400/5">
                    {flow.kind === 'qr' && <MockQr />}
                    {flow.kind === 'contact' && (
                      <div className="grid grid-cols-2 gap-3">
                        {['MA', 'LC', 'AN', 'RJ'].map((initials, i) => (
                          <div key={initials} className={cn('flex h-16 w-16 items-center justify-center rounded-2xl border text-sm font-black', i === 0 ? 'border-cyan-300 bg-cyan-300/15 text-cyan-100' : 'border-white/10 bg-white/5 text-zinc-400')}>
                            {initials}
                          </div>
                        ))}
                      </div>
                    )}
                    {flow.kind === 'nfc' && (
                      <div className="relative flex h-28 w-28 items-center justify-center">
                        <span className="absolute h-28 w-28 animate-ping rounded-full border border-emerald-300/30" />
                        <span className="absolute h-20 w-20 rounded-full border border-emerald-300/20" />
                        <Smartphone className="h-14 w-14 text-emerald-300" />
                      </div>
                    )}
                    {flow.kind === 'nearby' && (
                      <div className="relative h-36 w-36">
                        {['90%', '65%', '38%'].map(size => (
                          <span key={size} className="absolute left-1/2 top-1/2 rounded-full border border-violet-300/20" style={{ width: size, height: size, transform: 'translate(-50%, -50%)' }} />
                        ))}
                        <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-violet-300 text-xs font-black text-slate-950">You</span>
                        <span className="absolute right-3 top-6 flex h-10 w-10 items-center justify-center rounded-full border border-violet-300 bg-slate-900 text-xs font-bold text-white">LS</span>
                      </div>
                    )}
                    <motion.span
                      className="absolute left-5 right-5 h-0.5 bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,0.9)]"
                      animate={{ top: ['18%', '82%', '18%'] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </div>
                  <h4 className="mb-2 text-xl font-bold text-white">{flow.title}</h4>
                  <p className="text-sm leading-relaxed text-zinc-400">Detectando recebedor e preparando transacao em USDC.</p>
                </div>
              )}

              {step === 'confirm' && (
                <div className="flex flex-1 flex-col">
                  <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-300/10 text-lg font-black text-cyan-100">
                      {flow.recipient.slice(0, 2).toUpperCase()}
                    </div>
                    <h4 className="text-xl font-bold text-white">{flow.recipient}</h4>
                    <p className="text-sm text-zinc-500">{flow.handle}</p>
                  </div>
                  <div className="mb-5 rounded-2xl border border-white/10 bg-slate-900/70 p-5">
                    <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">Valor</p>
                    <div className="flex items-end justify-between">
                      <span className="text-4xl font-black text-white">{flow.amount}</span>
                      <span className="mb-1 rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-200">{flow.currency}</span>
                    </div>
                  </div>
                  <button className="mt-auto flex h-14 items-center justify-center rounded-2xl bg-cyan-400 px-5 py-4 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.25)]">
                    Confirmar envio
                  </button>
                </div>
              )}

              {step === 'success' && (
                <div className="flex flex-1 flex-col items-center justify-center text-center">
                  <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-300/10">
                    <CheckCircle2 className="h-12 w-12 text-emerald-300" />
                  </div>
                  <h4 className="mb-2 text-2xl font-black text-white">Enviado com sucesso</h4>
                  <p className="mb-6 max-w-[220px] text-sm leading-relaxed text-zinc-400">
                    {flow.amount} em {flow.currency} chegou para {flow.recipient} em tempo real.
                  </p>
                  <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-left">
                    <p className="text-xs font-bold text-emerald-200">Liquidado na Stellar</p>
                    <p className="text-[11px] text-emerald-100/60">Tempo estimado: 3.2s</p>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SendFlowShowcase() {
  return (
    <section className="border-t border-white/5 bg-white/[0.012] py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 max-w-2xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/8 px-3 py-1.5">
            <Zap className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-cyan-400">Real-time dollar payments</span>
          </div>
          <h2 className="mb-4 text-3xl font-bold leading-tight text-white md:text-4xl">
            Quatro formas de enviar dolar digital em segundos
          </h2>
          <p className="text-lg leading-relaxed text-zinc-400">
            Mockups do fluxo principal: identificar o recebedor, confirmar o valor em USDC e concluir a transferencia em tempo real.
          </p>
        </div>

        <div className="space-y-16">
          {sendFlows.map((flow, index) => {
            const Icon = flow.icon;
            const reverse = index % 2 === 1;
            return (
              <motion.div
                key={flow.kind}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-120px' }}
                transition={{ duration: 0.45 }}
                className={cn(
                  'grid items-center gap-10 lg:grid-cols-2',
                  reverse && 'lg:[&>*:first-child]:order-2'
                )}
              >
                <div>
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                    <Icon className="h-6 w-6 text-cyan-300" />
                  </div>
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.15em] text-cyan-400">{flow.label}</p>
                  <h3 className="mb-4 text-3xl font-bold text-white">{flow.title}</h3>
                  <p className="mb-7 max-w-xl leading-relaxed text-zinc-400">{flow.description}</p>
                  <div className="grid max-w-xl gap-3 sm:grid-cols-3">
                    {['Identificar', 'Confirmar', 'Enviado'].map((step, i) => (
                      <div key={step} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                        <p className="mb-1 text-xs font-black text-white/30">0{i + 1}</p>
                        <p className="text-sm font-bold text-white">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <PhoneSendMockup flow={flow} />
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function MarketingHome({ onSignup, onLogin, onGoTo }: Props) {
  return (
    <div>
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative w-full py-20 md:py-28">
        <div className="pointer-events-none absolute right-0 top-0 h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-[150px]" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-indigo-600/12 blur-[120px]" />
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-cyan-900/15 blur-[160px]" />

        <div className="relative mx-auto flex w-full max-w-7xl flex-col items-center gap-10 px-6 md:flex-row md:gap-16">
          <motion.div
            className="z-10 flex-1"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/8 px-3 py-1.5">
              <Zap className="h-3 w-3 text-cyan-400" />
              <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-cyan-400">Pagamentos sem fronteiras</span>
            </div>

            <h1 className="mb-5 text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-[3.4rem]">
              Mande dinheiro digital<br />
              <span className="bg-gradient-to-r from-cyan-300 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                como uma mensagem
              </span>
            </h1>

            <p className="mb-4 max-w-lg text-lg leading-relaxed text-zinc-400">
              Sem chaves complicadas. Sem esperar dias. Só o contato da agenda, um QR Code ou a aproximação do celular.
            </p>
            <p className="mb-10 max-w-lg text-base leading-relaxed text-zinc-500">
              O dinheiro chega na hora, em qualquer lugar do mundo — em dólar digital, estável e sem surpresas.
            </p>

            <div className="flex flex-wrap gap-4">
              <button
                onClick={onSignup}
                className="flex items-center gap-2.5 rounded-xl bg-cyan-500 px-8 py-4 text-base font-bold text-slate-950 shadow-[0_0_30px_rgba(34,211,238,0.4)] transition-all hover:brightness-110 active:scale-95"
              >
                Criar conta grátis
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={onLogin}
                className="rounded-xl border border-white/20 bg-white/5 px-8 py-4 text-base font-bold text-white transition-all hover:bg-white/10 active:scale-95"
              >
                Já tenho conta
              </button>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="https://t.me/+r6EXFIDI99M4NWYx"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-sky-400/25 bg-sky-400/10 px-4 py-2 text-sm font-semibold text-sky-200 transition-colors hover:bg-sky-400/15"
              >
                <MessageCircle className="h-4 w-4" />
                Comunidade no Telegram
              </a>
              <a
                href="https://livecoins.com.br/stellar-37-graus-chega-ao-rio-de-janeiro-com-premiacao-inicial-20-mil-em-usdc-para-startups/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-200 transition-colors hover:bg-amber-400/15"
              >
                <Trophy className="h-4 w-4" />
                Hackathon Stellar 37 Graus
              </a>
            </div>
          </motion.div>

          <motion.div
            className="relative z-10 flex w-full items-center justify-center md:w-[480px] md:shrink-0"
            initial={{ opacity: 0, scale: 0.93 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15 }}
          >
            <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br from-cyan-500/12 to-blue-600/8 blur-3xl" />
            <div className="aspect-square w-full max-w-[480px]">
              <GlobeCanvas />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Stellar / Hackathon ─────────────────────────────────────────── */}
      <section className="border-t border-white/5 bg-white/[0.015] py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="rounded-2xl border border-white/8 bg-white/[0.03] p-8"
            >
              <div className="mb-5 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white">
                  <img src="/stellar-mark.svg" alt="Stellar" className="h-7 w-7 invert" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-cyan-400">Built on Stellar</p>
                  <h2 className="text-2xl font-bold text-white">Infraestrutura global para dinheiro digital</h2>
                </div>
              </div>
              <p className="max-w-3xl leading-relaxed text-zinc-400">
                A Stellix Pay usa a rede Stellar para liquidar pagamentos globais em segundos, com USDC e taxas baixas, deixando a experiência simples para pessoas e empresas.
              </p>
            </motion.div>

            <motion.a
              href="https://livecoins.com.br/stellar-37-graus-chega-ao-rio-de-janeiro-com-premiacao-inicial-20-mil-em-usdc-para-startups/"
              target="_blank"
              rel="noreferrer"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="group rounded-2xl border border-amber-400/20 bg-amber-400/10 p-8 transition-colors hover:bg-amber-400/15"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-amber-400/25 bg-amber-400/10">
                <Trophy className="h-6 w-6 text-amber-300" />
              </div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.15em] text-amber-300">Stellar 37 Graus</p>
              <h3 className="mb-3 text-2xl font-bold text-white">Estamos concorrendo no hackathon</h3>
              <p className="mb-5 text-sm leading-relaxed text-zinc-300">
                O programa Stellar 37 Graus chega ao Rio de Janeiro com premiação inicial de US$ 20 mil em USDC para startups.
              </p>
              <span className="inline-flex items-center gap-2 text-sm font-bold text-amber-200">
                Ler matéria na Livecoins
                <ExternalLink className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </motion.a>
          </div>
        </div>
      </section>

      {/* ── Como funciona ────────────────────────────────────────────────── */}
      <section className="border-t border-white/5 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-14 text-center">
            <h2 className="mb-3 text-3xl font-bold text-white">É simples de verdade</h2>
            <p className="text-zinc-500">Três passos e o dinheiro já foi.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {howItWorks.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.35 }}
                className="relative rounded-2xl border border-white/8 bg-white/[0.03] p-8"
              >
                <p className="mb-4 text-5xl font-black text-white/5">{step.num}</p>
                <h3 className="mb-2 text-lg font-bold text-white">{step.title}</h3>
                <p className="text-sm leading-relaxed text-zinc-400">{step.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sobre ────────────────────────────────────────────────────────── */}
      <section className="border-t border-white/5 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-400/25 bg-indigo-400/8 px-3 py-1.5">
                <Globe className="h-3.5 w-3.5 text-indigo-400" />
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-indigo-400">Sobre a Stellix Pay</span>
              </div>
              <h2 className="mb-5 text-3xl font-bold leading-tight text-white md:text-4xl">
                Pagamentos globais sem fronteiras e sem complexidade
              </h2>
              <div className="space-y-4 leading-relaxed text-zinc-400">
                <p>
                  A Stellix Pay nasceu para transformar pagamentos internacionais em uma experiência direta: enviar, receber e pagar em dólar digital com a mesma facilidade de mandar uma mensagem.
                </p>
                <p>
                  A tecnologia por trás é blockchain, mas o produto foi desenhado para esconder a complexidade. O usuário vê contatos, QR Codes, pagamentos por aproximação e saldo; a Stellar cuida da liquidação rápida e auditável.
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="grid gap-4 sm:grid-cols-2"
            >
              {[
                { title: 'Missão', body: 'Dar acesso simples a dinheiro digital global para pessoas e empresas.' },
                { title: 'Rede', body: 'Construída sobre Stellar para liquidação rápida, barata e transparente.' },
                { title: 'Produto', body: 'Contatos, QR Code, aproximação e API em uma única experiência.' },
                { title: 'Comunidade', body: 'Acompanhe o beta, novidades e convites pelo nosso Telegram.' },
              ].map(item => (
                <div key={item.title} className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
                  <h3 className="mb-2 font-bold text-white">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-zinc-400">{item.body}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Formas de pagar ──────────────────────────────────────────────── */}
      <section className="border-t border-white/5 bg-white/[0.015] py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-14 max-w-xl">
            <h2 className="mb-3 text-3xl font-bold text-white">Do jeito que for mais fácil</h2>
            <p className="text-zinc-400">
              Escolha como quer pagar ou receber. Tudo no mesmo app, tudo na hora.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.35 }}
                className={cn('rounded-2xl border p-6 transition-all hover:border-white/20', f.bg)}
              >
                <div className={cn('mb-4 flex h-11 w-11 items-center justify-center rounded-xl border bg-black/20', f.bg)}>
                  <f.icon className={cn('h-5 w-5', f.color)} strokeWidth={1.5} />
                </div>
                <h3 className="mb-2 font-bold text-white">{f.title}</h3>
                <p className="text-sm leading-relaxed text-zinc-400">{f.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <SendFlowShowcase />

      {/* ── Mapa de proximidade ──────────────────────────────────────────── */}
      <section className="border-t border-white/5 py-20">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-16 px-6 lg:flex-row">
          <div className="flex-1">
            <h2 className="mb-4 text-3xl font-bold text-white">Pague quem está perto de você</h2>
            <p className="mb-6 max-w-md text-lg leading-relaxed text-zinc-400">
              Abriu o app, viu o café do lado aceitando Stellix — só clicar e pagar. Sem pedir o contato, sem digitar nada.
            </p>
            <ul className="space-y-3">
              {['Encontre usuários e lojas próximos no mapa','Mande ou receba sem precisar do contato salvo','Lojas recebem em tempo real, sem maquininha'].map(t => (
                <li key={t} className="flex items-center gap-3 text-sm text-zinc-300">
                  <Check className="h-4 w-4 shrink-0 text-cyan-400" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex w-full max-w-md flex-col items-center lg:w-auto">
            <div className="relative aspect-square w-full overflow-hidden rounded-full border-2 border-white/10 bg-white/[0.02] shadow-[0_0_60px_rgba(34,211,238,0.07)] backdrop-blur">
              {['80%','60%','40%'].map(s => (
                <div key={s} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5" style={{width:s,height:s}} />
              ))}
              <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
                <span className="absolute inset-0 h-12 w-12 animate-ping rounded-full bg-cyan-500/30" />
                <div className="relative flex h-12 w-12 items-center justify-center rounded-full border-2 border-cyan-400 bg-slate-900">
                  <span className="text-xs font-bold text-cyan-300">Eu</span>
                </div>
              </div>
              {nearbyUsers.map(u => (
                <div key={u.name} className="absolute flex flex-col items-center gap-1" style={{...u.style, animation:`float 6s ease-in-out ${u.delay} infinite`}}>
                  <div className={cn('flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-2 bg-slate-900 transition-transform hover:scale-110', u.color)}>
                    {u.isStore ? <Store className="h-5 w-5 text-emerald-400" /> : <span className="text-xs font-bold text-white">{u.name.replace('@','').slice(0,2).toUpperCase()}</span>}
                  </div>
                  <span className="rounded-full border border-white/10 bg-slate-900/80 px-2 py-0.5 text-[10px] text-white backdrop-blur">
                    {u.name}{u.dist ? ` • ${u.dist}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Segurança (sem jargão) ───────────────────────────────────────── */}
      <section className="border-t border-white/5 bg-white/[0.015] py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-start gap-6 rounded-2xl border border-white/8 bg-white/[0.03] p-8 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 border border-emerald-400/20">
                <Shield className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="mb-1 font-bold text-white">Seu dinheiro protegido</h3>
                <p className="max-w-lg text-sm leading-relaxed text-zinc-400">
                  Autenticação em duas etapas, confirmação biométrica nos pagamentos e registro imutável de cada transação. Você foca no que importa — a gente cuida da segurança.
                </p>
              </div>
            </div>
            <div className="shrink-0 text-sm font-semibold text-emerald-400">✓ Protegido</div>
          </div>
        </div>
      </section>

      {/* ── Teaser para empresas ─────────────────────────────────────────── */}
      <section className="border-t border-white/5 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="relative overflow-hidden rounded-3xl border border-cyan-400/15 bg-gradient-to-br from-cyan-950/40 via-slate-900/60 to-indigo-950/40 p-10 md:p-14"
          >
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-cyan-500/10 blur-[80px]" />
            <div className="relative z-10 flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
              <div className="max-w-xl">
                <span className="mb-4 inline-block rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.15em] text-cyan-400">
                  Para empresas e lojistas
                </span>
                <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl">
                  Receba de clientes do mundo todo em tempo real
                </h2>
                <p className="mb-6 text-zinc-400">
                  Dashboard completo, links de pagamento, QR Code de cobrança, gateway de API e muito mais. Sem esperar D+2, sem taxa oculta, sem burocracia.
                </p>
                <ul className="space-y-2">
                  {[
                    'Recebimento instantâneo, sem prazo',
                    'Gere links e QR Codes de cobrança em segundos',
                    'Aceite de qualquer país como se fosse na esquina',
                    'Integre ao seu sistema via API REST',
                  ].map(item => (
                    <li key={item} className="flex items-center gap-2.5 text-sm text-zinc-300">
                      <Check className="h-4 w-4 shrink-0 text-cyan-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="shrink-0">
                <button
                  onClick={() => onGoTo('empresas')}
                  className="flex items-center gap-3 rounded-xl bg-cyan-500 px-8 py-4 text-base font-bold text-slate-950 shadow-[0_0_30px_rgba(34,211,238,0.35)] transition-all hover:brightness-110 active:scale-95"
                >
                  Ver recursos para empresas
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA final ────────────────────────────────────────────────────── */}
      <section className="border-t border-white/5 py-28 text-center">
        <div className="mx-auto max-w-3xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="mb-5 text-4xl font-bold text-white sm:text-5xl">
              Comece agora. É grátis.
            </h2>
            <p className="mb-10 text-xl text-zinc-400">
              Crie sua conta em 2 minutos e mande seu primeiro pagamento hoje.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button
                onClick={onSignup}
                className="rounded-full bg-cyan-500 px-10 py-5 text-lg font-bold text-slate-950 shadow-[0_0_40px_rgba(34,211,238,0.4)] transition-transform hover:scale-105"
              >
                Criar conta grátis
              </button>
              <button
                onClick={onLogin}
                className="rounded-full border border-white/20 px-10 py-5 text-lg font-bold text-white transition-colors hover:bg-white/5"
              >
                Já tenho conta
              </button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
