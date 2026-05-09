/**
 * decrypt.ts
 * ─────────────────────────────────────────────────────────────────
 * Decrypts vault files in the beneficiary's browser using Lit Protocol.
 *
 * HOW IT WORKS:
 *  1. Beneficiary provides their authentication signature (authSig).
 *  2. We ask Lit nodes to check the Solana smart contract access conditions.
 *  3. If the vault is in Unlocked state, Lit nodes re-assemble the symmetric
 *     key and return it securely to the browser.
 *  4. We use the symmetric key to decrypt the ciphertext blob locally.
 *  5. The plaintext file is returned — it never leaves the browser.
 *
 * FR10: decryption keys are released programmatically only when the
 * on-chain DECEASED state is finalised.
 * ─────────────────────────────────────────────────────────────────
 */

import * as LitJsSdk from '@lit-protocol/lit-node-client';
import { getLitClient } from './litClient.js';
import type {
  DecryptVaultFileParams,
  DecryptedVaultFile,
  DecryptionErrorCode,
} from '../types.js';

// ── Custom error ───────────────────────────────────────────────────

export class TerminusDecryptionError extends Error {
  override name: string;
  public readonly code: DecryptionErrorCode;
  override readonly cause: Error | unknown;

  constructor(code: DecryptionErrorCode, message: string, cause?: Error | unknown) {
    super(message);
    this.name = 'TerminusDecryptionError';
    this.code = code;
    this.cause = cause;
  }
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Decrypts an encrypted vault file.
 * Throws {@link TerminusDecryptionError} with `code === 'VAULT_LOCKED'`
 * if the Solana smart contract has not yet reached the Unlocked state.
 *
 * @example
 * try {
 *   const file = await decryptVaultFile({ encryptedFile, encryptedSymmetricKey, ... });
 *   window.open(file.objectUrl);
 * } catch (err) {
 *   if (err instanceof TerminusDecryptionError && err.code === 'VAULT_LOCKED') {
 *     showError('Vault not yet unlocked.');
 *   }
 * }
 */
export async function decryptVaultFile({
  encryptedFile,
  encryptedSymmetricKey,
  accessControlConditions,
  dataToEncryptHash,
  mimeType = 'application/octet-stream',
  originalFileName = 'vault-file',
  authSig,
}: DecryptVaultFileParams): Promise<DecryptedVaultFile> {
  if (!encryptedFile) throw new Error('[Decrypt] encryptedFile is required.');
  if (!encryptedSymmetricKey) throw new Error('[Decrypt] encryptedSymmetricKey is required.');
  if (!accessControlConditions) throw new Error('[Decrypt] accessControlConditions is required.');
  if (!authSig) throw new Error('[Decrypt] authSig is required (beneficiary must sign first).');

  const litClient = await getLitClient();

  console.log('[Decrypt] Requesting symmetric key from Lit nodes …');

  // ── Step 1: Retrieve the symmetric key from Lit nodes ──────────
  let symmetricKey: Uint8Array;
  try {
    symmetricKey = await (litClient as any).getEncryptionKey({
      unifiedAccessControlConditions: accessControlConditions,
      toDecrypt: encryptedSymmetricKey,
      chain: resolveChain(),
      authSig,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('not authorized') || msg.includes('conditions are not met')) {
      throw new TerminusDecryptionError(
        'VAULT_LOCKED',
        'The vault has not yet been unlocked. The smart contract must reach Unlocked state before files can be decrypted.',
        err
      );
    }
    throw new TerminusDecryptionError('LIT_ERROR', msg, err);
  }

  console.log('[Decrypt] ✅ Symmetric key retrieved from Lit nodes.');

  // ── Step 2: Decrypt the file ───────────────────────────────────
  const ciphertextBlob = encryptedFile instanceof Blob
    ? encryptedFile
    : new Blob([toArrayBuffer(encryptedFile)]);

  let decryptedArrayBuffer: ArrayBuffer;
  try {
    decryptedArrayBuffer = await (LitJsSdk as any).decryptFile({
      file: ciphertextBlob,
      symmetricKey,
    });
  } catch (err) {
    throw new TerminusDecryptionError(
      'DECRYPT_FAILED',
      'Failed to decrypt file with the retrieved key. The encrypted payload may be corrupted.',
      err
    );
  }

  // ── Step 3: Integrity check ────────────────────────────────────
  if (dataToEncryptHash) {
    const actualHash = await sha256Hex(decryptedArrayBuffer);
    if (actualHash !== dataToEncryptHash) {
      console.warn(
        '[Decrypt] ⚠️  Hash mismatch! Expected:', dataToEncryptHash, 'Got:', actualHash
      );
    } else {
      console.log('[Decrypt] ✅ Integrity hash verified.');
    }
  }

  // ── Step 4: Return usable output ──────────────────────────────
  const decryptedBlob = new Blob([decryptedArrayBuffer], { type: mimeType });
  const objectUrl = URL.createObjectURL(decryptedBlob);

  return {
    blob: decryptedBlob,
    arrayBuffer: decryptedArrayBuffer,
    objectUrl,
    mimeType,
    originalFileName,
    async text(): Promise<string> {
      const decoder = new TextDecoder();
      return decoder.decode(decryptedArrayBuffer);
    },
    revoke(): void {
      URL.revokeObjectURL(objectUrl);
    },
  };
}

// ── Helpers ────────────────────────────────────────────────────────

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
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
