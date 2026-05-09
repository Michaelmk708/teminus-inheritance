/**
 * types.ts
 * ─────────────────────────────────────────────────────────────────
 * Shared TypeScript types and interfaces for the Terminus storage
 * and encryption module.
 * ─────────────────────────────────────────────────────────────────
 */

import type { AuthSig, UnifiedAccessControlConditions } from '@lit-protocol/types';

// ── Re-export Lit types used across the module ─────────────────────
export type { AuthSig, UnifiedAccessControlConditions };

// ── Vault state enum — must mirror the Rust/Anchor contract ───────
// ✓ VERIFIED AGAINST: terminus/programs/terminus/src/lib.rs:156-160
export enum VaultState {
  Active = 0,
  ChallengePeriod = 1,      // ✓ FIXED: was 2, should be 1
  Incapacitated = 2,        // ✓ FIXED: was missing
  Deceased = 3,             // ✓ FIXED: was "Unlocked"
}

// ── Condition types ────────────────────────────────────────────────
export type ConditionType = 'deceased' | 'incapacitated' | 'owner';

export type SolanaNetwork = 'mainnet-beta' | 'devnet' | 'testnet';
export type LitSolanaChain = 'solana' | 'solanaDevnet' | 'solanaTestnet';
export type LitNetworkName = 'datil-dev' | 'datil-test' | 'datil';

// ── Encrypted vault file — output of encrypt.ts ───────────────────
export interface EncryptedVaultFile {
  /** The AES-encrypted ciphertext blob — upload this to Storacha */
  encryptedFile: Blob;
  /** Hex-encoded symmetric key, wrapped by Lit nodes */
  encryptedSymmetricKey: string;
  /** Lit access conditions that gate key retrieval */
  accessControlConditions: UnifiedAccessControlConditions;
  /** SHA-256 of the original plaintext (for integrity verification) */
  dataToEncryptHash: string;
  mimeType: string;
  originalFileName: string;
  conditionType: ConditionType;
  vaultPDA: string;
}

// ── Store result — output of vaultStorage.storeVaultFile() ────────
export interface StoreResult {
  /** ← CRITICAL: Store this string on the Solana smart contract */
  metadataCid: string;
  encryptedFileCid: string;
  metadataUrl: string;
  encryptedFileUrl: string;
  conditionType: ConditionType;
  originalFileName: string;
  mimeType: string;
}

// ── Vault file metadata — what is stored in metadata.json on IPFS ─
export interface VaultFileMetadata {
  version: string;
  terminus: true;
  vaultPDA: string;
  conditionType: ConditionType;
  originalFileName: string;
  mimeType: string;
  dataToEncryptHash: string;
  encryptedSymmetricKey: string;
  accessControlConditions: UnifiedAccessControlConditions;
  encryptedFileCid: string;
  uploadedAt: string;
}

// ── Upload result — output of upload.ts ───────────────────────────
export interface VaultUploadResult {
  metadataCid: string;
  encryptedFileCid: string;
  metadataUrl: string;
  encryptedFileUrl: string;
}

// ── Decrypted vault file — output of decrypt.ts ───────────────────
export interface DecryptedVaultFile {
  blob: Blob;
  arrayBuffer: ArrayBuffer;
  /** Use directly in <a href> or <img src>. Revoke when done. */
  objectUrl: string;
  mimeType: string;
  originalFileName: string;
  /** Reads the decrypted content as a UTF-8 string */
  text: () => Promise<string>;
  /** Revokes the objectUrl to free memory — call after download/view */
  revoke: () => void;
}

// ── Decrypted file entry for the React hook ───────────────────────
export interface DecryptedFileEntry {
  metadataCid: string;
  objectUrl: string;
  originalFileName: string;
  mimeType: string;
  blob: Blob;
  /** Populated for text/* MIME types */
  text: string | null;
}

// ── Progress event shapes ──────────────────────────────────────────
export interface UploadProgressEvent {
  chunk?: Uint8Array;
  percent?: number;
}

export interface DownloadProgressEvent {
  received: number;
  total: number;
  percent: number;
}

// ── Encrypt params ─────────────────────────────────────────────────
export interface EncryptVaultFileParams {
  file: File | Blob;
  vaultPDA: string;
  ownerSolanaAddress: string;
  conditionType?: ConditionType;
  authSig: AuthSig;
}

export interface EncryptVaultTextParams {
  text: string;
  vaultPDA: string;
  ownerSolanaAddress: string;
  conditionType?: ConditionType;
  authSig: AuthSig;
}

// ── Decrypt params ─────────────────────────────────────────────────
export interface DecryptVaultFileParams {
  encryptedFile: Blob | Uint8Array;
  encryptedSymmetricKey: string;
  accessControlConditions: UnifiedAccessControlConditions;
  dataToEncryptHash: string;
  mimeType?: string;
  originalFileName?: string;
  authSig: AuthSig;
}

// ── Upload params ──────────────────────────────────────────────────
export interface UploadEncryptedVaultFileParams extends EncryptedVaultFile {
  vaultPDA: string;
  onProgress?: (event: UploadProgressEvent) => void;
}

// ── High-level vault API params ────────────────────────────────────
export interface StoreVaultFileParams {
  file: File | Blob;
  vaultPDA: string;
  ownerSolanaAddress: string;
  conditionType?: ConditionType;
  authSig: AuthSig;
  onProgress?: (event: UploadProgressEvent) => void;
}

export interface StoreVaultTextParams {
  text: string;
  fileName?: string;
  vaultPDA: string;
  ownerSolanaAddress: string;
  conditionType?: ConditionType;
  authSig: AuthSig;
}

export interface RetrieveVaultFileParams {
  metadataCid: string;
  authSig: AuthSig;
  onProgress?: (event: DownloadProgressEvent) => void;
}

export interface RetrieveAllVaultFilesParams {
  metadataCids: string[];
  authSig: AuthSig;
}

export interface RetrieveAllResult {
  cid: string;
  result?: DecryptedVaultFile;
  error?: Error;
}

// ── Error codes ────────────────────────────────────────────────────
export type DecryptionErrorCode = 'VAULT_LOCKED' | 'LIT_ERROR' | 'DECRYPT_FAILED';
