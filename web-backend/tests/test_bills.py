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


def create_vendor(client, *, book_id: str, currency_guid: str, name: str = "Fornecedor", vendor_id: str = "V0001") -> str:
    response = client.post(
        "/vendors",
        json={
            "book_id": book_id,
            "name": name,
            "id": vendor_id,
            "currency_guid": currency_guid,
        },
    )
    assert response.status_code == 201
    return response.json()["guid"]


def create_bill_with_entry(
    client,
    *,
    book_id: str,
    currency_guid: str,
    vendor_guid: str,
    expense_account_guid: str,
    bill_id: str,
    date_opened: str,
    unit_price_num: int,
) -> str:
    created = client.post(
        "/bills",
        json={
            "book_id": book_id,
            "type": "INVOICE",
            "id": bill_id,
            "date_opened": date_opened,
            "currency_guid": currency_guid,
            "vendor_guid": vendor_guid,
        },
    )
    assert created.status_code == 201
    bill_guid = created.json()["guid"]

    entry = client.post(
        f"/bills/{bill_guid}/entries",
        json={
            "date": date_opened,
            "description": "Item",
            "income_account_guid": expense_account_guid,
            "quantity_num": 1,
            "quantity_denom": 1,
            "unit_price_num": unit_price_num,
            "unit_price_denom": 100,
        },
    )
    assert entry.status_code == 201
    return bill_guid


def test_bill_crud_and_entries(client):
    book_id = create_book(client, "Bills")
    currency_guid = create_currency(client, "BRL")
    vendor_guid = create_vendor(client, book_id=book_id, currency_guid=currency_guid)
    root_id = create_account(
        client,
        book_id=book_id,
        commodity_id=currency_guid,
        name="Root",
        account_type="ROOT",
        is_placeholder=True,
    )
    expense_account_guid = create_account(
        client,
        book_id=book_id,
        commodity_id=currency_guid,
        name="Despesa de Servicos",
        account_type="EXPENSE",
        parent_id=root_id,
    )

    created = client.post(
        "/bills",
        json={
            "book_id": book_id,
            "type": "INVOICE",
            "id": "B00001",
            "date_opened": "2026-02-16T00:00:00Z",
            "notes": "Primeiro bill",
            "currency_guid": currency_guid,
            "vendor_guid": vendor_guid,
            "billing_id": "SUP-1",
        },
    )
    assert created.status_code == 201
    bill = created.json()
    invoices_listing = client.get(f"/invoices?book_id={book_id}")
    assert invoices_listing.status_code == 200
    assert invoices_listing.json() == []
    assert bill["status"] == "UNPAID"
    assert bill["entries"] == []
    assert bill["total_num"] == 0
    assert bill["total_denom"] == 1
    bill_guid = bill["guid"]

    created_entry = client.post(
        f"/bills/{bill_guid}/entries",
        json={
            "date": "2026-02-16T00:00:00Z",
            "description": "Consultoria",
            "action": "Horas",
            "income_account_guid": expense_account_guid,
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

    fetched = client.get(f"/bills/{bill_guid}")
    assert fetched.status_code == 200
    bill_after_entry = fetched.json()
    assert len(bill_after_entry["entries"]) == 1
    assert bill_after_entry["subtotal_num"] == 270
    assert bill_after_entry["tax_num"] == 5
    assert bill_after_entry["tax_denom"] == 1
    assert bill_after_entry["total_num"] == 270

    patched_entry = client.patch(
        f"/bills/{bill_guid}/entries/{entry_guid}",
        json={"quantity_num": 3, "discount_num": 0},
    )
    assert patched_entry.status_code == 200
    assert patched_entry.json()["total_num"] == 450

    patched_bill = client.patch(
        f"/bills/{bill_guid}",
        json={"notes": "Atualizado", "active": False},
    )
    assert patched_bill.status_code == 200
    assert patched_bill.json()["notes"] == "Atualizado"
    assert patched_bill.json()["status"] == "INACTIVE"

    listing_by_book = client.get(f"/bills?book_id={book_id}")
    assert listing_by_book.status_code == 200
    assert len(listing_by_book.json()) == 1

    listing_by_vendor = client.get(f"/bills?book_id={book_id}&vendor_guid={vendor_guid}")
    assert listing_by_vendor.status_code == 200
    assert len(listing_by_vendor.json()) == 1

    removed_entry = client.delete(f"/bills/{bill_guid}/entries/{entry_guid}")
    assert removed_entry.status_code == 204

    removed_bill = client.delete(f"/bills/{bill_guid}")
    assert removed_bill.status_code == 204

    missing = client.get(f"/bills/{bill_guid}")
    assert missing.status_code == 404


def test_bill_create_autonumbers_when_id_is_blank(client):
    book_id = create_book(client, "Bills Auto Number")
    currency_guid = create_currency(client, "BRL")
    vendor_guid = create_vendor(client, book_id=book_id, currency_guid=currency_guid)

    first = client.post(
        "/bills",
        json={
            "book_id": book_id,
            "type": "INVOICE",
            "id": "000020",
            "date_opened": "2026-02-15T00:00:00Z",
            "currency_guid": currency_guid,
            "vendor_guid": vendor_guid,
        },
    )
    assert first.status_code == 201
    assert first.json()["id"] == "000020"

    second = client.post(
        "/bills",
        json={
            "book_id": book_id,
            "type": "INVOICE",
            "id": "",
            "date_opened": "2026-02-16T00:00:00Z",
            "currency_guid": currency_guid,
            "vendor_guid": vendor_guid,
        },
    )
    assert second.status_code == 201
    assert second.json()["id"] == "000021"

    third = client.post(
        "/bills",
        json={
            "book_id": book_id,
            "type": "INVOICE",
            "id": "   ",
            "date_opened": "2026-02-17T00:00:00Z",
            "currency_guid": currency_guid,
            "vendor_guid": vendor_guid,
        },
    )
    assert third.status_code == 201
    assert third.json()["id"] == "000022"


def test_bill_autonumber_tracks_manual_high_id_after_counter_exists(client):
    book_id = create_book(client, "Bills Auto Number Manual Sync")
    currency_guid = create_currency(client, "BRL")
    vendor_guid = create_vendor(client, book_id=book_id, currency_guid=currency_guid)

    first_auto = client.post(
        "/bills",
        json={
            "book_id": book_id,
            "type": "INVOICE",
            "id": "",
            "date_opened": "2026-02-15T00:00:00Z",
            "currency_guid": currency_guid,
            "vendor_guid": vendor_guid,
        },
    )
    assert first_auto.status_code == 201
    assert first_auto.json()["id"] == "000001"

    manual = client.post(
        "/bills",
        json={
            "book_id": book_id,
            "type": "INVOICE",
            "id": "000199",
            "date_opened": "2026-02-16T00:00:00Z",
            "currency_guid": currency_guid,
            "vendor_guid": vendor_guid,
        },
    )
    assert manual.status_code == 201
    assert manual.json()["id"] == "000199"

    second_auto = client.post(
        "/bills",
        json={
            "book_id": book_id,
            "type": "INVOICE",
            "id": "",
            "date_opened": "2026-02-17T00:00:00Z",
            "currency_guid": currency_guid,
            "vendor_guid": vendor_guid,
        },
    )
    assert second_auto.status_code == 201
    assert second_auto.json()["id"] == "000200"


def test_bill_list_paginated_summary(client):
    book_id = create_book(client, "Bills Paginated")
    currency_guid = create_currency(client, "BRL")
    vendor_a_guid = create_vendor(client, book_id=book_id, currency_guid=currency_guid, name="Fornecedor A", vendor_id="VA")
    vendor_b_guid = create_vendor(client, book_id=book_id, currency_guid=currency_guid, name="Fornecedor B", vendor_id="VB")

    root_id = create_account(
        client,
        book_id=book_id,
        commodity_id=currency_guid,
        name="Root",
        account_type="ROOT",
        is_placeholder=True,
    )
    expense_account_guid = create_account(
        client,
        book_id=book_id,
        commodity_id=currency_guid,
        name="Despesa",
        account_type="EXPENSE",
        parent_id=root_id,
    )

    create_bill_with_entry(
        client,
        book_id=book_id,
        currency_guid=currency_guid,
        vendor_guid=vendor_a_guid,
        expense_account_guid=expense_account_guid,
        bill_id="B00001",
        date_opened="2026-01-10T00:00:00Z",
        unit_price_num=10000,
    )
    create_bill_with_entry(
        client,
        book_id=book_id,
        currency_guid=currency_guid,
        vendor_guid=vendor_b_guid,
        expense_account_guid=expense_account_guid,
        bill_id="B00002",
        date_opened="2026-01-11T00:00:00Z",
        unit_price_num=20000,
    )
    create_bill_with_entry(
        client,
        book_id=book_id,
        currency_guid=currency_guid,
        vendor_guid=vendor_a_guid,
        expense_account_guid=expense_account_guid,
        bill_id="B00003",
        date_opened="2026-01-12T00:00:00Z",
        unit_price_num=30000,
    )

    page1 = client.get(
        f"/bills/list?book_id={book_id}&sort_key=id&sort_direction=asc&page=1&page_size=2"
    )
    assert page1.status_code == 200
    payload1 = page1.json()
    assert payload1["total_items"] == 3
    assert payload1["total_pages"] == 2
    assert payload1["page"] == 1
    assert len(payload1["items"]) == 2
    assert [item["id"] for item in payload1["items"]] == ["B00001", "B00002"]
    assert payload1["items"][0]["vendor_name"] == "Fornecedor A"
    assert payload1["items"][0]["payment_status"] == "UNPAID"

    page2 = client.get(
        f"/bills/list?book_id={book_id}&sort_key=id&sort_direction=asc&page=2&page_size=2"
    )
    assert page2.status_code == 200
    payload2 = page2.json()
    assert payload2["page"] == 2
    assert len(payload2["items"]) == 1
    assert payload2["items"][0]["id"] == "B00003"

    vendor_filtered = client.get(
        f"/bills/list?book_id={book_id}&vendor_guid={vendor_b_guid}&sort_key=id&sort_direction=asc&page=1&page_size=25"
    )
    assert vendor_filtered.status_code == 200
    filtered_payload = vendor_filtered.json()
    assert filtered_payload["total_items"] == 1
    assert len(filtered_payload["items"]) == 1
    assert filtered_payload["items"][0]["vendor_guid"] == vendor_b_guid


def test_bill_list_open_payment_filter(client):
    book_id = create_book(client, "Bills Open Filter")
    currency_guid = create_currency(client, "BRL")
    vendor_guid = create_vendor(client, book_id=book_id, currency_guid=currency_guid, vendor_id="VOPEN")

    root_id = create_account(
        client,
        book_id=book_id,
        commodity_id=currency_guid,
        name="Root",
        account_type="ROOT",
        is_placeholder=True,
    )
    expense_account_guid = create_account(
        client,
        book_id=book_id,
        commodity_id=currency_guid,
        name="Despesa",
        account_type="EXPENSE",
        parent_id=root_id,
    )
    payable_account_guid = create_account(
        client,
        book_id=book_id,
        commodity_id=currency_guid,
        name="Contas a Pagar",
        account_type="LIABILITY",
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

    bill_open_guid = create_bill_with_entry(
        client,
        book_id=book_id,
        currency_guid=currency_guid,
        vendor_guid=vendor_guid,
        expense_account_guid=expense_account_guid,
        bill_id="B00020",
        date_opened="2026-01-10T00:00:00Z",
        unit_price_num=10000,
    )
    bill_paid_guid = create_bill_with_entry(
        client,
        book_id=book_id,
        currency_guid=currency_guid,
        vendor_guid=vendor_guid,
        expense_account_guid=expense_account_guid,
        bill_id="B00021",
        date_opened="2026-01-11T00:00:00Z",
        unit_price_num=20000,
    )

    post_open = client.post(
        f"/bills/{bill_open_guid}/post",
        json={"post_account_guid": payable_account_guid},
    )
    assert post_open.status_code == 200
    assert post_open.json()["status"] == "POSTED"

    post_paid = client.post(
        f"/bills/{bill_paid_guid}/post",
        json={"post_account_guid": payable_account_guid},
    )
    assert post_paid.status_code == 200
    assert post_paid.json()["status"] == "POSTED"

    pay_full = client.post(
        f"/bills/{bill_paid_guid}/payments",
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
        f"/bills/list?book_id={book_id}&payment_filter=OPEN&sort_key=id&sort_direction=asc&page=1&page_size=25"
    )
    assert open_only.status_code == 200
    payload = open_only.json()
    assert payload["total_items"] == 1
    assert len(payload["items"]) == 1
    assert payload["items"][0]["guid"] == bill_open_guid
    assert payload["items"][0]["payment_status"] == "UNPAID"


def test_bill_post_payment_and_undo_flow(client):
    book_id = create_book(client, "Bills Post")
    currency_guid = create_currency(client, "BRL")
    vendor_guid = create_vendor(client, book_id=book_id, currency_guid=currency_guid, vendor_id="VPOST")

    root_id = create_account(
        client,
        book_id=book_id,
        commodity_id=currency_guid,
        name="Root",
        account_type="ROOT",
        is_placeholder=True,
    )
    expense_account_guid = create_account(
        client,
        book_id=book_id,
        commodity_id=currency_guid,
        name="Despesa",
        account_type="EXPENSE",
        parent_id=root_id,
    )
    payable_account_guid = create_account(
        client,
        book_id=book_id,
        commodity_id=currency_guid,
        name="Contas a Pagar",
        account_type="LIABILITY",
        parent_id=root_id,
    )
    cash_account_guid = create_account(
        client,
        book_id=book_id,
        commodity_id=currency_guid,
        name="Banco",
        account_type="ASSET",
        parent_id=root_id,
    )

    created = client.post(
        "/bills",
        json={
            "book_id": book_id,
            "type": "INVOICE",
            "id": "B00010",
            "date_opened": "2026-02-16T00:00:00Z",
            "currency_guid": currency_guid,
            "vendor_guid": vendor_guid,
        },
    )
    assert created.status_code == 201
    bill_guid = created.json()["guid"]

    entry = client.post(
        f"/bills/{bill_guid}/entries",
        json={
            "date": "2026-02-16T00:00:00Z",
            "description": "Servico",
            "income_account_guid": expense_account_guid,
            "quantity_num": 1,
            "quantity_denom": 1,
            "unit_price_num": 10000,
            "unit_price_denom": 100,
        },
    )
    assert entry.status_code == 201

    posted = client.post(
        f"/bills/{bill_guid}/post",
        json={"post_account_guid": payable_account_guid, "post_date": "2026-02-16T12:00:00Z"},
    )
    assert posted.status_code == 200
    posted_payload = posted.json()
    assert posted_payload["status"] == "POSTED"
    assert posted_payload["post_tx_guid"]
    assert posted_payload["post_lot_guid"]
    assert posted_payload["post_account_guid"] == payable_account_guid
    assert posted_payload["open_amount_num"] == 100
    assert posted_payload["open_amount_denom"] == 1

    tx = client.get(f"/transactions/{posted_payload['post_tx_guid']}")
    assert tx.status_code == 200
    splits = tx.json()["splits"]
    assert len(splits) == 2

    payable_split = next(split for split in splits if split["account_guid"] == payable_account_guid)
    expense_split = next(split for split in splits if split["account_guid"] == expense_account_guid)
    assert payable_split["lot_guid"] == posted_payload["post_lot_guid"]
    assert payable_split["value_num"] == -10000
    assert payable_split["value_denom"] == 100
    assert expense_split["value_num"] == 10000
    assert expense_split["value_denom"] == 100

    partial_payment = client.post(
        f"/bills/{bill_guid}/payments",
        json={
            "transfer_account_guid": cash_account_guid,
            "amount_num": 3000,
            "amount_denom": 100,
            "payment_date": "2026-02-17T00:00:00Z",
            "memo": "Pagamento parcial",
        },
    )
    assert partial_payment.status_code == 200
    partial_payload = partial_payment.json()
    assert partial_payload["status"] == "PARTIAL"
    assert partial_payload["paid_amount_num"] == 30
    assert partial_payload["open_amount_num"] == 70
    assert len(partial_payload["payments"]) == 1
    first_payment_tx_guid = partial_payload["payments"][0]["tx_guid"]

    patch_payment_tx = client.patch(f"/transactions/{first_payment_tx_guid}", json={"description": "Nao permitido"})
    assert patch_payment_tx.status_code == 409
    assert patch_payment_tx.json()["code"] == "TRANSACTION_LINKED_INVOICE"

    over_payment = client.post(
        f"/bills/{bill_guid}/payments",
        json={"transfer_account_guid": cash_account_guid, "amount_num": 7100, "amount_denom": 100},
    )
    assert over_payment.status_code == 409
    assert over_payment.json()["code"] == "PAYMENT_EXCEEDS_OPEN_BALANCE"

    unpost_with_payment = client.post(f"/bills/{bill_guid}/unpost", json={})
    assert unpost_with_payment.status_code == 409
    assert unpost_with_payment.json()["code"] == "BILL_HAS_PAYMENTS"

    final_payment = client.post(
        f"/bills/{bill_guid}/payments",
        json={
            "transfer_account_guid": cash_account_guid,
            "amount_num": 7000,
            "amount_denom": 100,
            "payment_date": "2026-02-18T00:00:00Z",
        },
    )
    assert final_payment.status_code == 200
    final_payload = final_payment.json()
    assert final_payload["status"] == "PAID"
    assert final_payload["paid_amount_num"] == 100
    assert final_payload["open_amount_num"] == 0
    assert len(final_payload["payments"]) == 2
    second_payment_tx_guid = final_payload["payments"][1]["tx_guid"]

    undo_last = client.post(f"/bills/{bill_guid}/payments/{second_payment_tx_guid}/undo", json={})
    assert undo_last.status_code == 200
    undo_last_payload = undo_last.json()
    assert undo_last_payload["status"] == "PARTIAL"
    assert undo_last_payload["paid_amount_num"] == 30
    assert undo_last_payload["open_amount_num"] == 70
    assert len(undo_last_payload["payments"]) == 1

    undo_first = client.post(f"/bills/{bill_guid}/payments/{first_payment_tx_guid}/undo", json={})
    assert undo_first.status_code == 200
    undo_first_payload = undo_first.json()
    assert undo_first_payload["status"] == "POSTED"
    assert undo_first_payload["paid_amount_num"] == 0
    assert undo_first_payload["open_amount_num"] == 100
    assert undo_first_payload["payments"] == []

    unpost = client.post(f"/bills/{bill_guid}/unpost", json={})
    assert unpost.status_code == 200
    assert unpost.json()["status"] == "UNPAID"


def test_vendor_delete_rejected_when_has_bills(client):
    book_id = create_book(client, "Bills Vendor Restriction")
    currency_guid = create_currency(client, "BRL")
    vendor_guid = create_vendor(client, book_id=book_id, currency_guid=currency_guid, vendor_id="VDEL")

    created = client.post(
        "/bills",
        json={
            "book_id": book_id,
            "id": "B00999",
            "currency_guid": currency_guid,
            "vendor_guid": vendor_guid,
        },
    )
    assert created.status_code == 201

    delete_vendor = client.delete(f"/vendors/{vendor_guid}")
    assert delete_vendor.status_code == 409
    assert delete_vendor.json()["code"] == "VENDOR_HAS_BILLS"
