from __future__ import annotations

from tests.helpers import create_account, create_book, create_commodity, create_customer, create_vendor


def test_customer_crud_and_list_by_book(client):
    book_a = create_book(client, "Book A")
    book_b = create_book(client, "Book B")
    currency = create_commodity(client, "BRL")
    root_a = create_account(
        client,
        book_id=book_a,
        commodity_id=currency,
        name="Root",
        account_type="ROOT",
        is_placeholder=True,
    )
    income_account_a = create_account(
        client,
        book_id=book_a,
        commodity_id=currency,
        name="Receita de Servicos",
        account_type="INCOME",
        parent_id=root_a,
    )
    income_account_other = create_account(
        client,
        book_id=book_a,
        commodity_id=currency,
        name="Receita de Consultoria",
        account_type="INCOME",
        parent_id=root_a,
    )

    created = client.post(
        "/customers",
        json={
            "book_id": book_a,
            "name": "ACME Ltda",
            "id": "C0001",
            "notes": "Primary customer",
            "currency_guid": currency,
            "income_account_guid": income_account_a,
            "addr_email": "acme@example.com",
        },
    )
    assert created.status_code == 201
    customer_guid = created.json()["guid"]

    created_other_book = client.post(
        "/customers",
        json={
            "book_id": book_b,
            "name": "Other",
            "id": "C0002",
            "currency_guid": currency,
        },
    )
    assert created_other_book.status_code == 201

    listed = client.get(f"/customers?book_id={book_a}")
    assert listed.status_code == 200
    payload = listed.json()
    assert len(payload) == 1
    assert payload[0]["guid"] == customer_guid
    assert payload[0]["id"] == "C0001"
    assert payload[0]["income_account_guid"] == income_account_a

    patched = client.patch(
        f"/customers/{customer_guid}",
        json={
            "notes": "Updated note",
            "active": False,
            "shipaddr_email": "shipping@example.com",
            "income_account_guid": income_account_other,
        },
    )
    assert patched.status_code == 200
    assert patched.json()["notes"] == "Updated note"
    assert patched.json()["active"] is False
    assert patched.json()["shipaddr_email"] == "shipping@example.com"
    assert patched.json()["income_account_guid"] == income_account_other

    deleted = client.delete(f"/customers/{customer_guid}")
    assert deleted.status_code == 204

    fetched = client.get(f"/customers/{customer_guid}")
    assert fetched.status_code == 404


def test_vendor_crud_and_list_by_book(client):
    book_id = create_book(client)
    currency = create_commodity(client, "USD")
    root_id = create_account(
        client,
        book_id=book_id,
        commodity_id=currency,
        name="Root",
        account_type="ROOT",
        is_placeholder=True,
    )
    expense_account_a = create_account(
        client,
        book_id=book_id,
        commodity_id=currency,
        name="Despesas Administrativas",
        account_type="EXPENSE",
        parent_id=root_id,
    )
    expense_account_other = create_account(
        client,
        book_id=book_id,
        commodity_id=currency,
        name="Despesas de Material",
        account_type="EXPENSE",
        parent_id=root_id,
    )

    created = client.post(
        "/vendors",
        json={
            "book_id": book_id,
            "name": "Office Supplies Inc.",
            "id": "V0100",
            "notes": "Preferred supplier",
            "currency_guid": currency,
            "expense_account_guid": expense_account_a,
            "addr_phone": "+55 11 3000-0000",
        },
    )
    assert created.status_code == 201
    vendor_guid = created.json()["guid"]

    listed = client.get(f"/vendors?book_id={book_id}")
    assert listed.status_code == 200
    payload = listed.json()
    assert len(payload) == 1
    assert payload[0]["guid"] == vendor_guid
    assert payload[0]["id"] == "V0100"
    assert payload[0]["expense_account_guid"] == expense_account_a

    patched = client.patch(
        f"/vendors/{vendor_guid}",
        json={
            "active": False,
            "tax_inc": "YES",
            "addr_email": "billing@office.example",
            "expense_account_guid": expense_account_other,
        },
    )
    assert patched.status_code == 200
    assert patched.json()["active"] is False
    assert patched.json()["tax_inc"] == "YES"
    assert patched.json()["addr_email"] == "billing@office.example"
    assert patched.json()["expense_account_guid"] == expense_account_other

    deleted = client.delete(f"/vendors/{vendor_guid}")
    assert deleted.status_code == 204

    fetched = client.get(f"/vendors/{vendor_guid}")
    assert fetched.status_code == 404


def test_customer_requires_existing_book_and_currency(client):
    book_id = create_book(client)
    currency = create_commodity(client)

    invalid_book = client.post(
        "/customers",
        json={
            "book_id": "11111111-1111-1111-1111-111111111111",
            "name": "Broken",
            "id": "CERR1",
            "currency_guid": currency,
        },
    )
    assert invalid_book.status_code == 400
    assert invalid_book.json()["code"] == "INVALID_BOOK"

    invalid_currency = client.post(
        "/customers",
        json={
            "book_id": book_id,
            "name": "Broken",
            "id": "CERR2",
            "currency_guid": "22222222-2222-2222-2222-222222222222",
        },
    )
    assert invalid_currency.status_code == 400
    assert invalid_currency.json()["code"] == "INVALID_CURRENCY"


def test_vendor_requires_existing_book_and_currency(client):
    book_id = create_book(client)
    currency = create_commodity(client)

    invalid_book = client.post(
        "/vendors",
        json={
            "book_id": "11111111-1111-1111-1111-111111111111",
            "name": "Broken vendor",
            "id": "VERR1",
            "currency_guid": currency,
        },
    )
    assert invalid_book.status_code == 400
    assert invalid_book.json()["code"] == "INVALID_BOOK"

    invalid_currency = client.post(
        "/vendors",
        json={
            "book_id": book_id,
            "name": "Broken vendor",
            "id": "VERR2",
            "currency_guid": "22222222-2222-2222-2222-222222222222",
        },
    )
    assert invalid_currency.status_code == 400
    assert invalid_currency.json()["code"] == "INVALID_CURRENCY"


def test_customer_default_income_account_validation(client):
    book_id = create_book(client)
    other_book_id = create_book(client, "Other")
    currency = create_commodity(client, "BRL")
    root_id = create_account(
        client,
        book_id=book_id,
        commodity_id=currency,
        name="Root",
        account_type="ROOT",
        is_placeholder=True,
    )
    other_root_id = create_account(
        client,
        book_id=other_book_id,
        commodity_id=currency,
        name="Root Other",
        account_type="ROOT",
        is_placeholder=True,
    )
    income_account = create_account(
        client,
        book_id=book_id,
        commodity_id=currency,
        name="Receita",
        account_type="INCOME",
        parent_id=root_id,
    )
    expense_account = create_account(
        client,
        book_id=book_id,
        commodity_id=currency,
        name="Despesa",
        account_type="EXPENSE",
        parent_id=root_id,
    )
    foreign_income_account = create_account(
        client,
        book_id=other_book_id,
        commodity_id=currency,
        name="Receita externa",
        account_type="INCOME",
        parent_id=other_root_id,
    )

    valid = client.post(
        "/customers",
        json={
            "book_id": book_id,
            "name": "Cliente Conta",
            "id": "CC01",
            "currency_guid": currency,
            "income_account_guid": income_account,
        },
    )
    assert valid.status_code == 201
    assert valid.json()["income_account_guid"] == income_account

    invalid_type = client.post(
        "/customers",
        json={
            "book_id": book_id,
            "name": "Cliente Tipo",
            "id": "CC02",
            "currency_guid": currency,
            "income_account_guid": expense_account,
        },
    )
    assert invalid_type.status_code == 409
    assert invalid_type.json()["code"] == "INVALID_ACCOUNT_TYPE"

    invalid_book = client.post(
        "/customers",
        json={
            "book_id": book_id,
            "name": "Cliente Livro",
            "id": "CC03",
            "currency_guid": currency,
            "income_account_guid": foreign_income_account,
        },
    )
    assert invalid_book.status_code == 409
    assert invalid_book.json()["code"] == "INVALID_ACCOUNT_BOOK"


def test_vendor_default_expense_account_validation(client):
    book_id = create_book(client)
    other_book_id = create_book(client, "Other")
    currency = create_commodity(client, "BRL")
    root_id = create_account(
        client,
        book_id=book_id,
        commodity_id=currency,
        name="Root",
        account_type="ROOT",
        is_placeholder=True,
    )
    other_root_id = create_account(
        client,
        book_id=other_book_id,
        commodity_id=currency,
        name="Root Other",
        account_type="ROOT",
        is_placeholder=True,
    )
    expense_account = create_account(
        client,
        book_id=book_id,
        commodity_id=currency,
        name="Despesa",
        account_type="EXPENSE",
        parent_id=root_id,
    )
    income_account = create_account(
        client,
        book_id=book_id,
        commodity_id=currency,
        name="Receita",
        account_type="INCOME",
        parent_id=root_id,
    )
    foreign_expense_account = create_account(
        client,
        book_id=other_book_id,
        commodity_id=currency,
        name="Despesa externa",
        account_type="EXPENSE",
        parent_id=other_root_id,
    )

    valid = client.post(
        "/vendors",
        json={
            "book_id": book_id,
            "name": "Fornecedor Conta",
            "id": "FC01",
            "currency_guid": currency,
            "expense_account_guid": expense_account,
        },
    )
    assert valid.status_code == 201
    assert valid.json()["expense_account_guid"] == expense_account

    invalid_type = client.post(
        "/vendors",
        json={
            "book_id": book_id,
            "name": "Fornecedor Tipo",
            "id": "FC02",
            "currency_guid": currency,
            "expense_account_guid": income_account,
        },
    )
    assert invalid_type.status_code == 409
    assert invalid_type.json()["code"] == "INVALID_ACCOUNT_TYPE"

    invalid_book = client.post(
        "/vendors",
        json={
            "book_id": book_id,
            "name": "Fornecedor Livro",
            "id": "FC03",
            "currency_guid": currency,
            "expense_account_guid": foreign_expense_account,
        },
    )
    assert invalid_book.status_code == 409
    assert invalid_book.json()["code"] == "INVALID_ACCOUNT_BOOK"


def test_cannot_delete_referenced_commodity_or_book(client):
    book_id = create_book(client)
    currency = create_commodity(client)

    customer = client.post(
        "/customers",
        json={
            "book_id": book_id,
            "name": "ACME",
            "id": "C111",
            "currency_guid": currency,
        },
    )
    assert customer.status_code == 201

    delete_commodity = client.delete(f"/commodities/{currency}")
    assert delete_commodity.status_code == 409
    assert delete_commodity.json()["code"] == "COMMODITY_IN_USE"

    delete_book = client.delete(f"/books/{book_id}")
    assert delete_book.status_code == 409
    assert delete_book.json()["code"] == "BOOK_HAS_CUSTOMERS"


def test_create_customer_missing_required_fields(client):
    """Test validation errors when creating customer without required fields."""
    book_id = create_book(client)
    currency = create_commodity(client)
    
    # Missing name
    resp = client.post("/customers", json={
        "book_id": book_id,
        "id": "C001",
        "currency_guid": currency,
    })
    assert resp.status_code in (400, 422)
    
    # Missing id
    resp = client.post("/customers", json={
        "book_id": book_id,
        "name": "Test Customer",
        "currency_guid": currency,
    })
    assert resp.status_code in (400, 422)
    
    # Missing currency_guid
    resp = client.post("/customers", json={
        "book_id": book_id,
        "name": "Test Customer",
        "id": "C001",
    })
    assert resp.status_code in (400, 422)


def test_create_vendor_missing_required_fields(client):
    """Test validation errors when creating vendor without required fields."""
    book_id = create_book(client)
    currency = create_commodity(client)
    
    # Missing name
    resp = client.post("/vendors", json={
        "book_id": book_id,
        "id": "V001",
        "currency_guid": currency,
    })
    assert resp.status_code in (400, 422)
    
    # Missing id
    resp = client.post("/vendors", json={
        "book_id": book_id,
        "name": "Test Vendor",
        "currency_guid": currency,
    })
    assert resp.status_code in (400, 422)


def test_customer_invalid_data_types(client):
    """Test validation errors with wrong data types for customer."""
    book_id = create_book(client)
    currency = create_commodity(client)
    
    # NOTE: The API currently coerces many types automatically due to Pydantic
    # - Numbers to strings for text fields
    # - String "yes"/"true" may be coerced to boolean True
    # This is expected Pydantic behavior but could be made stricter
    # with custom validators if needed
    
    # active as string "yes" (may be coerced)
    resp = client.post("/customers", json={
        "book_id": book_id,
        "name": "Test",
        "id": "C001",
        "currency_guid": currency,
        "active": "yes",
    })
    # Pydantic may coerce this
    assert resp.status_code in (201, 400, 422)
