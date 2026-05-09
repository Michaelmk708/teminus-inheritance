/**
 * encrypt.ts
 * ─────────────────────────────────────────────────────────────────
 * Encrypts vault files client-side using Lit Protocol.
 *
 * HOW IT WORKS:
 *  1. A random AES-256 symmetric key is generated locally in the browser.
 *  2. The file is encrypted with that key using AES-CBC.
 *  3. The symmetric key is encrypted by Lits threshold network and stored
 *     across Lit nodes. No single node holds the full key.
 *  4. Lit only re-assembles the key when the on-chain access conditions
 *     pass (vault reaches Unlocked state).
 *  5. We receive two artefacts to upload to Storacha:
 *       • encryptedFile            — the ciphertext blob
 *       • encryptedSymmetricKey    — the key encrypted by Lit nodes
 * ─────────────────────────────────────────────────────────────────
 */

import * as LitJsSdk from '@lit-protocol/lit-node-client';
import { getLitClient } from './litClient.js';
import {
  buildDeceasedConditions,
  buildIncapacitatedConditions,
  buildOwnerConditions,
} from './accessConditions.js';
import type {
  EncryptedVaultFile,
  EncryptVaultFileParams,
  EncryptVaultTextParams,
  ConditionType,
  UnifiedAccessControlConditions,
  AuthSig,
} from '../types.js';

// ── Public API ─────────────────────────────────────────────────────

/**
 * Encrypts a single file for vault storage.
 *
 * @example
 * const encrypted = await encryptVaultFile({
 *   file: fileFromInput,
 *   vaultPDA: vault.publicKey.toBase58(),
 *   ownerSolanaAddress: ownerWallet.toBase58(),
 *   conditionType: 'deceased',
 *   authSig,
 * });
 */
export async function encryptVaultFile({
  file,
  vaultPDA,
  ownerSolanaAddress,
  conditionType = 'deceased',
  authSig,
}: EncryptVaultFileParams): Promise<EncryptedVaultFile> {
  if (!file) throw new Error('[Encrypt] file is required.');
  if (!vaultPDA) throw new Error('[Encrypt] vaultPDA is required.');
  if (!authSig) throw new Error('[Encrypt] authSig is required (owner must sign first).');

  const litClient = await getLitClient();

  const accessControlConditions = selectConditions(
    conditionType,
    vaultPDA,
    ownerSolanaAddress
  );

  const fileBuffer = await fileToUint8Array(file);

  const fileName = file instanceof File ? file.name : 'blob';
  console.log(
    `[Encrypt] Encrypting "${fileName}" ` +
    `(${fileBuffer.byteLength} bytes) with condition: ${conditionType} …`
  );

  // ── Encrypt via Lit SDK ────────────────────────────────────────
  const { ciphertext, dataToEncryptHash } = await (LitJsSdk as any).encryptFile(
    { file: new Blob([toArrayBuffer(fileBuffer)]) },
    litClient
  );

  // ── Store the key on Lit nodes ─────────────────────────────────
  const encryptedSymmetricKeyBytes = await (litClient as any).saveEncryptionKey({
    unifiedAccessControlConditions: accessControlConditions,
    symmetricKey: undefined as unknown as Uint8Array, // generated internally
    authSig,
    chain: resolveChain(),
  });

  console.log('[Encrypt] ✅ Key stored on Lit nodes.');

  return {
    encryptedFile: new Blob([ciphertext]),
    encryptedSymmetricKey: toHex(encryptedSymmetricKeyBytes),
    accessControlConditions,
    dataToEncryptHash,
    mimeType: file instanceof File ? (file.type || 'application/octet-stream') : 'application/octet-stream',
    originalFileName: file instanceof File ? (file.name || 'vault-file') : 'vault-file',
    conditionType,
    vaultPDA,
  };
}

/**
 * Convenience wrapper: encrypts a plain text string (password, private letter).
 */
export async function encryptVaultText({
  text,
  vaultPDA,
  ownerSolanaAddress,
  conditionType = 'deceased',
  authSig,
}: EncryptVaultTextParams): Promise<EncryptedVaultFile> {
  if (!text) throw new Error('[Encrypt] text is required.');

  const encoder = new TextEncoder();
  const blob = new Blob([encoder.encode(text)], { type: 'text/plain' });
  const pseudoFile = new File([blob], 'vault-text.txt', { type: 'text/plain' });

  return encryptVaultFile({
    file: pseudoFile,
    vaultPDA,
    ownerSolanaAddress,
    conditionType,
    authSig,
  });
}

// ── Internal helpers ───────────────────────────────────────────────

function selectConditions(
  type: ConditionType,
  vaultPDA: string,
  ownerAddress: string
): UnifiedAccessControlConditions {
  switch (type) {
    case 'deceased':
      return buildDeceasedConditions(vaultPDA);
    case 'incapacitated':
      return buildIncapacitatedConditions(vaultPDA);
    case 'owner':
      return buildOwnerConditions(ownerAddress);
    default: {
      // Exhaustiveness check
      const _exhaustive: never = type;
      throw new Error(`[Encrypt] Unknown conditionType: "${_exhaustive}".`);
    }
  }
}

async function fileToUint8Array(file: File | Blob | Uint8Array | ArrayBuffer): Promise<Uint8Array> {
  if (file instanceof Uint8Array) return file;
  if (file instanceof ArrayBuffer) return new Uint8Array(file);
  const ab = await file.arrayBuffer();
  return new Uint8Array(ab);
}

function toHex(uint8Array: Uint8Array): string {
  return Array.from(uint8Array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function resolveChain(): string {
  const net = process.env['SOLANA_NETWORK'] ?? 'devnet';
  const map: Record<string, string> = {
    'mainnet-beta': 'solana',
    'devnet': 'solanaDevnet',
    'testnet': 'solanaTestnet',
  };
  return map[net] ?? 'solanaDevnet';
}

function toArrayBuffer(input: Uint8Array): ArrayBuffer {
  return input.buffer.slice(
    input.byteOffset,
    input.byteOffset + input.byteLength
  ) as ArrayBuffer;
}
