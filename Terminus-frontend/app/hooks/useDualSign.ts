/**
 * hooks/useDualSign.ts
 * ────────────────────────────────────────────────────────────────
 * React hook for the dual-signing flow.
 *
 * Usage in components:
 *   const { sign, isLoading, error } = useDualSign();
 *   await sign({
 *     aiOraclePubkey: "...",
 *     claimantPubkey: walletPubkey,
 *     vaultPda: "...",
 *   });
 *
 * ────────────────────────────────────────────────────────────────
 */

import { useCallback, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import { triggerChallengeWithDualSign } from "@/app/lib/solanaClient";
import { classifyError, TerminusError } from "@/app/lib/errorHandling";

export interface UseDualSignParams {
  aiOraclePubkey: string;
  vaultOwnerPubkey: string;
  claimantPubkey: string;
  vaultPda: string;
  claimType?: number;
  stakeAmount?: number;
}

export function useDualSign() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<TerminusError | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const sign = useCallback(
    async (params: UseDualSignParams): Promise<string | null> => {
      if (!publicKey) {
        const err = new TerminusError(
          "Wallet not connected",
          "wallet" as any
        );
        setError(err);
        return null;
      }

      if (!signTransaction) {
        const err = new TerminusError(
          "Cannot sign transactions with this wallet",
          "wallet" as any
        );
        setError(err);
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const [signature, err] = await triggerChallengeWithDualSign({
          ...params,
          connection,
          signTransaction: signTransaction as (
            tx: Transaction
          ) => Promise<Transaction>,
          backendUrl:
            process.env.NEXT_PUBLIC_BACKEND_URL ||
            "http://localhost:8000",
        });

        if (err) {
          const classified = classifyError(err);
          setError(classified);
          return null;
        }

        if (signature) {
          setTxSignature(signature);
          return signature;
        }

        return null;
      } catch (err) {
        const classified = classifyError(err);
        setError(classified);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [publicKey, signTransaction, connection]
  );

  return {
    sign,
    isLoading,
    error,
    txSignature,
  };
}
