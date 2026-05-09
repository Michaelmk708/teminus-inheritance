/**
 * accessConditions.ts
 * ─────────────────────────────────────────────────────────────────
 * Builds the Lit Protocol Unified Access Control Conditions that
 * govern when encrypted vault files can be decrypted.
 *
 * ACCESS CONTROL FLOWS:
 *
 *  1. buildDeceasedConditions(vaultPDA)
 *     ── Checks the Solana vault account's `state` field equals
 *        VaultState::Deceased (value = 3).  Used for full-asset
 *        and private-document release to beneficiary (FR9, FR10).
 *
 *  2. buildIncapacitatedConditions(vaultPDA)
 *     ── Checks the vault is in VaultState::ChallengePeriod (1).
 *        Used for medical allowance release to fiduciary.
 *        This is where the timer matters: fiduciary waits for
 *        challenge_end_time to pass before calling execute_claim.
 *
 * ─── VAULT STATE ENUM (Rust: terminus/programs/terminus/src/lib.rs) ──
 *   #[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
 *   pub enum VaultState {
 *       Active,              // 0
 *       ChallengePeriod,     // 1
 *       Incapacitated,       // 2
 *       Deceased,            // 3
 *   }
 *
 * ─── VAULT ACCOUNT LAYOUT (CRITICAL: must match Rust struct) ────────
 *   Offset  Field                 Type     Size
 *   ──────────────────────────────────────────────────────────────
 *   0-7     Anchor discriminator  u8[8]    8 bytes
 *   8-39    owner                 Pubkey   32 bytes
 *   40-71   beneficiary           Pubkey   32 bytes
 *   72-103  fiduciary             Pubkey   32 bytes
 *   104-135 ai_oracle             Pubkey   32 bytes
 *   136     state                 VaultState (u8) → 1 byte ✓✓✓
 *   137-144 last_heartbeat        i64      8 bytes
 *   145-152 challenge_end_time    i64      8 bytes
 *   153-160 medical_allowance     u64      8 bytes
 *   161-168 claim_stake           u64      8 bytes
 *   169     pending_claim_type    u8       1 byte
 *   170     bump                  u8       1 byte
 *
 * ✓ Verified against: terminus/programs/terminus/src/lib.rs:160-171
 * ─────────────────────────────────────────────────────────────────
 */

import type { UnifiedAccessControlConditions } from '../types.js';
import type { LitSolanaChain, SolanaNetwork } from '../types.js';
import { createHash } from 'crypto';

// ── Byte layout constants — update if Rust struct changes ─────────
const STATE_BYTE_OFFSET = 136;  // ✓ VERIFIED: owner(8) + owner(32) + bene(32) + fid(32) + oracle(32)
const DECEASED_STATE_VALUE = 3;       // VaultState::Deceased
const CHALLENGE_PERIOD_STATE_VALUE = 1; // VaultState::ChallengePeriod (was 2, FIXED)
const TERMINUS_PROGRAM_ID = process.env['NEXT_PUBLIC_TERMINUS_PROGRAM_ID'] || process.env['TERMINUS_PROGRAM_ID'] || '';

/**
 * Returns unified Lit access conditions that unlock ONLY when the
 * Solana vault account has reached the `Deceased` (3) state.
 */
export function buildDeceasedConditions(
  vaultPDA: string,
  network: LitSolanaChain = resolveChain()
): UnifiedAccessControlConditions {
  if (!vaultPDA) {
    throw new Error('[AccessConditions] vaultPDA must be a non-empty base-58 string.');
  }
  if (!TERMINUS_PROGRAM_ID) {
    throw new Error('[AccessConditions] TERMINUS_PROGRAM_ID is required to build strict memcmp conditions.');
  }

  return [
    {
      conditionType: 'solRpc',
      method: 'getProgramAccounts',
      params: [
        TERMINUS_PROGRAM_ID,
        {
          encoding: 'base64',
          filters: [
            { memcmp: { offset: 0, bytes: buildAnchorDiscriminator('VaultAccount') } },
            { memcmp: { offset: STATE_BYTE_OFFSET, bytes: encodeStateByteBase58(DECEASED_STATE_VALUE) } },
          ],
        },
      ],
      chain: network,
      returnValueTest: {
        key: '$',
        comparator: 'contains',
        value: vaultPDA,
      },
    },
  ];
}

/**
 * Returns access conditions for the INCAPACITATED path.
 * The vault must be in ChallengePeriod (1) state.
 */
export function buildIncapacitatedConditions(
  vaultPDA: string,
  network: LitSolanaChain = resolveChain()
): UnifiedAccessControlConditions {
  if (!vaultPDA) {
    throw new Error('[AccessConditions] vaultPDA must be a non-empty base-58 string.');
  }
  if (!TERMINUS_PROGRAM_ID) {
    throw new Error('[AccessConditions] TERMINUS_PROGRAM_ID is required to build strict memcmp conditions.');
  }

  return [
    {
      conditionType: 'solRpc',
      method: 'getProgramAccounts',
      params: [
        TERMINUS_PROGRAM_ID,
        {
          encoding: 'base64',
          filters: [
            { memcmp: { offset: 0, bytes: buildAnchorDiscriminator('VaultAccount') } },
            { memcmp: { offset: STATE_BYTE_OFFSET, bytes: encodeStateByteBase58(CHALLENGE_PERIOD_STATE_VALUE) } },
          ],
        },
      ],
      chain: network,
      returnValueTest: {
        key: '$',
        comparator: 'contains',
        value: vaultPDA,
      },
    },
  ];
}

/**
 * Returns conditions for the owner's authenticated session.
 * The owner can always decrypt their own files (e.g. to update them).
 */
export function buildOwnerConditions(
  ownerSolanaAddress: string,
  network: LitSolanaChain = resolveChain()
): UnifiedAccessControlConditions {
  if (!ownerSolanaAddress) {
    throw new Error('[AccessConditions] ownerSolanaAddress must be a non-empty string.');
  }

  return [
    {
      conditionType: 'solRpc',
      method: 'getBalance',
      params: [':userAddress'],
      chain: network,
      returnValueTest: {
        key: '$.value',
        comparator: '>',
        value: '0',
      },
    },
  ];
}

// ── Internal helpers ───────────────────────────────────────────────

/**
 * Encodes the expected state byte as a base64 string for Lit's
 * `contains` comparator to match against the raw account data.
 */
function encodeStateByteBase58(stateVal: number): string {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  if (stateVal === 0) return '1';
  let num = stateVal;
  let encoded = '';
  while (num > 0) {
    const mod = num % 58;
    encoded = alphabet[mod] + encoded;
    num = Math.floor(num / 58);
  }
  return encoded;
}

function buildAnchorDiscriminator(accountName: string): string {
  const hash = createHash('sha256').update(`account:${accountName}`).digest();
  const first8 = hash.subarray(0, 8);
  return encodeBytesBase58(first8);
}

function encodeBytesBase58(input: Uint8Array): string {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let digits = [0];
  for (let i = 0; i < input.length; i += 1) {
    let carry = input[i] ?? 0;
    for (let j = 0; j < digits.length; j += 1) {
      const x = (digits[j] ?? 0) * 256 + carry;
      digits[j] = x % 58;
      carry = (x / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  for (let i = 0; i < input.length && input[i] === 0; i += 1) {
    digits.push(0);
  }
  return digits.reverse().map((d) => alphabet[d] || alphabet[0]).join('');
}

/** Maps SOLANA_NETWORK env var to Lit chain identifier. */
function resolveChain(): LitSolanaChain {
  const net = (process.env['SOLANA_NETWORK'] ?? 'devnet') as SolanaNetwork;
  const map: Record<SolanaNetwork, LitSolanaChain> = {
    'mainnet-beta': 'solana',
    'devnet': 'solanaDevnet',
    'testnet': 'solanaTestnet',
  };
  return map[net] ?? 'solanaDevnet';
}
