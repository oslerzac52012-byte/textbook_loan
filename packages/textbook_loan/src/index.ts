import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}





export interface Book {
  book_id: u64;
  borrower: Option<string>;
  isbn: string;
  listed_at: u64;
  loan_count: u32;
  owner: string;
  return_by: u64;
  status: BookStatus;
  title: string;
}


export interface LoanStats {
  available_books: u32;
  completed_loans: u32;
  loaned_books: u32;
  requested_books: u32;
  total_books: u32;
}

export type BookStatus = {tag: "Available", values: void} | {tag: "Requested", values: void} | {tag: "Loaned", values: void};



export const ContractError = {
  1: {message:"BookNotFound"},
  2: {message:"BookAlreadyExists"},
  3: {message:"BookNotAvailable"},
  4: {message:"InvalidReturnDate"},
  5: {message:"OwnerCannotBorrow"},
  6: {message:"NoPendingRequest"},
  7: {message:"UnauthorizedOwner"},
  8: {message:"UnauthorizedBorrower"},
  9: {message:"BookNotLoaned"}
}





export interface Client {
  /**
   * Construct and simulate a get_book transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_book: ({book_id}: {book_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Book>>

  /**
   * Construct and simulate a get_stats transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_stats: (options?: MethodOptions) => Promise<AssembledTransaction<LoanStats>>

  /**
   * Construct and simulate a list_book transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  list_book: ({owner, book_id, title, isbn}: {owner: string, book_id: u64, title: string, isbn: string}, options?: MethodOptions) => Promise<AssembledTransaction<u64>>

  /**
   * Construct and simulate a list_books transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  list_books: (options?: MethodOptions) => Promise<AssembledTransaction<Array<u64>>>

  /**
   * Construct and simulate a confirm_loan transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  confirm_loan: ({owner, book_id}: {owner: string, book_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a is_available transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_available: ({book_id}: {book_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a request_loan transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  request_loan: ({borrower, book_id, return_by}: {borrower: string, book_id: u64, return_by: u64}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a mark_returned transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  mark_returned: ({owner, book_id}: {owner: string, book_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a cancel_request transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  cancel_request: ({borrower, book_id}: {borrower: string, book_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a reject_request transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  reject_request: ({owner, book_id}: {owner: string, book_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAQAAAAAAAAAAAAAABEJvb2sAAAAJAAAAAAAAAAdib29rX2lkAAAAAAYAAAAAAAAACGJvcnJvd2VyAAAD6AAAABMAAAAAAAAABGlzYm4AAAAQAAAAAAAAAAlsaXN0ZWRfYXQAAAAAAAAGAAAAAAAAAApsb2FuX2NvdW50AAAAAAAEAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAACXJldHVybl9ieQAAAAAAAAYAAAAAAAAABnN0YXR1cwAAAAAH0AAAAApCb29rU3RhdHVzAAAAAAAAAAAABXRpdGxlAAAAAAAAEA==",
        "AAAAAQAAAAAAAAAAAAAACUxvYW5TdGF0cwAAAAAAAAUAAAAAAAAAD2F2YWlsYWJsZV9ib29rcwAAAAAEAAAAAAAAAA9jb21wbGV0ZWRfbG9hbnMAAAAABAAAAAAAAAAMbG9hbmVkX2Jvb2tzAAAABAAAAAAAAAAPcmVxdWVzdGVkX2Jvb2tzAAAAAAQAAAAAAAAAC3RvdGFsX2Jvb2tzAAAAAAQ=",
        "AAAAAgAAAAAAAAAAAAAACkJvb2tTdGF0dXMAAAAAAAMAAAAAAAAAAAAAAAlBdmFpbGFibGUAAAAAAAAAAAAAAAAAAAlSZXF1ZXN0ZWQAAAAAAAAAAAAAAAAAAAZMb2FuZWQAAA==",
        "AAAABQAAAAAAAAAAAAAACkJvb2tMaXN0ZWQAAAAAAAIAAAAIdGV4dGJvb2sAAAAGbGlzdGVkAAAAAAAEAAAAAAAAAAdib29rX2lkAAAAAAYAAAABAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAAAAAAAAV0aXRsZQAAAAAAABAAAAAAAAAAAAAAAARpc2JuAAAAEAAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAADEJvb2tSZXR1cm5lZAAAAAIAAAAIdGV4dGJvb2sAAAAIcmV0dXJuZWQAAAAEAAAAAAAAAAdib29rX2lkAAAAAAYAAAABAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAAAAAAAAhib3Jyb3dlcgAAABMAAAAAAAAAAAAAAApsb2FuX2NvdW50AAAAAAAEAAAAAAAAAAI=",
        "AAAABAAAAAAAAAAAAAAADUNvbnRyYWN0RXJyb3IAAAAAAAAJAAAAAAAAAAxCb29rTm90Rm91bmQAAAABAAAAAAAAABFCb29rQWxyZWFkeUV4aXN0cwAAAAAAAAIAAAAAAAAAEEJvb2tOb3RBdmFpbGFibGUAAAADAAAAAAAAABFJbnZhbGlkUmV0dXJuRGF0ZQAAAAAAAAQAAAAAAAAAEU93bmVyQ2Fubm90Qm9ycm93AAAAAAAABQAAAAAAAAAQTm9QZW5kaW5nUmVxdWVzdAAAAAYAAAAAAAAAEVVuYXV0aG9yaXplZE93bmVyAAAAAAAABwAAAAAAAAAUVW5hdXRob3JpemVkQm9ycm93ZXIAAAAIAAAAAAAAAA1Cb29rTm90TG9hbmVkAAAAAAAACQ==",
        "AAAABQAAAAAAAAAAAAAADUxvYW5Db25maXJtZWQAAAAAAAACAAAACHRleHRib29rAAAACWNvbmZpcm1lZAAAAAAAAAQAAAAAAAAAB2Jvb2tfaWQAAAAABgAAAAEAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAAAAAACGJvcnJvd2VyAAAAEwAAAAAAAAAAAAAACXJldHVybl9ieQAAAAAAAAYAAAAAAAAAAg==",
        "AAAABQAAAAAAAAAAAAAADUxvYW5SZXF1ZXN0ZWQAAAAAAAACAAAACHRleHRib29rAAAACXJlcXVlc3RlZAAAAAAAAAMAAAAAAAAAB2Jvb2tfaWQAAAAABgAAAAEAAAAAAAAACGJvcnJvd2VyAAAAEwAAAAAAAAAAAAAACXJldHVybl9ieQAAAAAAAAYAAAAAAAAAAg==",
        "AAAABQAAAAAAAAAAAAAAD1JlcXVlc3RSZWplY3RlZAAAAAACAAAACHRleHRib29rAAAACHJlamVjdGVkAAAAAwAAAAAAAAAHYm9va19pZAAAAAAGAAAAAQAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAAAAAAIYm9ycm93ZXIAAAATAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAAEFJlcXVlc3RDYW5jZWxsZWQAAAACAAAACHRleHRib29rAAAACWNhbmNlbGxlZAAAAAAAAAIAAAAAAAAAB2Jvb2tfaWQAAAAABgAAAAEAAAAAAAAACGJvcnJvd2VyAAAAEwAAAAAAAAAC",
        "AAAAAAAAAAAAAAAIZ2V0X2Jvb2sAAAABAAAAAAAAAAdib29rX2lkAAAAAAYAAAABAAAH0AAAAARCb29r",
        "AAAAAAAAAAAAAAAJZ2V0X3N0YXRzAAAAAAAAAAAAAAEAAAfQAAAACUxvYW5TdGF0cwAAAA==",
        "AAAAAAAAAAAAAAAJbGlzdF9ib29rAAAAAAAABAAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAdib29rX2lkAAAAAAYAAAAAAAAABXRpdGxlAAAAAAAAEAAAAAAAAAAEaXNibgAAABAAAAABAAAABg==",
        "AAAAAAAAAAAAAAAKbGlzdF9ib29rcwAAAAAAAAAAAAEAAAPqAAAABg==",
        "AAAAAAAAAAAAAAAMY29uZmlybV9sb2FuAAAAAgAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAdib29rX2lkAAAAAAYAAAABAAAAAQ==",
        "AAAAAAAAAAAAAAAMaXNfYXZhaWxhYmxlAAAAAQAAAAAAAAAHYm9va19pZAAAAAAGAAAAAQAAAAE=",
        "AAAAAAAAAAAAAAAMcmVxdWVzdF9sb2FuAAAAAwAAAAAAAAAIYm9ycm93ZXIAAAATAAAAAAAAAAdib29rX2lkAAAAAAYAAAAAAAAACXJldHVybl9ieQAAAAAAAAYAAAABAAAAAQ==",
        "AAAAAAAAAAAAAAANbWFya19yZXR1cm5lZAAAAAAAAAIAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAHYm9va19pZAAAAAAGAAAAAQAAAAE=",
        "AAAAAAAAAAAAAAAOY2FuY2VsX3JlcXVlc3QAAAAAAAIAAAAAAAAACGJvcnJvd2VyAAAAEwAAAAAAAAAHYm9va19pZAAAAAAGAAAAAQAAAAE=",
        "AAAAAAAAAAAAAAAOcmVqZWN0X3JlcXVlc3QAAAAAAAIAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAHYm9va19pZAAAAAAGAAAAAQAAAAE=" ]),
      options
    )
  }
  public readonly fromJSON = {
    get_book: this.txFromJSON<Book>,
        get_stats: this.txFromJSON<LoanStats>,
        list_book: this.txFromJSON<u64>,
        list_books: this.txFromJSON<Array<u64>>,
        confirm_loan: this.txFromJSON<boolean>,
        is_available: this.txFromJSON<boolean>,
        request_loan: this.txFromJSON<boolean>,
        mark_returned: this.txFromJSON<boolean>,
        cancel_request: this.txFromJSON<boolean>,
        reject_request: this.txFromJSON<boolean>
  }
}