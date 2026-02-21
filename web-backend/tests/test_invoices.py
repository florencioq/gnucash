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


def create_invoice_with_entry(
    client,
    *,
    book_id: str,
    currency_guid: str,
    customer_guid: str,
    income_account_guid: str,
    invoice_id: str,
    date_opened: str,
    unit_price_num: int,
) -> str:
    created = client.post(
        "/invoices",
        json={
            "book_id": book_id,
            "type": "INVOICE",
            "id": invoice_id,
            "date_opened": date_opened,
            "currency_guid": currency_guid,
            "customer_guid": customer_guid,
        },
    )
    assert created.status_code == 201
    invoice_guid = created.json()["guid"]

    entry = client.post(
        f"/invoices/{invoice_guid}/entries",
        json={
            "date": date_opened,
            "description": "Item",
            "income_account_guid": income_account_guid,
            "quantity_num": 1,
            "quantity_denom": 1,
            "unit_price_num": unit_price_num,
            "unit_price_denom": 100,
        },
    )
    assert entry.status_code == 201
    return invoice_guid


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
            "taxable": True,
            "tax_num": 500,
            "tax_denom": 100,
            "tax_included": False,
        },
    )
    assert created_entry.status_code == 201
    entry = created_entry.json()
    assert entry["subtotal_num"] == 270
    assert entry["subtotal_denom"] == 1
    assert entry["tax_num"] == 5
    assert entry["tax_denom"] == 1
    assert entry["total_num"] == 270
    assert entry["total_denom"] == 1
    entry_guid = entry["guid"]

    fetched = client.get(f"/invoices/{invoice_guid}")
    assert fetched.status_code == 200
    invoice_after_entry = fetched.json()
    assert len(invoice_after_entry["entries"]) == 1
    assert invoice_after_entry["subtotal_num"] == 270
    assert invoice_after_entry["subtotal_denom"] == 1
    assert invoice_after_entry["tax_num"] == 5
    assert invoice_after_entry["tax_denom"] == 1
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


def test_invoice_create_autonumbers_when_id_is_blank(client):
    book_id = create_book(client, "Invoices Auto Number")
    currency_guid = create_currency(client, "BRL")
    customer_guid = create_customer(client, book_id=book_id, currency_guid=currency_guid)

    first = client.post(
        "/invoices",
        json={
            "book_id": book_id,
            "type": "INVOICE",
            "id": "000009",
            "date_opened": "2026-02-15T00:00:00Z",
            "currency_guid": currency_guid,
            "customer_guid": customer_guid,
        },
    )
    assert first.status_code == 201
    assert first.json()["id"] == "000009"

    second = client.post(
        "/invoices",
        json={
            "book_id": book_id,
            "type": "INVOICE",
            "id": "",
            "date_opened": "2026-02-16T00:00:00Z",
            "currency_guid": currency_guid,
            "customer_guid": customer_guid,
        },
    )
    assert second.status_code == 201
    assert second.json()["id"] == "000010"

    third = client.post(
        "/invoices",
        json={
            "book_id": book_id,
            "type": "INVOICE",
            "id": "   ",
            "date_opened": "2026-02-17T00:00:00Z",
            "currency_guid": currency_guid,
            "customer_guid": customer_guid,
        },
    )
    assert third.status_code == 201
    assert third.json()["id"] == "000011"


def test_invoice_autonumber_tracks_manual_high_id_after_counter_exists(client):
    book_id = create_book(client, "Invoices Auto Number Manual Sync")
    currency_guid = create_currency(client, "BRL")
    customer_guid = create_customer(client, book_id=book_id, currency_guid=currency_guid)

    first_auto = client.post(
        "/invoices",
        json={
            "book_id": book_id,
            "type": "INVOICE",
            "id": "",
            "date_opened": "2026-02-15T00:00:00Z",
            "currency_guid": currency_guid,
            "customer_guid": customer_guid,
        },
    )
    assert first_auto.status_code == 201
    assert first_auto.json()["id"] == "000001"

    manual = client.post(
        "/invoices",
        json={
            "book_id": book_id,
            "type": "INVOICE",
            "id": "000099",
            "date_opened": "2026-02-16T00:00:00Z",
            "currency_guid": currency_guid,
            "customer_guid": customer_guid,
        },
    )
    assert manual.status_code == 201
    assert manual.json()["id"] == "000099"

    second_auto = client.post(
        "/invoices",
        json={
            "book_id": book_id,
            "type": "INVOICE",
            "id": "",
            "date_opened": "2026-02-17T00:00:00Z",
            "currency_guid": currency_guid,
            "customer_guid": customer_guid,
        },
    )
    assert second_auto.status_code == 201
    assert second_auto.json()["id"] == "000100"


def test_invoice_list_paginated_summary(client):
    book_id = create_book(client, "Invoices Paginated")
    currency_guid = create_currency(client, "BRL")
    customer_a_guid = create_customer(client, book_id=book_id, currency_guid=currency_guid, name="Partech", customer_id="CA")
    customer_b_guid = create_customer(client, book_id=book_id, currency_guid=currency_guid, name="Banco Inter", customer_id="CB")
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
        name="Receita",
        account_type="INCOME",
        parent_id=root_id,
    )

    create_invoice_with_entry(
        client,
        book_id=book_id,
        currency_guid=currency_guid,
        customer_guid=customer_a_guid,
        income_account_guid=income_account_guid,
        invoice_id="000001",
        date_opened="2026-01-10T00:00:00Z",
        unit_price_num=10000,
    )
    create_invoice_with_entry(
        client,
        book_id=book_id,
        currency_guid=currency_guid,
        customer_guid=customer_b_guid,
        income_account_guid=income_account_guid,
        invoice_id="000002",
        date_opened="2026-01-11T00:00:00Z",
        unit_price_num=20000,
    )
    create_invoice_with_entry(
        client,
        book_id=book_id,
        currency_guid=currency_guid,
        customer_guid=customer_a_guid,
        income_account_guid=income_account_guid,
        invoice_id="000003",
        date_opened="2026-01-12T00:00:00Z",
        unit_price_num=30000,
    )

    page1 = client.get(
        f"/invoices/list?book_id={book_id}&sort_key=id&sort_direction=asc&page=1&page_size=2"
    )
    assert page1.status_code == 200
    payload1 = page1.json()
    assert payload1["total_items"] == 3
    assert payload1["total_pages"] == 2
    assert payload1["page"] == 1
    assert len(payload1["items"]) == 2
    assert [item["id"] for item in payload1["items"]] == ["000001", "000002"]
    assert payload1["items"][0]["customer_name"] == "Partech"
    assert payload1["items"][0]["payment_status"] == "UNPAID"

    page2 = client.get(
        f"/invoices/list?book_id={book_id}&sort_key=id&sort_direction=asc&page=2&page_size=2"
    )
    assert page2.status_code == 200
    payload2 = page2.json()
    assert payload2["page"] == 2
    assert len(payload2["items"]) == 1
    assert payload2["items"][0]["id"] == "000003"

    customer_filtered = client.get(
        f"/invoices/list?book_id={book_id}&customer_guid={customer_b_guid}&sort_key=id&sort_direction=asc&page=1&page_size=25"
    )
    assert customer_filtered.status_code == 200
    filtered_payload = customer_filtered.json()
    assert filtered_payload["total_items"] == 1
    assert len(filtered_payload["items"]) == 1
    assert filtered_payload["items"][0]["customer_guid"] == customer_b_guid


def test_invoice_list_open_payment_filter(client):
    book_id = create_book(client, "Book Open Filter")
    currency_guid = create_currency(client, "BRL")
    customer_guid = create_customer(client, book_id=book_id, currency_guid=currency_guid, customer_id="COPEN")
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
        name="Receita",
        account_type="INCOME",
        parent_id=root_id,
    )
    receivable_account_guid = create_account(
        client,
        book_id=book_id,
        commodity_id=currency_guid,
        name="Contas a Receber",
        account_type="ASSET",
        parent_id=root_id,
    )
    bank_account_guid = create_account(
        client,
        book_id=book_id,
        commodity_id=currency_guid,
        name="Banco",
        account_type="ASSET",
        parent_id=root_id,
    )

    invoice_open_guid = create_invoice_with_entry(
        client,
        book_id=book_id,
        currency_guid=currency_guid,
        customer_guid=customer_guid,
        income_account_guid=income_account_guid,
        invoice_id="000010",
        date_opened="2026-01-10T00:00:00Z",
        unit_price_num=10000,
    )
    invoice_paid_guid = create_invoice_with_entry(
        client,
        book_id=book_id,
        currency_guid=currency_guid,
        customer_guid=customer_guid,
        income_account_guid=income_account_guid,
        invoice_id="000011",
        date_opened="2026-01-11T00:00:00Z",
        unit_price_num=20000,
    )

    post_open = client.post(
        f"/invoices/{invoice_open_guid}/post",
        json={"post_account_guid": receivable_account_guid},
    )
    assert post_open.status_code == 200
    assert post_open.json()["status"] == "POSTED"

    post_paid = client.post(
        f"/invoices/{invoice_paid_guid}/post",
        json={"post_account_guid": receivable_account_guid},
    )
    assert post_paid.status_code == 200
    assert post_paid.json()["status"] == "POSTED"

    pay_full = client.post(
        f"/invoices/{invoice_paid_guid}/payments",
        json={
            "transfer_account_guid": bank_account_guid,
            "amount_num": 20000,
            "amount_denom": 100,
            "payment_date": "2026-01-12T00:00:00Z",
        },
    )
    assert pay_full.status_code == 200
    assert pay_full.json()["status"] == "PAID"

    open_only = client.get(
        f"/invoices/list?book_id={book_id}&payment_filter=OPEN&sort_key=id&sort_direction=asc&page=1&page_size=25"
    )
    assert open_only.status_code == 200
    payload = open_only.json()
    assert payload["total_items"] == 1
    assert len(payload["items"]) == 1
    assert payload["items"][0]["guid"] == invoice_open_guid
    assert payload["items"][0]["payment_status"] == "UNPAID"


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


def test_invoice_post_and_unpost_flow(client):
    book_id = create_book(client, "Book Post")
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
        name="Receita",
        account_type="INCOME",
        parent_id=root_id,
    )
    receivable_account_guid = create_account(
        client,
        book_id=book_id,
        commodity_id=currency_guid,
        name="Contas a Receber",
        account_type="ASSET",
        parent_id=root_id,
    )

    created = client.post(
        "/invoices",
        json={
            "book_id": book_id,
            "type": "INVOICE",
            "id": "000200",
            "date_opened": "2026-02-16T00:00:00Z",
            "currency_guid": currency_guid,
            "customer_guid": customer_guid,
        },
    )
    assert created.status_code == 201
    invoice_guid = created.json()["guid"]

    entry = client.post(
        f"/invoices/{invoice_guid}/entries",
        json={
            "date": "2026-02-16T00:00:00Z",
            "description": "Servico",
            "income_account_guid": income_account_guid,
            "quantity_num": 1,
            "quantity_denom": 1,
            "unit_price_num": 10000,
            "unit_price_denom": 100,
        },
    )
    assert entry.status_code == 201

    posted = client.post(
        f"/invoices/{invoice_guid}/post",
        json={
            "post_account_guid": receivable_account_guid,
            "post_date": "2026-02-16T12:00:00Z",
        },
    )
    assert posted.status_code == 200
    posted_payload = posted.json()
    assert posted_payload["status"] == "POSTED"
    assert posted_payload["post_tx_guid"]
    assert posted_payload["post_lot_guid"]
    assert posted_payload["post_account_guid"] == receivable_account_guid
    assert posted_payload["date_due"] == "2026-02-16T12:00:00Z"

    listed = client.get(
        f"/invoices/list?book_id={book_id}&sort_key=date_due&sort_direction=asc&page=1&page_size=25"
    )
    assert listed.status_code == 200
    listed_item = next(item for item in listed.json()["items"] if item["guid"] == invoice_guid)
    assert listed_item["date_due"].startswith("2026-02-16T12:00:00")

    tx = client.get(f"/transactions/{posted_payload['post_tx_guid']}")
    assert tx.status_code == 200
    splits = tx.json()["splits"]
    assert len(splits) == 2

    receivable_split = next(split for split in splits if split["account_guid"] == receivable_account_guid)
    income_split = next(split for split in splits if split["account_guid"] == income_account_guid)
    assert receivable_split["lot_guid"] == posted_payload["post_lot_guid"]
    assert receivable_split["value_num"] == 10000
    assert receivable_split["value_denom"] == 100
    assert income_split["value_num"] == -10000
    assert income_split["value_denom"] == 100

    patch_linked_tx = client.patch(
        f"/transactions/{posted_payload['post_tx_guid']}",
        json={"description": "Nao permitido"},
    )
    assert patch_linked_tx.status_code == 409
    assert patch_linked_tx.json()["code"] == "TRANSACTION_LINKED_INVOICE"

    delete_linked_tx = client.delete(f"/transactions/{posted_payload['post_tx_guid']}")
    assert delete_linked_tx.status_code == 409
    assert delete_linked_tx.json()["code"] == "TRANSACTION_LINKED_INVOICE"

    patch_entry_while_posted = client.patch(
        f"/invoices/{invoice_guid}/entries/{entry.json()['guid']}",
        json={"description": "Nao deve alterar"},
    )
    assert patch_entry_while_posted.status_code == 409
    assert patch_entry_while_posted.json()["code"] == "INVOICE_ALREADY_POSTED"

    delete_invoice_while_posted = client.delete(f"/invoices/{invoice_guid}")
    assert delete_invoice_while_posted.status_code == 409
    assert delete_invoice_while_posted.json()["code"] == "INVOICE_ALREADY_POSTED"

    unposted = client.post(f"/invoices/{invoice_guid}/unpost", json={})
    assert unposted.status_code == 200
    unposted_payload = unposted.json()
    assert unposted_payload["status"] == "UNPAID"
    assert unposted_payload["post_tx_guid"] is None
    assert unposted_payload["post_lot_guid"] is None
    assert unposted_payload["post_account_guid"] is None
    assert unposted_payload["date_posted"] is None
    assert unposted_payload["date_due"] is None

    tx_after_unpost = client.get(f"/transactions/{posted_payload['post_tx_guid']}")
    assert tx_after_unpost.status_code == 404


def test_invoice_payment_partial_and_undo_flow(client):
    book_id = create_book(client, "Book Payments API")
    currency_guid = create_currency(client, "BRL")
    customer_guid = create_customer(client, book_id=book_id, currency_guid=currency_guid, customer_id="CPARTIAL")

    root_id = create_account(
        client,
        book_id=book_id,
        commodity_id=currency_guid,
        name="Root",
        account_type="ROOT",
        is_placeholder=True,
    )
    receivable_account_guid = create_account(
        client,
        book_id=book_id,
        commodity_id=currency_guid,
        name="Contas a Receber",
        account_type="ASSET",
        parent_id=root_id,
    )
    income_account_guid = create_account(
        client,
        book_id=book_id,
        commodity_id=currency_guid,
        name="Receita",
        account_type="INCOME",
        parent_id=root_id,
    )
    bank_account_guid = create_account(
        client,
        book_id=book_id,
        commodity_id=currency_guid,
        name="Banco",
        account_type="ASSET",
        parent_id=root_id,
    )

    created = client.post(
        "/invoices",
        json={
            "book_id": book_id,
            "id": "000400",
            "currency_guid": currency_guid,
            "customer_guid": customer_guid,
        },
    )
    assert created.status_code == 201
    invoice_guid = created.json()["guid"]

    entry = client.post(
        f"/invoices/{invoice_guid}/entries",
        json={
            "date": "2026-02-16T00:00:00Z",
            "description": "Servico",
            "income_account_guid": income_account_guid,
            "quantity_num": 2,
            "quantity_denom": 1,
            "unit_price_num": 10000,
            "unit_price_denom": 100,
        },
    )
    assert entry.status_code == 201

    posted = client.post(
        f"/invoices/{invoice_guid}/post",
        json={"post_account_guid": receivable_account_guid},
    )
    assert posted.status_code == 200
    assert posted.json()["status"] == "POSTED"
    assert posted.json()["open_amount_num"] == 200
    assert posted.json()["open_amount_denom"] == 1
    assert posted.json()["payments"] == []

    partial_payment = client.post(
        f"/invoices/{invoice_guid}/payments",
        json={
            "transfer_account_guid": bank_account_guid,
            "amount_num": 5000,
            "amount_denom": 100,
            "payment_date": "2026-02-17T00:00:00Z",
            "memo": "Pagamento parcial",
        },
    )
    assert partial_payment.status_code == 200
    partial_payload = partial_payment.json()
    assert partial_payload["status"] == "PARTIAL"
    assert partial_payload["paid_amount_num"] == 50
    assert partial_payload["paid_amount_denom"] == 1
    assert partial_payload["open_amount_num"] == 150
    assert partial_payload["open_amount_denom"] == 1
    assert len(partial_payload["payments"]) == 1
    first_payment_tx_guid = partial_payload["payments"][0]["tx_guid"]

    first_payment_tx = client.get(f"/transactions/{first_payment_tx_guid}")
    assert first_payment_tx.status_code == 200
    first_payment_splits = first_payment_tx.json()["splits"]
    assert len(first_payment_splits) == 2
    receivable_split = next(split for split in first_payment_splits if split["account_guid"] == receivable_account_guid)
    counter_split = next(split for split in first_payment_splits if split["account_guid"] == bank_account_guid)
    assert receivable_split["lot_guid"] == partial_payload["post_lot_guid"]
    assert receivable_split["value_num"] == -5000
    assert receivable_split["value_denom"] == 100
    assert counter_split["value_num"] == 5000
    assert counter_split["value_denom"] == 100

    patch_payment_tx = client.patch(f"/transactions/{first_payment_tx_guid}", json={"description": "Nao permitido"})
    assert patch_payment_tx.status_code == 409
    assert patch_payment_tx.json()["code"] == "TRANSACTION_LINKED_INVOICE"

    delete_payment_tx = client.delete(f"/transactions/{first_payment_tx_guid}")
    assert delete_payment_tx.status_code == 409
    assert delete_payment_tx.json()["code"] == "TRANSACTION_LINKED_INVOICE"

    over_payment = client.post(
        f"/invoices/{invoice_guid}/payments",
        json={
            "transfer_account_guid": bank_account_guid,
            "amount_num": 15100,
            "amount_denom": 100,
        },
    )
    assert over_payment.status_code == 409
    assert over_payment.json()["code"] == "PAYMENT_EXCEEDS_OPEN_BALANCE"

    final_payment = client.post(
        f"/invoices/{invoice_guid}/payments",
        json={
            "transfer_account_guid": bank_account_guid,
            "amount_num": 15000,
            "amount_denom": 100,
            "payment_date": "2026-02-18T00:00:00Z",
        },
    )
    assert final_payment.status_code == 200
    final_payload = final_payment.json()
    assert final_payload["status"] == "PAID"
    assert final_payload["paid_amount_num"] == 200
    assert final_payload["paid_amount_denom"] == 1
    assert final_payload["open_amount_num"] == 0
    assert final_payload["open_amount_denom"] == 1
    assert len(final_payload["payments"]) == 2
    second_payment_tx_guid = final_payload["payments"][1]["tx_guid"]

    unpost_paid_invoice = client.post(f"/invoices/{invoice_guid}/unpost", json={})
    assert unpost_paid_invoice.status_code == 409
    assert unpost_paid_invoice.json()["code"] == "INVOICE_HAS_PAYMENTS"

    undo_last = client.post(f"/invoices/{invoice_guid}/payments/{second_payment_tx_guid}/undo", json={})
    assert undo_last.status_code == 200
    undo_last_payload = undo_last.json()
    assert undo_last_payload["status"] == "PARTIAL"
    assert undo_last_payload["paid_amount_num"] == 50
    assert undo_last_payload["open_amount_num"] == 150
    assert len(undo_last_payload["payments"]) == 1

    undo_first = client.post(f"/invoices/{invoice_guid}/payments/{first_payment_tx_guid}/undo", json={})
    assert undo_first.status_code == 200
    undo_first_payload = undo_first.json()
    assert undo_first_payload["status"] == "POSTED"
    assert undo_first_payload["paid_amount_num"] == 0
    assert undo_first_payload["paid_amount_denom"] == 1
    assert undo_first_payload["open_amount_num"] == 200
    assert undo_first_payload["open_amount_denom"] == 1
    assert undo_first_payload["payments"] == []


def test_invoice_post_with_retained_tax_reduces_receivable_open_amount(client):
    book_id = create_book(client, "Book Retained Tax")
    currency_guid = create_currency(client, "BRL")
    customer_guid = create_customer(client, book_id=book_id, currency_guid=currency_guid, customer_id="CRETIDO")

    root_id = create_account(
        client,
        book_id=book_id,
        commodity_id=currency_guid,
        name="Root",
        account_type="ROOT",
        is_placeholder=True,
    )
    receivable_account_guid = create_account(
        client,
        book_id=book_id,
        commodity_id=currency_guid,
        name="Contas a Receber",
        account_type="ASSET",
        parent_id=root_id,
    )
    retained_tax_account_guid = create_account(
        client,
        book_id=book_id,
        commodity_id=currency_guid,
        name="ISS Retido na Fonte",
        account_type="ASSET",
        parent_id=root_id,
    )
    income_account_guid = create_account(
        client,
        book_id=book_id,
        commodity_id=currency_guid,
        name="Receita",
        account_type="INCOME",
        parent_id=root_id,
    )
    bank_account_guid = create_account(
        client,
        book_id=book_id,
        commodity_id=currency_guid,
        name="Banco",
        account_type="ASSET",
        parent_id=root_id,
    )

    created = client.post(
        "/invoices",
        json={
            "book_id": book_id,
            "id": "000500",
            "currency_guid": currency_guid,
            "customer_guid": customer_guid,
        },
    )
    assert created.status_code == 201
    invoice_guid = created.json()["guid"]

    entry = client.post(
        f"/invoices/{invoice_guid}/entries",
        json={
            "date": "2026-02-16T00:00:00Z",
            "description": "Servico",
            "income_account_guid": income_account_guid,
            "quantity_num": 1,
            "quantity_denom": 1,
            "unit_price_num": 10000,
            "unit_price_denom": 100,
            "tax_num": 500,
            "tax_denom": 100,
        },
    )
    assert entry.status_code == 201

    missing_retained_account = client.post(
        f"/invoices/{invoice_guid}/post",
        json={"post_account_guid": receivable_account_guid},
    )
    assert missing_retained_account.status_code == 409
    assert missing_retained_account.json()["code"] == "MISSING_RETAINED_TAX_ACCOUNT"

    posted = client.post(
        f"/invoices/{invoice_guid}/post",
        json={
            "post_account_guid": receivable_account_guid,
            "retained_tax_account_guid": retained_tax_account_guid,
        },
    )
    assert posted.status_code == 200
    posted_payload = posted.json()
    assert posted_payload["status"] == "PARTIAL"
    assert posted_payload["total_num"] == 100
    assert posted_payload["tax_num"] == 5
    assert posted_payload["open_amount_num"] == 95
    assert posted_payload["open_amount_denom"] == 1

    tx = client.get(f"/transactions/{posted_payload['post_tx_guid']}")
    assert tx.status_code == 200
    splits = tx.json()["splits"]
    assert len(splits) == 3

    receivable_split = next(split for split in splits if split["account_guid"] == receivable_account_guid)
    retained_split = next(split for split in splits if split["account_guid"] == retained_tax_account_guid)
    income_split = next(split for split in splits if split["account_guid"] == income_account_guid)
    assert receivable_split["value_num"] == 9500
    assert receivable_split["value_denom"] == 100
    assert receivable_split["lot_guid"] == posted_payload["post_lot_guid"]
    assert retained_split["value_num"] == 500
    assert retained_split["value_denom"] == 100
    assert retained_split["lot_guid"] is None
    assert income_split["value_num"] == -10000
    assert income_split["value_denom"] == 100

    payment = client.post(
        f"/invoices/{invoice_guid}/payments",
        json={
            "transfer_account_guid": bank_account_guid,
            "amount_num": 9500,
            "amount_denom": 100,
        },
    )
    assert payment.status_code == 200
    paid_payload = payment.json()
    assert paid_payload["status"] == "PAID"
    assert paid_payload["open_amount_num"] == 0
    assert len(paid_payload["payments"]) == 1
    unpost_with_payment = client.post(f"/invoices/{invoice_guid}/unpost", json={})
    assert unpost_with_payment.status_code == 409
    assert unpost_with_payment.json()["code"] == "INVOICE_HAS_PAYMENTS"

    payment_tx_guid = paid_payload["payments"][0]["tx_guid"]
    undo_payment = client.post(f"/invoices/{invoice_guid}/payments/{payment_tx_guid}/undo", json={})
    assert undo_payment.status_code == 200

    unpost = client.post(f"/invoices/{invoice_guid}/unpost", json={})
    assert unpost.status_code == 200
    assert unpost.json()["status"] == "UNPAID"


def test_invoice_unpost_rejected_when_lot_has_payment_split(client):
    book_id = create_book(client, "Book Payment")
    currency_guid = create_currency(client, "BRL")
    customer_guid = create_customer(client, book_id=book_id, currency_guid=currency_guid, customer_id="CPAY")

    root_id = create_account(
        client,
        book_id=book_id,
        commodity_id=currency_guid,
        name="Root",
        account_type="ROOT",
        is_placeholder=True,
    )
    receivable_account_guid = create_account(
        client,
        book_id=book_id,
        commodity_id=currency_guid,
        name="Contas a Receber",
        account_type="ASSET",
        parent_id=root_id,
    )
    income_account_guid = create_account(
        client,
        book_id=book_id,
        commodity_id=currency_guid,
        name="Receita",
        account_type="INCOME",
        parent_id=root_id,
    )
    cash_account_guid = create_account(
        client,
        book_id=book_id,
        commodity_id=currency_guid,
        name="Caixa",
        account_type="ASSET",
        parent_id=root_id,
    )

    created = client.post(
        "/invoices",
        json={
            "book_id": book_id,
            "type": "INVOICE",
            "id": "000300",
            "date_opened": "2026-02-16T00:00:00Z",
            "currency_guid": currency_guid,
            "customer_guid": customer_guid,
        },
    )
    assert created.status_code == 201
    invoice_guid = created.json()["guid"]

    entry = client.post(
        f"/invoices/{invoice_guid}/entries",
        json={
            "date": "2026-02-16T00:00:00Z",
            "description": "Servico",
            "income_account_guid": income_account_guid,
            "quantity_num": 1,
            "quantity_denom": 1,
            "unit_price_num": 20000,
            "unit_price_denom": 100,
        },
    )
    assert entry.status_code == 201

    posted = client.post(
        f"/invoices/{invoice_guid}/post",
        json={"post_account_guid": receivable_account_guid},
    )
    assert posted.status_code == 200
    posted_payload = posted.json()
    lot_guid = posted_payload["post_lot_guid"]

    payment_tx = client.post(
        "/transactions",
        json={
            "currency_guid": currency_guid,
            "description": "Pagamento parcial",
            "splits": [
                {
                    "account_guid": receivable_account_guid,
                    "memo": "Baixa parcial",
                    "action": "",
                    "reconcile_state": "n",
                    "value_num": -5000,
                    "value_denom": 100,
                    "quantity_num": -5000,
                    "quantity_denom": 100,
                    "lot_guid": lot_guid,
                },
                {
                    "account_guid": cash_account_guid,
                    "memo": "Recebimento",
                    "action": "",
                    "reconcile_state": "n",
                    "value_num": 5000,
                    "value_denom": 100,
                    "quantity_num": 5000,
                    "quantity_denom": 100,
                },
            ],
        },
    )
    assert payment_tx.status_code == 201

    unpost = client.post(f"/invoices/{invoice_guid}/unpost", json={})
    assert unpost.status_code == 409
    assert unpost.json()["code"] == "INVOICE_HAS_PAYMENTS"


def uuid_entry_like() -> str:
    return "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
