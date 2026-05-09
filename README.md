
# 🏛️ Terminus: Decentralized Inheritance & Trust Protocol

Terminus is an industrial-grade, Web3-native dead man's switch and inheritance protocol built on Solana. It enables users to secure digital assets (SOL, SPL tokens) and highly sensitive personal documents, ensuring they are autonomously transferred to designated beneficiaries only upon verified incapacitation or death.

---

## 🚀 The Problem & Our Solution

Traditional inheritance requires expensive lawyers, physical trust documents, and relies on human fiduciaries who can be compromised. 

**Terminus solves this by replacing the lawyer with a smart contract and the vault with decentralized cryptography.** Users establish an Inter Vivos Trust on-chain. As long as the user maintains their "heartbeat" (a zero-gas proof of life), the vault remains locked. If the heartbeat expires, the protocol enters a Challenge Period. If the user does not trigger the **Emergency Panic Button** (which slashes fraudulent claims), the assets and encrypted files are autonomously unlocked for the verified beneficiary.

---

## ⚙️ Technical Architecture & Stack

Terminus is built with a decoupled, high-performance architecture utilizing three core layers:

### 1. On-Chain Escrow (Smart Contracts)
* **Framework:** Solana & Anchor Framework (Rust)
* **Implementation:** Custom PDA-based vaults (`VaultAccount`) that store state constraints, challenge periods, and beneficiary mappings. 

### 2. The Verification Engine (Backend)
* **Framework:** Python (FastAPI)
* **Function:** Acts as the decentralized AI Oracle. It handles the watchdog services for heartbeat expirations, processes step-up authentication (OTP) for the panic button, and securely manages the off-chain trust verifications.

### 3. Client & Cryptography (Frontend)
* **Framework:** Next.js (TypeScript) & Tailwind CSS
* **Storage & Encryption:** Lit Protocol (`datil-test` network) & Pinata (IPFS)
* **Implementation:** Client-side encryption ensures files never touch a centralized server. We implemented a manual cryptographic handshake using Solana `signMessage` to seamlessly interface Lit Protocol with modern wallet adapters.

---

## ✨ Key Features

* **Sovereign File Encryption:** Utilizing **Lit Protocol**, sensitive documents (e.g., Living Wills) are encrypted client-side. The decryption keys are tied to the Solana Smart Contract state—meaning not even the Terminus developers can access the files.
* **Zero-Gas Heartbeats:** Users verify they are alive without paying transaction fees for every check-in, reducing the friction of maintaining the vault.
* **Stolen Device Protocol (Panic Button):** If a bad actor triggers an inheritance claim, the true owner receives an alert. Using an OTP-gated **Emergency Override**, the owner can instantly abort the execution and slash the attacker's staked SOL.
* **Direct SystemProgram Escrow:** Deposits interact directly with the Solana `SystemProgram` to move funds into derived PDA vaults safely.

---

## 📂 Repository Structure

```text
teminus-inheritance/
├── terminus/               # Solana Smart Contracts (Anchor/Rust)
│   ├── programs/           # Core protocol logic
│   └── tests/              # Contract test suites
├── Terminus-frontend/      # Next.js Client & Web3 UI
│   ├── app/lib/storage/    # Lit Protocol & Pinata IPFS utilities
│   └── components/         # Dashboard & Wallet integration
└── terminus-backend/       # FastAPI Verification Oracle
    ├── app/api/            # Heartbeat, OTP, and Watchdog routes
    └── main.py             # Server entry point

```

---

## 💻 Local Setup & Deployment

To run the Terminus environment locally:

### Prerequisites

* Node.js (v18+) & `pnpm`
* Python 3.10+
* Rust & Solana CLI (Anchor v0.30+)

### 1. Start the FastAPI Oracle

```bash
cd terminus-backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

```

### 2. Deploy Local Smart Contract

```bash
cd terminus
anchor build
anchor deploy

```

### 3. Launch the Frontend Application

```bash
cd Terminus-frontend
pnpm install
# Add your environment variables (.env.local) including Pinata JWT
pnpm dev

```

*The application will be live at `http://localhost:3000*`

```

```
