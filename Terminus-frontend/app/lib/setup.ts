/**
 * app/lib/setup.ts
 * ─────────────────────────────────────────────────────────────
 * Terminus Smart Contract Setup & Connection
 *
 * This file initializes the Anchor program connection to the live
 * Solana Devnet Terminus smart contract.
 *
 * Program ID: EYjKKn4Qhjv2d2fE9yggedBdLJBPHiumwfbVLtofMMsb
 * Network: Solana Devnet
 *
 * Usage:
 *   const provider = useAnchorProvider(); // from Solana Wallet Adapter
 *   const program = getTerminusProgram(provider);
 *   await program.methods.initializeVault({...}).rpc();
 * ─────────────────────────────────────────────────────────────
 */

import { Program, AnchorProvider, Idl, setProvider } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import terminusIDL from "../../idl/terminus_idl.json";

/**
 * LIVE PROGRAM ID on Solana Devnet
 * This is the deployed Terminus smart contract address.
 * DO NOT CHANGE without re-deploying the contract.
 */
const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_TERMINUS_PROGRAM_ID ||
    "EYjKKn4Qhjv2d2fE9yggedBdLJBPHiumwfbVLtofMMsb"
);

/**
 * IDL (Interface Definition Language) for the Terminus program.
 * This matches the deployed smart contract's instruction set and accounts.
 * Force TypeScript to accept the raw JSON as an Idl type.
 */
export const IDL = terminusIDL as unknown as Idl;

/**
 * Get the Solana RPC connection endpoint.
 * Defaults to Devnet, can be overridden with env var.
 */
export const getConnection = () => {
  const rpc =
    process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT ||
    "https://api.devnet.solana.com";
  return new Connection(rpc, "confirmed");
};

/**
 * Initialize the Terminus Program instance.
 *
 * This creates a Program object that can be used to:
 * - Build instructions (.methods.xxx())
 * - Call RPC methods (.rpc())
 * - Fetch accounts (.account.xxx.fetch())
 * - Parse events
 *
 * @param provider - AnchorProvider with wallet signer and connection
 * @returns Program instance ready for instruction building
 *
 * @example
 * const provider = useAnchorProvider();
 * const program = getTerminusProgram(provider);
 * const tx = await program.methods
 *   .initializeVault({
 *     beneficiary: new PublicKey("..."),
 *     fiduciary: new PublicKey("..."),
 *     aiOracle: new PublicKey("..."),
 *     medicalAllowance: new BN(1_000_000),
 *     depositAmount: new BN(5_000_000),
 *   })
 *   .rpc();
 */
export const getTerminusProgram = (provider: AnchorProvider) => {
  setProvider(provider);
  // Anchor 0.29.0 requires all three arguments: IDL, Program ID, Provider
  return new Program(IDL, PROGRAM_ID, provider);
};

/**
 * Utility: Get the Program ID as a string
 */
export const getProgramId = () => PROGRAM_ID.toBase58();

/**
 * Utility: Get the Program ID as a PublicKey
 */
export const getProgramIdPublicKey = () => PROGRAM_ID;