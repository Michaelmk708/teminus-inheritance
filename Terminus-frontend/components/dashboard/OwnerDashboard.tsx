"use client";

import { utils } from "@coral-xyz/anchor";
import { useState, useEffect, useCallback } from "react";
import { Badge, Button, Card, CardHeader, FormInput } from "@/components/ui";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction, SystemProgram, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { executePanicButton } from "@/app/lib/solanaClient";
import { uploadEncryptedVaultFile } from "@/app/lib/storage/upload";
import clsx from "clsx";

interface Props { 
  user: { name: string; email: string; vault_pda?: string; owner_pubkey?: string; }; 
}

export default function OwnerDashboard({ user }: Props) {
  const { connection } = useConnection();
  const { publicKey, signTransaction, signMessage } = useWallet();
  const firstName = user.name.split(" ")[0] || "Owner";

  // ─── CORE STATE ───
  const [vaultData, setVaultData] = useState<any>(null);
  const [vaultBalance, setVaultBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // ─── SEPARATED MODAL STATES ───
  const [showDepositSolModal, setShowDepositSolModal] = useState(false);
  const [showDepositFileModal, setShowDepositFileModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  
  // ─── INPUT STATES ───
  const [solAmount, setSolAmount] = useState("0.1");
  const [uploading, setUploading] = useState(false);
  
  // ─── SECURITY STATES ───
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpPhone, setOtpPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);

  // ─── DATA SYNCHRONIZATION ───
  const refreshData = useCallback(async () => {
    if (!user.owner_pubkey || !user.vault_pda) return;
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      
      // Fetch Metadata (Files, Beneficiary, Tier)
      const response = await fetch(`${backendUrl}/api/vault/${user.owner_pubkey}`);
      const data = await response.json();
      setVaultData(data);

      // Fetch On-Chain SOL Balance
      const balance = await connection.getBalance(new PublicKey(user.vault_pda));
      setVaultBalance(balance / LAMPORTS_PER_SOL);
    } catch (err) { 
      console.error("Sync Error:", err); 
    } finally { 
      setLoading(false); 
    }
  }, [user.owner_pubkey, user.vault_pda, connection]);

  useEffect(() => { refreshData(); }, [refreshData]);

  // ─── TRANSACTION LOGIC ───
  const handleSolDeposit = async () => {
    if (!publicKey || !signTransaction || !user.vault_pda) return;
    setIsActionLoading(true);
    try {
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(user.vault_pda),
          lamports: parseFloat(solAmount) * LAMPORTS_PER_SOL,
        })
      );
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signed = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature);
      
      alert(`✓ ${solAmount} SOL successfully secured in vault.`);
      setShowDepositSolModal(false);
      setSolAmount("0.1"); // Reset
      refreshData();
    } catch (err: any) {
      alert(`Deposit failed: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  // ─── ENCRYPTION LOGIC ───
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !publicKey || !user.vault_pda) return;

    if (!signMessage) {
      alert("Your current wallet adapter does not support message signing required for encryption.");
      return;
    }

    setUploading(true);
    try {
      // 1. Manually construct AuthSig using Next.js Wallet Adapter
      const message = "Sign this message to authenticate with Terminus and encrypt your vault file.";
      const encodedMessage = new TextEncoder().encode(message);
      
      // This triggers the reliable wallet popup
      const signatureBytes = await signMessage(encodedMessage);
      const signatureBase58 = utils.bytes.bs58.encode(signatureBytes);

      const authSig = {
        sig: signatureBase58,
        derivedVia: "solana.signMessage",
        signedMessage: message,
        address: publicKey.toBase58(),
      };

      // 2. Pass manual signature to storage utility
      const result = await uploadEncryptedVaultFile({
        file,
        ownerPubkey: publicKey.toBase58(),
        vaultPDA: user.vault_pda,
        authSig // Explicit signature
      });

      alert("✓ Document encrypted and pinned to IPFS.");
      setShowDepositFileModal(false);
      refreshData();
    } catch (err: any) {
      console.error("Encryption Error:", err);
      alert(`Security Handshake Failed: ${err.message || "User rejected signature request"}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-12 py-10 animate-fade-up">
      {loading && (
        <div className="h-[60vh] flex flex-col items-center justify-center">
          <div className="w-10 h-10 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && (
        <>
          {/* HEADER */}
          <div className="flex items-start justify-between mb-10 border-b border-line pb-6">
            <div>
              <h1 className="font-display text-4xl font-light text-cream mb-1">
                Vault: <em className="italic text-gold-light">{firstName}</em>
              </h1>
              <div className="flex items-center gap-4 mt-2">
                <Badge variant="outline" className="border-gold text-gold bg-gold/10">Active</Badge>
                <p className="font-mono text-[12px] text-muted tracking-widest uppercase">
                  Balance: <span className="text-cream font-medium">{vaultBalance.toFixed(4)} SOL</span>
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-mono text-[10px] text-muted tracking-widest uppercase mb-1">Vault PDA Address</p>
              <div className="bg-glass border border-line px-4 py-2 rounded-lg font-mono text-[11px] text-muted-2">
                {user.vault_pda}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_380px] gap-6">
            {/* LEFT COLUMN */}
            <div className="flex flex-col gap-6">
              
              <Card>
                <CardHeader title="Escrow Assets" />
                <div className="px-7 py-6">
                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <Button variant="gold-outline" onClick={() => setShowDepositSolModal(true)} className="py-6 border-dashed">
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-xl">💰</span>
                        <span>Deposit Crypto</span>
                      </div>
                    </Button>
                    <Button variant="gold-outline" onClick={() => setShowDepositFileModal(true)} className="py-6 border-dashed">
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-xl">📄</span>
                        <span>Secure Private File</span>
                      </div>
                    </Button>
                  </div>

                  {/* Vault File List */}
                  <div>
                    <h3 className="font-mono text-[11px] text-muted tracking-widest uppercase mb-3 border-b border-line pb-2">Encrypted Documents</h3>
                    {vaultData?.files?.length > 0 ? (
                      <div className="space-y-3">
                        {vaultData.files.map((f: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-glass border border-line rounded-lg">
                            <div className="flex items-center gap-3">
                              <span className="text-muted">📄</span>
                              <p className="font-mono text-xs text-cream">{f.name}</p>
                            </div>
                            <Badge variant="success">Secured in IPFS</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 bg-glass border border-line border-dashed rounded-lg">
                        <p className="text-sm text-muted">No encrypted documents stored yet.</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* Panic Button */}
              <div className="flex items-center justify-between gap-6 p-7 rounded-xl bg-red-900/5 border border-red-900/20">
                <div>
                  <p className="text-[14px] text-cream font-medium mb-1">Emergency Override</p>
                  <p className="text-[12px] text-muted leading-relaxed">Instantly slash fraudulent triggers.</p>
                </div>
                <Button variant="danger" onClick={() => setShowOtpModal(true)}>⚡ Panic Button</Button>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="flex flex-col gap-6">
              
              <Card>
                <CardHeader title="Next of Kin" />
                <div className="p-7">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-full bg-ink-3 border border-line flex items-center justify-center text-xl">
                      {vaultData?.beneficiary ? "👤" : "❓"}
                    </div>
                    <div>
                      <p className="text-sm text-cream font-medium">{vaultData?.beneficiary_name || "Unassigned"}</p>
                      <p className="font-mono text-[10px] text-muted mt-0.5">
                        {vaultData?.beneficiary ? `${vaultData.beneficiary.slice(0, 12)}...` : "Setup Required"}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" full onClick={() => setShowUpdateModal(true)} className="border border-line">
                    Manage Access
                  </Button>
                </div>
              </Card>

              <Card>
                <CardHeader title="Subscription Tier" />
                <div className="p-7">
                  <div className="p-5 rounded-xl border border-line bg-glass">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-display text-2xl text-cream">{vaultData?.is_premium ? "Premium" : "Free"}</p>
                      {vaultData?.is_premium && <Badge variant="success">Active</Badge>}
                    </div>
                    <p className="text-xs text-muted mb-4">
                      {vaultData?.is_premium ? "Unlimited Files & Custom Distribution" : "Basic Escrow & 0.5 SOL Limit"}
                    </p>
                    
                    {!vaultData?.is_premium && (
                      <Button variant="primary" full onClick={() => alert("Redirecting to Premium Upgrade Checkout...")}>
                        Upgrade for $9.99/mo
                      </Button>
                    )}
                  </div>
                </div>
              </Card>

            </div>
          </div>
        </>
      )}

      {/* ─── MODALS ─── */}

      {/* 1. Deposit SOL Modal */}
      {showDepositSolModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-ink border border-line p-8 rounded-2xl max-w-md w-full shadow-2xl">
            <h3 className="text-xl text-cream mb-2 font-display italic">Deposit Crypto</h3>
            <p className="text-xs text-muted mb-6">Transfer SOL securely into your Terminus smart contract vault.</p>
            <FormInput label="Amount (SOL)" value={solAmount} onChange={setSolAmount} placeholder="e.g. 1.5" />
            <div className="flex gap-3 mt-8">
              <Button variant="ghost" className="flex-1" onClick={() => setShowDepositSolModal(false)}>Cancel</Button>
              <Button variant="primary" className="flex-[2]" onClick={handleSolDeposit} disabled={isActionLoading}>
                {isActionLoading ? "Processing on-chain..." : "Confirm Deposit"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Deposit File Modal */}
      {showDepositFileModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-ink border border-line p-8 rounded-2xl max-w-md w-full shadow-2xl">
            <h3 className="text-xl text-cream mb-2 font-display italic">Secure Private File</h3>
            <p className="text-xs text-muted mb-6">Files are encrypted via Lit Protocol using your wallet signature before leaving your device.</p>
            
            <div className="p-6 border border-dashed border-line rounded-xl bg-glass flex flex-col items-center justify-center">
              <input type="file" onChange={handleFileUpload} className="w-full text-xs text-muted file:bg-gold file:text-ink file:border-0 file:rounded file:px-4 file:py-2 file:mr-4 file:cursor-pointer file:font-bold" />
            </div>
            
            {uploading && (
              <div className="mt-4 p-3 bg-gold/10 border border-gold/30 rounded text-gold text-xs text-center animate-pulse">
                🔒 Requesting wallet signature and encrypting...
              </div>
            )}
            
            <Button variant="ghost" full className="mt-6" onClick={() => setShowDepositFileModal(false)} disabled={uploading}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* 3. Update Access Modal */}
      {showUpdateModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-ink border border-line p-8 rounded-2xl max-w-md w-full shadow-2xl">
            <h3 className="text-xl text-cream mb-6 font-display italic">Update Access Protocol</h3>
            <div className="space-y-4">
              <FormInput label="New Beneficiary ID" placeholder="Enter Solana Pubkey" />
              <Button variant="primary" full onClick={() => {
                alert("Updating Smart Contract State...");
                setShowUpdateModal(false);
              }}>Commit On-Chain Changes</Button>
              <Button variant="ghost" full onClick={() => setShowUpdateModal(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Panic OTP Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-ink border border-red-900/30 p-8 rounded-2xl max-w-md w-full shadow-2xl">
            <h3 className="text-xl text-cream mb-2 font-display">Step-Up Authentication</h3>
            <p className="text-sm text-muted mb-6">Verify your identity to authorize the Panic Button.</p>
            <FormInput label="Verified Phone" placeholder="+254..." value={otpPhone} onChange={setOtpPhone} />
            <FormInput label="OTP Code" placeholder="123456" value={otpCode} onChange={setOtpCode} className="mt-4" />
            {otpError && <p className="text-xs text-red-400 mt-2">{otpError}</p>}
            <div className="flex gap-3 mt-8">
              <Button variant="ghost" onClick={() => setShowOtpModal(false)} className="flex-1">Cancel</Button>
              <Button variant="danger" onClick={() => {/* Slashing logic */}} className="flex-1">Confirm Slash</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}