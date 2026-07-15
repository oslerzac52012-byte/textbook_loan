import { Networks } from "@stellar/stellar-sdk";

const DEFAULT_RPC_URL =
  "https://soroban-testnet.stellar.org";

export const STELLAR_NETWORK =
  import.meta.env.VITE_STELLAR_NETWORK
    ?.trim()
    .toUpperCase() || "TESTNET";

export const NETWORK_PASSPHRASE =
  Networks.TESTNET;

export const RPC_URL =
  import.meta.env.VITE_STELLAR_RPC_URL
    ?.trim() || DEFAULT_RPC_URL;

export const CONTRACT_ID =
  import.meta.env.VITE_CONTRACT_ID
    ?.trim() || "";

export const TRANSACTION_TIMEOUT_SECONDS =
  30;

export const EXPLORER_BASE_URL =
  "https://stellar.expert/explorer/testnet";

export function requireContractId(): string {
  const isValidContractId =
    /^C[A-Z2-7]{55}$/.test(CONTRACT_ID);

  if (!isValidContractId) {
    throw new Error(
      "The deployed contract ID is missing. Add VITE_CONTRACT_ID to frontend/.env.",
    );
  }

  return CONTRACT_ID;
}
