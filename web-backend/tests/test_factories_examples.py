"""
Example: Refactoring tests to use factories.

This file demonstrates how to refactor existing tests to use factories,
showing the before and after comparison for better maintainability.
"""

from __future__ import annotations

from tests.factories import AccountFactory, BookFactory, CommodityFactory, TransactionFactory


# ==============================================================================
# BEFORE: Manual test data creation (verbose and error-prone)
# ==============================================================================


def test_report_with_manual_setup_OLD_WAY(client):
    """OLD WAY: Manual creation of test data - verbose and repetitive."""
    # Create book manually
    book_response = client.post("/books", json={"name": "Demo"})
    assert book_response.status_code == 201
    book_id = book_response.json()["id"]

    # Create commodity manually
    commodity_response = client.post(
        "/commodities",
        json={
            "namespace": "CURRENCY",
            "mnemonic": "BRL",
            "fullname": "BRL",
            "fraction": 100,
            "quote": False,
        },
    )
    assert commodity_response.status_code == 201
    commodity_id = commodity_response.json()["id"]

    # Create root account manually
    root_response = client.post(
        "/accounts",
        json={
            "book_id": book_id,
            "name": "Root",
            "type": "ROOT",
            "commodity_id": commodity_id,
            "is_placeholder": True,
        },
    )
    assert root_response.status_code == 201
    root_id = root_response.json()["id"]

    # Create asset account manually
    asset_response = client.post(
        "/accounts",
        json={
            "book_id": book_id,
            "parent_id": root_id,
            "name": "Bank",
            "type": "ASSET",
            "commodity_id": commodity_id,
            "is_placeholder": False,
        },
    )
    assert asset_response.status_code == 201
    asset_id = asset_response.json()["id"]

    # Create income account manually
    income_response = client.post(
        "/accounts",
        json={
            "book_id": book_id,
            "parent_id": root_id,
            "name": "Sales",
            "type": "INCOME",
            "commodity_id": commodity_id,
            "is_placeholder": False,
        },
    )
    assert income_response.status_code == 201
    income_id = income_response.json()["id"]

    # Create transaction manually (very verbose!)
    tx_response = client.post(
        "/transactions",
        json={
            "currency_guid": commodity_id,
            "post_date": "2026-02-10T10:00:00Z",
            "description": "Sales",
            "splits": [
                {
                    "account_guid": income_id,
                    "memo": "",
                    "action": "",
                    "reconcile_state": "n",
                    "value_num": -100000,
                    "value_denom": 100,
                    "quantity_num": -100000,
                    "quantity_denom": 100,
                },
                {
                    "account_guid": asset_id,
                    "memo": "",
                    "action": "",
                    "reconcile_state": "n",
                    "value_num": 100000,
                    "value_denom": 100,
                    "quantity_num": 100000,
                    "quantity_denom": 100,
                },
            ],
        },
    )
    assert tx_response.status_code == 201

    # Finally, test the actual functionality
    # Verify the transaction was created and is balanced
    transactions = client.get(f"/transactions?book_id={book_id}").json()
    assert len(transactions) >= 1
    
    # Verify account balances
    tree = client.get(f"/accounts/tree?book_id={book_id}").json()
    assert len(tree) == 1  # Root account with children


# ==============================================================================
# AFTER: Using factories (clean and readable)
# ==============================================================================


def test_report_with_factories_NEW_WAY(client):
    """NEW WAY: Using factories - concise and expressive."""
    # Setup test data in just 5 lines!
    book_id = BookFactory.create(client)
    commodity_id = CommodityFactory.create(client)
    root_id = AccountFactory.create_root(client, book_id=book_id, commodity_id=commodity_id)
    asset_id = AccountFactory.create(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        parent_id=root_id,
        account_type="ASSET",
        name="Bank",
    )
    income_id = AccountFactory.create(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        parent_id=root_id,
        account_type="INCOME",
        name="Sales",
    )

    # Create transaction with factory - much simpler!
    TransactionFactory.create(
        client,
        currency_guid=commodity_id,
        account_id=asset_id,
        counter_account_id=income_id,
        value_num=100000,
        post_date="2026-02-10T10:00:00Z",
        description="Sales",
    )

    # Test the actual functionality (same as before)
    transactions = client.get(f"/transactions?book_id={book_id}").json()
    assert len(transactions) >= 1
    assert transactions[0]["description"] == "Sales"


# ==============================================================================
# EVEN BETTER: Using batch operations for multiple entities
# ==============================================================================


def test_report_with_multiple_transactions_BEST_WAY(client):
    """BEST WAY: Using batch operations for complex scenarios."""
    # Setup
    book_id = BookFactory.create(client)
    commodity_id = CommodityFactory.create(client)
    root_id = AccountFactory.create_root(client, book_id=book_id, commodity_id=commodity_id)

    # Create multiple accounts at once
    asset_id, income_id, expense_id = AccountFactory.create_batch(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        parent_id=root_id,
        count=3,
        account_type="ASSET",  # Will be overridden below
    )

    # Override for specific accounts
    income_id = AccountFactory.create(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        parent_id=root_id,
        account_type="INCOME",
    )
    expense_id = AccountFactory.create(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        parent_id=root_id,
        account_type="EXPENSE",
    )

    # Create 10 income transactions with random realistic values
    TransactionFactory.create_batch(
        client,
        currency_guid=commodity_id,
        account_id=asset_id,
        counter_account_id=income_id,
        count=10,
        value_range=(50000, 200000),  # R$ 500 - R$ 2000
    )

    # Create 5 expense transactions
    TransactionFactory.create_batch(
        client,
        currency_guid=commodity_id,
        account_id=expense_id,
        counter_account_id=asset_id,
        count=5,
        value_range=(10000, 100000),  # R$ 100 - R$ 1000
    )

    # Test with realistic data
    transactions = client.get(f"/transactions?book_id={book_id}").json()
    assert len(transactions) == 15  # 10 income + 5 expense
    
    # Verify all transactions are balanced
    for tx in transactions:
        total = sum(split["value_num"] for split in tx["splits"])
        assert total == 0, f"Transaction {tx['guid']} is not balanced"


# ==============================================================================
# Benefits Comparison
# ==============================================================================

"""
COMPARISON SUMMARY:

┌─────────────────────────────┬──────────────┬──────────────┬──────────────┐
│ Metric                      │ Old Way      │ New Way      │ Best Way     │
├─────────────────────────────┼──────────────┼──────────────┼──────────────┤
│ Lines of code (setup)       │ ~100         │ ~25          │ ~30          │
│ Readability                 │ Low          │ High         │ Very High    │
│ Maintainability             │ Low          │ High         │ Very High    │
│ Realistic data              │ No           │ Yes          │ Yes          │
│ Reusability                 │ No           │ Yes          │ Yes          │
│ Bulk operations             │ Manual loop  │ Manual       │ Built-in     │
│ Data variety                │ Hardcoded    │ Faker-based  │ Faker-based  │
└─────────────────────────────┴──────────────┴──────────────┴──────────────┘

KEY BENEFITS OF USING FACTORIES:

1. **Reduced Boilerplate**: 75% less code for test setup
2. **Realistic Data**: Faker generates varied, realistic test data
3. **Better Tests**: Catch edge cases with varied input data
4. **Maintainability**: Change factory once, all tests updated
5. **Readability**: Intent is clear, setup is concise
6. **Batch Operations**: Easy to create multiple entities
7. **Consistency**: All tests use same creation patterns
8. **Flexibility**: Easy to override defaults when needed

MIGRATION STRATEGY:

1. Start using factories in new tests immediately
2. Gradually refactor existing tests as you touch them
3. Focus on tests with complex setup first
4. Keep old helper functions temporarily for backward compatibility
5. Remove old helpers once all tests are migrated

TIPS FOR USING FACTORIES:

✓ Use factories for ALL test data creation
✓ Use build() to inspect data without creating
✓ Use create_batch() for multiple entities
✓ Override only what's needed for the test case
✓ Let Faker generate realistic data for better coverage
✓ Use descriptive names when they matter for the test
✓ Combine factories for complex scenarios

✗ Don't manually create entities anymore
✗ Don't hardcode IDs like "CUST001" (let Faker generate)
✗ Don't fear realistic data - it catches more bugs!
✗ Don't duplicate factory logic in tests
"""
