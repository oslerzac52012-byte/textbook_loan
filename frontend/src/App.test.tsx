import {
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

import userEvent from
  "@testing-library/user-event";

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type {
  Book,
  LoanStats,
} from "textbook_loan";

const mocks = vi.hoisted(() => ({
  connectWallet: vi.fn(),
  getCurrentWallet: vi.fn(),

  cancelRequest: vi.fn(),
  confirmLoan: vi.fn(),
  getBook: vi.fn(),
  getLoanStats: vi.fn(),
  isBookAvailable: vi.fn(),
  listBook: vi.fn(),
  listBooks: vi.fn(),
  markReturned: vi.fn(),
  rejectRequest: vi.fn(),
  requestLoan: vi.fn(),
}));

vi.mock(
  "./contractConfig",
  () => ({
    CONTRACT_ID:
      `C${"A".repeat(55)}`,

    RPC_URL:
      "https://soroban-testnet.stellar.org",

    STELLAR_NETWORK:
      "TESTNET",
  }),
);

vi.mock(
  "./services/wallet",
  () => ({
    connectWallet:
      mocks.connectWallet,

    getCurrentWallet:
      mocks.getCurrentWallet,
  }),
);

vi.mock(
  "./services/contract",
  () => ({
    cancelRequest:
      mocks.cancelRequest,

    confirmLoan:
      mocks.confirmLoan,

    getBook:
      mocks.getBook,

    getLoanStats:
      mocks.getLoanStats,

    isBookAvailable:
      mocks.isBookAvailable,

    listBook:
      mocks.listBook,

    listBooks:
      mocks.listBooks,

    markReturned:
      mocks.markReturned,

    rejectRequest:
      mocks.rejectRequest,

    requestLoan:
      mocks.requestLoan,
  }),
);

import App from "./App";

const WALLET = {
  address:
    `G${"A".repeat(55)}`,

  network:
    "TESTNET",

  networkPassphrase:
    "Test SDF Network ; September 2015",
};

const EMPTY_STATS: LoanStats = {
  total_books: 0,
  available_books: 0,
  requested_books: 0,
  loaned_books: 0,
  completed_loans: 0,
};

const SAMPLE_BOOK: Book = {
  book_id: 1001n,

  owner:
    WALLET.address,

  title:
    "Calculus for Engineers",

  isbn:
    "9780000001001",

  status: {
    tag: "Available",
    values: undefined,
  },

  borrower: undefined,
  return_by: 0n,
  loan_count: 0,
  listed_at: 1_700_000_000n,
};

describe(
  "Textbook Loan dashboard",
  () => {
    beforeEach(() => {
      mocks.getCurrentWallet
        .mockResolvedValue(null);

      mocks.connectWallet
        .mockResolvedValue(WALLET);

      mocks.listBooks
        .mockResolvedValue([]);

      mocks.getLoanStats
        .mockResolvedValue(
          EMPTY_STATS,
        );

      mocks.getBook
        .mockResolvedValue(
          SAMPLE_BOOK,
        );

      mocks.isBookAvailable
        .mockResolvedValue(true);

      mocks.listBook
        .mockResolvedValue({
          hash: "listing-hash",
          result: 1001n,

          explorerUrl:
            "https://stellar.expert/explorer/testnet/tx/listing-hash",
        });

      mocks.requestLoan
        .mockResolvedValue({
          hash: "request-hash",
          result: true,

          explorerUrl:
            "https://stellar.expert/explorer/testnet/tx/request-hash",
        });

      mocks.confirmLoan
        .mockResolvedValue({
          hash: "confirm-hash",
          result: true,

          explorerUrl:
            "https://stellar.expert/explorer/testnet/tx/confirm-hash",
        });

      mocks.rejectRequest
        .mockResolvedValue({
          hash: "reject-hash",
          result: true,

          explorerUrl:
            "https://stellar.expert/explorer/testnet/tx/reject-hash",
        });

      mocks.cancelRequest
        .mockResolvedValue({
          hash: "cancel-hash",
          result: true,

          explorerUrl:
            "https://stellar.expert/explorer/testnet/tx/cancel-hash",
        });

      mocks.markReturned
        .mockResolvedValue({
          hash: "return-hash",
          result: true,

          explorerUrl:
            "https://stellar.expert/explorer/testnet/tx/return-hash",
        });
    });

    it(
      "renders the disconnected dashboard",
      async () => {
        render(<App />);

        expect(
          screen.getByRole(
            "heading",
            {
              name:
                /put idle textbooks back/i,
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Connect Freighter",
            },
          ),
        ).toBeInTheDocument();

        await waitFor(() => {
          expect(
            mocks.getCurrentWallet,
          ).toHaveBeenCalledOnce();
        });
      },
    );

    it(
      "connects the wallet and loads the catalogue",
      async () => {
        const user =
          userEvent.setup();

        mocks.listBooks
          .mockResolvedValue([
            1001n,
          ]);

        mocks.getLoanStats
          .mockResolvedValue({
            total_books: 1,
            available_books: 1,
            requested_books: 0,
            loaned_books: 0,
            completed_loans: 0,
          });

        render(<App />);

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Connect Freighter",
            },
          ),
        );

        expect(
          await screen.findByRole(
            "button",
            {
              name: "Disconnect",
            },
          ),
        ).toBeInTheDocument();

        expect(
          await screen.findByRole(
            "heading",
            {
              name:
                "Calculus for Engineers",
            },
          ),
        ).toBeInTheDocument();

        expect(
          mocks.connectWallet,
        ).toHaveBeenCalledOnce();

        expect(
          mocks.listBooks,
        ).toHaveBeenCalledWith(
          WALLET.address,
        );
      },
    );

    it(
      "shows validation errors before listing an invalid textbook",
      async () => {
        const user =
          userEvent.setup();

        render(<App />);

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Connect Freighter",
            },
          ),
        );

        const heading =
          screen.getByRole(
            "heading",
            {
              name:
                "List a textbook",
            },
          );

        const panel =
          heading.closest(
            "article",
          );

        expect(panel).not.toBeNull();

        const form =
          within(
            panel as HTMLElement,
          );

        await user.type(
          form.getByLabelText(
            "Book ID",
          ),
          "1001",
        );

        await user.type(
          form.getByLabelText(
            "Textbook title",
          ),
          "A",
        );

        await user.type(
          form.getByLabelText(
            "ISBN or reference",
          ),
          "1234",
        );

        await user.click(
          form.getByRole(
            "button",
            {
              name:
                "List textbook",
            },
          ),
        );

        expect(
          await screen.findByText(
            "Enter a valid textbook title.",
          ),
        ).toBeInTheDocument();

        expect(
          mocks.listBook,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "submits a valid textbook listing",
      async () => {
        const user =
          userEvent.setup();

        render(<App />);

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Connect Freighter",
            },
          ),
        );

        const heading =
          screen.getByRole(
            "heading",
            {
              name:
                "List a textbook",
            },
          );

        const panel =
          heading.closest(
            "article",
          );

        expect(panel).not.toBeNull();

        const form =
          within(
            panel as HTMLElement,
          );

        await user.type(
          form.getByLabelText(
            "Book ID",
          ),
          "1001",
        );

        await user.type(
          form.getByLabelText(
            "Textbook title",
          ),
          "Calculus for Engineers",
        );

        await user.type(
          form.getByLabelText(
            "ISBN or reference",
          ),
          "9780000001001",
        );

        await user.click(
          form.getByRole(
            "button",
            {
              name:
                "List textbook",
            },
          ),
        );

        expect(
          await screen.findByText(
            "List textbook completed",
          ),
        ).toBeInTheDocument();

        expect(
          mocks.listBook,
        ).toHaveBeenCalledWith(
          WALLET.address,
          1001n,
          "Calculus for Engineers",
          "9780000001001",
        );
      },
    );

    it(
      "displays a wallet connection error",
      async () => {
        const user =
          userEvent.setup();

        mocks.connectWallet
          .mockRejectedValue(
            new Error(
              "Freighter access was not approved.",
            ),
          );

        render(<App />);

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Connect Freighter",
            },
          ),
        );

        expect(
          await screen.findByText(
            "Freighter access was not approved.",
          ),
        ).toBeInTheDocument();
      },
    );
  },
);
