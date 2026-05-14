import { motion } from 'motion/react';
import {
  Globe, Zap, QrCode, Users, Link2,
  ArrowRight, Check, Terminal, Shield, Wifi, Store,
  CreditCard, BarChart3, UserPlus, ReceiptText, Wallet
} from 'lucide-react';
import { cn } from '@/lib/utils';
import GlobeCanvas from './GlobeCanvas';

interface LandingProps {
  onLogin: () => void;
  onSignup: () => void;
}

const paymentCards = [
  {
    icon: Wifi,
    title: 'NFC por Aproximação',
    body: 'Pague em terminais físicos apenas aproximando seu celular, com segurança biométrica.',
  },
  {
    icon: Users,
    title: 'Contatos do Celular',
    body: 'Sincronize sua agenda e descubra quem já usa Stellix para envios instantâneos.',
  },
  {
    icon: Globe,
    title: 'Sem Fronteiras',
    body: 'Sem taxas Swift ou demoras bancárias. O dinheiro chega antes de você terminar o café.',
  },
  {
    icon: QrCode,
    title: 'QR Code Inteligente',
    body: 'Escaneie qualquer QR code ou gere o seu para receber pagamentos na hora.',
  },
];

const steps = [
  {
    icon: UserPlus,
    title: 'Crie sua conta',
    body: 'Cadastro rápido e seguro. Em poucos minutos seu hub de pagamentos estará pronto.',
  },
  {
    icon: ReceiptText,
    title: 'Gere cobranças',
    body: 'Crie links, QR Codes ou integre via API para faturar em qualquer moeda com conversão automática.',
  },
  {
    icon: Wallet,
    title: 'Receba instantaneamente',
    body: 'Liquidação em segundos diretamente na sua carteira digital, pronta para uso ou saque.',
  },
];

const benefits = [
  {
    icon: Zap,
    title: 'Liquidez em Tempo Real',
    body: 'Diga adeus aos prazos de 30 dias. Com o Stellix, seu capital está disponível no momento da venda.',
  },
  {
    icon: Shield,
    title: 'Segurança Blockchain',
    body: 'Cada transação é imutável e protegida pela tecnologia ledger, eliminando fraudes e chargebacks.',
  },
  {
    icon: Globe,
    title: 'Alcance Global',
    body: 'Aceite pagamentos de qualquer país como se estivessem na mesma cidade que você.',
  },
  {
    icon: CreditCard,
    title: 'Taxas Reduzidas',
    body: 'Eliminamos os intermediários tradicionais, passando a economia diretamente para o seu negócio.',
  },
];

const nearbyUsers = [
  { name: '@lucas', dist: '200m', color: 'border-cyan-400', top: '20%', left: '22%', delay: '1s' },
  { name: '@maria', dist: '500m', color: 'border-purple-400', bottom: '28%', right: '18%', delay: '2.5s' },
  { name: 'Star Coffee', dist: '', color: 'border-emerald-400', top: '38%', right: '14%', delay: '0.5s', isStore: true },
  { name: 'Global Mkt', dist: '', color: 'border-emerald-400', bottom: '18%', left: '14%', delay: '3s', isStore: true },
];

export default function Landing({ onLogin, onSignup }: LandingProps) {
  return (
    <div
      className="flex flex-col overflow-y-auto no-scrollbar bg-[#070b14] text-white"
      style={{
        backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.04) 1px, transparent 0)',
        backgroundSize: '40px 40px',
      }}
    >
      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 border border-cyan-400/30">
              <Globe className="h-5 w-5 text-cyan-400" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">Stellix</span>
          </div>

          <div className="hidden items-center gap-8 md:flex">
            {['Como funciona', 'App', 'API', 'Rede'].map((item) => (
              <a key={item} href="#" className="text-sm font-medium text-zinc-400 transition-colors hover:text-cyan-300">
                {item}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onLogin}
              className="hidden px-4 py-2 text-sm font-semibold text-zinc-400 transition-colors hover:text-white sm:block"
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={onSignup}
              className="rounded-full bg-cyan-500 px-5 py-2 text-sm font-bold text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.35)] transition-all hover:brightness-110 active:scale-95"
            >
              Criar conta
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative w-full py-20">
        {/* Gradients ficam no section full-width, sem overflow-hidden */}
        <div className="pointer-events-none absolute right-0 top-0 h-[500px] w-[500px] rounded-full bg-cyan-500/12 blur-[140px]" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-indigo-600/15 blur-[120px]" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-900/20 blur-[160px]" />

        <div className="relative mx-auto flex w-full max-w-7xl flex-col items-center gap-12 px-6 md:flex-row">

        <motion.div
          className="relative z-10 md:w-1/2"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1">
            <Zap className="h-3 w-3 text-cyan-400" />
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-cyan-400">
              O futuro dos pagamentos
            </span>
          </div>

          <h1 className="mb-6 text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-[3.25rem]">
            Receba pagamentos do{' '}
            <span className="bg-gradient-to-r from-cyan-300 to-teal-300 bg-clip-text text-transparent">
              mundo inteiro
            </span>{' '}
            em segundos
          </h1>

          <p className="mb-10 max-w-lg text-lg leading-relaxed text-zinc-400">
            Conecte seu negócio à economia global com liquidação instantânea via blockchain. Sem taxas ocultas, sem fronteiras, apenas inovação.
          </p>

          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              onClick={onSignup}
              className="flex items-center gap-3 rounded-xl bg-cyan-500 px-8 py-4 text-base font-bold text-slate-950 shadow-[0_0_30px_rgba(34,211,238,0.4)] transition-all hover:brightness-110 active:scale-95"
            >
              Criar conta grátis
              <ArrowRight className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={onLogin}
              className="rounded-xl border border-white/20 bg-white/5 px-8 py-4 text-base font-bold text-white transition-all hover:bg-white/10 active:scale-95"
            >
              Já tenho conta
            </button>
          </div>
        </motion.div>

        {/* 3D Globe */}
        <motion.div
          className="relative z-10 flex items-center justify-center md:w-1/2"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15 }}
        >
          <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br from-cyan-500/15 to-blue-600/10 blur-3xl" />
          <div className="relative aspect-square w-full max-w-[520px]">
            <GlobeCanvas />
          </div>
        </motion.div>
        </div>{/* end max-w-7xl content */}
      </section>

      {/* ── Pague em qualquer lugar ────────────────────────────────────── */}
      <section className="relative overflow-hidden border-t border-white/5 bg-white/[0.015] py-24">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center gap-20 px-6 lg:flex-row">
          {/* Text + cards */}
          <div className="lg:w-1/2">
            <h2 className="mb-6 text-3xl font-bold text-white">Pague em Qualquer Lugar</h2>
            <p className="mb-10 text-lg leading-relaxed text-zinc-400">
              O Stellix transforma seu smartphone em uma ferramenta de pagamento universal. Compre no café da esquina ou envie dinheiro para amigos no outro lado do mundo.
            </p>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {paymentCards.map((card) => (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35 }}
                  className="cursor-pointer rounded-2xl border border-white/5 bg-white/[0.03] p-6 backdrop-blur-sm transition-all hover:border-cyan-400/30 hover:bg-white/[0.06]"
                >
                  <card.icon className="mb-4 h-8 w-8 text-cyan-400" strokeWidth={1.5} />
                  <h4 className="mb-2 font-bold text-white">{card.title}</h4>
                  <p className="text-sm leading-relaxed text-zinc-400">{card.body}</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Proximity map */}
          <div className="flex w-full flex-col items-center lg:w-1/2">
            <div className="mb-6 text-center">
              <span className="mb-2 inline-block rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-1 text-[11px] font-bold uppercase tracking-[0.15em] text-cyan-400">
                Novo Recurso
              </span>
              <h3 className="text-xl font-bold text-white">Mapa de Proximidade</h3>
            </div>

            <div className="relative aspect-square w-full max-w-md overflow-hidden rounded-full border-2 border-white/10 bg-white/[0.03] shadow-[0_0_50px_rgba(34,211,238,0.08)] backdrop-blur-sm">
              {/* Rings */}
              {['80%', '60%', '40%'].map((size) => (
                <div
                  key={size}
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5"
                  style={{ width: size, height: size }}
                />
              ))}

              {/* Center user */}
              <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
                <span className="absolute inset-0 h-12 w-12 animate-ping rounded-full bg-cyan-500/40" />
                <div className="relative h-12 w-12 overflow-hidden rounded-full border-2 border-cyan-400 bg-slate-900 flex items-center justify-center">
                  <span className="text-sm font-bold text-cyan-300">Eu</span>
                </div>
              </div>

              {/* Nearby entities */}
              {nearbyUsers.map((u) => (
                <div
                  key={u.name}
                  className="absolute flex flex-col items-center gap-1"
                  style={{
                    top: u.top,
                    left: u.left,
                    bottom: (u as any).bottom,
                    right: (u as any).right,
                    animation: `float 6s ease-in-out ${u.delay} infinite`,
                  }}
                >
                  <div
                    className={cn(
                      'flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 bg-slate-900 transition-transform hover:scale-110',
                      u.color
                    )}
                  >
                    {u.isStore ? (
                      <Store className="h-5 w-5 text-emerald-400" />
                    ) : (
                      <span className="text-xs font-bold text-white">{u.name.replace('@', '').slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <span className="rounded-full border border-white/10 bg-slate-900/80 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm">
                    {u.name}{u.dist ? ` • ${u.dist}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Como funciona ──────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-7xl px-6 py-20">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold text-white">Como funciona</h2>
          <p className="text-zinc-400">Três passos simples para transformar sua forma de receber.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.35 }}
              className="group cursor-pointer rounded-2xl border border-white/5 bg-white/[0.03] p-8 transition-all hover:border-cyan-400/30"
            >
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-400 transition-transform group-hover:scale-110">
                <step.icon className="h-7 w-7" strokeWidth={1.5} />
              </div>
              <h3 className="mb-3 text-xl font-bold text-white">{step.title}</h3>
              <p className="leading-relaxed text-zinc-400">{step.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Vantagens para lojistas ────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-7xl border-t border-white/5 px-6 py-24">
        <div className="flex flex-col items-center gap-16 lg:flex-row">
          <div className="lg:w-1/2">
            <h2 className="mb-8 text-3xl font-bold text-white">Vantagens que impulsionam seu faturamento</h2>
            <div className="space-y-8">
              {benefits.map((b) => (
                <motion.div
                  key={b.title}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35 }}
                  className="flex gap-4"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-500/15">
                    <Check className="h-4 w-4 text-cyan-400" />
                  </div>
                  <div>
                    <h4 className="mb-1 font-bold text-white">{b.title}</h4>
                    <p className="leading-relaxed text-zinc-400">{b.body}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Dashboard preview */}
          <div className="w-full lg:w-1/2">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-2xl backdrop-blur-sm">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-cyan-500/5 via-transparent to-transparent" />
              <div className="rounded-xl border border-white/5 bg-slate-900/80 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <p className="font-bold text-white">Dashboard do Lojista</p>
                  <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                    Ao vivo
                  </span>
                </div>
                <div className="mb-4 grid grid-cols-2 gap-3">
                  {[
                    { label: 'Receita hoje', value: '$ 1.248,00', up: true },
                    { label: 'Transações', value: '34', up: true },
                    { label: 'Taxa de conversão', value: '98,2%', up: true },
                    { label: 'Ticket médio', value: '$ 36,70', up: false },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-xl border border-white/5 bg-white/[0.04] p-4">
                      <p className="mb-1 text-[10px] text-zinc-500">{stat.label}</p>
                      <p className="text-lg font-bold text-white">{stat.value}</p>
                      <p className={cn('text-[10px] font-bold', stat.up ? 'text-emerald-400' : 'text-rose-400')}>
                        {stat.up ? '↑ +12%' : '↓ -3%'}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 rounded-xl bg-cyan-500/15 py-2.5 text-sm font-bold text-cyan-400 transition-colors hover:bg-cyan-500/25">
                    Gerar Link
                  </button>
                  <button className="flex-1 rounded-xl bg-white/5 py-2.5 text-sm font-bold text-zinc-300 transition-colors hover:bg-white/10">
                    QR Code
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── API Section ────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-7xl border-t border-white/5 px-6 py-24">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-sm md:p-12">
          <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-cyan-500/10 blur-[100px]" />
          <div className="flex flex-col items-start gap-12 md:flex-row md:items-center">
            <div className="relative z-10 md:w-1/2">
              <h2 className="mb-4 text-3xl font-bold text-white">Integre o Stellix ao seu sistema</h2>
              <p className="mb-8 leading-relaxed text-zinc-400">
                Nossa API robusta permite que desenvolvedores criem fluxos de pagamento personalizados em minutos. Documentação completa e SDKs em diversas linguagens.
              </p>
              <div className="flex flex-wrap gap-4">
                <button className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-bold text-slate-950 transition-colors hover:bg-zinc-200">
                  <Terminal className="h-4 w-4" />
                  Ver Documentação
                </button>
                <button className="rounded-xl border border-cyan-400/30 px-6 py-3 font-bold text-cyan-400 transition-colors hover:bg-cyan-400/10">
                  Obter chave de API
                </button>
              </div>
            </div>

            <div className="relative z-10 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-900 p-6 font-mono text-sm shadow-inner md:w-1/2">
              <div className="mb-4 flex gap-2">
                {['bg-red-500/50', 'bg-yellow-500/50', 'bg-emerald-500/50'].map((c) => (
                  <div key={c} className={cn('h-3 w-3 rounded-full', c)} />
                ))}
              </div>
              <pre className="overflow-x-auto text-cyan-400">
                <code>
                  <span className="text-zinc-500">{'// Initialize Stellix SDK\n'}</span>
                  {'const stellix = new Stellix(\'dp_live_...\');\n\n'}
                  <span className="text-zinc-500">{'// Create a global charge\n'}</span>
                  {'const charge = await stellix.charges.create({\n'}
                  {'  amount: 25000,\n'}
                  {'  currency: \'USD\',\n'}
                  {'  method: \'global_network\',\n'}
                  {'  description: \'Pro Service Export\'\n'}
                  {'});\n\n'}
                  {'console.log(charge.payment_url);'}
                </code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-4xl px-6 py-32 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
        >
          <h2 className="mb-6 text-4xl font-bold leading-tight text-white sm:text-5xl">
            Comece a receber pagamentos globais hoje
          </h2>
          <p className="mb-12 text-xl text-zinc-400">
            Junte-se a milhares de usuários que já modernizaram seu fluxo de capital com o app.
          </p>
          <div className="flex flex-col items-center justify-center gap-5 sm:flex-row">
            <button
              type="button"
              onClick={onSignup}
              className="rounded-full bg-cyan-500 px-10 py-5 text-lg font-bold text-slate-950 shadow-[0_0_40px_rgba(34,211,238,0.4)] transition-transform hover:scale-105"
            >
              Criar conta agora
            </button>
            <button
              type="button"
              onClick={onLogin}
              className="rounded-full border border-white/20 px-10 py-5 text-lg font-bold text-white transition-colors hover:bg-white/5"
            >
              Já tenho conta
            </button>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 bg-slate-950 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
          <div className="flex flex-col gap-1.5">
            <p className="text-lg font-bold text-zinc-200">Stellix</p>
            <p className="text-sm text-zinc-500">© 2025 Stellix. Innovation Built on Blockchain.</p>
          </div>
          <div className="flex gap-8">
            {['Documentação', 'Privacidade', 'Status', 'Contato'].map((link) => (
              <a key={link} href="#" className="text-sm text-zinc-500 transition-colors hover:text-white">
                {link}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 cursor-pointer text-zinc-500 transition-colors hover:text-cyan-400" />
            <Link2 className="h-5 w-5 cursor-pointer text-zinc-500 transition-colors hover:text-cyan-400" />
          </div>
        </div>
      </footer>
    </div>
  );
}
