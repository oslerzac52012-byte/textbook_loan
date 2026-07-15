import {
  BASE_FEE,
  Contract,
  FeeBumpTransaction,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";

import type {
  Book,
  LoanStats,
} from "textbook_loan";

import {
  EXPLORER_BASE_URL,
  NETWORK_PASSPHRASE,
  RPC_URL,
  TRANSACTION_TIMEOUT_SECONDS,
  requireContractId,
} from "../contractConfig";

import {
  signWalletTransaction,
} from "./wallet";

type ContractArgument =
  ReturnType<typeof nativeToScVal>;

export interface ContractTransactionResult<T> {
  hash: string;
  result: T;
  explorerUrl: string;
}

const server =
  new rpc.Server(RPC_URL);

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "An unknown contract interaction error occurred.";
}

function delay(
  milliseconds: number,
): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(
      resolve,
      milliseconds,
    );
  });
}

async function buildContractTransaction(
  sourceAddress: string,
  functionName: string,
  argumentsList: ContractArgument[],
) {
  const sourceAccount =
    await server.getAccount(
      sourceAddress,
    );

  const contract =
    new Contract(
      requireContractId(),
    );

  return new TransactionBuilder(
    sourceAccount,
    {
      fee: BASE_FEE,
      networkPassphrase:
        NETWORK_PASSPHRASE,
    },
  )
    .addOperation(
      contract.call(
        functionName,
        ...argumentsList,
      ),
    )
    .setTimeout(
      TRANSACTION_TIMEOUT_SECONDS,
    )
    .build();
}

async function simulateRead<T>(
  sourceAddress: string,
  functionName: string,
  argumentsList: ContractArgument[],
): Promise<T> {
  try {
    const transaction =
      await buildContractTransaction(
        sourceAddress,
        functionName,
        argumentsList,
      );

    const simulation =
      await server.simulateTransaction(
        transaction,
      );

    if (
      !rpc.Api.isSimulationSuccess(
        simulation,
      )
    ) {
      throw new Error(
        `Simulation failed while calling ${functionName}.`,
      );
    }

    const returnValue =
      simulation.result?.retval;

    if (!returnValue) {
      throw new Error(
        `Contract function ${functionName} returned no value.`,
      );
    }

    return scValToNative(
      returnValue,
    ) as T;
  } catch (error) {
    throw new Error(
      `Unable to read ${functionName}: ${getErrorMessage(
        error,
      )}`,
      {
        cause: error,
      },
    );
  }
}

async function waitForTransaction(
  hash: string,
) {
  for (
    let attempt = 0;
    attempt <
    TRANSACTION_TIMEOUT_SECONDS;
    attempt += 1
  ) {
    const response =
      await server.getTransaction(
        hash,
      );

    if (
      response.status === "SUCCESS"
    ) {
      return response;
    }

    if (
      response.status === "FAILED"
    ) {
      throw new Error(
        `Transaction ${hash} failed on Stellar Testnet.`,
      );
    }

    await delay(1_000);
  }

  throw new Error(
    `Transaction ${hash} is still pending after ${TRANSACTION_TIMEOUT_SECONDS} seconds.`,
  );
}

async function invokeWrite<T>(
  sourceAddress: string,
  functionName: string,
  argumentsList: ContractArgument[],
): Promise<
  ContractTransactionResult<T>
> {
  try {
    const transaction =
      await buildContractTransaction(
        sourceAddress,
        functionName,
        argumentsList,
      );

    const preparedTransaction =
      await server.prepareTransaction(
        transaction,
      );

    const signedTransactionXdr =
      await signWalletTransaction(
        preparedTransaction.toXDR(),
        sourceAddress,
      );

    const signedTransaction =
      TransactionBuilder.fromXDR(
        signedTransactionXdr,
        NETWORK_PASSPHRASE,
      );

    if (
      signedTransaction instanceof
      FeeBumpTransaction
    ) {
      throw new Error(
        "Unexpected fee-bump transaction returned by Freighter.",
      );
    }

    const submission =
      await server.sendTransaction(
        signedTransaction,
      );

    if (
      submission.status !==
      "PENDING"
    ) {
      throw new Error(
        `RPC rejected ${functionName} with status ${submission.status}.`,
      );
    }

    const completedTransaction =
      await waitForTransaction(
        submission.hash,
      );

    if (
      !(
        "returnValue" in
        completedTransaction
      ) ||
      !completedTransaction.returnValue
    ) {
      throw new Error(
        `Transaction ${submission.hash} completed without a contract return value.`,
      );
    }

    return {
      hash: submission.hash,

      result: scValToNative(
        completedTransaction.returnValue,
      ) as T,

      explorerUrl:
        `${EXPLORER_BASE_URL}/tx/${submission.hash}`,
    };
  } catch (error) {
    throw new Error(
      `Unable to execute ${functionName}: ${getErrorMessage(
        error,
      )}`,
      {
        cause: error,
      },
    );
  }
}

export async function listBook(
  ownerAddress: string,
  bookId: bigint,
  title: string,
  isbn: string,
): Promise<
  ContractTransactionResult<bigint>
> {
  return invokeWrite<bigint>(
    ownerAddress,
    "list_book",
    [
      nativeToScVal(
        ownerAddress,
        {
          type: "address",
        },
      ),

      nativeToScVal(
        bookId,
        {
          type: "u64",
        },
      ),

      nativeToScVal(
        title,
        {
          type: "string",
        },
      ),

      nativeToScVal(
        isbn,
        {
          type: "string",
        },
      ),
    ],
  );
}

export async function requestLoan(
  borrowerAddress: string,
  bookId: bigint,
  returnBy: bigint,
): Promise<
  ContractTransactionResult<boolean>
> {
  return invokeWrite<boolean>(
    borrowerAddress,
    "request_loan",
    [
      nativeToScVal(
        borrowerAddress,
        {
          type: "address",
        },
      ),

      nativeToScVal(
        bookId,
        {
          type: "u64",
        },
      ),

      nativeToScVal(
        returnBy,
        {
          type: "u64",
        },
      ),
    ],
  );
}

export async function cancelRequest(
  borrowerAddress: string,
  bookId: bigint,
): Promise<
  ContractTransactionResult<boolean>
> {
  return invokeWrite<boolean>(
    borrowerAddress,
    "cancel_request",
    [
      nativeToScVal(
        borrowerAddress,
        {
          type: "address",
        },
      ),

      nativeToScVal(
        bookId,
        {
          type: "u64",
        },
      ),
    ],
  );
}

export async function rejectRequest(
  ownerAddress: string,
  bookId: bigint,
): Promise<
  ContractTransactionResult<boolean>
> {
  return invokeWrite<boolean>(
    ownerAddress,
    "reject_request",
    [
      nativeToScVal(
        ownerAddress,
        {
          type: "address",
        },
      ),

      nativeToScVal(
        bookId,
        {
          type: "u64",
        },
      ),
    ],
  );
}

export async function confirmLoan(
  ownerAddress: string,
  bookId: bigint,
): Promise<
  ContractTransactionResult<boolean>
> {
  return invokeWrite<boolean>(
    ownerAddress,
    "confirm_loan",
    [
      nativeToScVal(
        ownerAddress,
        {
          type: "address",
        },
      ),

      nativeToScVal(
        bookId,
        {
          type: "u64",
        },
      ),
    ],
  );
}

export async function markReturned(
  ownerAddress: string,
  bookId: bigint,
): Promise<
  ContractTransactionResult<boolean>
> {
  return invokeWrite<boolean>(
    ownerAddress,
    "mark_returned",
    [
      nativeToScVal(
        ownerAddress,
        {
          type: "address",
        },
      ),

      nativeToScVal(
        bookId,
        {
          type: "u64",
        },
      ),
    ],
  );
}

export async function getBook(
  sourceAddress: string,
  bookId: bigint,
): Promise<Book> {
  return simulateRead<Book>(
    sourceAddress,
    "get_book",
    [
      nativeToScVal(
        bookId,
        {
          type: "u64",
        },
      ),
    ],
  );
}

export async function listBooks(
  sourceAddress: string,
): Promise<bigint[]> {
  return simulateRead<bigint[]>(
    sourceAddress,
    "list_books",
    [],
  );
}

export async function isBookAvailable(
  sourceAddress: string,
  bookId: bigint,
): Promise<boolean> {
  return simulateRead<boolean>(
    sourceAddress,
    "is_available",
    [
      nativeToScVal(
        bookId,
        {
          type: "u64",
        },
      ),
    ],
  );
}

export async function getLoanStats(
  sourceAddress: string,
): Promise<LoanStats> {
  return simulateRead<LoanStats>(
    sourceAddress,
    "get_stats",
    [],
  );
}
