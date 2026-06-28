#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol};

/// Status of a book copy in the lending pool.
///
/// - `Available`: book is listed and free to be borrowed.
/// - `Loaned`:    book is currently lent to a borrower until `return_by`.
/// - `Returned`:  book has been returned and is back in the owner's hands.
#[contracttype]
#[derive(Clone, Debug)]
pub enum BookStatus {
    Available,
    Loaned,
    Returned,
}

/// On-chain record for a single textbook listing.
///
/// Stored under a per-book key so the same owner can list many titles and
/// every interested student can inspect availability without an indexer.
#[contracttype]
#[derive(Clone, Debug)]
pub struct Book {
    pub owner: Address,
    pub title: Symbol,
    pub isbn: Symbol,
    pub status: BookStatus,
    pub borrower: Option<Address>,
    pub return_by: u64,
}

const BOOKS: Symbol = Symbol::short("BOOKS");

fn books_map(env: &Env) -> soroban_sdk::Map<u64, Book> {
    env.storage()
        .instance()
        .get(&BOOKS)
        .unwrap_or_else(|| soroban_sdk::Map::new(env))
}

fn save_books(env: &Env, books: &soroban_sdk::Map<u64, Book>) {
    env.storage().instance().set(&BOOKS, books);
}

#[contract]
pub struct TextbookLoan;

#[contractimpl]
impl TextbookLoan {
    /// List a textbook the caller owns so other students can borrow it.
    ///
    /// The `owner` must authorize the listing. `book_id` is an off-chain
    /// chosen identifier (e.g. an ISBN-derived numeric id) and must be
    /// unique within this contract; the call will panic if a book with
    /// the same id has already been listed.
    pub fn list_book(env: Env, owner: Address, book_id: u64, title: Symbol, isbn: Symbol) {
        owner.require_auth();

        let mut books = books_map(&env);
        if books.get(book_id).is_some() {
            panic!("book_id already listed");
        }

        let book = Book {
            owner: owner.clone(),
            title,
            isbn,
            status: BookStatus::Available,
            borrower: None,
            return_by: 0,
        };
        books.set(book_id, book);
        save_books(&env, &books);
    }

    /// Request to borrow a listed textbook.
    ///
    /// The `borrower` authorizes the request. The book must currently be
    /// `Available`; otherwise the contract panics. `return_by` is a
    /// Unix-style deadline (seconds) recorded on-chain so the lender can
    /// check it before confirming.
    pub fn request_loan(env: Env, borrower: Address, book_id: u64, return_by: u64) {
        borrower.require_auth();

        let mut books = books_map(&env);
        let mut book = books.get(book_id).expect("book not listed");

        match book.status {
            BookStatus::Available => {}
            _ => panic!("book is not available"),
        }

        if return_by <= env.ledger().timestamp() {
            panic!("return_by must be in the future");
        }

        book.borrower = Some(borrower.clone());
        book.return_by = return_by;
        // Status stays Available until the owner confirms; this allows
        // the owner to reject or for the borrower to cancel.
        books.set(book_id, book);
        save_books(&env, &books);
    }

    /// Approve a pending loan request as the book's owner.
    ///
    /// Only the recorded `owner` may call this. The borrower recorded on
    /// the book must match `borrower`. On success the book transitions
    /// to `Loaned`, locking the title until the owner marks it returned.
    pub fn confirm_loan(env: Env, owner: Address, book_id: u64, borrower: Address) {
        owner.require_auth();

        let mut books = books_map(&env);
        let mut book = books.get(book_id).expect("book not listed");

        if book.owner != owner {
            panic!("only the owner can confirm");
        }
        match &book.borrower {
            Some(b) if *b == borrower => {}
            _ => panic!("no matching pending request"),
        }
        match book.status {
            BookStatus::Available => {}
            _ => panic!("book is not available"),
        }

        book.status = BookStatus::Loaned;
        books.set(book_id, book);
        save_books(&env, &books);
    }

    /// Mark a previously loaned book as returned.
    ///
    /// Only the recorded `owner` may call this. The book must be in
    /// the `Loaned` state. After the call the book is back to
    /// `Available` and ready to be requested again.
    pub fn mark_returned(env: Env, owner: Address, book_id: u64) {
        owner.require_auth();

        let mut books = books_map(&env);
        let mut book = books.get(book_id).expect("book not listed");

        if book.owner != owner {
            panic!("only the owner can mark returned");
        }
        match book.status {
            BookStatus::Loaned => {}
            _ => panic!("book is not currently loaned"),
        }

        book.status = BookStatus::Available;
        book.borrower = None;
        book.return_by = 0;
        books.set(book_id, book);
        save_books(&env, &books);
    }

    /// View helper: return true when the book exists and is available
    /// to be requested. Returns false for unknown ids, loaned copies,
    /// or copies still in `Returned` limbo.
    pub fn is_available(env: Env, book_id: u64) -> bool {
        let books = books_map(&env);
        match books.get(book_id) {
            Some(book) => matches!(book.status, BookStatus::Available),
            None => false,
        }
    }
}
