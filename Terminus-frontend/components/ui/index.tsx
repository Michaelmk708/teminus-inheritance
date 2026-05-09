import clsx from "clsx";
import { ReactNode } from "react";

/* ── Badge ── */
type BadgeVariant = "success" | "warning" | "danger" | "gold";
const badgeStyles: Record<BadgeVariant, string> = {
  success: "bg-[rgba(92,156,122,0.1)]  text-[#5c9c7a] border border-[rgba(92,156,122,0.25)]",
  warning: "bg-[rgba(201,132,58,0.1)]  text-[#c9843a] border border-[rgba(201,132,58,0.25)]",
  danger:  "bg-[rgba(196,92,92,0.1)]   text-[#c45c5c] border border-[rgba(196,92,92,0.25)]",
  gold:    "bg-gold-dim text-gold-light border border-gold/25",
};

export function Badge({ variant, children }: { variant: BadgeVariant; children: ReactNode }) {
  return (
    <span className={clsx("inline-flex items-center gap-2 px-3 py-1 rounded-full font-mono text-[10px] tracking-[0.1em] uppercase", badgeStyles[variant])}>
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-dot" />
      {children}
    </span>
  );
}

/* ── Card ── */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("bg-ink-2 border border-line rounded-xl overflow-hidden", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-center justify-between px-7 py-5 border-b border-line">
      <h3 className="font-display text-lg font-medium text-cream">{title}</h3>
      {action && (
        <button onClick={onAction} className="font-mono text-[11px] uppercase tracking-[0.08em] text-gold hover:text-gold-light transition-colors">
          {action}
        </button>
      )}
    </div>
  );
}

/* ── Progress Bar ── */
type ProgressVariant = "gold" | "danger" | "warn";
const progressStyles: Record<ProgressVariant, string> = {
  gold:   "bg-gradient-to-r from-gold to-gold-light",
  danger: "bg-gradient-to-r from-[#c45c5c] to-[#e07878]",
  warn:   "bg-gradient-to-r from-[#c9843a] to-[#e8a060]",
};

export function ProgressBar({ value, variant = "gold" }: { value: number; variant?: ProgressVariant }) {
  return (
    <div className="h-1 bg-glass2 rounded-full overflow-hidden">
      <div
        className={clsx("h-full rounded-full transition-all duration-1000", progressStyles[variant])}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

/* ── Section Label ── */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-gold mb-4">{children}</p>
  );
}

/* ── Form Input ── */
export function FormInput({
  label, type = "text", placeholder, value, onChange,
}: {
  label: string; type?: string; placeholder?: string;
  value?: string; onChange?: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="font-mono text-[11px] tracking-[0.1em] uppercase text-muted">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full px-4 py-3 bg-ink border border-line2 rounded-lg text-cream text-sm font-sans placeholder:text-muted-2 outline-none focus:border-gold/40 focus:ring-2 focus:ring-gold/5 transition-all"
      />
    </div>
  );
}

/* ── Button ── */
type BtnVariant = "primary" | "ghost" | "danger" | "gold-outline";
const btnStyles: Record<BtnVariant, string> = {
  primary:      "bg-gold text-ink font-medium hover:bg-gold-light hover:shadow-[0_4px_24px_rgba(201,169,110,0.2)]",
  ghost:        "bg-transparent text-cream border border-line2 hover:border-gold/40 hover:text-gold-light",
  danger:       "bg-transparent text-[#c45c5c] border border-[#c45c5c] hover:bg-[#c45c5c] hover:text-white hover:shadow-[0_0_24px_rgba(196,92,92,0.3)]",
  "gold-outline": "bg-gold-dim text-gold-light border border-gold/30 hover:bg-[rgba(201,169,110,0.25)]",
};

export function Button({
  children, variant = "primary", onClick, disabled, full, className,
}: {
  children: ReactNode; variant?: BtnVariant;
  onClick?: () => void; disabled?: boolean; full?: boolean; className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "px-6 py-3 rounded-lg font-mono text-[11px] tracking-[0.1em] uppercase transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed",
        btnStyles[variant],
        full && "w-full",
        className
      )}
    >
      {children}
    </button>
  );
}
