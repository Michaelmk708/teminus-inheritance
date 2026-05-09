"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import HomePage from "@/components/home/HomePage";
import CreateVault from "@/components/dashboard/CreateVault";
import OwnerDashboard from "@/components/dashboard/OwnerDashboard";
import BeneficiaryPortal from "@/components/portal/BeneficiaryPortal";

export type Tab = "home" | "owner" | "beneficiary";

export interface VaultUser {
  name: string;
  email: string;
  vault_pda?: string;
  owner_pubkey?: string;
}

export default function Page() {
  const [tab, setTab] = useState<Tab>("home");
  const [vaultUser, setVaultUser] = useState<VaultUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // ─── PROTOTYPE GATEKEEPER ───
  // Since the dashboard is a static zero-state, we safely skip the backend read 
  // and only check if the user successfully created a vault in this session.
  useEffect(() => {
    const savedUser = localStorage.getItem("terminus_user");
    if (savedUser) {
      try {
        setVaultUser(JSON.parse(savedUser));
      } catch (e) {}
    }
    setIsChecking(false); // Instantly stop the loading screen
  }, []);

  function handleNavigate(t: Tab) {
    if (t === "owner") {
      if (vaultUser) {
        setCreating(false);
        setTab("owner");
      } else {
        setCreating(true);
        setTab("owner");
      }
    } else {
      setCreating(false);
      setTab(t);
    }
  }

  function handleLogout() {
    // PRODUCTION FIX: Clear all session data on logout
    console.log("[AUTH] Logging out user...");
    localStorage.removeItem("terminus_user");
    localStorage.removeItem("terminus_vault_session");
    setVaultUser(null);
    setTab("home");
    setCreating(false);
    console.log("[AUTH] ✓ User logged out");
  }

  function handleVaultCreated(user: VaultUser) {
    // Captures the REAL data from the legit creation flow
    setVaultUser(user);
    localStorage.setItem("terminus_user", JSON.stringify(user));
    setTab("owner");
  }

  return (
    <main className="min-h-screen">
      <Navbar activeTab={tab} onTabChange={handleNavigate} onLogout={handleLogout} isLoggedIn={!!vaultUser} />
      <div className="pt-[72px]">
        
        {tab === "home" && <HomePage onNavigate={handleNavigate} />}

        {tab === "owner" && isChecking && (
          <div className="flex flex-col items-center justify-center h-[50vh]">
            <div className="w-10 h-10 border-2 border-gold border-t-transparent rounded-full animate-spin mb-4" />
          </div>
        )}

        {/* Creation Flow */}
        {tab === "owner" && !isChecking && !vaultUser && (
          <CreateVault onCreated={handleVaultCreated} />
        )}

        {/* Owner Dashboard (Zero-State) */}
        {tab === "owner" && !isChecking && vaultUser && (
          <OwnerDashboard user={vaultUser} />
        )}

        {tab === "beneficiary" && <BeneficiaryPortal />}
      </div>
    </main>
  );
}