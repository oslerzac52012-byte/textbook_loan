# textbook_loan

## Project Title
textbook_loan

## Project Description
Textbook prices and shipping delays often block students from starting a course on time. `textbook_loan` is a peer-to-peer lending ledger built on Soroban that lets a student who owns a used textbook list it, and another student request to borrow it with an agreed-upon return date, with the owner confirming the hand-off on-chain. The contract stores listings, pending requests, and active loans so any participant can verify availability and due dates without trusting a centralized marketplace.

## Project Vision
Make required course materials accessible to every student regardless of up-front budget, while giving owners of used textbooks a low-friction way to put idle books back into circulation. Long term the contract becomes the trust anchor for a wider campus lending network that also handles lab kits, calculators, and musical instruments, and integrates with university identity systems for verified borrowers.

## Key Features
- `list_book` — any authenticated student registers a textbook they own, including a title and ISBN tag, so peers can discover it.
- `request_loan` — a borrower locks in a return deadline on-chain, recording intent before the owner approves.
- `confirm_loan` — the original owner is the only party that can transition a listing into an active loan, preventing unauthorized transfers.
- `mark_returned` — once the physical book is back, the owner resets the listing to `Available` for the next borrower.
- `is_available` — read-only view helper so front-ends and other contracts can show real-time availability without an indexer.

## Contract

- **Network:** Stellar Testnet (Public)
- **Scope:** education dApp — see `contracts/textbook_loan/src/lib.rs` for the full textbook_loan business logic.
- **Functions exposed:** see `Key Features` above and the `pub fn` list in `lib.rs`.
- **Contract ID:** `CDDGIZUJ5YOTVXTTDPON2IEMZG4QSTXLNFJKJTVXPI2FD3U4QFEUML5Z`
- **Explorer template:** `https://stellar.expert/explorer/testnet/tx/5859b594d16a443a6fc421d885d8ed6a28e5cc0257c156b9f254ea4ddb598a25`

## Future Scope
- Attach a refundable XLM deposit to each loan so on-time returns are enforced economically, with the deposit released only when the owner calls `mark_returned`.
- Add a reputation counter per borrower address, recorded on-chain, so repeat reliable borrowers are surfaced to owners.
- Support multi-edition listings (one owner, several copies of the same ISBN) by indexing books under `(isbn, copy_id)` tuples.

## Profile

- **Name:** <!-- Fill github name -->
- **Project:** `textbook_loan` (education)
- **Built with:** Soroban SDK 25, Rust, Stellar Testnet
