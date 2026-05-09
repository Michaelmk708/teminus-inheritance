"use client";

import { useState } from "react";
import { Button, FormInput } from "@/components/ui";

type VerificationResult = {
  status: string;
  document_type: string;
  confidence: number;
  zk_proof: string;
  document_hash: string;
  message: string;
};

export default function BeneficiaryPortal() {
  const [email, setEmail] = useState("");
  const [vaultOwner, setVaultOwner] = useState("");
  const [claimantPubkey, setClaimantPubkey] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);

  async function submitVerification() {
    if (!file || !email || !vaultOwner || !claimantPubkey) {
      setError("All fields are required before verification.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      const formData = new FormData();
      formData.append("file", file);
      formData.append("username", email);
      formData.append("vault_owner", vaultOwner);
      formData.append("claimant_pubkey", claimantPubkey);

      const res = await fetch(`${backendUrl}/api/ocr/verify-claim`, {
        method: "POST",
        body: formData,
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.detail || "Verification failed");
      }

      setResult(payload as VerificationResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-72px)] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-[560px] bg-ink-2 border border-line rounded-2xl overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.6)]">
        <div className="text-center px-10 pt-10 pb-8 bg-ink-3 border-b border-line">
          <h2 className="font-display text-3xl font-light text-cream mb-1.5">
            Inheritance Claim Verification
          </h2>
          <p className="text-[13px] text-muted">Upload official documents to legally unlock the vault.</p>
        </div>

        <div className="px-10 py-8 space-y-4">
          <FormInput
            label="Beneficiary Email"
            type="email"
            placeholder="beneficiary@email.com"
            value={email}
            onChange={setEmail}
          />
          <FormInput
            label="Vault Owner Reference ID"
            placeholder="Enter the owner's Terminus ID or email"
            value={vaultOwner}
            onChange={setVaultOwner}
          />
          <FormInput
            label="Your Secure ID"
            placeholder="Enter your claimant identifier"
            value={claimantPubkey}
            onChange={setClaimantPubkey}
          />

          <div>
            <label className="font-mono text-[11px] tracking-[0.1em] uppercase text-muted mb-2 block">
              Official Medical / Death Certificate
            </label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 bg-glass2 border border-line rounded text-cream text-sm cursor-pointer"
            />
          </div>

          {error && (
            <div className="p-3 rounded bg-red-900/20 border border-red-700/40 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* WEB2 FIX: Cleaned up the success receipt to hide raw cryptographic hashes */}
          {result && (
            <div className="p-5 rounded-lg bg-[rgba(92,156,122,0.05)] border border-[rgba(92,156,122,0.2)] text-sm space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[#5c9c7a] text-lg">✓</span>
                <p className="font-semibold text-[#5c9c7a]">Document Verified Automatically</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-muted-2">
                <p>Status:</p><p className="text-cream text-right capitalize">{result.status}</p>
                <p>Type:</p><p className="text-cream text-right">{result.document_type.replace("_", " ")}</p>
                <p>AI Confidence:</p><p className="text-cream text-right">{(result.confidence * 100).toFixed(1)}%</p>
              </div>
              <div className="mt-4 pt-3 border-t border-[rgba(92,156,122,0.1)]">
                <p className="font-mono text-[10px] text-[#5c9c7a] uppercase tracking-wider text-center">
                  Zero-Knowledge Proof Generated
                </p>
              </div>
            </div>
          )}

          <Button
            variant="primary"
            full
            onClick={submitVerification}
            disabled={loading || !file || !email || !vaultOwner || !claimantPubkey}
          >
            {loading ? "Verifying Document..." : "Verify & Initiate Claim"}
          </Button>
        </div>
      </div>
    </div>
  );
}