/**
 * app/hooks/useIdentityLookup.ts
 * ─────────────────────────────────────────────────────────────────────
 * Hook for resolving usernames/emails to Solana public keys.
 *
 * This hook provides debounced lookup functionality for the CreateVault
 * component, allowing users to reference vault participants by friendly
 * identifiers instead of long Base58 public keys.
 *
 * Usage:
 *   const { lookup, isLoading, result, error, found } = useIdentityLookup();
 *   
 *   // In an input onChange handler:
 *   const handleBeneficiaryChange = async (value) => {
 *     setBeneficiary(value);
 *     await lookup(value); // Resolves username/email to pubkey
 *   };
 *
 * ─────────────────────────────────────────────────────────────────────
 */

"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface IdentityLookupResult {
  found: boolean;
  username?: string;
  email?: string;
  solana_pubkey?: string;
  friendly_name?: string;
}

interface UseIdentityLookupReturn {
  lookup: (identifier: string) => Promise<void>;
  isLoading: boolean;
  result: IdentityLookupResult | null;
  error: string | null;
  found: boolean;
  solanaPublicKey: string | null;
  clear: () => void;
}

const DEBOUNCE_DELAY = 500; // milliseconds

/**
 * Hook for identity lookup with debouncing.
 *
 * Features:
 * - Debounces rapid input changes
 * - Accepts both username and email
 * - Returns Solana pubkey when found
 * - User-friendly error messages
 *
 * @param backendUrl - Backend API URL (from env or param)
 * @returns Object with lookup function and state
 */
export function useIdentityLookup(
  backendUrl: string = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"
): UseIdentityLookupReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<IdentityLookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  /**
   * Perform identity lookup (debounced).
   *
   * @param identifier - Username or email to lookup
   */
  const lookup = useCallback(
    async (identifier: string) => {
      // Clear previous debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Skip empty input
      if (!identifier || identifier.trim().length === 0) {
        setResult(null);
        setError(null);
        return;
      }

      // Debounce the lookup
      debounceTimerRef.current = setTimeout(async () => {
        setIsLoading(true);
        setError(null);

        try {
          const url = `${backendUrl}/api/identity/lookup/${encodeURIComponent(identifier)}`;
          console.log(`[IDENTITY] Fetching: ${url}`);

          const response = await fetch(url, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          });

          console.log(`[IDENTITY] Response status: ${response.status}`);

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.log(`[IDENTITY] Error response:`, errorData);
            throw new Error(
              errorData.detail || `Lookup failed with status ${response.status}`
            );
          }

          const data: IdentityLookupResult = await response.json();
          console.log(`[IDENTITY] Response data:`, data);
          setResult(data);

          if (data.found) {
            console.log(
              `[IDENTITY] ✓ Found: ${data.username || data.email}`,
              data.solana_pubkey ? `→ ${data.solana_pubkey.slice(0, 8)}...` : "(no pubkey)"
            );
          } else {
            console.log(`[IDENTITY] User not found: ${identifier}`);
          }
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : "Lookup failed";
          console.error("[IDENTITY] Error:", errorMessage);
          setError(errorMessage);
          setResult(null);
        } finally {
          setIsLoading(false);
        }
      }, DEBOUNCE_DELAY);
    },
    [backendUrl]
  );

  /**
   * Clear lookup state.
   */
  const clear = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setResult(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    lookup,
    isLoading,
    result,
    error,
    found: result?.found ?? false,
    solanaPublicKey: result?.solana_pubkey ?? null,
    clear,
  };
}
