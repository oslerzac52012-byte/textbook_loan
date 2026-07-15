import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  FormEvent,
} from "react";

import type {
  Book,
  LoanStats,
} from "textbook_loan";

import {
  CONTRACT_ID,
  RPC_URL,
  STELLAR_NETWORK,
} from "./contractConfig";

import {
  cancelRequest,
  confirmLoan,
  getBook,
  getLoanStats,
  isBookAvailable,
  listBook,
  listBooks,
  markReturned,
  rejectRequest,
  requestLoan,
} from "./services/contract";

import {
  connectWallet,
  getCurrentWallet,
} from "./services/wallet";

import type {
  WalletConnection,
} from "./services/wallet";

import "./App.css";

type TransactionStatus =
  | "idle"
  | "pending"
  | "success"
  | "error";

type ManageAction =
  | "confirm"
  | "reject"
  | "cancel"
  | "return";

interface TransactionState {
  status: TransactionStatus;
  title: string;
  message: string;
  hash?: string;
  explorerUrl?: string;
}

interface TransactionOutcome {
  hash: string;
  explorerUrl: string;
}

const EMPTY_TRANSACTION: TransactionState = {
  status: "idle",
  title: "No transaction submitted",
  message:
    "Connect Freighter and choose an action to begin.",
};

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "An unexpected application error occurred.";
}

function shortenAddress(
  address: string,
  startLength = 8,
  endLength = 6,
): string {
  if (
    address.length <=
    startLength + endLength
  ) {
    return address;
  }

  return `${address.slice(
    0,
    startLength,
  )}…${address.slice(-endLength)}`;
}

function parsePositiveBigInt(
  value: string,
  fieldName: string,
): bigint {
  const normalizedValue =
    value.trim();

  if (!/^\d+$/.test(normalizedValue)) {
    throw new Error(
      `${fieldName} must contain whole-number digits only.`,
    );
  }

  const result =
    BigInt(normalizedValue);

  if (result <= 0n) {
    throw new Error(
      `${fieldName} must be greater than zero.`,
    );
  }

  return result;
}

function parseReturnDate(
  value: string,
): bigint {
  if (!value) {
    throw new Error(
      "Select a return date.",
    );
  }

  const milliseconds =
    new Date(value).getTime();

  if (
    !Number.isFinite(milliseconds)
  ) {
    throw new Error(
      "The return date is invalid.",
    );
  }

  const returnTimestamp =
    BigInt(
      Math.floor(
        milliseconds / 1_000,
      ),
    );

  const currentTimestamp =
    BigInt(
      Math.floor(
        Date.now() / 1_000,
      ),
    );

  if (
    returnTimestamp <=
    currentTimestamp
  ) {
    throw new Error(
      "The return date must be in the future.",
    );
  }

  return returnTimestamp;
}

function formatTimestamp(
  value: bigint | number,
): string {
  const seconds = Number(value);

  if (
    !Number.isFinite(seconds) ||
    seconds <= 0
  ) {
    return "Not set";
  }

  return new Date(
    seconds * 1_000,
  ).toLocaleString();
}

function statusClassName(
  status: string,
): string {
  return `status-chip status-${status.toLowerCase()}`;
}

function App() {
  const [wallet, setWallet] =
    useState<WalletConnection | null>(
      null,
    );

  const [
    walletLoading,
    setWalletLoading,
  ] = useState(false);

  const [
    busyAction,
    setBusyAction,
  ] = useState<string | null>(
    null,
  );

  const [books, setBooks] =
    useState<Book[]>([]);

  const [stats, setStats] =
    useState<LoanStats | null>(
      null,
    );

  const [
    selectedBook,
    setSelectedBook,
  ] = useState<Book | null>(
    null,
  );

  const [
    selectedAvailability,
    setSelectedAvailability,
  ] = useState<boolean | null>(
    null,
  );

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [dataError, setDataError] =
    useState("");

  const [
    transaction,
    setTransaction,
  ] = useState<TransactionState>(
    EMPTY_TRANSACTION,
  );

  const [
    listingForm,
    setListingForm,
  ] = useState({
    bookId: "",
    title: "",
    isbn: "",
  });

  const [
    requestForm,
    setRequestForm,
  ] = useState({
    bookId: "",
    returnDate: "",
  });

  const [
    manageBookId,
    setManageBookId,
  ] = useState("");

  const [
    lookupBookId,
    setLookupBookId,
  ] = useState("");

  const contractReady =
    /^C[A-Z2-7]{55}$/.test(
      CONTRACT_ID,
    );

  const sortedBooks =
    useMemo(
      () =>
        [...books].sort(
          (first, second) =>
            Number(
              second.book_id -
                first.book_id,
            ),
        ),
      [books],
    );

  useEffect(() => {
    let active = true;

    async function restoreWallet() {
      try {
        const currentWallet =
          await getCurrentWallet();

        if (
          active &&
          currentWallet
        ) {
          setWallet(currentWallet);
        }
      } catch {
        if (active) {
          setWallet(null);
        }
      }
    }

    void restoreWallet();

    return () => {
      active = false;
    };
  }, []);

  async function refreshBooks(
    sourceAddress =
      wallet?.address,
  ): Promise<void> {
    if (!sourceAddress) {
      return;
    }

    setRefreshing(true);
    setDataError("");

    try {
      const [
        bookIds,
        currentStats,
      ] = await Promise.all([
        listBooks(sourceAddress),
        getLoanStats(
          sourceAddress,
        ),
      ]);

      const records =
        await Promise.all(
          bookIds.map(
            (bookId) =>
              getBook(
                sourceAddress,
                bookId,
              ),
          ),
        );

      setBooks(records);
      setStats(currentStats);
    } catch (error) {
      setDataError(
        getErrorMessage(error),
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function handleConnectWallet() {
    setWalletLoading(true);
    setDataError("");

    try {
      const connection =
        await connectWallet();

      setWallet(connection);

      if (contractReady) {
        await refreshBooks(
          connection.address,
        );
      }
    } catch (error) {
      setDataError(
        getErrorMessage(error),
      );
    } finally {
      setWalletLoading(false);
    }
  }

  function handleDisconnectWallet() {
    setWallet(null);
    setBooks([]);
    setStats(null);
    setSelectedBook(null);
    setSelectedAvailability(
      null,
    );
    setDataError("");
    setTransaction(
      EMPTY_TRANSACTION,
    );
  }

  async function runTransaction(
    title: string,
    action:
      () => Promise<TransactionOutcome>,
  ): Promise<void> {
    setBusyAction(title);
    setDataError("");

    setTransaction({
      status: "pending",
      title,
      message:
        "Waiting for Freighter approval and Stellar Testnet confirmation.",
    });

    try {
      const result =
        await action();

      setTransaction({
        status: "success",
        title: `${title} completed`,
        message:
          "The smart contract transaction was confirmed on Stellar Testnet.",
        hash: result.hash,
        explorerUrl:
          result.explorerUrl,
      });

      if (wallet) {
        await refreshBooks(
          wallet.address,
        );
      }
    } catch (error) {
      setTransaction({
        status: "error",
        title: `${title} failed`,
        message:
          getErrorMessage(error),
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleListBook(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!wallet) {
      setDataError(
        "Connect Freighter before listing a textbook.",
      );
      return;
    }

    try {
      const bookId =
        parsePositiveBigInt(
          listingForm.bookId,
          "Book ID",
        );

      const title =
        listingForm.title.trim();

      const isbn =
        listingForm.isbn.trim();

      if (title.length < 2) {
        throw new Error(
          "Enter a valid textbook title.",
        );
      }

      if (isbn.length < 4) {
        throw new Error(
          "Enter a valid ISBN or textbook reference.",
        );
      }

      await runTransaction(
        "List textbook",
        () =>
          listBook(
            wallet.address,
            bookId,
            title,
            isbn,
          ),
      );

      setListingForm({
        bookId: "",
        title: "",
        isbn: "",
      });
    } catch (error) {
      setDataError(
        getErrorMessage(error),
      );
    }
  }

  async function handleRequestLoan(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!wallet) {
      setDataError(
        "Connect Freighter before requesting a textbook.",
      );
      return;
    }

    try {
      const bookId =
        parsePositiveBigInt(
          requestForm.bookId,
          "Book ID",
        );

      const returnBy =
        parseReturnDate(
          requestForm.returnDate,
        );

      await runTransaction(
        "Request textbook loan",
        () =>
          requestLoan(
            wallet.address,
            bookId,
            returnBy,
          ),
      );

      setRequestForm({
        bookId: "",
        returnDate: "",
      });
    } catch (error) {
      setDataError(
        getErrorMessage(error),
      );
    }
  }

  async function handleManageBook(
    action: ManageAction,
  ) {
    if (!wallet) {
      setDataError(
        "Connect Freighter before managing a textbook.",
      );
      return;
    }

    try {
      const bookId =
        parsePositiveBigInt(
          manageBookId,
          "Book ID",
        );

      if (action === "confirm") {
        await runTransaction(
          "Confirm textbook loan",
          () =>
            confirmLoan(
              wallet.address,
              bookId,
            ),
        );
      }

      if (action === "reject") {
        await runTransaction(
          "Reject loan request",
          () =>
            rejectRequest(
              wallet.address,
              bookId,
            ),
        );
      }

      if (action === "cancel") {
        await runTransaction(
          "Cancel loan request",
          () =>
            cancelRequest(
              wallet.address,
              bookId,
            ),
        );
      }

      if (action === "return") {
        await runTransaction(
          "Mark textbook returned",
          () =>
            markReturned(
              wallet.address,
              bookId,
            ),
        );
      }
    } catch (error) {
      setDataError(
        getErrorMessage(error),
      );
    }
  }

  async function handleLookupBook(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!wallet) {
      setDataError(
        "Connect Freighter before reading contract data.",
      );
      return;
    }

    setBusyAction(
      "Look up textbook",
    );
    setDataError("");

    try {
      const bookId =
        parsePositiveBigInt(
          lookupBookId,
          "Book ID",
        );

      const [
        book,
        available,
      ] = await Promise.all([
        getBook(
          wallet.address,
          bookId,
        ),

        isBookAvailable(
          wallet.address,
          bookId,
        ),
      ]);

      setSelectedBook(book);

      setSelectedAvailability(
        available,
      );
    } catch (error) {
      setSelectedBook(null);

      setSelectedAvailability(
        null,
      );

      setDataError(
        getErrorMessage(error),
      );
    } finally {
      setBusyAction(null);
    }
  }

  const walletLabel =
    wallet
      ? shortenAddress(
          wallet.address,
        )
      : "Not connected";

  return (
    <div className="app-shell">
      <header className="topbar">
        <a
          className="brand"
          href="#top"
          aria-label="Textbook Loan home"
        >
          <span className="brand-mark">
            TL
          </span>

          <span>
            <strong>
              Textbook Loan
            </strong>

            <small>
              Campus lending on Stellar
            </small>
          </span>
        </a>

        <div className="topbar-actions">
          <span className="network-badge">
            <span className="network-dot" />

            {STELLAR_NETWORK}
          </span>

          {wallet ? (
            <div className="wallet-menu">
              <span className="wallet-address">
                {walletLabel}
              </span>

              <button
                className="button button-secondary button-small"
                type="button"
                onClick={
                  handleDisconnectWallet
                }
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              className="button button-primary button-small"
              type="button"
              disabled={
                walletLoading
              }
              onClick={() => {
                void handleConnectWallet();
              }}
            >
              {walletLoading
                ? "Connecting…"
                : "Connect Freighter"}
            </button>
          )}
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">
              Shared learning resources
            </span>

            <h1>
              Put idle textbooks back
              into students’ hands.
            </h1>

            <p>
              List used textbooks,
              request a loan, approve the
              hand-off, and record the
              return through a transparent
              Soroban smart contract.
            </p>

            <div className="hero-actions">
              <a
                className="button button-primary"
                href="#workspace"
              >
                Open lending workspace
              </a>

              <a
                className="button button-secondary"
                href="#catalogue"
              >
                Browse catalogue
              </a>
            </div>

            <div className="hero-proof">
              <span>
                ✓ Verified ownership
              </span>

              <span>
                ✓ On-chain due dates
              </span>

              <span>
                ✓ Reusable listings
              </span>
            </div>
          </div>

          <div className="hero-panel">
            <div className="hero-panel-header">
              <span>
                Application runtime
              </span>

              <span
                className={
                  contractReady
                    ? "runtime-ready"
                    : "runtime-warning"
                }
              >
                {contractReady
                  ? "Contract ready"
                  : "Deployment required"}
              </span>
            </div>

            <div className="runtime-row">
              <span>
                Network
              </span>

              <strong>
                {STELLAR_NETWORK}
              </strong>
            </div>

            <div className="runtime-row">
              <span>
                Wallet
              </span>

              <strong>
                {walletLabel}
              </strong>
            </div>

            <div className="runtime-row">
              <span>
                Contract
              </span>

              <strong>
                {contractReady
                  ? shortenAddress(
                      CONTRACT_ID,
                      10,
                      8,
                    )
                  : "Not configured"}
              </strong>
            </div>

            <div className="runtime-row">
              <span>
                RPC
              </span>

              <strong>
                {RPC_URL.replace(
                  "https://",
                  "",
                )}
              </strong>
            </div>
          </div>
        </section>

        <section className="metrics-grid">
          <article className="metric-card">
            <span className="metric-label">
              Total textbooks
            </span>

            <strong className="metric-value">
              {stats?.total_books ?? 0}
            </strong>

            <span className="metric-help">
              Listings stored on-chain
            </span>
          </article>

          <article className="metric-card">
            <span className="metric-label">
              Available
            </span>

            <strong className="metric-value">
              {stats?.available_books ??
                0}
            </strong>

            <span className="metric-help">
              Ready for a new borrower
            </span>
          </article>

          <article className="metric-card">
            <span className="metric-label">
              Requested
            </span>

            <strong className="metric-value">
              {stats?.requested_books ??
                0}
            </strong>

            <span className="metric-help">
              Waiting for owner approval
            </span>
          </article>

          <article className="metric-card">
            <span className="metric-label">
              Active loans
            </span>

            <strong className="metric-value">
              {stats?.loaned_books ?? 0}
            </strong>

            <span className="metric-help">
              Currently with borrowers
            </span>
          </article>

          <article className="metric-card">
            <span className="metric-label">
              Completed loans
            </span>

            <strong className="metric-value">
              {stats?.completed_loans ??
                0}
            </strong>

            <span className="metric-help">
              Returned successfully
            </span>
          </article>
        </section>

        {dataError ? (
          <section
            className="alert alert-error"
            role="alert"
          >
            <strong>
              Action needed
            </strong>

            <span>
              {dataError}
            </span>

            <button
              type="button"
              aria-label="Dismiss error"
              onClick={() => {
                setDataError("");
              }}
            >
              ×
            </button>
          </section>
        ) : null}

        <section
          className="workspace-section"
          id="workspace"
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                Lending workspace
              </span>

              <h2>
                Manage textbook loans
              </h2>
            </div>

            <button
              className="button button-secondary button-small"
              type="button"
              disabled={
                !wallet ||
                refreshing ||
                !contractReady
              }
              onClick={() => {
                void refreshBooks();
              }}
            >
              {refreshing
                ? "Refreshing…"
                : "Refresh contract data"}
            </button>
          </div>

          <div className="workspace-grid">
            <article className="panel">
              <div className="panel-heading">
                <span className="panel-step">
                  01
                </span>

                <div>
                  <h3>
                    List a textbook
                  </h3>

                  <p>
                    Register a textbook you
                    own for other students.
                  </p>
                </div>
              </div>

              <form
                className="form-stack"
                onSubmit={(event) => {
                  void handleListBook(
                    event,
                  );
                }}
              >
                <label>
                  Book ID

                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="1001"
                    value={
                      listingForm.bookId
                    }
                    onChange={(event) => {
                      setListingForm(
                        (current) => ({
                          ...current,
                          bookId:
                            event.target
                              .value,
                        }),
                      );
                    }}
                  />
                </label>

                <label>
                  Textbook title

                  <input
                    type="text"
                    placeholder="Introduction to Economics"
                    value={
                      listingForm.title
                    }
                    onChange={(event) => {
                      setListingForm(
                        (current) => ({
                          ...current,
                          title:
                            event.target
                              .value,
                        }),
                      );
                    }}
                  />
                </label>

                <label>
                  ISBN or reference

                  <input
                    type="text"
                    placeholder="9780000000001"
                    value={
                      listingForm.isbn
                    }
                    onChange={(event) => {
                      setListingForm(
                        (current) => ({
                          ...current,
                          isbn:
                            event.target
                              .value,
                        }),
                      );
                    }}
                  />
                </label>

                <button
                  className="button button-primary button-full"
                  type="submit"
                  disabled={
                    !wallet ||
                    !contractReady ||
                    busyAction !== null
                  }
                >
                  {busyAction ===
                  "List textbook"
                    ? "Submitting…"
                    : "List textbook"}
                </button>
              </form>
            </article>

            <article className="panel">
              <div className="panel-heading">
                <span className="panel-step">
                  02
                </span>

                <div>
                  <h3>
                    Request a loan
                  </h3>

                  <p>
                    Choose a book and propose
                    a return deadline.
                  </p>
                </div>
              </div>

              <form
                className="form-stack"
                onSubmit={(event) => {
                  void handleRequestLoan(
                    event,
                  );
                }}
              >
                <label>
                  Book ID

                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="1001"
                    value={
                      requestForm.bookId
                    }
                    onChange={(event) => {
                      setRequestForm(
                        (current) => ({
                          ...current,
                          bookId:
                            event.target
                              .value,
                        }),
                      );
                    }}
                  />
                </label>

                <label>
                  Proposed return date

                  <input
                    type="datetime-local"
                    value={
                      requestForm.returnDate
                    }
                    onChange={(event) => {
                      setRequestForm(
                        (current) => ({
                          ...current,
                          returnDate:
                            event.target
                              .value,
                        }),
                      );
                    }}
                  />
                </label>

                <button
                  className="button button-primary button-full"
                  type="submit"
                  disabled={
                    !wallet ||
                    !contractReady ||
                    busyAction !== null
                  }
                >
                  {busyAction ===
                  "Request textbook loan"
                    ? "Submitting…"
                    : "Request loan"}
                </button>
              </form>
            </article>

            <article className="panel">
              <div className="panel-heading">
                <span className="panel-step">
                  03
                </span>

                <div>
                  <h3>
                    Manage loan status
                  </h3>

                  <p>
                    Approve, reject, cancel,
                    or complete a loan.
                  </p>
                </div>
              </div>

              <div className="form-stack">
                <label>
                  Book ID

                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="1001"
                    value={manageBookId}
                    onChange={(event) => {
                      setManageBookId(
                        event.target.value,
                      );
                    }}
                  />
                </label>

                <div className="action-grid">
                  <button
                    className="button button-success"
                    type="button"
                    disabled={
                      !wallet ||
                      !contractReady ||
                      busyAction !== null
                    }
                    onClick={() => {
                      void handleManageBook(
                        "confirm",
                      );
                    }}
                  >
                    Confirm loan
                  </button>

                  <button
                    className="button button-warning"
                    type="button"
                    disabled={
                      !wallet ||
                      !contractReady ||
                      busyAction !== null
                    }
                    onClick={() => {
                      void handleManageBook(
                        "reject",
                      );
                    }}
                  >
                    Reject request
                  </button>

                  <button
                    className="button button-secondary"
                    type="button"
                    disabled={
                      !wallet ||
                      !contractReady ||
                      busyAction !== null
                    }
                    onClick={() => {
                      void handleManageBook(
                        "cancel",
                      );
                    }}
                  >
                    Cancel request
                  </button>

                  <button
                    className="button button-primary"
                    type="button"
                    disabled={
                      !wallet ||
                      !contractReady ||
                      busyAction !== null
                    }
                    onClick={() => {
                      void handleManageBook(
                        "return",
                      );
                    }}
                  >
                    Mark returned
                  </button>
                </div>
              </div>
            </article>

            <article className="panel">
              <div className="panel-heading">
                <span className="panel-step">
                  04
                </span>

                <div>
                  <h3>
                    Look up a textbook
                  </h3>

                  <p>
                    Read the latest listing
                    directly from Stellar RPC.
                  </p>
                </div>
              </div>

              <form
                className="form-stack"
                onSubmit={(event) => {
                  void handleLookupBook(
                    event,
                  );
                }}
              >
                <label>
                  Book ID

                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="1001"
                    value={lookupBookId}
                    onChange={(event) => {
                      setLookupBookId(
                        event.target.value,
                      );
                    }}
                  />
                </label>

                <button
                  className="button button-secondary button-full"
                  type="submit"
                  disabled={
                    !wallet ||
                    !contractReady ||
                    busyAction !== null
                  }
                >
                  {busyAction ===
                  "Look up textbook"
                    ? "Loading…"
                    : "Get textbook"}
                </button>
              </form>

              {selectedBook ? (
                <div className="book-detail">
                  <div className="book-detail-header">
                    <div>
                      <span>
                        Book #
                        {selectedBook.book_id.toString()}
                      </span>

                      <strong>
                        {selectedBook.title}
                      </strong>
                    </div>

                    <span
                      className={statusClassName(
                        selectedBook.status
                          .tag,
                      )}
                    >
                      {
                        selectedBook.status
                          .tag
                      }
                    </span>
                  </div>

                  <dl>
                    <div>
                      <dt>
                        Available
                      </dt>

                      <dd>
                        {selectedAvailability
                          ? "Yes"
                          : "No"}
                      </dd>
                    </div>

                    <div>
                      <dt>
                        ISBN
                      </dt>

                      <dd>
                        {
                          selectedBook.isbn
                        }
                      </dd>
                    </div>

                    <div>
                      <dt>
                        Owner
                      </dt>

                      <dd
                        title={
                          selectedBook.owner
                        }
                      >
                        {shortenAddress(
                          selectedBook.owner,
                        )}
                      </dd>
                    </div>

                    <div>
                      <dt>
                        Borrower
                      </dt>

                      <dd>
                        {selectedBook.borrower
                          ? shortenAddress(
                              selectedBook.borrower,
                            )
                          : "None"}
                      </dd>
                    </div>

                    <div>
                      <dt>
                        Return deadline
                      </dt>

                      <dd>
                        {formatTimestamp(
                          selectedBook.return_by,
                        )}
                      </dd>
                    </div>

                    <div>
                      <dt>
                        Completed loans
                      </dt>

                      <dd>
                        {
                          selectedBook.loan_count
                        }
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : null}
            </article>

            <article className="panel transaction-panel">
              <div className="panel-heading">
                <span className="panel-step">
                  05
                </span>

                <div>
                  <h3>
                    Transaction monitor
                  </h3>

                  <p>
                    Track Freighter signing and
                    Testnet confirmation.
                  </p>
                </div>
              </div>

              <div
                className={`transaction-state transaction-${transaction.status}`}
                aria-live="polite"
              >
                <span className="transaction-icon">
                  {transaction.status ===
                  "idle"
                    ? "○"
                    : null}

                  {transaction.status ===
                  "pending"
                    ? "◌"
                    : null}

                  {transaction.status ===
                  "success"
                    ? "✓"
                    : null}

                  {transaction.status ===
                  "error"
                    ? "!"
                    : null}
                </span>

                <div>
                  <strong>
                    {transaction.title}
                  </strong>

                  <p>
                    {transaction.message}
                  </p>
                </div>
              </div>

              {transaction.hash ? (
                <div className="transaction-hash">
                  <span>
                    Transaction hash
                  </span>

                  <code>
                    {shortenAddress(
                      transaction.hash,
                      12,
                      10,
                    )}
                  </code>

                  {transaction.explorerUrl ? (
                    <a
                      href={
                        transaction.explorerUrl
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open in explorer ↗
                    </a>
                  ) : null}
                </div>
              ) : null}
            </article>
          </div>
        </section>

        <section
          className="catalogue-section"
          id="catalogue"
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                Campus catalogue
              </span>

              <h2>
                Textbooks on the lending ledger
              </h2>
            </div>

            <span className="record-count">
              {books.length} records
            </span>
          </div>

          <div className="catalogue-card">
            {sortedBooks.length > 0 ? (
              <div className="book-grid">
                {sortedBooks.map(
                  (book) => (
                    <article
                      className="book-card"
                      key={
                        book.book_id.toString()
                      }
                    >
                      <div className="book-card-top">
                        <span className="book-id">
                          #
                          {
                            book.book_id.toString()
                          }
                        </span>

                        <span
                          className={statusClassName(
                            book.status.tag,
                          )}
                        >
                          {
                            book.status.tag
                          }
                        </span>
                      </div>

                      <h3>
                        {book.title}
                      </h3>

                      <p>
                        ISBN: {book.isbn}
                      </p>

                      <dl>
                        <div>
                          <dt>
                            Owner
                          </dt>

                          <dd
                            title={
                              book.owner
                            }
                          >
                            {shortenAddress(
                              book.owner,
                            )}
                          </dd>
                        </div>

                        <div>
                          <dt>
                            Borrower
                          </dt>

                          <dd>
                            {book.borrower
                              ? shortenAddress(
                                  book.borrower,
                                )
                              : "None"}
                          </dd>
                        </div>

                        <div>
                          <dt>
                            Return by
                          </dt>

                          <dd>
                            {formatTimestamp(
                              book.return_by,
                            )}
                          </dd>
                        </div>

                        <div>
                          <dt>
                            Past loans
                          </dt>

                          <dd>
                            {
                              book.loan_count
                            }
                          </dd>
                        </div>
                      </dl>
                    </article>
                  ),
                )}
              </div>
            ) : (
              <div className="empty-state">
                <span>
                  ◫
                </span>

                <h3>
                  No textbooks loaded
                </h3>

                <p>
                  Connect Freighter and refresh
                  the catalogue after deploying
                  the contract.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer>
        <span>
          Textbook Loan
        </span>

        <span>
          Built with Stellar, Soroban,
          React, and Freighter.
        </span>
      </footer>
    </div>
  );
}

export default App;
