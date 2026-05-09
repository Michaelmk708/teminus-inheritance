/**
 * lib/solanaClient.ts
 * ────────────────────────────────────────────────────────────────
 * Frontend Solana client: constructs and partially signs transactions.
 *
 * This is part of the Sequential Dual-Signing Flow:
 *   1. Frontend constructs trigger_challenge instruction
 *   2. Frontend signs with Phantom (claimant signer)
 *   3. Frontend serializes and sends to backend
 *   4. Backend signs with AI_ORACLE keypair
 *   5. Backend submits to Solana
 *
 * ────────────────────────────────────────────────────────────────
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  TransactionInstruction,
  AccountMeta,
} from "@solana/web3.js";
import { safeAsync } from "./errorHandling";

// ════════════════════════════════════════════════════════════════════
//  CONFIGURATION
// ════════════════════════════════════════════════════════════════════

const TERMINUS_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_TERMINUS_PROGRAM_ID ||
    "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"
);

const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  "https://api.devnet.solana.com";

// ════════════════════════════════════════════════════════════════════
//  INSTRUCTION BUILDING
// ════════════════════════════════════════════════════════════════════

/**
 * Builds the trigger_challenge instruction.
 *
 * This instruction requires TWO signers:
 *   1. ai_oracle: Verifies the medical/death document
 *   2. claimant: Pays the stake and triggers challenge
 *
 * Args:
 *   aiOraclePubkey: Backend's AI Oracle public key (will verify TX from RPC)
 *   claimantPubkey: User's public key (signs with Phantom)
 *   vaultPda: Vault account address
 *   claimType: 1 = Medical, 2 = Death
 *   stakeAmount: Lamports to stake
 *
 * Returns:
 *   TransactionInstruction ready to be added to TX
 */
export function buildTriggerChallengeInstruction(
  aiOraclePubkey: PublicKey,
  claimantPubkey: PublicKey,
  vaultPda: PublicKey,
  claimType: number = 2,
  stakeAmount: number = 5000000
): TransactionInstruction {
  const accounts: AccountMeta[] = [
    {
      pubkey: aiOraclePubkey,
      isSigner: true,  // AI Oracle must sign
      isWritable: false,
    },
    {
      pubkey: claimantPubkey,
      isSigner: true,  // Claimant must sign (FRONTEND)
      isWritable: true,  // Claimant's lamports are transferred
    },
    {
      pubkey: vaultPda,
      isSigner: false,
      isWritable: true,  // Vault receives stake
    },
    {
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
  ];

  // Anchor instruction discriminator for trigger_challenge
  // First 8 bytes of SHA256("global:trigger_challenge")
  const discriminator = Buffer.from([
    0xec, 0x8e, 0xfb, 0x92, 0x70, 0xda, 0xf1, 0x66,
  ]);

  // Encode instruction data: discriminator + claim_type (u8) + stake_amount (u64 LE)
  const data = Buffer.alloc(8 + 1 + 8);
  discriminator.copy(data, 0);
  data.writeUInt8(claimType, 8);
  data.writeBigUInt64LE(BigInt(stakeAmount), 9);

  return new TransactionInstruction({
    programId: TERMINUS_PROGRAM_ID,
    keys: accounts,
    data,
  });
}

export function buildPanicButtonInstruction(
  ownerPubkey: PublicKey,
  vaultPda: PublicKey
): TransactionInstruction {
  const accounts: AccountMeta[] = [
    { pubkey: ownerPubkey, isSigner: true, isWritable: true },
    { pubkey: vaultPda, isSigner: false, isWritable: true },
  ];
  const discriminator = Buffer.from([
    0x8c, 0x8b, 0xac, 0xcf, 0x1b, 0xcc, 0x67, 0xa1,
  ]);
  return new TransactionInstruction({
    programId: TERMINUS_PROGRAM_ID,
    keys: accounts,
    data: discriminator,
  });
}

// ════════════════════════════════════════════════════════════════════
//  TRANSACTION CONSTRUCTION & SIGNING
// ════════════════════════════════════════════════════════════════════

export interface TriggerChallengeParams {
  aiOraclePubkey: string;  // Base58
  vaultOwnerPubkey: string; // Base58 (owner of the vault)
  claimantPubkey: string;  // Base58 (your wallet)
  vaultPda: string;        // Base58
  claimType?: number;
  stakeAmount?: number;
  connection: Connection;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
}

/**
 * STEP 1 of Dual-Sign Flow:
 *
 * Constructs trigger_challenge instruction and signs with Phantom wallet.
 * Returns a base64-encoded partially-signed transaction ready for backend.
 *
 * @returns base64-encoded transaction (for sending to backend)
 */
export async function signTriggerChallengeWithPhantom({
  aiOraclePubkey,
  claimantPubkey,
  vaultPda,
  claimType = 2,
  stakeAmount = 5000000,
  connection,
  signTransaction,
}: TriggerChallengeParams): Promise<[string | null, Error | null]> {
  return safeAsync(async () => {
    console.log("[DUAL-SIGN] Step 1: Building instruction...");

    const aiOracleKey = new PublicKey(aiOraclePubkey);
    const claimantKey = new PublicKey(claimantPubkey);
    const vaultKey = new PublicKey(vaultPda);

    // Build instruction (both signers required, but only claimant is available locally)
    const instruction = buildTriggerChallengeInstruction(
      aiOracleKey,
      claimantKey,
      vaultKey,
      claimType,
      stakeAmount
    );

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");

    // Create transaction
    const transaction = new Transaction({
      blockhash,
      lastValidBlockHeight,
      feePayer: claimantKey,
    }).add(instruction);

    console.log("[DUAL-SIGN] Step 2: Requesting Phantom to sign...");
    console.log(`        Claimant: ${claimantKey.toBase58().slice(0, 8)}...`);

    // Sign with claimant's wallet (Phantom)
    const signedTx = await signTransaction(transaction);

    console.log("[DUAL-SIGN] Step 3: Serializing transaction...");

    // Serialize to base64 for transmission to backend
    const serialized = signedTx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    const base64Encoded = Buffer.from(serialized).toString("base64");

    console.log(
      `[DUAL-SIGN] ✓ Claimant signature added. TX: ${base64Encoded.slice(0, 50)}...`
    );

    return base64Encoded;
  });
}

// ════════════════════════════════════════════════════════════════════
//  BACKEND SUBMISSION
// ════════════════════════════════════════════════════════════════════

export interface SubmitToChallengeParams {
  base64SignedTx: string;
  vaultOwnerPubkey: string;
  backendUrl: string;
}

/**
 * Submits the partially-signed transaction to the backend.
 *
 * Backend will:
 *   1. Deserialize the transaction
 *   2. Add its signature (AI_ORACLE)
 *   3. Submit fully-signed TX to Solana
 *   4. Return TX signature
 */
export async function submitToBackendForCompletion({
  base64SignedTx,
  vaultOwnerPubkey,
  backendUrl,
}: SubmitToChallengeParams): Promise<[string | null, Error | null]> {
  return safeAsync(async () => {
    console.log("[DUAL-SIGN] Step 4: Submitting to backend for oracle signature...");

    const response = await fetch(
      `${backendUrl}/api/vault/${vaultOwnerPubkey}/finalize-challenge`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          claimant_signed_tx_base64: base64SignedTx,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        error.detail || `Backend returned ${response.status}`
      );
    }

    const result = await response.json();

    console.log(
      `[DUAL-SIGN] ✓ Oracle signature added and TX submitted: ${result.tx_signature}`
    );

    return result.tx_signature;
  });
}

// ════════════════════════════════════════════════════════════════════
//  COMBINED FLOW
// ════════════════════════════════════════════════════════════════════

/**
 * High-level function: orchestrates the complete dual-sign flow.
 *
 * Returns: [txSignature, error]
 */
export async function triggerChallengeWithDualSign({
  aiOraclePubkey,
  vaultOwnerPubkey,
  claimantPubkey,
  vaultPda,
  claimType = 2,
  stakeAmount = 5000000,
  connection,
  signTransaction,
  backendUrl,
}: TriggerChallengeParams & { backendUrl: string }): Promise<
  [string | null, Error | null]
> {
  // Step 1: Sign with Phantom
  const [partiallySignedTx, signError] =
    await signTriggerChallengeWithPhantom({
      aiOraclePubkey,
      vaultOwnerPubkey,
      claimantPubkey,
      vaultPda,
      claimType,
      stakeAmount,
      connection,
      signTransaction,
    });

  if (signError) {
    return [null, signError];
  }

  if (!partiallySignedTx) {
    return [null, new Error("Failed to sign transaction")];
  }

  // Step 2: Submit to backend for oracle signature + submission
  return submitToBackendForCompletion({
    base64SignedTx: partiallySignedTx,
    vaultOwnerPubkey,
    backendUrl,
  });
}

export interface ExecutePanicButtonParams {
  ownerPubkey: string;
  vaultPda: string;
  connection: Connection;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
}

export async function executePanicButton({
  ownerPubkey,
  vaultPda,
  connection,
  signTransaction,
}: ExecutePanicButtonParams): Promise<[string | null, Error | null]> {
  return safeAsync(async () => {
    const owner = new PublicKey(ownerPubkey);
    const vault = new PublicKey(vaultPda);
    const ix = buildPanicButtonInstruction(owner, vault);
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");
    const tx = new Transaction({
      blockhash,
      lastValidBlockHeight,
      feePayer: owner,
    }).add(ix);
    const signed = await signTransaction(tx);
    const sig = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
    await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      "confirmed"
    );
    return sig;
  });
}
