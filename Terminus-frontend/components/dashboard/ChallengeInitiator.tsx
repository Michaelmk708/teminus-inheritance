/**
 * componets/dashboard/ChallengeInitiator.tsx
 * ────────────────────────────────────────────────────────────────
 * Example component showing how to use the dual-sign flow.
 *
 * This demonstrates:
 *   1. Connect wallet
 *   2. Trigger challenge with medical document
 *   3. Uses the useDualSign hook for signing
 *   4. Shows loading/error states
 *
 * ────────────────────────────────────────────────────────────────
 */

"use client";

import { useState } from "react";
import { useVaultSync } from "@/app/context";
import { useDualSign } from "@/app/hooks/useDualSign";
import { getUserFriendlyMessage } from "@/app/lib/errorHandling";
import { useWallet } from "@solana/wallet-adapter-react";

interface ChallengeInitiatorProps {
  ownerPubkey: string;
  vaultPda: string;
  aiOraclePubkey: string;
  onSuccess?: (txSignature: string) => void;
}

export default function ChallengeInitiator({
  ownerPubkey,
  vaultPda,
  aiOraclePubkey,
  onSuccess,
}: ChallengeInitiatorProps) {
  const { sign, isLoading, error, txSignature } = useDualSign();
  const { syncVault } = useVaultSync();
  const { publicKey } = useWallet();
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [claimType, setClaimType] = useState<1 | 2>(2); // 1=Medical, 2=Death

  const handleUploadDocument = async () => {
    if (!documentFile) {
      alert("Please select a document");
      return;
    }

    if (!ownerPubkey) {
      alert("Wallet not connected");
      return;
    }

    const claimant = publicKey?.toBase58() ?? ownerPubkey;

    try {
      // Step 1: Upload document to backend for OCR verification
      console.log("[CHALLENGE] Step 1: Uploading document for OCR...");

      const formData = new FormData();
      formData.append("file", documentFile);
      formData.append("username", ownerPubkey);
      formData.append("vault_owner", ownerPubkey);
      formData.append("claimant_pubkey", claimant);

      const verifyResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/ocr/verify-claim`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!verifyResponse.ok) {
        const error = await verifyResponse.json().catch(() => ({}));
        throw new Error(
          error.detail ||
            `OCR verification failed: ${verifyResponse.status}`
        );
      }

      const verifyResult = await verifyResponse.json();
      console.log("[CHALLENGE] ✓ Document verified:", verifyResult);

      // Step 2: Initiate dual-sign flow
      console.log(
        "[CHALLENGE] Step 2: Initiating dual-signature challenge..."
      );

      const signature = await sign({
        aiOraclePubkey,
        vaultOwnerPubkey: ownerPubkey,
        claimantPubkey: claimant,
        vaultPda,
        claimType,
        stakeAmount: 5000000, // 0.005 SOL
      });

      if (!signature) {
        throw new Error("Failed to sign transaction");
      }

      console.log(`[CHALLENGE] ✓ Challenge initiated: ${signature}`);

      // Step 3: Sync vault state
      console.log(
        "[CHALLENGE] Step 3: Syncing vault state from on-chain..."
      );
      await syncVault(true);

      if (onSuccess) {
        onSuccess(signature);
      }

      alert("✓ Challenge initiated successfully!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      alert(`✗ Error: ${message}`);
      console.error("[CHALLENGE] Error:", err);
    }
  };

  return (
    <div className="bg-glass1 border border-line rounded-lg p-6 space-y-4">
      <h3 className="text-lg font-semibold text-cream">
        Initiate Challenge
      </h3>

      {/* Claim Type Selection */}
      <div className="space-y-2">
        <label className="text-sm text-muted">Claim Type</label>
        <div className="flex gap-2">
          <button
            onClick={() => setClaimType(1)}
            className={`px-4 py-2 rounded transition ${
              claimType === 1
                ? "bg-gold text-ink"
                : "bg-glass2 text-muted hover:bg-glass1"
            }`}
          >
            Medical (Incapacitation)
          </button>
          <button
            onClick={() => setClaimType(2)}
            className={`px-4 py-2 rounded transition ${
              claimType === 2
                ? "bg-gold text-ink"
                : "bg-glass2 text-muted hover:bg-glass1"
            }`}
          >
            Death
          </button>
        </div>
      </div>

      {/* File Upload */}
      <div className="space-y-2">
        <label className="text-sm text-muted">
          Upload {claimType === 1 ? "Medical" : "Death"} Certificate
        </label>
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
          className="w-full px-3 py-2 bg-glass2 border border-line rounded text-cream text-sm"
        />
        {documentFile && (
          <p className="text-xs text-gold">✓ {documentFile.name}</p>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-900/20 border border-red-700/50 rounded text-sm text-red-300">
          <p className="font-semibold">Error</p>
          <p>{getUserFriendlyMessage(error)}</p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="p-3 bg-blue-900/20 border border-blue-700/50 rounded text-sm text-blue-300">
          ⏳ Processing challenge...
        </div>
      )}

      {/* Success State */}
      {txSignature && (
        <div className="p-3 bg-green-900/20 border border-green-700/50 rounded text-sm text-green-300">
          <p className="font-semibold">✓ Challenge Initiated</p>
          <p className="text-xs font-mono">
            TX: {txSignature.slice(0, 20)}...
          </p>
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={handleUploadDocument}
        disabled={isLoading || !documentFile}
        className={`w-full px-4 py-2 rounded font-semibold transition ${
          isLoading || !documentFile
            ? "bg-muted/30 text-muted/50 cursor-not-allowed"
            : "bg-gold text-ink hover:bg-gold-light active:scale-95"
        }`}
      >
        {isLoading ? "⏳ Processing..." : "Submit Challenge"}
      </button>

      {/* Debug Info */}
      <details className="text-xs text-muted">
        <summary className="cursor-pointer hover:text-muted-2">
          Debug Info
        </summary>
        <pre className="mt-2 p-2 bg-black/20 rounded overflow-auto text-[10px]">
          {JSON.stringify(
            {
              ownerPubkey: ownerPubkey?.slice(0, 8),
              vaultPda: vaultPda?.slice(0, 8),
              claimType,
              file: documentFile?.name,
            },
            null,
            2
          )}
        </pre>
      </details>
    </div>
  );
}
