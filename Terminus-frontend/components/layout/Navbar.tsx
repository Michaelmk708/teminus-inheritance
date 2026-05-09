"use client";

import { Tab } from "@/app/page";
import clsx from "clsx";

const tabs: { id: Tab; label: string }[] = [
  { id: "home",        label: "Overview"      },
  { id: "owner",       label: "Owner Vault"   },
  { id: "beneficiary", label: "Claim Portal"  },
];

interface NavbarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onLogout?: () => void;
  isLoggedIn?: boolean;
}

export default function Navbar({ activeTab, onTabChange, onLogout, isLoggedIn }: NavbarProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-12 py-4 bg-ink/85 backdrop-blur-xl border-b border-line">
      {/* Logo */}
      <button
        onClick={() => onTabChange("home")}
        className="font-display text-xl font-medium tracking-[0.12em] uppercase text-gold-light hover:opacity-80 transition-opacity"
      >
        Termin<span className="text-muted font-light">us</span>
      </button>

      {/* Tab switcher */}
      <nav className="flex gap-0.5 bg-glass border border-line rounded-full p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            className={clsx(
              "px-5 py-1.5 rounded-full font-mono text-[11px] tracking-[0.08em] uppercase transition-all duration-200",
              activeTab === t.id
                ? "bg-gold-dim text-gold-light border border-gold/25"
                : "text-muted hover:text-cream"
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Chain status + Logout */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 font-mono text-[11px] text-muted tracking-[0.06em]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#5c9c7a] shadow-[0_0_8px_#5c9c7a] animate-pulse-dot" />
          Solana Mainnet
        </div>
        {isLoggedIn && onLogout && (
          <button
            onClick={onLogout}
            className="font-mono text-[11px] text-muted hover:text-[#c45c5c] transition-colors tracking-[0.06em] px-3 py-1 rounded hover:bg-[rgba(196,92,92,0.1)]"
          >
            Logout
          </button>
        )}
      </div>
    </header>
  );
}
