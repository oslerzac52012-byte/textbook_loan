#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, Address,
    Env, String, Vec,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum BookStatus {
    Available,
    Requested,
    Loaned,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Book {
    pub book_id: u64,
    pub owner: Address,
    pub title: String,
    pub isbn: String,
    pub status: BookStatus,
    pub borrower: Option<Address>,
    pub return_by: u64,
    pub loan_count: u32,
    pub listed_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LoanStats {
    pub total_books: u32,
    pub available_books: u32,
    pub requested_books: u32,
    pub loaned_books: u32,
    pub completed_loans: u32,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Book(u64),
    BookIds,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ContractError {
    BookNotFound = 1,
    BookAlreadyExists = 2,
    BookNotAvailable = 3,
    InvalidReturnDate = 4,
    OwnerCannotBorrow = 5,
    NoPendingRequest = 6,
    UnauthorizedOwner = 7,
    UnauthorizedBorrower = 8,
    BookNotLoaned = 9,
}

#[contractevent(topics = ["textbook", "listed"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BookListed {
    #[topic]
    pub book_id: u64,
    pub owner: Address,
    pub title: String,
    pub isbn: String,
}

#[contractevent(topics = ["textbook", "requested"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LoanRequested {
    #[topic]
    pub book_id: u64,
    pub borrower: Address,
    pub return_by: u64,
}

#[contractevent(topics = ["textbook", "confirmed"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LoanConfirmed {
    #[topic]
    pub book_id: u64,
    pub owner: Address,
    pub borrower: Address,
    pub return_by: u64,
}

#[contractevent(topics = ["textbook", "cancelled"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RequestCancelled {
    #[topic]
    pub book_id: u64,
    pub borrower: Address,
}

#[contractevent(topics = ["textbook", "rejected"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RequestRejected {
    #[topic]
    pub book_id: u64,
    pub owner: Address,
    pub borrower: Address,
}

#[contractevent(topics = ["textbook", "returned"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BookReturned {
    #[topic]
    pub book_id: u64,
    pub owner: Address,
    pub borrower: Address,
    pub loan_count: u32,
}

fn load_book(env: &Env, book_id: u64) -> Book {
    env.storage()
        .persistent()
        .get(&DataKey::Book(book_id))
        .unwrap_or_else(|| panic_with_error!(env, ContractError::BookNotFound))
}

fn save_book(env: &Env, book: &Book) {
    env.storage()
        .persistent()
        .set(&DataKey::Book(book.book_id), book);
}

fn load_book_ids(env: &Env) -> Vec<u64> {
    env.storage()
        .persistent()
        .get(&DataKey::BookIds)
        .unwrap_or_else(|| Vec::new(env))
}

fn clear_request(book: &mut Book) {
    book.status = BookStatus::Available;
    book.borrower = None;
    book.return_by = 0;
}

#[contract]
pub struct TextbookLoan;

#[contractimpl]
impl TextbookLoan {
    pub fn list_book(env: Env, owner: Address, book_id: u64, title: String, isbn: String) -> u64 {
        owner.require_auth();

        let key = DataKey::Book(book_id);

        if env.storage().persistent().has(&key) {
            panic_with_error!(&env, ContractError::BookAlreadyExists);
        }

        let book = Book {
            book_id,
            owner: owner.clone(),
            title: title.clone(),
            isbn: isbn.clone(),
            status: BookStatus::Available,
            borrower: None,
            return_by: 0,
            loan_count: 0,
            listed_at: env.ledger().timestamp(),
        };

        save_book(&env, &book);

        let mut book_ids = load_book_ids(&env);
        book_ids.push_back(book_id);

        env.storage().persistent().set(&DataKey::BookIds, &book_ids);

        BookListed {
            book_id,
            owner,
            title,
            isbn,
        }
        .publish(&env);

        book_id
    }

    pub fn request_loan(env: Env, borrower: Address, book_id: u64, return_by: u64) -> bool {
        borrower.require_auth();

        let mut book = load_book(&env, book_id);

        if book.status != BookStatus::Available {
            panic_with_error!(&env, ContractError::BookNotAvailable);
        }

        if book.owner == borrower {
            panic_with_error!(&env, ContractError::OwnerCannotBorrow);
        }

        if return_by <= env.ledger().timestamp() {
            panic_with_error!(&env, ContractError::InvalidReturnDate);
        }

        book.status = BookStatus::Requested;
        book.borrower = Some(borrower.clone());
        book.return_by = return_by;

        save_book(&env, &book);

        LoanRequested {
            book_id,
            borrower,
            return_by,
        }
        .publish(&env);

        true
    }

    pub fn cancel_request(env: Env, borrower: Address, book_id: u64) -> bool {
        borrower.require_auth();

        let mut book = load_book(&env, book_id);

        if book.status != BookStatus::Requested {
            panic_with_error!(&env, ContractError::NoPendingRequest);
        }

        match book.borrower.clone() {
            Some(recorded_borrower) if recorded_borrower == borrower => {}
            _ => {
                panic_with_error!(&env, ContractError::UnauthorizedBorrower);
            }
        }

        clear_request(&mut book);
        save_book(&env, &book);

        RequestCancelled { book_id, borrower }.publish(&env);

        true
    }

    pub fn reject_request(env: Env, owner: Address, book_id: u64) -> bool {
        owner.require_auth();

        let mut book = load_book(&env, book_id);

        if book.owner != owner {
            panic_with_error!(&env, ContractError::UnauthorizedOwner);
        }

        if book.status != BookStatus::Requested {
            panic_with_error!(&env, ContractError::NoPendingRequest);
        }

        let borrower = book
            .borrower
            .clone()
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::NoPendingRequest));

        clear_request(&mut book);
        save_book(&env, &book);

        RequestRejected {
            book_id,
            owner,
            borrower,
        }
        .publish(&env);

        true
    }

    pub fn confirm_loan(env: Env, owner: Address, book_id: u64) -> bool {
        owner.require_auth();

        let mut book = load_book(&env, book_id);

        if book.owner != owner {
            panic_with_error!(&env, ContractError::UnauthorizedOwner);
        }

        if book.status != BookStatus::Requested {
            panic_with_error!(&env, ContractError::NoPendingRequest);
        }

        let borrower = book
            .borrower
            .clone()
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::NoPendingRequest));

        book.status = BookStatus::Loaned;
        save_book(&env, &book);

        LoanConfirmed {
            book_id,
            owner,
            borrower,
            return_by: book.return_by,
        }
        .publish(&env);

        true
    }

    pub fn mark_returned(env: Env, owner: Address, book_id: u64) -> bool {
        owner.require_auth();

        let mut book = load_book(&env, book_id);

        if book.owner != owner {
            panic_with_error!(&env, ContractError::UnauthorizedOwner);
        }

        if book.status != BookStatus::Loaned {
            panic_with_error!(&env, ContractError::BookNotLoaned);
        }

        let borrower = book
            .borrower
            .clone()
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::BookNotLoaned));

        book.loan_count += 1;
        clear_request(&mut book);

        save_book(&env, &book);

        BookReturned {
            book_id,
            owner,
            borrower,
            loan_count: book.loan_count,
        }
        .publish(&env);

        true
    }

    pub fn get_book(env: Env, book_id: u64) -> Book {
        load_book(&env, book_id)
    }

    pub fn list_books(env: Env) -> Vec<u64> {
        load_book_ids(&env)
    }

    pub fn is_available(env: Env, book_id: u64) -> bool {
        env.storage()
            .persistent()
            .get::<DataKey, Book>(&DataKey::Book(book_id))
            .map(|book| book.status == BookStatus::Available)
            .unwrap_or(false)
    }

    pub fn get_stats(env: Env) -> LoanStats {
        let book_ids = load_book_ids(&env);

        let mut available_books = 0_u32;
        let mut requested_books = 0_u32;
        let mut loaned_books = 0_u32;
        let mut completed_loans = 0_u32;
        let mut index = 0_u32;

        while index < book_ids.len() {
            let book_id = book_ids.get(index).unwrap();
            let book = load_book(&env, book_id);

            match book.status {
                BookStatus::Available => {
                    available_books += 1;
                }
                BookStatus::Requested => {
                    requested_books += 1;
                }
                BookStatus::Loaned => {
                    loaned_books += 1;
                }
            }

            completed_loans += book.loan_count;
            index += 1;
        }

        LoanStats {
            total_books: book_ids.len(),
            available_books,
            requested_books,
            loaned_books,
            completed_loans,
        }
    }
}

#[cfg(test)]
mod test;
