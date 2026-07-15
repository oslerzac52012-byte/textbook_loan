import {
  getAddress,
  getNetworkDetails,
  isConnected,
  requestAccess,
  setAllowed,
  signTransaction,
} from "@stellar/freighter-api";

import {
  NETWORK_PASSPHRASE,
  STELLAR_NETWORK,
} from "../contractConfig";

export interface WalletConnection {
  address: string;
  network: string;
  networkPassphrase: string;
  sorobanRpcUrl?: string;
}

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "An unknown Freighter wallet error occurred.";
}

export async function checkFreighterInstalled():
Promise<boolean> {
  const result = await isConnected();

  if (result.error) {
    throw new Error(
      getErrorMessage(result.error),
    );
  }

  return result.isConnected;
}

export async function connectWallet():
Promise<WalletConnection> {
  const connectionResult =
    await isConnected();

  if (connectionResult.error) {
    throw new Error(
      getErrorMessage(
        connectionResult.error,
      ),
    );
  }

  if (!connectionResult.isConnected) {
    throw new Error(
      "Freighter is not installed or is unavailable in this browser.",
    );
  }

  const permissionResult =
    await setAllowed();

  if (permissionResult.error) {
    throw new Error(
      getErrorMessage(
        permissionResult.error,
      ),
    );
  }

  if (!permissionResult.isAllowed) {
    throw new Error(
      "Freighter access was not approved.",
    );
  }

  const accessResult =
    await requestAccess();

  if (accessResult.error) {
    throw new Error(
      getErrorMessage(
        accessResult.error,
      ),
    );
  }

  const addressResult =
    await getAddress();

  if (addressResult.error) {
    throw new Error(
      getErrorMessage(
        addressResult.error,
      ),
    );
  }

  const address =
    addressResult.address ||
    accessResult.address;

  if (!address) {
    throw new Error(
      "Freighter did not return a wallet address.",
    );
  }

  const networkResult =
    await getNetworkDetails();

  if (networkResult.error) {
    throw new Error(
      getErrorMessage(
        networkResult.error,
      ),
    );
  }

  if (
    networkResult.network !==
    STELLAR_NETWORK
  ) {
    throw new Error(
      `Switch Freighter to ${STELLAR_NETWORK}. Current network: ${
        networkResult.network || "unknown"
      }.`,
    );
  }

  return {
    address,
    network: networkResult.network,
    networkPassphrase:
      networkResult.networkPassphrase ||
      NETWORK_PASSPHRASE,
    sorobanRpcUrl:
      networkResult.sorobanRpcUrl,
  };
}

export async function getCurrentWallet():
Promise<WalletConnection | null> {
  const connectionResult =
    await isConnected();

  if (connectionResult.error) {
    throw new Error(
      getErrorMessage(
        connectionResult.error,
      ),
    );
  }

  if (!connectionResult.isConnected) {
    return null;
  }

  const addressResult =
    await getAddress();

  if (
    addressResult.error ||
    !addressResult.address
  ) {
    return null;
  }

  const networkResult =
    await getNetworkDetails();

  if (networkResult.error) {
    throw new Error(
      getErrorMessage(
        networkResult.error,
      ),
    );
  }

  return {
    address: addressResult.address,
    network: networkResult.network,
    networkPassphrase:
      networkResult.networkPassphrase ||
      NETWORK_PASSPHRASE,
    sorobanRpcUrl:
      networkResult.sorobanRpcUrl,
  };
}

export async function signWalletTransaction(
  transactionXdr: string,
  address: string,
): Promise<string> {
  const result =
    await signTransaction(
      transactionXdr,
      {
        networkPassphrase:
          NETWORK_PASSPHRASE,
        address,
      },
    );

  if (result.error) {
    throw new Error(
      getErrorMessage(result.error),
    );
  }

  if (!result.signedTxXdr) {
    throw new Error(
      "Freighter did not return a signed transaction.",
    );
  }

  return result.signedTxXdr;
}
