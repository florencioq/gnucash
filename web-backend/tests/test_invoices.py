from __future__ import annotations


def create_book(client, name: str = "Book") -> str:
    response = client.post("/books", json={"name": name})
    assert response.status_code == 201
    return response.json()["id"]


def create_currency(client, mnemonic: str = "BRL") -> str:
    response = client.post(
        "/commodities",
        json={
            "namespace": "CURRENCY",
            "mnemonic": mnemonic,
            "fullname": mnemonic,
            "fraction": 100,
            "quote": False,
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def create_account(
    client,
    *,
    book_id: str,
    commodity_id: str,
    name: str,
    account_type: str,
    parent_id: str | None = None,
    is_placeholder: bool = False,
) -> str:
    payload = {
        "book_id": book_id,
        "name": name,
        "type": account_type,
        "commodity_id": commodity_id,
        "is_placeholder": is_placeholder,
    }
    if parent_id:
        payload["parent_id"] = parent_id
    response = client.post("/accounts", json=payload)
    assert response.status_code == 201
    return response.json()["id"]


def create_customer(client, *, book_id: str, currency_guid: str, name: str = "Partech", customer_id: str = "C0001") -> str:
    response = client.post(
        "/customers",
        json={
            "book_id": book_id,
            "name": name,
            "id": customer_id,
            "currency_guid": currency_guid,
        },
    )
    assert response.status_code == 201
    return response.json()["guid"]


def test_invoice_crud_and_entries(client):
    book_id = create_book(client, "Invoices")
    currency_guid = create_currency(client, "BRL")
    customer_guid = create_customer(client, book_id=book_id, currency_guid=currency_guid)
    root_id = create_account(
        client,
        book_id=book_id,
        commodity_id=currency_guid,
        name="Root",
        account_type="ROOT",
        is_placeholder=True,
    )
    income_account_guid = create_account(
        client,
        book_id=book_id,
        commodity_id=currency_guid,
        name="Receita de Servicos",
        account_type="INCOME",
        parent_id=root_id,
    )

    created = client.post(
        "/invoices",
        json={
            "book_id": book_id,
            "type": "INVOICE",
            "id": "000001",
            "date_opened": "2026-02-15T00:00:00Z",
            "notes": "Primeira fatura",
            "currency_guid": currency_guid,
            "customer_guid": customer_guid,
            "billing_id": "BILL-1",
        },
    )
    assert created.status_code == 201
    invoice = created.json()
    assert invoice["status"] == "UNPAID"
    assert invoice["entries"] == []
    assert invoice["total_num"] == 0
    assert invoice["total_denom"] == 1
    invoice_guid = invoice["guid"]

    created_entry = client.post(
        f"/invoices/{invoice_guid}/entries",
        json={
            "date": "2026-02-15T00:00:00Z",
            "description": "Consultoria",
            "action": "Horas",
            "income_account_guid": income_account_guid,
            "quantity_num": 2,
            "quantity_denom": 1,
            "unit_price_num": 15000,
            "unit_price_denom": 100,
            "discount_num": 10,
            "discount_denom": 100,
            "discount_type": "PERCENT",
            "discount_how": "PRETAX",
            "taxable": False,
            "tax_included": False,
        },
    )
    assert created_entry.status_code == 201
    entry = created_entry.json()
    assert entry["subtotal_num"] == 270
    assert entry["subtotal_denom"] == 1
    assert entry["total_num"] == 270
    assert entry["total_denom"] == 1
    entry_guid = entry["guid"]

    fetched = client.get(f"/invoices/{invoice_guid}")
    assert fetched.status_code == 200
    invoice_after_entry = fetched.json()
    assert len(invoice_after_entry["entries"]) == 1
    assert invoice_after_entry["subtotal_num"] == 270
    assert invoice_after_entry["subtotal_denom"] == 1
    assert invoice_after_entry["total_num"] == 270
    assert invoice_after_entry["total_denom"] == 1

    patched_entry = client.patch(
        f"/invoices/{invoice_guid}/entries/{entry_guid}",
        json={
            "quantity_num": 3,
            "discount_num": 0,
        },
    )
    assert patched_entry.status_code == 200
    assert patched_entry.json()["total_num"] == 450

    patched_invoice = client.patch(
        f"/invoices/{invoice_guid}",
        json={
            "notes": "Atualizada",
            "active": False,
        },
    )
    assert patched_invoice.status_code == 200
    assert patched_invoice.json()["notes"] == "Atualizada"
    assert patched_invoice.json()["status"] == "INACTIVE"

    listing_by_book = client.get(f"/invoices?book_id={book_id}")
    assert listing_by_book.status_code == 200
    assert len(listing_by_book.json()) == 1

    listing_by_customer = client.get(f"/invoices?book_id={book_id}&customer_guid={customer_guid}")
    assert listing_by_customer.status_code == 200
    assert len(listing_by_customer.json()) == 1

    removed_entry = client.delete(f"/invoices/{invoice_guid}/entries/{entry_guid}")
    assert removed_entry.status_code == 204

    removed_invoice = client.delete(f"/invoices/{invoice_guid}")
    assert removed_invoice.status_code == 204

    missing = client.get(f"/invoices/{invoice_guid}")
    assert missing.status_code == 404


def test_invoice_validation_rules(client):
    book_id = create_book(client, "Book A")
    other_book_id = create_book(client, "Book B")
    currency_guid = create_currency(client, "USD")
    customer_guid = create_customer(client, book_id=book_id, currency_guid=currency_guid, customer_id="C100")
    other_customer_guid = create_customer(
        client,
        book_id=other_book_id,
        currency_guid=currency_guid,
        customer_id="C200",
    )

    invalid_book = client.post(
        "/invoices",
        json={
            "book_id": "11111111-1111-1111-1111-111111111111",
            "id": "000001",
            "currency_guid": currency_guid,
            "customer_guid": customer_guid,
        },
    )
    assert invalid_book.status_code == 400
    assert invalid_book.json()["code"] == "INVALID_BOOK"

    invalid_currency = client.post(
        "/invoices",
        json={
            "book_id": book_id,
            "id": "000001",
            "currency_guid": "22222222-2222-2222-2222-222222222222",
            "customer_guid": customer_guid,
        },
    )
    assert invalid_currency.status_code == 400
    assert invalid_currency.json()["code"] == "INVALID_CURRENCY"

    invalid_customer = client.post(
        "/invoices",
        json={
            "book_id": book_id,
            "id": "000001",
            "currency_guid": currency_guid,
            "customer_guid": "33333333-3333-3333-3333-333333333333",
        },
    )
    assert invalid_customer.status_code == 400
    assert invalid_customer.json()["code"] == "INVALID_CUSTOMER"

    customer_other_book = client.post(
        "/invoices",
        json={
            "book_id": book_id,
            "id": "000001",
            "currency_guid": currency_guid,
            "customer_guid": other_customer_guid,
        },
    )
    assert customer_other_book.status_code == 409
    assert customer_other_book.json()["code"] == "INVALID_CUSTOMER_BOOK"

    invoice = client.post(
        "/invoices",
        json={
            "book_id": book_id,
            "id": "000002",
            "currency_guid": currency_guid,
            "customer_guid": customer_guid,
        },
    )
    assert invoice.status_code == 201
    invoice_guid = invoice.json()["guid"]

    root_a = create_account(
        client,
        book_id=book_id,
        commodity_id=currency_guid,
        name="Root A",
        account_type="ROOT",
        is_placeholder=True,
    )
    root_b = create_account(
        client,
        book_id=other_book_id,
        commodity_id=currency_guid,
        name="Root B",
        account_type="ROOT",
        is_placeholder=True,
    )
    income_b = create_account(
        client,
        book_id=other_book_id,
        commodity_id=currency_guid,
        name="Income B",
        account_type="INCOME",
        parent_id=root_b,
    )

    wrong_book_account = client.post(
        f"/invoices/{invoice_guid}/entries",
        json={
            "date": "2026-02-15T00:00:00Z",
            "income_account_guid": income_b,
            "quantity_num": 1,
            "quantity_denom": 1,
            "unit_price_num": 100,
            "unit_price_denom": 1,
        },
    )
    assert wrong_book_account.status_code == 409
    assert wrong_book_account.json()["code"] == "INVALID_ACCOUNT_BOOK"

    invalid_account = client.post(
        f"/invoices/{invoice_guid}/entries",
        json={
            "date": "2026-02-15T00:00:00Z",
            "income_account_guid": "44444444-4444-4444-4444-444444444444",
            "quantity_num": 1,
            "quantity_denom": 1,
            "unit_price_num": 100,
            "unit_price_denom": 1,
        },
    )
    assert invalid_account.status_code == 400
    assert invalid_account.json()["code"] == "INVALID_ACCOUNT"

    income_a = create_account(
        client,
        book_id=book_id,
        commodity_id=currency_guid,
        name="Income A",
        account_type="INCOME",
        parent_id=root_a,
    )
    bad_patch = client.patch(
        f"/invoices/{invoice_guid}/entries/{uuid_entry_like()}",
        json={"income_account_guid": income_a},
    )
    assert bad_patch.status_code == 404


def test_invoice_delete_restrictions(client):
    book_id = create_book(client, "Book Restriction")
    currency_brl = create_currency(client, "BRL")
    currency_usd = create_currency(client, "USD")
    customer_guid = create_customer(client, book_id=book_id, currency_guid=currency_brl)

    root_id = create_account(
        client,
        book_id=book_id,
        commodity_id=currency_brl,
        name="Root",
        account_type="ROOT",
        is_placeholder=True,
    )
    income_account_guid = create_account(
        client,
        book_id=book_id,
        commodity_id=currency_brl,
        name="Income",
        account_type="INCOME",
        parent_id=root_id,
    )

    invoice = client.post(
        "/invoices",
        json={
            "book_id": book_id,
            "id": "000010",
            "currency_guid": currency_brl,
            "customer_guid": customer_guid,
        },
    )
    assert invoice.status_code == 201
    invoice_guid = invoice.json()["guid"]

    entry = client.post(
        f"/invoices/{invoice_guid}/entries",
        json={
            "date": "2026-02-15T00:00:00Z",
            "income_account_guid": income_account_guid,
            "quantity_num": 1,
            "quantity_denom": 1,
            "unit_price_num": 5000,
            "unit_price_denom": 100,
        },
    )
    assert entry.status_code == 201

    customer_delete = client.delete(f"/customers/{customer_guid}")
    assert customer_delete.status_code == 409
    assert customer_delete.json()["code"] == "CUSTOMER_HAS_INVOICES"

    account_delete = client.delete(f"/accounts/{income_account_guid}")
    assert account_delete.status_code == 409
    assert account_delete.json()["code"] == "ACCOUNT_HAS_ENTRIES"

    moved_customer_currency = client.patch(
        f"/customers/{customer_guid}",
        json={"currency_guid": currency_usd},
    )
    assert moved_customer_currency.status_code == 200

    commodity_delete = client.delete(f"/commodities/{currency_brl}")
    assert commodity_delete.status_code == 409
    assert commodity_delete.json()["code"] == "COMMODITY_IN_USE"

    book_without_accounts = create_book(client, "Book Invoice Only")
    customer_without_accounts = create_customer(
        client,
        book_id=book_without_accounts,
        currency_guid=currency_usd,
        customer_id="C999",
    )
    invoice_without_accounts = client.post(
        "/invoices",
        json={
            "book_id": book_without_accounts,
            "id": "000999",
            "currency_guid": currency_usd,
            "customer_guid": customer_without_accounts,
        },
    )
    assert invoice_without_accounts.status_code == 201

    book_delete = client.delete(f"/books/{book_without_accounts}")
    assert book_delete.status_code == 409
    assert book_delete.json()["code"] == "BOOK_HAS_INVOICES"


def uuid_entry_like() -> str:
    return "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
