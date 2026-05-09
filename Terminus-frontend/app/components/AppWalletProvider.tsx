"use client";

/**
 * AppWalletProvider
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Client Component that provides Solana wallet functionality and vault state
 * management to the entire application.
 *
 * This MUST be a separate "use client" component to avoid breaking Next.js
 * server-side rendering and metadata in the root layout.tsx.
 *
 * Provider Stack (innermost to outermost):
 *   1. ConnectionProvider - Connects to Solana RPC endpoint
 *   2. WalletProvider - Manages wallet adapters (Phantom, Solflare, etc)
 *   3. WalletModalProvider - UI for wallet selection modal
 *   4. VaultProvider - Terminus-specific vault state and polling
 *
 * ══════════════════════════════════════════════════════════════════════════
 */

import React, { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";

// Wallet modal styles - CRITICAL: Must import for modal to render
import "@solana/wallet-adapter-react-ui/styles.css";

// Terminus vault state management
import { VaultProvider } from "../context/VaultContext";

interface AppWalletProviderProps {
  children: React.ReactNode;
}

/**
 * Main provider component
 * ────────────────────────────────────────────────────────────────────────
 * 
 * Props:
 *   children - React nodes to render inside provider stack
 * 
 * Environment Variables:
 *   NEXT_PUBLIC_SOLANA_RPC_URL - Solana RPC endpoint (devnet/mainnet)
 *   Falls back to devnet if not defined
 * 
 * ────────────────────────────────────────────────────────────────────────
 */
export default function AppWalletProvider({ children }: AppWalletProviderProps) {
  /**
   * RPC Endpoint Configuration
   * ──────────────────────────────────────────────────────────────────────
   * 
   * Get from environment variable with devnet fallback to prevent crashes
   * when env var is undefined during build time.
   */
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

  /**
   * Wallet Adapters Configuration
   * ──────────────────────────────────────────────────────────────────────
   * 
   * useMemo prevents unnecessary re-initialization on every render.
   * Each wallet adapter handles its own connection protocol:
   *   • PhantomWalletAdapter - Phantom browser extension
   *   • SolflareWalletAdapter - Solflare browser extension
   * 
   * Add more wallet adapters as needed (WalletConnect, Ledger, etc)
   */
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider
        wallets={wallets}
        autoConnect={true}
        onError={(error: any) => {
          console.error("[WALLET] Provider error:", error.message);
        }}
      >
        <WalletModalProvider>
          <VaultProvider>
            {children}
          </VaultProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
