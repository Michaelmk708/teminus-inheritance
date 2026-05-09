"use client";

/**
 * VaultContext.tsx
 * ────────────────────────────────────────────────────────────────
 * React Context for synchronizing Solana vault state with the UI.
 *
 * This is the CORE integration layer that bridges:
 *   • Solana on-chain state (VaultAccount)
 *   • Backend cache (database.py VaultState)
 *   • Frontend UI components
 *
 * ARCHITECTURE:
 *   1. Provider wraps the entire app
 *   2. useVaultSync hook subscribes to vault updates
 *   3. Automatic polling from /api/vault/{owner} (cache-first)
 *   4. Force-refresh on user action (TX confirmation, etc.)
 *   5. Error boundaries + retry logic
 *
 * STATE TRANSITIONS (must match Rust contract):
 *   0 = Active → User is alive, vault locked
 *   1 = ChallengePeriod → Medical/death claim submitted, awaiting owner confirmation
 *   2 = Incapacitated → Medical allowance triggered
 *   3 = Deceased → Full asset release to beneficiary
 *
 * ────────────────────────────────────────────────────────────────
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";

// ════════════════════════════════════════════════════════════════════
//  TYPE DEFINITIONS
// ════════════════════════════════════════════════════════════════════

export enum VaultStateEnum {
  Active = 0,
  ChallengePeriod = 1,
  Incapacitated = 2,
  Deceased = 3,
}

export const VaultStateNames: Record<VaultStateEnum, string> = {
  [VaultStateEnum.Active]: "Active",
  [VaultStateEnum.ChallengePeriod]: "Challenge Period",
  [VaultStateEnum.Incapacitated]: "Incapacitated",
  [VaultStateEnum.Deceased]: "Deceased",
};

export interface VaultStateData {
  vaultPda: string;
  state: VaultStateEnum;
  stateName: string;
  lastHeartbeat: number;
  challengeEndTime: number;
  medicalAllowance: number;
  claimStake: number;
  pendingClaimType: number;
  lastSyncedAt: string;
  cached: boolean;
}

export interface VaultContextType {
  // State
  vaultState: VaultStateData | null;
  isLoading: boolean;
  error: string | null;
  ownerPubkey: string | null;

  // Actions
  setOwnerPubkey: (pubkey: string) => void;
  syncVault: (forceRefresh?: boolean) => Promise<void>;
  triggerChallenge: (claimantPubkey: string, claimType: number) => Promise<string>;

  // Utils
  getStateColor: () => string;
  getStateBadge: () => string;
  isChallengePeriodActive: () => boolean;
  secondsUntilChallengeExpires: () => number | null;
}

// ════════════════════════════════════════════════════════════════════
//  CONTEXT & HOOKS
// ════════════════════════════════════════════════════════════════════

const VaultContext = createContext<VaultContextType | null>(null);

interface VaultProviderProps {
  children: ReactNode;
  backendUrl?: string;
  pollingIntervalMs?: number;
}

export function VaultProvider({
  children,
  backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000",
  pollingIntervalMs = 30000, // 30 seconds default
}: VaultProviderProps) {
  const [vaultState, setVaultState] = useState<VaultStateData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownerPubkey, setOwnerPubkey] = useState<string | null>(null);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const syncInProgressRef = useRef(false);

  /**
   * Fetches vault state from the backend cache (preferred).
   * Falls back to RPC if cache is stale.
   */
  const syncVault = useCallback(
    async (forceRefresh: boolean = false) => {
      if (!ownerPubkey) {
        console.warn(
          "[VaultContext] No owner pubkey set. Call setOwnerPubkey() first."
        );
        return;
      }

      // Prevent concurrent requests
      if (syncInProgressRef.current) return;
      syncInProgressRef.current = true;

      try {
        setIsLoading(true);
        setError(null);

        const query = forceRefresh ? "?force_refresh=true" : "";
        const response = await fetch(
          `${backendUrl}/api/vault/${ownerPubkey}${query}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(
            data.detail ||
              `Backend returned ${response.status}: ${response.statusText}`
          );
        }

        const data = await response.json();

        const stateEnum = (data.state as VaultStateEnum) || VaultStateEnum.Active;
        setVaultState({
          vaultPda: data.vault_pda,
          state: stateEnum,
          stateName: data.state_name || VaultStateNames[stateEnum],
          lastHeartbeat: data.last_heartbeat,
          challengeEndTime: data.challenge_end_time,
          medicalAllowance: data.medical_allowance,
          claimStake: data.claim_stake,
          pendingClaimType: data.pending_claim_type,
          lastSyncedAt: data.last_synced_at,
          cached: data.cached !== false,
        });

        console.log(
          `[VaultContext] ✓ Synced vault state: ${data.state_name}${
            data.cached ? " (cached)" : " (from RPC)"
          }`
        );
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Unknown error during sync";
        setError(errorMsg);
        console.error("[VaultContext] ✗ Sync failed:", errorMsg);
      } finally {
        setIsLoading(false);
        syncInProgressRef.current = false;
      }
    },
    [ownerPubkey, backendUrl]
  );

  /**
   * Triggers a challenge (medical proof or death claim).
   * Called by the Backend after OCR verification.
   */
  const triggerChallenge = useCallback(
    async (claimantPubkey: string, claimType: number = 2): Promise<string> => {
      if (!ownerPubkey) {
        throw new Error("No owner pubkey set");
      }

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          `${backendUrl}/api/vault/${ownerPubkey}/trigger-challenge`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              claimant_pubkey: claimantPubkey,
              claim_type: claimType,
            }),
          }
        );

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(
            data.detail || `Failed with status ${response.status}`
          );
        }

        const data = await response.json();

        console.log(
          `[VaultContext] ✓ Challenge triggered: ${data.tx_signature}`
        );

        // Immediately sync vault state to reflect ChallengePeriod
        await syncVault(true);

        return data.tx_signature;
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Unknown error";
        setError(errorMsg);
        console.error("[VaultContext] ✗ Challenge trigger failed:", errorMsg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [ownerPubkey, backendUrl, syncVault]
  );

  /**
   * Set up polling for vault state updates.
   * Starts/stops polling when ownerPubkey changes.
   */
  useEffect(() => {
    if (!ownerPubkey) return;

    // Initial sync
    syncVault(false);

    // Set up polling
    pollingIntervalRef.current = setInterval(() => {
      syncVault(false);
    }, pollingIntervalMs);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [ownerPubkey, pollingIntervalMs, syncVault]);

  // ══════════════════════════════════════════════════════════════════
  //  UTILITY METHODS
  // ══════════════════════════════════════════════════════════════════

  const getStateColor = useCallback((): string => {
    if (!vaultState) return "gray";

    switch (vaultState.state) {
      case VaultStateEnum.Active:
        return "green";
      case VaultStateEnum.ChallengePeriod:
        return "yellow";
      case VaultStateEnum.Incapacitated:
        return "orange";
      case VaultStateEnum.Deceased:
        return "red";
      default:
        return "gray";
    }
  }, [vaultState]);

  const getStateBadge = useCallback((): string => {
    if (!vaultState) return "—";

    switch (vaultState.state) {
      case VaultStateEnum.Active:
        return "✓ Active";
      case VaultStateEnum.ChallengePeriod:
        return "⏱ Challenge";
      case VaultStateEnum.Incapacitated:
        return "⚕️ Incapacitated";
      case VaultStateEnum.Deceased:
        return "⚰️ Deceased";
      default:
        return "?";
    }
  }, [vaultState]);

  const isChallengePeriodActive = useCallback((): boolean => {
    if (!vaultState) return false;
    return vaultState.state === VaultStateEnum.ChallengePeriod;
  }, [vaultState]);

  const secondsUntilChallengeExpires = useCallback((): number | null => {
    if (!vaultState || vaultState.state !== VaultStateEnum.ChallengePeriod) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    const remaining = vaultState.challengeEndTime - now;

    return remaining > 0 ? remaining : 0;
  }, [vaultState]);

  const value: VaultContextType = {
    // State
    vaultState,
    isLoading,
    error,
    ownerPubkey,

    // Actions
    setOwnerPubkey,
    syncVault,
    triggerChallenge,

    // Utils
    getStateColor,
    getStateBadge,
    isChallengePeriodActive,
    secondsUntilChallengeExpires,
  };

  return (
    <VaultContext.Provider value={value}>{children}</VaultContext.Provider>
  );
}

/**
 * Hook to use the VaultContext.
 *
 * @example
 * const { vaultState, syncVault, error } = useVaultSync();
 *
 * useEffect(() => {
 *   vault.setOwnerPubkey(walletAddress);
 * }, [walletAddress]);
 */
export function useVaultSync(): VaultContextType {
  const context = useContext(VaultContext);

  if (!context) {
    throw new Error("useVaultSync must be used within <VaultProvider>");
  }

  return context;
}
