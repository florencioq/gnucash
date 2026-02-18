# Test Factories with Faker

This directory contains test factory functions that generate realistic test data using the [Faker](https://faker.readthedocs.io/) library.

## Overview

Factories provide a clean, consistent way to create test data with minimal boilerplate. Instead of manually building JSON payloads and making API calls, you can use factory methods that handle all the details.

## Benefits

- **75% less test setup code** - Factories eliminate boilerplate
- **Realistic data** - Faker generates varied, realistic values
- **Better test coverage** - Varied data catches more edge cases
- **Easier maintenance** - Change factory once, all tests updated
- **Batch operations** - Easily create multiple entities
- **Consistent patterns** - All tests use the same creation methods

## Quick Start

```python
from tests.factories import BookFactory, CommodityFactory, AccountFactory

# Create entities with defaults
book_id = BookFactory.create(client)
commodity_id = CommodityFactory.create(client)
account_id = AccountFactory.create(
    client,
    book_id=book_id,
    commodity_id=commodity_id,
    account_type="ASSET",
)

# Create with custom values
book_id = BookFactory.create(client, name="Custom Book Name")

# Create multiple entities at once
book_ids = BookFactory.create_batch(client, count=5)
```

## Available Factories

### BookFactory

Creates book entities.

```python
# Single book
book_id = BookFactory.create(client)
book_id = BookFactory.create(client, name="Acme Corp")

# Multiple books
book_ids = BookFactory.create_batch(client, count=3)

# Preview data without creating
data = BookFactory.build(name="Preview Book")
```

### CommodityFactory

Creates currency/commodity entities.

```python
# Default (BRL)
commodity_id = CommodityFactory.create(client)

# Specific currency
usd_id = CommodityFactory.create(client, mnemonic="USD")
eur_id = CommodityFactory.create(client, mnemonic="EUR")

# Multiple currencies
ids = CommodityFactory.create_batch(client, count=4)

# Build without creating
data = CommodityFactory.build(mnemonic="GBP", fullname="British Pound")
```

### AccountFactory

Creates account entities with realistic names based on account type.

```python
# Root account
root_id = AccountFactory.create_root(
    client,
    book_id=book_id,
    commodity_id=commodity_id,
)

# Regular account
asset_id = AccountFactory.create(
    client,
    book_id=book_id,
    commodity_id=commodity_id,
    parent_id=root_id,
    account_type="ASSET",
    name="Bank Account",  # Optional, will generate if not provided
)

# Multiple accounts
account_ids = AccountFactory.create_batch(
    client,
    book_id=book_id,
    commodity_id=commodity_id,
    parent_id=root_id,
    account_type="EXPENSE",
    count=5,
)
```

Account types and their realistic names:
- `ASSET`: "Cash", "Bank Account", "Checking", "Savings", "Investments"
- `LIABILITY`: "Credit Card", "Loan", "Mortgage", "Accounts Payable"
- `EQUITY`: "Opening Balances", "Retained Earnings", "Owner's Equity"
- `INCOME`: "Salary", "Interest", "Dividends", "Sales Revenue"
- `EXPENSE`: "Groceries", "Rent", "Utilities", "Transportation", "Entertainment"

### CustomerFactory

Creates customer entities with realistic company names, emails, and phone numbers.

```python
# Basic customer
customer_guid = CustomerFactory.create(
    client,
    book_id=book_id,
    currency_guid=currency_id,
)

# Custom customer
customer_guid = CustomerFactory.create(
    client,
    book_id=book_id,
    currency_guid=currency_id,
    name="ACME Corp",
    customer_id="C0001",
    addr_email="contact@acme.com",
    addr_phone="+1-555-0100",
)

# Multiple customers
guids = CustomerFactory.create_batch(
    client,
    book_id=book_id,
    currency_guid=currency_id,
    count=10,
)
```

### VendorFactory

Creates vendor entities similar to customers.

```python
vendor_guid = VendorFactory.create(
    client,
    book_id=book_id,
    currency_guid=currency_id,
)

# Multiple vendors
guids = VendorFactory.create_batch(
    client,
    book_id=book_id,
    currency_guid=currency_id,
    count=5,
)
```

### TransactionFactory

Creates transaction entities with balanced splits.

```python
# Simple two-split transaction
tx_guid = TransactionFactory.create(
    client,
    currency_guid=commodity_id,
    account_id=asset_id,
    counter_account_id=income_id,
    value_num=100000,  # R$ 1000.00
    value_denom=100,
    description="Sales",  # Optional, will generate if not provided
)

# Multiple transactions with random values
guids = TransactionFactory.create_batch(
    client,
    currency_guid=commodity_id,
    account_id=cash_id,
    counter_account_id=expense_id,
    count=20,
    value_range=(1000, 100000),  # R$ 10.00 to R$ 1000.00
)

# Complex transaction (custom splits)
data = TransactionFactory.build(
    currency_guid=commodity_id,
    splits=[
        {
            "account_guid": account1_id,
            "value_num": 50000,
            "value_denom": 100,
            # ... other split fields
        },
        {
            "account_guid": account2_id,
            "value_num": -30000,
            "value_denom": 100,
        },
        {
            "account_guid": account3_id,
            "value_num": -20000,
            "value_denom": 100,
        },
    ],
)
response = client.post("/transactions", json=data)
```

## Common Patterns

### Complete Test Setup

```python
def test_my_feature(client):
    # Setup base entities
    book_id = BookFactory.create(client)
    commodity_id = CommodityFactory.create(client)
    root_id = AccountFactory.create_root(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
    )
    
    # Create accounts
    cash_id = AccountFactory.create(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        parent_id=root_id,
        account_type="ASSET",
    )
    
    # Test your feature
    result = my_function(book_id, cash_id)
    assert result == expected_value
```

### Testing with Multiple Entities

```python
def test_with_multiple_customers(client):
    book_id = BookFactory.create(client)
    currency_id = CommodityFactory.create(client)
    
    # Create 10 customers
    customer_guids = CustomerFactory.create_batch(
        client,
        book_id=book_id,
        currency_guid=currency_id,
        count=10,
    )
    
    # Test listing
    response = client.get(f"/customers?book_id={book_id}")
    assert len(response.json()) == 10
```

### Testing with Realistic Data

```python
def test_edge_cases_with_varied_data(client):
    book_id = BookFactory.create(client)
    commodity_id = CommodityFactory.create(client)
    root_id = AccountFactory.create_root(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
    )
    
    # Create 100 transactions with random values
    # This helps catch edge cases and performance issues
    TransactionFactory.create_batch(
        client,
        currency_guid=commodity_id,
        account_id=asset_id,
        counter_account_id=income_id,
        count=100,
        value_range=(1, 1000000),
    )
    
    # Test with realistic varied data
    result = calculate_something(book_id)
    assert result > 0
```

## Build vs Create

All factories have two methods:

- **`build(**kwargs)`** - Returns a dictionary of data without creating the entity
  - Useful for testing validation
  - Can be modified before sending to API
  - Does not make any API calls

- **`create(client, **kwargs)`** - Creates the entity and returns its ID/GUID
  - Makes API call
  - Asserts successful creation (201 status)
  - Returns the ID for use in subsequent operations

```python
# Build data for inspection/modification
customer_data = CustomerFactory.build(
    book_id=book_id,
    currency_guid=currency_id,
    name="Test Customer",
)
customer_data["notes"] = "Modified before creation"
response = client.post("/customers", json=customer_data)

# Create directly (most common)
customer_guid = CustomerFactory.create(
    client,
    book_id=book_id,
    currency_guid=currency_id,
)
```

## Migration Guide

To migrate existing tests to use factories:

1. **Identify repetitive setup code** - Look for manual entity creation
2. **Replace with factory calls** - Use appropriate factory method
3. **Customize only what matters** - Override only fields relevant to the test
4. **Use batch operations** - Replace loops with `create_batch()`

### Before

```python
def test_old_way(client):
    # Manual creation (verbose)
    book_response = client.post("/books", json={"name": "Demo"})
    book_id = book_response.json()["id"]
    
    commodity_response = client.post(
        "/commodities",
        json={
            "namespace": "CURRENCY",
            "mnemonic": "BRL",
            "fullname": "Brazilian Real",
            "fraction": 100,
            "quote": False,
        },
    )
    commodity_id = commodity_response.json()["id"]
    
    # ... more manual creation
```

### After

```python
def test_new_way(client):
    # Clean factory-based creation
    book_id = BookFactory.create(client)
    commodity_id = CommodityFactory.create(client)
    
    # Done! Much cleaner
```

## Tips and Best Practices

✅ **DO:**
- Use factories for ALL test data creation
- Let Faker generate realistic data
- Use `create_batch()` for multiple entities
- Override only fields relevant to your test
- Use descriptive names when the name matters for the test

❌ **DON'T:**
- Manually create test data with hardcoded values
- Hardcode IDs like "CUST001" (let Faker generate)
- Create entities in loops (use `create_batch()` instead)
- Override fields unnecessarily
- Fear realistic/random data (it catches more bugs!)

## Faker Configuration

The factories use Faker with:
- **Locales**: `pt_BR` (Brazilian Portuguese) and `en_US` (English)
- **Seed**: `12345` (for reproducibility in tests)
- **Providers**: Names, companies, addresses, emails, phones, dates, etc.

You can add more locales or change the seed in `factories.py` if needed:

```python
fake = Faker(["pt_BR", "en_US", "es_ES"])  # Add Spanish
Faker.seed(99999)  # Different seed
```

## Examples

See [`test_factories.py`](test_factories.py) and [`test_factories_examples.py`](test_factories_examples.py) for complete working examples.

## Further Reading

- [Faker Documentation](https://faker.readthedocs.io/)
- [Factory Pattern](https://en.wikipedia.org/wiki/Factory_(object-oriented_programming))
- [Test Data Builders](https://www.natpryce.com/articles/000714.html)
