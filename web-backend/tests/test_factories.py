"""
Tests demonstrating the use of factories for test data generation.

These tests showcase how to use the factory functions to create
realistic test data with minimal boilerplate.
"""

from __future__ import annotations

import pytest

from tests.factories import (
    AccountFactory,
    BookFactory,
    CommodityFactory,
    CustomerFactory,
    TransactionFactory,
    VendorFactory,
)


def test_book_factory_creates_books_with_different_names(client):
    """Test that BookFactory generates unique books."""
    book_ids = BookFactory.create_batch(client, count=5)

    assert len(book_ids) == 5
    assert len(set(book_ids)) == 5, "All book IDs should be unique"

    # Verify all books exist
    for book_id in book_ids:
        response = client.get(f"/books/{book_id}")
        assert response.status_code == 200


def test_book_factory_can_override_name(client):
    """Test that BookFactory allows custom names."""
    book_id = BookFactory.create(client, name="My Custom Book")

    response = client.get(f"/books/{book_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "My Custom Book"


def test_commodity_factory_creates_different_currencies(client):
    """Test that CommodityFactory generates different commodities."""
    commodity_ids = CommodityFactory.create_batch(client, count=4)

    assert len(commodity_ids) == 4
    assert len(set(commodity_ids)) == 4

    # Verify all commodities exist
    for commodity_id in commodity_ids:
        response = client.get(f"/commodities/{commodity_id}")
        assert response.status_code == 200


def test_commodity_factory_respects_mnemonic(client):
    """Test that CommodityFactory uses specified mnemonic."""
    usd_id = CommodityFactory.create(client, mnemonic="USD")
    eur_id = CommodityFactory.create(client, mnemonic="EUR")

    usd = client.get(f"/commodities/{usd_id}").json()
    eur = client.get(f"/commodities/{eur_id}").json()

    assert usd["mnemonic"] == "USD"
    assert eur["mnemonic"] == "EUR"


def test_account_factory_creates_hierarchical_structure(client):
    """Test that AccountFactory can create account hierarchies."""
    book_id = BookFactory.create(client)
    commodity_id = CommodityFactory.create(client)

    root_id = AccountFactory.create_root(client, book_id=book_id, commodity_id=commodity_id)

    # Create multiple child accounts
    asset_ids = AccountFactory.create_batch(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        parent_id=root_id,
        account_type="ASSET",
        count=3,
    )

    assert len(asset_ids) == 3

    # Verify hierarchy
    tree = client.get(f"/accounts/tree?book_id={book_id}").json()
    assert len(tree) == 1
    assert tree[0]["id"] == root_id
    assert len(tree[0]["children"]) == 3


def test_account_factory_generates_realistic_names(client):
    """Test that AccountFactory generates appropriate names by type."""
    book_id = BookFactory.create(client)
    commodity_id = CommodityFactory.create(client)
    root_id = AccountFactory.create_root(client, book_id=book_id, commodity_id=commodity_id)

    # Create accounts of different types
    asset_id = AccountFactory.create(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        parent_id=root_id,
        account_type="ASSET",
    )
    expense_id = AccountFactory.create(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        parent_id=root_id,
        account_type="EXPENSE",
    )

    asset = client.get(f"/accounts/{asset_id}").json()
    expense = client.get(f"/accounts/{expense_id}").json()

    # Names should be from the appropriate category
    assert asset["name"] in AccountFactory.ACCOUNT_NAMES["ASSET"]
    assert expense["name"] in AccountFactory.ACCOUNT_NAMES["EXPENSE"]


def test_customer_factory_creates_with_realistic_data(client):
    """Test that CustomerFactory generates realistic customer data."""
    book_id = BookFactory.create(client)
    currency_id = CommodityFactory.create(client)

    customer_guid = CustomerFactory.create(
        client,
        book_id=book_id,
        currency_guid=currency_id,
    )

    customer = client.get(f"/customers/{customer_guid}").json()

    assert customer["name"]  # Should have a company name
    assert customer["id"].startswith("C")  # Should have customer ID starting with C
    assert customer["active"] is True  # Should be active by default

    # Email and phone might be generated (70% and 60% chance)
    # Just verify the structure is valid if present
    if "addr_email" in customer and customer["addr_email"]:
        assert "@" in customer["addr_email"]


def test_customer_factory_batch_creates_multiple(client):
    """Test that CustomerFactory can create multiple customers."""
    book_id = BookFactory.create(client)
    currency_id = CommodityFactory.create(client)

    customer_guids = CustomerFactory.create_batch(
        client,
        book_id=book_id,
        currency_guid=currency_id,
        count=5,
    )

    assert len(customer_guids) == 5
    assert len(set(customer_guids)) == 5

    # Verify all exist
    for guid in customer_guids:
        response = client.get(f"/customers/{guid}")
        assert response.status_code == 200


def test_vendor_factory_creates_with_realistic_data(client):
    """Test that VendorFactory generates realistic vendor data."""
    book_id = BookFactory.create(client)
    currency_id = CommodityFactory.create(client)

    vendor_guid = VendorFactory.create(
        client,
        book_id=book_id,
        currency_guid=currency_id,
    )

    vendor = client.get(f"/vendors/{vendor_guid}").json()

    assert vendor["name"]  # Should have a company name
    assert vendor["id"].startswith("V")  # Should have vendor ID starting with V
    assert vendor["active"] is True


def test_transaction_factory_creates_balanced_transaction(client):
    """Test that TransactionFactory creates valid balanced transactions."""
    book_id = BookFactory.create(client)
    commodity_id = CommodityFactory.create(client)
    root_id = AccountFactory.create_root(client, book_id=book_id, commodity_id=commodity_id)

    cash_id = AccountFactory.create(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        parent_id=root_id,
        account_type="ASSET",
        name="Cash",
    )
    equity_id = AccountFactory.create(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        parent_id=root_id,
        account_type="EQUITY",
        name="Opening Balance",
    )

    # Create transaction
    tx_guid = TransactionFactory.create(
        client,
        currency_guid=commodity_id,
        account_id=cash_id,
        counter_account_id=equity_id,
        value_num=10000,
        value_denom=100,
    )

    # Verify transaction
    tx = client.get(f"/transactions/{tx_guid}").json()

    assert tx["description"]  # Should have generated description
    assert len(tx["splits"]) == 2
    assert tx["splits"][0]["value_num"] + tx["splits"][1]["value_num"] == 0  # Balanced


def test_transaction_factory_batch_creates_multiple(client):
    """Test that TransactionFactory can create multiple transactions."""
    book_id = BookFactory.create(client)
    commodity_id = CommodityFactory.create(client)
    root_id = AccountFactory.create_root(client, book_id=book_id, commodity_id=commodity_id)

    cash_id = AccountFactory.create(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        parent_id=root_id,
        account_type="ASSET",
        name="Cash",
    )
    expense_id = AccountFactory.create(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        parent_id=root_id,
        account_type="EXPENSE",
        name="Groceries",
    )

    # Create multiple transactions with random values
    tx_guids = TransactionFactory.create_batch(
        client,
        currency_guid=commodity_id,
        account_id=cash_id,
        counter_account_id=expense_id,
        count=10,
        value_range=(100, 50000),
    )

    assert len(tx_guids) == 10
    assert len(set(tx_guids)) == 10

    # Verify all exist and have different values
    values = []
    for guid in tx_guids:
        tx = client.get(f"/transactions/{guid}").json()
        value = tx["splits"][0]["value_num"]
        values.append(abs(value))

    # Most values should be different (allowing for rare collisions)
    assert len(set(values)) >= 8, "Most transaction values should be unique"


def test_factories_work_together_for_complex_scenario(client):
    """Test that factories can be combined for complex test scenarios."""
    # Create a complete test environment
    book_id = BookFactory.create(client, name="Test Business")
    currency_id = CommodityFactory.create(client, mnemonic="USD")

    # Create account structure
    root_id = AccountFactory.create_root(client, book_id=book_id, commodity_id=currency_id)
    asset_id = AccountFactory.create(
        client,
        book_id=book_id,
        commodity_id=currency_id,
        parent_id=root_id,
        account_type="ASSET",
        name="Bank Account",
    )
    income_id = AccountFactory.create(
        client,
        book_id=book_id,
        commodity_id=currency_id,
        parent_id=root_id,
        account_type="INCOME",
        name="Sales",
    )

    # Create customers
    customers = CustomerFactory.create_batch(
        client,
        book_id=book_id,
        currency_guid=currency_id,
        count=3,
    )

    # Create vendors
    vendors = VendorFactory.create_batch(
        client,
        book_id=book_id,
        currency_guid=currency_id,
        count=2,
    )

    # Create some transactions
    transactions = TransactionFactory.create_batch(
        client,
        currency_guid=currency_id,
        account_id=asset_id,
        counter_account_id=income_id,
        count=5,
    )

    # Verify everything exists
    assert len(customers) == 3
    assert len(vendors) == 2
    assert len(transactions) == 5

    # Verify book has all the data
    accounts = client.get(f"/accounts?book_id={book_id}").json()
    assert len(accounts) >= 3  # root + asset + income

    book_customers = client.get(f"/customers?book_id={book_id}").json()
    assert len(book_customers) == 3

    book_vendors = client.get(f"/vendors?book_id={book_id}").json()
    assert len(book_vendors) == 2


def test_factory_build_methods_dont_create_entities(client):
    """Test that build() methods create data without persisting."""
    # Build data without creating
    book_data = BookFactory.build(name="Not Created")
    customer_data = CustomerFactory.build(
        book_id="fake-book-id",
        currency_guid="fake-currency-id",
    )
    commodity_data = CommodityFactory.build(mnemonic="TST")

    # Verify data structure
    assert book_data["name"] == "Not Created"
    assert customer_data["book_id"] == "fake-book-id"
    assert commodity_data["mnemonic"] == "TST"

    # Verify nothing was created in the API
    books = client.get("/books").json()
    # The list might not be empty if other tests ran, but our book shouldn't be there
    assert not any(b["name"] == "Not Created" for b in books)


@pytest.mark.parametrize("count", [1, 5, 10])
def test_batch_creation_scales(client, count):
    """Test that batch creation works for different counts."""
    books = BookFactory.create_batch(client, count=count)
    assert len(books) == count
    assert len(set(books)) == count  # All unique
