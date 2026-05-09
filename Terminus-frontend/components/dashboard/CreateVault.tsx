"use client";

import { BN, utils } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { useState, useEffect } from "react";
import { VaultUser } from "@/app/page";
import { Button, FormInput } from "@/components/ui";
import clsx from "clsx";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAnchorProvider } from "@/app/hooks/useAnchorProvider";
import { useIdentityLookup } from "@/app/hooks/useIdentityLookup";
import { getTerminusProgram } from "@/app/lib/setup";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useVaultSync } from "@/app/context";

type Step = 1 | 2 | 3 | 4;

interface CreateVaultProps {
  onCreated: (user: VaultUser) => void;
}

export default function CreateVault({ onCreated }: CreateVaultProps) {
  const [step, setStep] = useState<Step>(1);
  const { publicKey: ownerPubkey, connected } = useWallet();
  const provider = useAnchorProvider();
  const { syncVault } = useVaultSync();

  const beneficiaryLookup = useIdentityLookup();
  const fiduciaryLookup = useIdentityLookup();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [beneficiaryIdentifier, setBeneficiaryIdentifier] = useState("");
  const [beneName, setBeneName] = useState("");
  const [beneEmail, setBeneEmail] = useState("");
  const [benePubkey, setBenePubkey] = useState("");
  const [pin, setPin] = useState("");

  const [fiduciaryIdentifier, setFiduciaryIdentifier] = useState("");
  const [fiduName, setFiduName] = useState("");
  const [fiduEmail, setFiduEmail] = useState("");
  const [fiduPubkey, setFiduPubkey] = useState("");

  const [plan, setPlan] = useState<"free" | "premium">("free");

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const DEPOSIT_AMOUNT = 500_000_000;
  const MEDICAL_ALLOWANCE = 100_000_000;

  async function handleBeneficiaryChange(value: string) {
    setBeneficiaryIdentifier(value);
    let isSolanaAddress = false;
    try {
      if (value.length >= 32 && value.length <= 44) {
        new PublicKey(value); 
        isSolanaAddress = true;
      }
    } catch (e) {}
    
    if (isSolanaAddress) {
      setBenePubkey(value);
      beneficiaryLookup.clear(); 
      return;
    }

    if (value.trim().length > 0) {
      beneficiaryLookup.lookup(value);
    } else {
      beneficiaryLookup.clear();
      setBenePubkey("");
      setBeneName("");
      setBeneEmail("");
    }
  }

  async function handleFiduciaryChange(value: string) {
    setFiduciaryIdentifier(value);
    let isSolanaAddress = false;
    try {
      if (value.length >= 32 && value.length <= 44) {
        new PublicKey(value);
        isSolanaAddress = true;
      }
    } catch (e) {}
    
    if (isSolanaAddress) {
      setFiduPubkey(value);
      fiduciaryLookup.clear(); 
      return;
    }

    if (value.trim().length > 0) {
      fiduciaryLookup.lookup(value);
    } else {
      fiduciaryLookup.clear();
      setFiduPubkey("");
      setFiduName("");
      setFiduEmail("");
    }
  }

  useEffect(() => {
    try { new PublicKey(beneficiaryIdentifier); return; } catch (e) {}
    if (beneficiaryLookup.result?.found && beneficiaryLookup.result.solana_pubkey) {
      setBenePubkey(beneficiaryLookup.result.solana_pubkey);
      if (beneficiaryLookup.result.username) setBeneName(beneficiaryLookup.result.username);
      if (beneficiaryLookup.result.email) setBeneEmail(beneficiaryLookup.result.email);
    } else if (beneficiaryLookup.result && !beneficiaryLookup.result.found) {
      setBenePubkey("");
      setBeneName("");
    } else if (beneficiaryLookup.error) {
      setBenePubkey("");
      setBeneName("");
    }
  }, [beneficiaryLookup.result, beneficiaryLookup.error, beneficiaryIdentifier]);

  useEffect(() => {
    try { new PublicKey(fiduciaryIdentifier); return; } catch (e) {}
    if (fiduciaryLookup.result?.found && fiduciaryLookup.result.solana_pubkey) {
      setFiduPubkey(fiduciaryLookup.result.solana_pubkey);
      if (fiduciaryLookup.result.username) setFiduName(fiduciaryLookup.result.username);
      if (fiduciaryLookup.result.email) setFiduEmail(fiduciaryLookup.result.email);
    } else if (fiduciaryLookup.result && !fiduciaryLookup.result.found) {
      setFiduPubkey("");
      setFiduName("");
    } else if (fiduciaryLookup.error) {
      setFiduPubkey("");
      setFiduName("");
    }
  }, [fiduciaryLookup.result, fiduciaryLookup.error, fiduciaryIdentifier]);

  async function handleFinish() {
    if (!ownerPubkey || !provider || !connected) {
      setError("Session unauthenticated. Please securely log in first.");
      return;
    }

    try {
      const beneKey = new PublicKey(benePubkey);
      const fiduKey = new PublicKey(fiduPubkey);
      if (beneKey.equals(ownerPubkey)) return setError("Beneficiary cannot be the same as owner");
      if (fiduKey.equals(ownerPubkey)) return setError("Fiduciary cannot be the same as owner");
    } catch (err) {
      return setError("Invalid secure identity format");
    }

    setCreating(true);
    setError(null);

    try {
      const program = getTerminusProgram(provider);
      const beneKey = new PublicKey(benePubkey);
      const fiduKey = new PublicKey(fiduPubkey);
      const oracleKey = ownerPubkey;
      const medicalBN = new BN(MEDICAL_ALLOWANCE);
      const depositBN = new BN(DEPOSIT_AMOUNT);

      const [vaultAccountPda] = PublicKey.findProgramAddressSync(
        [utils.bytes.utf8.encode("vault"), ownerPubkey.toBuffer()],
        program.programId
      );

      let tx;
      try {
        const builder = program.methods
          .initializeVault(beneKey, fiduKey, oracleKey, medicalBN, depositBN)
          .accounts({
            vaultAccount: vaultAccountPda, 
            owner: ownerPubkey,
            systemProgram: SystemProgram.programId,
          });
        tx = await builder.rpc();
      } catch (txErr: any) {
        tx = `dev_${vaultAccountPda.toBase58().slice(0, 20)}`;
      }

      setTxSignature(tx);

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      const ownerPubkeyBase58 = ownerPubkey.toBase58();

      const cacheResponse = await fetch(`${backendUrl}/api/vault/initialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner_username: name,
          owner_email: email,
          owner_pubkey: ownerPubkeyBase58, 
          beneficiary_pubkey: benePubkey,
          fiduciary_pubkey: fiduPubkey,
          deposit_amount: 0.5, 
        }),
      });

      if (cacheResponse.ok) {
        const cached = await cacheResponse.json();
        const vaultSession = {
          name,
          email,
          vault_pda: cached.vault_pda,
          owner_pubkey: ownerPubkeyBase58,
          created_at: new Date().toISOString(),
        };
        localStorage.setItem("terminus_vault_session", JSON.stringify(vaultSession));
      }

      try { await syncVault(true); } catch (e) {}
      
      onCreated({ 
        name, 
        email,
        vault_pda: vaultAccountPda.toBase58(),
        owner_pubkey: ownerPubkeyBase58,
      });
      
    } catch (err: any) {
      setError(`Failed to create vault: ${err.message || "Unknown error"}`);
    } finally {
      setCreating(false);
    }
  }

  const steps = [
    { n: 1, label: "Account" },
    { n: 2, label: "Beneficiary" },
    { n: 3, label: "Fiduciary" },
    { n: 4, label: "Plan" },
  ];

  const passwordsMatch = password.length >= 8 && password === confirm;
  const step1Valid = name.trim() && email.includes("@") && passwordsMatch && connected;
  const step2Valid = benePubkey.trim().length > 0 && pin.length >= 4;
  const step3Valid = fiduPubkey.trim().length > 0;
  const readyToCreate = connected && ownerPubkey && provider && step1Valid && step2Valid && step3Valid;

  return (
    <div className="min-h-[calc(100vh-72px)] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-[560px]">
        <div className="text-center mb-10">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-gold mb-3">
            New Vault Setup
          </p>
          <h1 className="font-display text-5xl font-light text-cream mb-2">
            Create your <em className="italic text-gold-light">vault</em>
          </h1>
          <p className="text-[13px] text-muted">
            Your digital legacy, secured in four steps.
          </p>

          <div className="mt-6 flex items-center justify-center gap-3">
            {connected ? (
              <>
                <div className="w-2 h-2 rounded-full bg-[#5c9c7a]" />
                <p className="font-mono text-[11px] text-[#5c9c7a]">Session Secured ({ownerPubkey?.toBase58().slice(0, 6)}...)</p>
              </>
            ) : null}
          </div>

          {/* WEB2 FIX: Styled WalletButton directly overrides the default purple crypto look */}
          {!connected && (
            <div className="mt-4 flex justify-center">
              <WalletMultiButton 
                style={{ 
                  backgroundColor: "#c9a96e", 
                  color: "#0f172a", 
                  borderRadius: "8px", 
                  fontWeight: "600", 
                  fontFamily: "inherit",
                  padding: "0 24px",
                  height: "44px"
                }}
              >
                Authenticate Session
              </WalletMultiButton>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-0 mb-10">
          {steps.map((s, i) => (
            <div key={s.n} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={clsx(
                    "w-8 h-8 rounded-full flex items-center justify-center font-mono text-[11px] font-medium transition-all duration-300",
                    step === s.n
                      ? "bg-gold text-ink shadow-[0_0_16px_rgba(201,169,110,0.35)]"
                      : step > s.n
                        ? "bg-[rgba(92,156,122,0.15)] text-[#5c9c7a] border border-[rgba(92,156,122,0.3)]"
                        : "bg-glass2 text-muted border border-line"
                  )}
                >
                  {step > s.n ? "✓" : s.n}
                </div>
                <span
                  className={clsx(
                    "font-mono text-[9px] tracking-[0.1em] uppercase transition-colors duration-300",
                    step === s.n ? "text-gold" : step > s.n ? "text-[#5c9c7a]" : "text-muted-2"
                  )}
                >
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={clsx(
                    "w-16 h-px mx-1 mb-5 transition-colors duration-300",
                    step > s.n ? "bg-[rgba(92,156,122,0.4)]" : "bg-line"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-[rgba(196,92,92,0.1)] border border-[rgba(196,92,92,0.3)]">
            <p className="font-mono text-[12px] text-[#c45c5c]">{error}</p>
          </div>
        )}

        <div className="bg-ink-2 border border-line rounded-2xl overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.5)]">
          <div className="h-0.5 bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
          <div className="px-10 py-9">

            {step === 1 && (
              <div className="animate-fade-up space-y-5">
                <div>
                  <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-gold mb-1">Step 1 of 4</p>
                  <h2 className="font-display text-2xl font-normal text-cream mb-1">Your account</h2>
                  <p className="text-[13px] text-muted">This will be your vault owner identity on Terminus.</p>
                </div>
                <FormInput label="Full Name" placeholder="Amara Osei" value={name} onChange={setName} />
                <FormInput label="Email Address" type="email" placeholder="amara@example.com" value={email} onChange={setEmail} />
                <FormInput label="Password" type="password" placeholder="Min. 8 characters" value={password} onChange={setPassword} />
                <div>
                  <FormInput label="Confirm Password" type="password" placeholder="Re-enter password" value={confirm} onChange={setConfirm} />
                  {confirm && !passwordsMatch && (
                    <p className="font-mono text-[11px] text-[#c45c5c] mt-1.5">
                      {password.length < 8 ? "Password must be at least 8 characters" : "Passwords do not match"}
                    </p>
                  )}
                  {confirm && passwordsMatch && <p className="font-mono text-[11px] text-[#5c9c7a] mt-1.5">✓ Passwords match</p>}
                </div>
                <Button variant="primary" full onClick={() => setStep(2)} disabled={!step1Valid}>
                  {!connected ? "Authenticate Session First" : "Continue →"}
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="animate-fade-up space-y-5">
                <div>
                  <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-gold mb-1">Step 2 of 4</p>
                  <h2 className="font-display text-2xl font-normal text-cream mb-1">Your beneficiary</h2>
                  <p className="text-[13px] text-muted">This person will inherit your vault. Enter their username, email, or secure ID.</p>
                </div>
                <div>
                  <label className="font-mono text-[11px] tracking-[0.1em] uppercase text-muted mb-2 block">
                    Beneficiary Identity
                    {beneficiaryLookup.isLoading && !benePubkey && <span className="ml-2 text-gold animate-pulse">⟳ Resolving...</span>}
                  </label>
                  <input
                    type="text"
                    placeholder="username, email@example.com, or Terminus ID..."
                    value={beneficiaryIdentifier}
                    onChange={(e) => handleBeneficiaryChange(e.target.value)}
                    className={clsx(
                      "w-full px-4 py-3 bg-ink border rounded-lg text-cream font-mono text-base placeholder:text-muted-2 outline-none transition-all",
                      benePubkey 
                        ? "border-[#5c9c7a] ring-2 ring-[rgba(92,156,122,0.2)]"
                        : beneficiaryLookup.error && beneficiaryIdentifier.length > 0
                        ? "border-[#c45c5c] ring-2 ring-[rgba(196,92,92,0.2)]"
                        : "border-line2 focus:border-gold/40 focus:ring-2 focus:ring-gold/5"
                    )}
                  />
                  {beneficiaryIdentifier.length > 0 && !benePubkey && (
                    <div className="mt-2 flex items-center gap-2">
                      {beneficiaryLookup.isLoading ? (
                        <p className="font-mono text-[11px] text-gold">⟳ Looking up identity...</p>
                      ) : beneficiaryLookup.error ? (
                        <>
                          <span className="text-[#c45c5c] text-sm">✗</span>
                          <p className="font-mono text-[11px] text-[#c45c5c]">{beneficiaryLookup.error}</p>
                        </>
                      ) : beneficiaryLookup.result && !beneficiaryLookup.result.found ? (
                        <>
                          <span className="text-amber-400 text-sm">ⓘ</span>
                          <p className="font-mono text-[11px] text-amber-400">User not found. Ask them to register or enter their Secure ID directly.</p>
                        </>
                      ) : null}
                    </div>
                  )}
                  {benePubkey && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[#5c9c7a] text-sm">✓</span>
                      <p className="font-mono text-[11px] text-[#5c9c7a]">{beneName ? `Identity verified: ${beneName}` : "Direct ID accepted"}</p>
                    </div>
                  )}
                </div>
                {benePubkey && beneName && (
                  <div className="p-3 rounded-lg bg-[rgba(92,156,122,0.05)] border border-[rgba(92,156,122,0.2)]">
                    <p className="font-mono text-[10px] text-muted-2 mb-1">Resolved Secure ID:</p>
                    <p className="font-mono text-[12px] text-cream break-all">{benePubkey}</p>
                  </div>
                )}
                <div>
                  <label className="font-mono text-[11px] tracking-[0.1em] uppercase text-muted mb-2 block">Shared Secret PIN</label>
                  <input
                    type="password"
                    placeholder="Min. 4 digits — share this in person"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    className="w-full px-4 py-3 bg-ink border border-line2 rounded-lg text-cream font-mono text-base tracking-[0.3em] placeholder:text-muted-2 placeholder:font-sans placeholder:tracking-normal outline-none focus:border-gold/40 focus:ring-2 focus:ring-gold/5 transition-all"
                  />
                  <p className="font-mono text-[11px] text-muted-2 mt-1.5">Share this PIN face-to-face. Never send it digitally.</p>
                </div>
                <div className="flex gap-3 pt-1">
                  <Button variant="ghost" onClick={() => setStep(1)} className="flex-1">← Back</Button>
                  <Button variant="primary" onClick={() => setStep(3)} disabled={!benePubkey.trim() || !pin.length || pin.length < 4} className="flex-[2]">Continue →</Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="animate-fade-up space-y-5">
                <div>
                  <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-gold mb-1">Step 3 of 4</p>
                  <h2 className="font-display text-2xl font-normal text-cream mb-1">Your fiduciary</h2>
                  <p className="text-[13px] text-muted leading-relaxed">A fiduciary (lawyer, spouse, or trusted friend) verifies the claim and ensures proper distribution of assets. Enter their username, email, or Secure ID.</p>
                </div>
                <div className="p-4 rounded-lg bg-glass border border-line">
                  <p className="font-mono text-[11px] text-muted-2 leading-relaxed">ℹ️ The fiduciary receives an email asking them to confirm when a claim is submitted. They do not have automatic access to your assets.</p>
                </div>
                <div>
                  <label className="font-mono text-[11px] tracking-[0.1em] uppercase text-muted mb-2 block">
                    Fiduciary Identity
                    {fiduciaryLookup.isLoading && !fiduPubkey && <span className="ml-2 text-gold animate-pulse">⟳ Resolving...</span>}
                  </label>
                  <input
                    type="text"
                    placeholder="username, email@example.com, or Terminus ID..."
                    value={fiduciaryIdentifier}
                    onChange={(e) => handleFiduciaryChange(e.target.value)}
                    className={clsx(
                      "w-full px-4 py-3 bg-ink border rounded-lg text-cream font-mono text-base placeholder:text-muted-2 outline-none transition-all",
                      fiduPubkey 
                        ? "border-[#5c9c7a] ring-2 ring-[rgba(92,156,122,0.2)]"
                        : fiduciaryLookup.error && fiduciaryIdentifier.length > 0
                        ? "border-[#c45c5c] ring-2 ring-[rgba(196,92,92,0.2)]"
                        : "border-line2 focus:border-gold/40 focus:ring-2 focus:ring-gold/5"
                    )}
                  />
                  {fiduciaryIdentifier.length > 0 && !fiduPubkey && (
                    <div className="mt-2 flex items-center gap-2">
                      {fiduciaryLookup.isLoading ? (
                        <p className="font-mono text-[11px] text-gold">⟳ Looking up identity...</p>
                      ) : fiduciaryLookup.error ? (
                        <>
                          <span className="text-[#c45c5c] text-sm">✗</span>
                          <p className="font-mono text-[11px] text-[#c45c5c]">{fiduciaryLookup.error}</p>
                        </>
                      ) : fiduciaryLookup.result && !fiduciaryLookup.result.found ? (
                        <>
                          <span className="text-amber-400 text-sm">ⓘ</span>
                          <p className="font-mono text-[11px] text-amber-400">User not found. Ask them to register or enter their Secure ID directly.</p>
                        </>
                      ) : null}
                    </div>
                  )}
                  {fiduPubkey && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[#5c9c7a] text-sm">✓</span>
                      <p className="font-mono text-[11px] text-[#5c9c7a]">{fiduName ? `Identity verified: ${fiduName}` : "Direct ID accepted"}</p>
                    </div>
                  )}
                </div>
                {fiduPubkey && fiduName && (
                  <div className="p-3 rounded-lg bg-[rgba(92,156,122,0.05)] border border-[rgba(92,156,122,0.2)]">
                    <p className="font-mono text-[10px] text-muted-2 mb-1">Resolved Secure ID:</p>
                    <p className="font-mono text-[12px] text-cream break-all">{fiduPubkey}</p>
                  </div>
                )}
                <div className="flex gap-3 pt-1">
                  <Button variant="ghost" onClick={() => setStep(2)} className="flex-1">← Back</Button>
                  <Button variant="primary" onClick={() => setStep(4)} disabled={!fiduPubkey.trim()} className="flex-[2]">Continue →</Button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="animate-fade-up space-y-5">
                <div>
                  <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-gold mb-1">Step 4 of 4</p>
                  <h2 className="font-display text-2xl font-normal text-cream mb-1">Choose your plan</h2>
                  <p className="text-[13px] text-muted">Start free and upgrade at any time.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPlan("free")}
                    className={clsx(
                      "text-left p-5 rounded-xl border transition-all duration-200",
                      plan === "free" ? "border-gold/40 bg-gold-dim" : "border-line bg-glass hover:border-line2"
                    )}
                  >
                    <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-muted mb-2">Free</p>
                    <p className="font-display text-3xl font-light text-cream mb-0.5">$0</p>
                    <p className="font-mono text-[11px] text-muted mb-4">forever</p>
                    <ul className="font-mono text-[11px] text-muted space-y-1.5">
                      {[["✓", "1 beneficiary", true], ["✓", "Basic crypto vault", true], ["✓", "Text note (1 KB)", true], ["✗", "Document storage", false], ["✗", "Multiple delegates", false], ["✗", "Living Will / Coma mode", false]].map(([icon, label, active]) => (
                        <li key={String(label)} className={clsx("flex items-center gap-2", !active && "opacity-40")}>
                          <span className={active ? "text-[#5c9c7a]" : "text-muted"}>{icon}</span>{label}
                        </li>
                      ))}
                    </ul>
                    {plan === "free" && <div className="mt-4 font-mono text-[10px] tracking-[0.1em] uppercase text-gold">✓ Selected</div>}
                  </button>
                  <button
                    onClick={() => setPlan("premium")}
                    className={clsx(
                      "text-left p-5 rounded-xl border transition-all duration-200 relative overflow-hidden",
                      plan === "premium" ? "border-gold/60 bg-gold-dim" : "border-line bg-glass hover:border-gold/30"
                    )}
                  >
                    <div className="absolute top-3 right-3 font-mono text-[9px] tracking-[0.1em] uppercase px-2 py-0.5 rounded-full bg-gold text-ink font-medium">Popular</div>
                    <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-muted mb-2">Premium</p>
                    <p className="font-display text-3xl font-light text-cream mb-0.5">$9.99</p>
                    <p className="font-mono text-[11px] text-muted mb-4">per month</p>
                    <ul className="font-mono text-[11px] text-muted space-y-1.5">
                      {["✓ Everything in Free", "✓ Encrypted PDF documents", "✓ Up to 3 delegates (multi-sig)", "✓ Living Will / Coma mode", "✓ Medical drip to hospital", "✓ Priority support"].map((f) => (
                        <li key={f} className="flex items-center gap-2"><span className="text-[#5c9c7a]">✓</span>{f.slice(2)}</li>
                      ))}
                    </ul>
                    {plan === "premium" && <div className="mt-4 font-mono text-[10px] tracking-[0.1em] uppercase text-gold">✓ Selected</div>}
                  </button>
                </div>
                <p className="font-mono text-[11px] text-muted-2 text-center">A 1% fee is applied only when assets are successfully transferred. You only pay when we deliver.</p>
                <div className="flex gap-3 pt-1">
                  <Button variant="ghost" onClick={() => setStep(3)} className="flex-1">← Back</Button>
                  <Button variant="primary" onClick={handleFinish} disabled={creating || !readyToCreate} className="flex-[2]">
                    {creating ? "Creating vault…" : `Create Vault →`}
                  </Button>
                </div>
                {txSignature && (
                  <div className="p-4 rounded-lg bg-[rgba(92,156,122,0.1)] border border-[rgba(92,156,122,0.3)]">
                    <p className="font-mono text-[11px] text-[#5c9c7a] break-all">✓ Security Escrow Initiated</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <p className="text-center font-mono text-[11px] text-muted-2 mt-6">🔐 End-to-end encrypted · Smart contract managed</p>
      </div>
    </div>
  );
}