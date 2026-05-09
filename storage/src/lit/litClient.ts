/**
 * litClient.ts
 * ─────────────────────────────────────────────────────────────────
 * Singleton wrapper around the Lit Protocol node client.
 *
 * Lit Protocol is the encryption/decryption backbone of Terminus.
 * It stores key-shares across a decentralised network of nodes;
 * keys are only released when programmable access conditions are met
 * (in our case: the Solana vault smart-contract reaching Unlocked state).
 * ─────────────────────────────────────────────────────────────────
 */

import * as LitJsSdk from '@lit-protocol/lit-node-client';
import { LIT_NETWORK } from '@lit-protocol/constants';
import type { LitNetworkName } from '../types.js';

// ── Singleton state ────────────────────────────────────────────────
let _litClient: LitJsSdk.LitNodeClient | null = null;
let _isConnected = false;

/**
 * Returns (and lazily connects) the shared Lit node client.
 * Safe to call multiple times — only one connection is made.
 */
export async function getLitClient(): Promise<LitJsSdk.LitNodeClient> {
  if (_litClient !== null && _isConnected) {
    return _litClient;
  }

  const network = resolveLitNetwork();

  console.log(`[Lit] Connecting to Lit Network: ${network} …`);

  _litClient = new LitJsSdk.LitNodeClient({
    litNetwork: network,
    debug: process.env['NODE_ENV'] === 'development',
  });

  await _litClient.connect();
  _isConnected = true;

  console.log('[Lit] ✅ Connected to Lit nodes.');
  return _litClient;
}

/**
 * Gracefully tears down the Lit connection.
 * Call this on application shutdown or test teardown.
 */
export async function disconnectLit(): Promise<void> {
  if (_litClient !== null && _isConnected) {
    await _litClient.disconnect();
    _litClient = null;
    _isConnected = false;
    console.log('[Lit] Disconnected.');
  }
}

// ── Helpers ────────────────────────────────────────────────────────

function resolveLitNetwork(): any {
  const envNetwork = (process.env['LIT_NETWORK'] ?? 'datil-dev') as LitNetworkName;

  const map: Record<LitNetworkName, string> = {
    'datil-dev': LIT_NETWORK.DatilDev,
    'datil-test': LIT_NETWORK.DatilTest,
    'datil': LIT_NETWORK.Datil,
  };

  const resolved = map[envNetwork];
  if (resolved === undefined) {
    console.warn(
      `[Lit] Unknown LIT_NETWORK "${envNetwork}". Falling back to datil-dev.`
    );
    return LIT_NETWORK.DatilDev;
  }
  return resolved;
}
