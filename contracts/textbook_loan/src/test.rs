use super::*;

use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    Address, Env, String,
};

struct TestContext {
    env: Env,
    client: TextbookLoanClient<'static>,
    owner: Address,
    borrower: Address,
    second_borrower: Address,
}

fn create_context() -> TestContext {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000);

    let contract_id = env.register(TextbookLoan, ());

    let client = TextbookLoanClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    let borrower = Address::generate(&env);
    let second_borrower = Address::generate(&env);

    TestContext {
        env,
        client,
        owner,
        borrower,
        second_borrower,
    }
}

fn list_default_book(context: &TestContext, book_id: u64) {
    context.client.list_book(
        &context.owner,
        &book_id,
        &String::from_str(&context.env, "Introduction to Stellar"),
        &String::from_str(&context.env, "9780000000001"),
    );
}

#[test]
fn owner_can_list_a_book() {
    let context = create_context();

    let book_id = context.client.list_book(
        &context.owner,
        &1_u64,
        &String::from_str(&context.env, "Blockchain Fundamentals"),
        &String::from_str(&context.env, "9780000000002"),
    );

    assert_eq!(book_id, 1);

    let book = context.client.get_book(&1_u64);

    assert_eq!(book.book_id, 1);
    assert_eq!(book.owner, context.owner);
    assert_eq!(book.status, BookStatus::Available);
    assert_eq!(book.borrower, None);
    assert_eq!(book.loan_count, 0);

    assert!(context.client.is_available(&1_u64));
}

#[test]
fn borrower_request_locks_the_book() {
    let context = create_context();
    list_default_book(&context, 2);

    assert!(context
        .client
        .request_loan(&context.borrower, &2_u64, &2_000_u64,));

    let book = context.client.get_book(&2_u64);

    assert_eq!(book.status, BookStatus::Requested);

    assert_eq!(book.borrower, Some(context.borrower));

    assert_eq!(book.return_by, 2_000);
    assert!(!context.client.is_available(&2_u64));
}

#[test]
#[should_panic]
fn second_borrower_cannot_replace_existing_request() {
    let context = create_context();
    list_default_book(&context, 3);

    context
        .client
        .request_loan(&context.borrower, &3_u64, &2_000_u64);

    context
        .client
        .request_loan(&context.second_borrower, &3_u64, &2_500_u64);
}

#[test]
fn owner_can_confirm_a_requested_loan() {
    let context = create_context();
    list_default_book(&context, 4);

    context
        .client
        .request_loan(&context.borrower, &4_u64, &2_000_u64);

    assert!(context.client.confirm_loan(&context.owner, &4_u64,));

    let book = context.client.get_book(&4_u64);

    assert_eq!(book.status, BookStatus::Loaned);
}

#[test]
fn borrower_can_cancel_a_request() {
    let context = create_context();
    list_default_book(&context, 5);

    context
        .client
        .request_loan(&context.borrower, &5_u64, &2_000_u64);

    assert!(context.client.cancel_request(&context.borrower, &5_u64,));

    let book = context.client.get_book(&5_u64);

    assert_eq!(book.status, BookStatus::Available);

    assert_eq!(book.borrower, None);
    assert_eq!(book.return_by, 0);
}

#[test]
fn owner_can_reject_a_request() {
    let context = create_context();
    list_default_book(&context, 6);

    context
        .client
        .request_loan(&context.borrower, &6_u64, &2_000_u64);

    assert!(context.client.reject_request(&context.owner, &6_u64,));

    assert!(context.client.is_available(&6_u64));
}

#[test]
fn returned_book_becomes_available_again() {
    let context = create_context();
    list_default_book(&context, 7);

    context
        .client
        .request_loan(&context.borrower, &7_u64, &2_000_u64);

    context.client.confirm_loan(&context.owner, &7_u64);

    assert!(context.client.mark_returned(&context.owner, &7_u64,));

    let book = context.client.get_book(&7_u64);

    assert_eq!(book.status, BookStatus::Available);

    assert_eq!(book.borrower, None);
    assert_eq!(book.loan_count, 1);
}

#[test]
fn stats_track_all_book_states() {
    let context = create_context();

    list_default_book(&context, 8);
    list_default_book(&context, 9);
    list_default_book(&context, 10);

    context
        .client
        .request_loan(&context.borrower, &9_u64, &2_000_u64);

    context
        .client
        .request_loan(&context.second_borrower, &10_u64, &2_500_u64);

    context.client.confirm_loan(&context.owner, &10_u64);

    let stats = context.client.get_stats();

    assert_eq!(stats.total_books, 3);
    assert_eq!(stats.available_books, 1);
    assert_eq!(stats.requested_books, 1);
    assert_eq!(stats.loaned_books, 1);
    assert_eq!(stats.completed_loans, 0);

    assert_eq!(
        context.client.list_books(),
        soroban_sdk::vec![&context.env, 8_u64, 9_u64, 10_u64,]
    );
}
