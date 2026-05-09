import * as LitJsSdk from "@lit-protocol/lit-node-client";

const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT;

export async function uploadEncryptedVaultFile(params: {
  file: File;
  ownerPubkey: string;
  vaultPDA: string;
  authSig: any;
}) {
  if (!PINATA_JWT) throw new Error("Pinata JWT is missing.");

  // 1. Establish Secure Connection to Lit Network
  const client = new LitJsSdk.LitNodeClient({
    litNetwork: "datil-test", // <-- CHANGED TO DATIL-TEST
    debug: false,
  });
  await client.connect();

  // INDUSTRIAL STANDARD: Restrict decryption to the Vault Owner
  const accessControlConditions = [
    {
      method: "",
      title: "",
      env: "devnet",
      pdaParams: [],
      pdaInterface: { offset: 0, fields: {} },
      pdaKey: "",
      chain: "solana",
      returnValueTest: {
        key: "",
        comparator: "=",
        value: params.ownerPubkey,
      },
    },
  ];

  // Pass the manual AuthSig and the Conditions directly to Lit
  const { ciphertext, dataToEncryptHash } = await LitJsSdk.encryptFile(
    {
      file: params.file,
      authSig: params.authSig, 
      solRpcConditions: accessControlConditions, 
    },
    client
  );

  const formData = new FormData();
  formData.append("file", new Blob([ciphertext], { type: "application/octet-stream" }));
  
  const pinataMetadata = JSON.stringify({
    name: `terminus_file_${params.vaultPDA.slice(0, 8)}`,
    keyvalues: {
      vault: params.vaultPDA,
      dataHash: dataToEncryptHash,
      owner: params.ownerPubkey
    }
  });
  formData.append("pinataMetadata", pinataMetadata);

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: formData,
  });

  if (!res.ok) throw new Error("IPFS Gateway Error");
  const data = await res.json();

  return { metadataCid: data.IpfsHash, dataToEncryptHash };
}