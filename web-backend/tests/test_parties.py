from __future__ import annotations


def create_book(client, name: str = "Demo") -> str:
    response = client.post("/books", json={"name": name})
    assert response.status_code == 201
    return response.json()["id"]


def create_commodity(client, mnemonic: str = "BRL") -> str:
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


def test_customer_crud_and_list_by_book(client):
    book_a = create_book(client, "Book A")
    book_b = create_book(client, "Book B")
    currency = create_commodity(client, "BRL")

    created = client.post(
        "/customers",
        json={
            "book_id": book_a,
            "name": "ACME Ltda",
            "id": "C0001",
            "notes": "Primary customer",
            "currency_guid": currency,
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

    patched = client.patch(
        f"/customers/{customer_guid}",
        json={"notes": "Updated note", "active": False, "shipaddr_email": "shipping@example.com"},
    )
    assert patched.status_code == 200
    assert patched.json()["notes"] == "Updated note"
    assert patched.json()["active"] is False
    assert patched.json()["shipaddr_email"] == "shipping@example.com"

    deleted = client.delete(f"/customers/{customer_guid}")
    assert deleted.status_code == 204

    fetched = client.get(f"/customers/{customer_guid}")
    assert fetched.status_code == 404


def test_vendor_crud_and_list_by_book(client):
    book_id = create_book(client)
    currency = create_commodity(client, "USD")

    created = client.post(
        "/vendors",
        json={
            "book_id": book_id,
            "name": "Office Supplies Inc.",
            "id": "V0100",
            "notes": "Preferred supplier",
            "currency_guid": currency,
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

    patched = client.patch(
        f"/vendors/{vendor_guid}",
        json={"active": False, "tax_inc": "YES", "addr_email": "billing@office.example"},
    )
    assert patched.status_code == 200
    assert patched.json()["active"] is False
    assert patched.json()["tax_inc"] == "YES"
    assert patched.json()["addr_email"] == "billing@office.example"

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
