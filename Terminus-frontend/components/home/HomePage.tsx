"use client";

import { Tab } from "@/app/page";
import { Button, SectionLabel } from "@/components/ui";

const features = [
  {
    icon: "🔐",
    title: "Cryptographic Vault",
    desc: "Rust smart contracts on Solana hold your assets in mathematically unhackable escrow. No single point of failure, no third-party custody.",
  },
  {
    icon: "⚖️",
    title: "AI Verification",
    desc: "Context-aware AI reads death certificates via OCR and generates Zero-Knowledge proofs — so no private data ever touches the blockchain.",
  },
  {
    icon: "🛡️",
    title: "30-Day Failsafe",
    desc: "A mandatory challenge period with aggressive alerts ensures you can abort any false trigger with one click of the Panic Button.",
  },
  {
    icon: "💊",
    title: "Living Will",
    desc: "A separate Incapacitated state unlocks a monthly medical allowance directly to hospital wallets if you enter a coma — without liquidating your vault.",
  },
  {
    icon: "📧",
    title: "Walletless Access",
    desc: "Beneficiaries access their inheritance through a simple email and PIN. No seed phrases, no gas fees, no blockchain knowledge required.",
  },
  {
    icon: "🌍",
    title: "KICA Compliant",
    desc: "Structured as an Inter Vivos Trust to legally bypass probate courts. Built for Kenya's top-5 global crypto adoption, scalable globally.",
  },
];

const stats = [
  { n: "$2.5T", l: "Crypto Market" },
  { n: "20%",   l: "Keys Lost Forever" },
  { n: "1%",    l: "Execution Fee" },
];

interface HomePageProps {
  onNavigate: (tab: Tab) => void;
}

export default function HomePage({ onNavigate }: HomePageProps) {
  return (
    <div>
      {/* ── Hero ── */}
      <section className="relative min-h-[calc(100vh-72px)] flex flex-col items-center justify-center text-center px-12 py-20 overflow-hidden">
        {/* Grid bg */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(201,169,110,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(201,169,110,0.04) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
            maskImage: "radial-gradient(ellipse 80% 70% at 50% 50%, black, transparent)",
          }}
        />
        {/* Radial orb */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(201,169,110,0.06) 0%, transparent 65%)" }}
        />

        <p className="animate-fade-up delay-200 font-mono text-[10px] tracking-[0.3em] uppercase text-gold mb-6 opacity-0">
          Decentralized Digital Inheritance Protocol
        </p>

        <h1 className="animate-fade-up delay-400 font-display font-light leading-tight text-cream mb-3 opacity-0"
          style={{ fontSize: "clamp(56px, 8vw, 96px)" }}>
          Your legacy,<br />
          <em className="italic text-gold-light">immutably</em> secured
        </h1>

        <p className="animate-fade-up delay-600 font-display font-light text-muted mb-12 opacity-0"
          style={{ fontSize: "clamp(18px, 2.5vw, 26px)" }}>
          Where cryptographic certainty meets human empathy.
        </p>

        <div className="animate-fade-up delay-800 flex gap-4 mb-20 opacity-0">
          <Button variant="primary" onClick={() => onNavigate("owner")}>
            Create Your Vault
          </Button>
          <Button variant="ghost" onClick={() => onNavigate("beneficiary")}>
            Claim Inheritance
          </Button>
        </div>

        {/* Stats */}
        <div className="animate-fade-up delay-1000 flex items-center gap-16 opacity-0">
          {stats.map((s, i) => (
            <div key={s.l} className="flex items-center gap-16">
              <div className="text-center">
                <span className="font-display text-4xl font-normal text-gold-light block">{s.n}</span>
                <span className="font-mono text-[11px] tracking-[0.12em] uppercase text-muted">{s.l}</span>
              </div>
              {i < stats.length - 1 && <div className="w-px h-10 bg-line" />}
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="max-w-6xl mx-auto px-12 py-28">
        <SectionLabel>Why Terminus</SectionLabel>
        <h2 className="font-display font-light text-cream mb-16 leading-tight"
          style={{ fontSize: "clamp(32px, 4vw, 52px)" }}>
          The smart vault with an <em className="italic text-gold-light">AI Lawyer</em>
        </h2>

        <div className="grid grid-cols-3 gap-px bg-line border border-line rounded-xl overflow-hidden">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-ink-2 p-10 hover:bg-ink-3 transition-colors duration-300 group relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="w-11 h-11 flex items-center justify-center text-xl border border-line2 rounded-lg bg-glass mb-6">
                {f.icon}
              </div>
              <h3 className="font-display text-xl font-medium text-cream mb-3">{f.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="flex items-center justify-between px-12 py-10 border-t border-line">
        <span className="font-display text-base font-light tracking-[0.12em] uppercase text-muted">Terminus</span>
        <span className="font-mono text-[11px] text-muted-2">
          Solana · Lit Protocol · Storacha · ZK-Proofs
        </span>
        <span className="font-mono text-[11px] text-muted-2">Block Four — Nairobi, Kenya</span>
      </footer>
    </div>
  );
}
