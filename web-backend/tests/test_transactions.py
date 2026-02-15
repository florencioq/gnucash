from __future__ import annotations

from fractions import Fraction


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


def create_root_account(client, *, book_id: str, commodity_id: str, name: str = "Root") -> str:
    response = client.post(
        "/accounts",
        json={
            "book_id": book_id,
            "name": name,
            "type": "ROOT",
            "commodity_id": commodity_id,
            "is_placeholder": True,
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def create_child_account(client, *, book_id: str, commodity_id: str, parent_id: str, name: str, account_type: str) -> str:
    payload = {
        "book_id": book_id,
        "parent_id": parent_id,
        "name": name,
        "type": account_type,
        "commodity_id": commodity_id,
        "is_placeholder": False,
    }
    response = client.post("/accounts", json=payload)
    assert response.status_code == 201
    return response.json()["id"]


def create_child_account_with_code(
    client,
    *,
    book_id: str,
    commodity_id: str,
    parent_id: str,
    name: str,
    account_type: str,
    code: str,
) -> str:
    response = client.post(
        "/accounts",
        json={
            "book_id": book_id,
            "parent_id": parent_id,
            "name": name,
            "code": code,
            "type": account_type,
            "commodity_id": commodity_id,
            "is_placeholder": False,
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def find_tree_node(nodes: list[dict], account_id: str) -> dict | None:
    for node in nodes:
        if node["id"] == account_id:
            return node
        found = find_tree_node(node.get("children", []), account_id)
        if found is not None:
            return found
    return None


def test_create_and_get_transaction_with_balanced_splits(client):
    book_id = create_book(client)
    commodity_id = create_commodity(client)
    root_id = create_root_account(client, book_id=book_id, commodity_id=commodity_id)
    asset_id = create_child_account(
        client, book_id=book_id, commodity_id=commodity_id, parent_id=root_id, name="Cash", account_type="ASSET"
    )
    equity_id = create_child_account(
        client, book_id=book_id, commodity_id=commodity_id, parent_id=root_id, name="Opening", account_type="EQUITY"
    )

    created = client.post(
        "/transactions",
        json={
            "currency_guid": commodity_id,
            "num": "0001",
            "description": "Initial balance",
            "splits": [
                {
                    "account_guid": asset_id,
                    "memo": "Debit cash",
                    "action": "",
                    "reconcile_state": "n",
                    "value_num": 10000,
                    "value_denom": 100,
                    "quantity_num": 10000,
                    "quantity_denom": 100,
                },
                {
                    "account_guid": equity_id,
                    "memo": "Credit opening",
                    "action": "",
                    "reconcile_state": "n",
                    "value_num": -10000,
                    "value_denom": 100,
                    "quantity_num": -10000,
                    "quantity_denom": 100,
                },
            ],
        },
    )
    assert created.status_code == 201
    payload = created.json()
    assert payload["guid"]
    assert len(payload["splits"]) == 2

    balance = Fraction(0, 1)
    for split in payload["splits"]:
        balance += Fraction(split["value_num"], split["value_denom"])
    assert balance == 0

    fetched = client.get(f"/transactions/{payload['guid']}")
    assert fetched.status_code == 200
    assert fetched.json()["guid"] == payload["guid"]


def test_account_tree_includes_code_and_balance(client):
    book_id = create_book(client)
    commodity_id = create_commodity(client)
    root_id = create_root_account(client, book_id=book_id, commodity_id=commodity_id)
    asset_id = create_child_account_with_code(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        parent_id=root_id,
        name="Cash",
        account_type="ASSET",
        code="1.1.01",
    )
    equity_id = create_child_account(
        client, book_id=book_id, commodity_id=commodity_id, parent_id=root_id, name="Opening", account_type="EQUITY"
    )

    created = client.post(
        "/transactions",
        json={
            "currency_guid": commodity_id,
            "description": "Initial balance",
            "splits": [
                {
                    "account_guid": asset_id,
                    "memo": "",
                    "action": "",
                    "reconcile_state": "n",
                    "value_num": 12345,
                    "value_denom": 100,
                    "quantity_num": 12345,
                    "quantity_denom": 100,
                },
                {
                    "account_guid": equity_id,
                    "memo": "",
                    "action": "",
                    "reconcile_state": "n",
                    "value_num": -12345,
                    "value_denom": 100,
                    "quantity_num": -12345,
                    "quantity_denom": 100,
                },
            ],
        },
    )
    assert created.status_code == 201

    tree = client.get(f"/accounts/tree?book_id={book_id}")
    assert tree.status_code == 200
    payload = tree.json()

    asset_node = find_tree_node(payload, asset_id)
    assert asset_node is not None
    assert asset_node["code"] == "1.1.01"
    assert Fraction(asset_node["balance_num"], asset_node["balance_denom"]) == Fraction(12345, 100)

    equity_node = find_tree_node(payload, equity_id)
    assert equity_node is not None
    assert Fraction(equity_node["balance_num"], equity_node["balance_denom"]) == Fraction(-12345, 100)


def test_reject_unbalanced_transaction(client):
    book_id = create_book(client)
    commodity_id = create_commodity(client)
    root_id = create_root_account(client, book_id=book_id, commodity_id=commodity_id)
    expense_id = create_child_account(
        client, book_id=book_id, commodity_id=commodity_id, parent_id=root_id, name="Rent", account_type="EXPENSE"
    )
    asset_id = create_child_account(
        client, book_id=book_id, commodity_id=commodity_id, parent_id=root_id, name="Bank", account_type="ASSET"
    )

    response = client.post(
        "/transactions",
        json={
            "currency_guid": commodity_id,
            "description": "Invalid unbalanced",
            "splits": [
                {
                    "account_guid": expense_id,
                    "memo": "",
                    "action": "",
                    "reconcile_state": "n",
                    "value_num": 5000,
                    "value_denom": 100,
                    "quantity_num": 5000,
                    "quantity_denom": 100,
                },
                {
                    "account_guid": asset_id,
                    "memo": "",
                    "action": "",
                    "reconcile_state": "n",
                    "value_num": -3000,
                    "value_denom": 100,
                    "quantity_num": -3000,
                    "quantity_denom": 100,
                },
            ],
        },
    )
    assert response.status_code == 409
    assert response.json()["code"] == "TRANSACTION_UNBALANCED"


def test_reject_transaction_with_accounts_from_different_books(client):
    commodity_id = create_commodity(client)

    book_a = create_book(client, "A")
    root_a = create_root_account(client, book_id=book_a, commodity_id=commodity_id, name="Root A")
    account_a = create_child_account(
        client, book_id=book_a, commodity_id=commodity_id, parent_id=root_a, name="Cash A", account_type="ASSET"
    )

    book_b = create_book(client, "B")
    root_b = create_root_account(client, book_id=book_b, commodity_id=commodity_id, name="Root B")
    account_b = create_child_account(
        client, book_id=book_b, commodity_id=commodity_id, parent_id=root_b, name="Cash B", account_type="ASSET"
    )

    response = client.post(
        "/transactions",
        json={
            "currency_guid": commodity_id,
            "description": "Cross book",
            "splits": [
                {
                    "account_guid": account_a,
                    "memo": "",
                    "action": "",
                    "reconcile_state": "n",
                    "value_num": 1000,
                    "value_denom": 100,
                    "quantity_num": 1000,
                    "quantity_denom": 100,
                },
                {
                    "account_guid": account_b,
                    "memo": "",
                    "action": "",
                    "reconcile_state": "n",
                    "value_num": -1000,
                    "value_denom": 100,
                    "quantity_num": -1000,
                    "quantity_denom": 100,
                },
            ],
        },
    )
    assert response.status_code == 409
    assert response.json()["code"] == "INVALID_TRANSACTION_BOOK"


def test_list_transactions_by_book(client):
    commodity_id = create_commodity(client)

    book_a = create_book(client, "A")
    root_a = create_root_account(client, book_id=book_a, commodity_id=commodity_id, name="Root A")
    account_a1 = create_child_account(
        client, book_id=book_a, commodity_id=commodity_id, parent_id=root_a, name="A1", account_type="ASSET"
    )
    account_a2 = create_child_account(
        client, book_id=book_a, commodity_id=commodity_id, parent_id=root_a, name="A2", account_type="EQUITY"
    )

    book_b = create_book(client, "B")
    root_b = create_root_account(client, book_id=book_b, commodity_id=commodity_id, name="Root B")
    account_b1 = create_child_account(
        client, book_id=book_b, commodity_id=commodity_id, parent_id=root_b, name="B1", account_type="ASSET"
    )
    account_b2 = create_child_account(
        client, book_id=book_b, commodity_id=commodity_id, parent_id=root_b, name="B2", account_type="EQUITY"
    )

    tx_a = client.post(
        "/transactions",
        json={
            "currency_guid": commodity_id,
            "splits": [
                {
                    "account_guid": account_a1,
                    "memo": "",
                    "action": "",
                    "reconcile_state": "n",
                    "value_num": 100,
                    "value_denom": 1,
                    "quantity_num": 100,
                    "quantity_denom": 1,
                },
                {
                    "account_guid": account_a2,
                    "memo": "",
                    "action": "",
                    "reconcile_state": "n",
                    "value_num": -100,
                    "value_denom": 1,
                    "quantity_num": -100,
                    "quantity_denom": 1,
                },
            ],
        },
    )
    assert tx_a.status_code == 201
    tx_a_id = tx_a.json()["guid"]

    tx_b = client.post(
        "/transactions",
        json={
            "currency_guid": commodity_id,
            "splits": [
                {
                    "account_guid": account_b1,
                    "memo": "",
                    "action": "",
                    "reconcile_state": "n",
                    "value_num": 100,
                    "value_denom": 1,
                    "quantity_num": 100,
                    "quantity_denom": 1,
                },
                {
                    "account_guid": account_b2,
                    "memo": "",
                    "action": "",
                    "reconcile_state": "n",
                    "value_num": -100,
                    "value_denom": 1,
                    "quantity_num": -100,
                    "quantity_denom": 1,
                },
            ],
        },
    )
    assert tx_b.status_code == 201

    response = client.get(f"/transactions?book_id={book_a}")
    assert response.status_code == 200
    listed = response.json()
    assert len(listed) == 1
    assert listed[0]["guid"] == tx_a_id


def test_patch_transaction_replaces_splits(client):
    book_id = create_book(client)
    commodity_id = create_commodity(client)
    root_id = create_root_account(client, book_id=book_id, commodity_id=commodity_id)
    cash_id = create_child_account(
        client, book_id=book_id, commodity_id=commodity_id, parent_id=root_id, name="Cash", account_type="ASSET"
    )
    equity_id = create_child_account(
        client, book_id=book_id, commodity_id=commodity_id, parent_id=root_id, name="Equity", account_type="EQUITY"
    )
    expense_id = create_child_account(
        client, book_id=book_id, commodity_id=commodity_id, parent_id=root_id, name="Expense", account_type="EXPENSE"
    )

    created = client.post(
        "/transactions",
        json={
            "currency_guid": commodity_id,
            "description": "Before patch",
            "splits": [
                {
                    "account_guid": cash_id,
                    "memo": "",
                    "action": "",
                    "reconcile_state": "n",
                    "value_num": 200,
                    "value_denom": 1,
                    "quantity_num": 200,
                    "quantity_denom": 1,
                },
                {
                    "account_guid": equity_id,
                    "memo": "",
                    "action": "",
                    "reconcile_state": "n",
                    "value_num": -200,
                    "value_denom": 1,
                    "quantity_num": -200,
                    "quantity_denom": 1,
                },
            ],
        },
    )
    assert created.status_code == 201
    tx_id = created.json()["guid"]

    patched = client.patch(
        f"/transactions/{tx_id}",
        json={
            "description": "After patch",
            "splits": [
                {
                    "account_guid": expense_id,
                    "memo": "",
                    "action": "",
                    "reconcile_state": "n",
                    "value_num": 50,
                    "value_denom": 1,
                    "quantity_num": 50,
                    "quantity_denom": 1,
                },
                {
                    "account_guid": cash_id,
                    "memo": "",
                    "action": "",
                    "reconcile_state": "n",
                    "value_num": -50,
                    "value_denom": 1,
                    "quantity_num": -50,
                    "quantity_denom": 1,
                },
            ],
        },
    )
    assert patched.status_code == 200
    payload = patched.json()
    assert payload["description"] == "After patch"
    assert {split["account_guid"] for split in payload["splits"]} == {expense_id, cash_id}


def test_cannot_delete_account_or_commodity_in_use_by_transactions(client):
    book_id = create_book(client)
    commodity_id = create_commodity(client)
    root_id = create_root_account(client, book_id=book_id, commodity_id=commodity_id)
    cash_id = create_child_account(
        client, book_id=book_id, commodity_id=commodity_id, parent_id=root_id, name="Cash", account_type="ASSET"
    )
    equity_id = create_child_account(
        client, book_id=book_id, commodity_id=commodity_id, parent_id=root_id, name="Equity", account_type="EQUITY"
    )

    created = client.post(
        "/transactions",
        json={
            "currency_guid": commodity_id,
            "splits": [
                {
                    "account_guid": cash_id,
                    "memo": "",
                    "action": "",
                    "reconcile_state": "n",
                    "value_num": 100,
                    "value_denom": 1,
                    "quantity_num": 100,
                    "quantity_denom": 1,
                },
                {
                    "account_guid": equity_id,
                    "memo": "",
                    "action": "",
                    "reconcile_state": "n",
                    "value_num": -100,
                    "value_denom": 1,
                    "quantity_num": -100,
                    "quantity_denom": 1,
                },
            ],
        },
    )
    assert created.status_code == 201
    tx_id = created.json()["guid"]

    delete_account = client.delete(f"/accounts/{cash_id}")
    assert delete_account.status_code == 409
    assert delete_account.json()["code"] == "ACCOUNT_HAS_SPLITS"

    delete_commodity = client.delete(f"/commodities/{commodity_id}")
    assert delete_commodity.status_code == 409
    assert delete_commodity.json()["code"] == "COMMODITY_IN_USE"

    delete_tx = client.delete(f"/transactions/{tx_id}")
    assert delete_tx.status_code == 204
