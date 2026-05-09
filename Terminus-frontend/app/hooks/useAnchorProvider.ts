/**
 * app/hooks/useAnchorProvider.ts
 * ─────────────────────────────────────────────────────────────────────
 * Hook to get an AnchorProvider from the Solana Wallet Adapter.
 *
 * This bridges Wallet Adapter (useConnection + useWallet) with Anchor's
 * Provider interface, allowing seamless access to the Program methods.
 *
 * Usage:
 *   const provider = useAnchorProvider();
 *   const program = getTerminusProgram(provider);
 *   await program.methods.initializeVault({...}).rpc();
 * ─────────────────────────────────────────────────────────────────────
 */

"use client";

import { useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";

/**
 * Get an AnchorProvider from Solana Wallet Adapter.
 *
 * Returns null if wallet is not connected. Always check before using.
 *
 * @returns AnchorProvider if wallet connected, null otherwise
 */
export function useAnchorProvider(): AnchorProvider | null {
  const { connection } = useConnection();
  const wallet = useWallet();

  return useMemo(() => {
    // Anchor provider requires a connected wallet
    if (!wallet.publicKey) {
      console.warn("[useAnchorProvider] Wallet not connected");
      return null;
    }

    // Create Anchor provider from wallet adapter
    const provider = new AnchorProvider(
      connection,
      wallet as any, // Wallet adapter is compatible with Anchor's Wallet interface
      {
        commitment: "confirmed",
        preflightCommitment: "processed",
      }
    );

    return provider;
  }, [connection, wallet]);
}
