from __future__ import annotations


def create_book(client, name: str) -> str:
    response = client.post("/books", json={"name": name})
    assert response.status_code == 201
    return response.json()["id"]


def create_commodity(
    client,
    *,
    namespace: str = "CURRENCY",
    mnemonic: str = "BRL",
    fullname: str | None = "Brazilian Real",
    fraction: int = 100,
    quote: bool = False,
) -> str:
    response = client.post(
        "/commodities",
        json={
            "namespace": namespace,
            "mnemonic": mnemonic,
            "fullname": fullname,
            "fraction": fraction,
            "quote": quote,
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
    parent_id: str | None = None,
    account_type: str = "ASSET",
    is_placeholder: bool = False,
) -> str:
    payload = {
        "book_id": book_id,
        "name": name,
        "type": account_type,
        "commodity_id": commodity_id,
        "is_placeholder": is_placeholder,
    }
    if parent_id is not None:
        payload["parent_id"] = parent_id
    response = client.post("/accounts", json=payload)
    assert response.status_code == 201
    return response.json()["id"]


def test_scenario_1_create_and_list_book(client):
    created = client.post("/books", json={"name": "Demo"})
    assert created.status_code == 201
    payload = created.json()
    assert payload["id"]
    assert payload["name"] == "Demo"
    assert payload["created_at"].endswith("Z")

    listing = client.get("/books")
    assert listing.status_code == 200
    ids = {item["id"] for item in listing.json()}
    assert payload["id"] in ids


def test_scenario_2_create_brl_commodity(client):
    created = client.post(
        "/commodities",
        json={
            "namespace": "CURRENCY",
            "mnemonic": "BRL",
            "fullname": "Brazilian Real",
            "fraction": 100,
            "quote": False,
        },
    )
    assert created.status_code == 201

    listing = client.get("/commodities?namespace=CURRENCY")
    assert listing.status_code == 200
    assert any(
        commodity["namespace"] == "CURRENCY" and commodity["mnemonic"] == "BRL"
        for commodity in listing.json()
    )


def test_scenario_6_prevent_hierarchy_cycles(client):
    book_id = create_book(client, "Demo")
    commodity_id = create_commodity(client, mnemonic="USD", fullname="US Dollar")

    account_a = create_account(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        name="Root",
        is_placeholder=True,
        account_type="ROOT",
    )
    account_b = create_account(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        name="B",
        parent_id=account_a,
        is_placeholder=True,
    )
    account_c = create_account(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        name="C",
        parent_id=account_b,
    )

    cycle = client.patch(f"/accounts/{account_a}", json={"parent_id": account_c})
    assert cycle.status_code in {400, 409}
    assert cycle.json()["code"] == "ACCOUNT_CYCLE"


def test_scenario_7_list_accounts_by_book(client):
    book_a = create_book(client, "A")
    book_b = create_book(client, "B")
    commodity_id = create_commodity(client, mnemonic="USD", fullname="US Dollar")

    root_a = create_account(
        client,
        book_id=book_a,
        commodity_id=commodity_id,
        name="Root A",
        account_type="ROOT",
        is_placeholder=True,
    )
    root_b = create_account(
        client,
        book_id=book_b,
        commodity_id=commodity_id,
        name="Root B",
        account_type="ROOT",
        is_placeholder=True,
    )
    account_a = create_account(
        client,
        book_id=book_a,
        commodity_id=commodity_id,
        parent_id=root_a,
        name="Assets A",
    )
    create_account(
        client,
        book_id=book_b,
        commodity_id=commodity_id,
        parent_id=root_b,
        name="Assets B",
    )

    response = client.get(f"/accounts?book_id={book_a}")
    assert response.status_code == 200
    result = response.json()
    assert len(result) == 2
    ids = {item["id"] for item in result}
    assert account_a in ids
    assert all(item["book_id"] == book_a for item in result)


def test_scenario_8_retrieve_tree_ordered_by_name(client):
    book_id = create_book(client, "Demo")
    commodity_id = create_commodity(client, mnemonic="USD", fullname="US Dollar")
    root_id = create_account(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        name="Root",
        is_placeholder=True,
        account_type="ROOT",
    )

    create_account(client, book_id=book_id, commodity_id=commodity_id, parent_id=root_id, name="Wallet")
    create_account(client, book_id=book_id, commodity_id=commodity_id, parent_id=root_id, name="Bank")
    create_account(client, book_id=book_id, commodity_id=commodity_id, parent_id=root_id, name="Cash")

    response = client.get(f"/accounts/tree?book_id={book_id}")
    assert response.status_code == 200
    tree = response.json()
    assert len(tree) == 1
    assert tree[0]["name"] == "Root"
    assert [child["name"] for child in tree[0]["children"]] == ["Bank", "Cash", "Wallet"]


def test_scenario_9_delete_restrictions(client):
    book_id = create_book(client, "Demo")
    commodity_id = create_commodity(client, mnemonic="USD", fullname="US Dollar")
    root_id = create_account(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        name="Root",
        is_placeholder=True,
        account_type="ROOT",
    )
    create_account(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        parent_id=root_id,
        name="Assets",
    )

    account_delete = client.delete(f"/accounts/{root_id}")
    assert account_delete.status_code == 409

    commodity_delete = client.delete(f"/commodities/{commodity_id}")
    assert commodity_delete.status_code == 409
    assert commodity_delete.json()["code"] == "COMMODITY_IN_USE"

    book_delete = client.delete(f"/books/{book_id}")
    assert book_delete.status_code == 409
    assert book_delete.json()["code"] == "BOOK_HAS_ACCOUNTS"
