"""
Shared test helper functions for creating test data.

This module centralizes common operations used across multiple test files,
reducing duplication and making tests easier to maintain.
"""

from __future__ import annotations


def create_book(client, name: str = "Demo") -> str:
    """Create a book and return its ID.

    Args:
        client: FastAPI test client
        name: Name of the book

    Returns:
        Book ID (string)
    """
    response = client.post("/books", json={"name": name})
    assert response.status_code == 201, f"Failed to create book: {response.json()}"
    return response.json()["id"]


def create_commodity(
    client,
    mnemonic: str = "BRL",
    namespace: str = "CURRENCY",
    fullname: str | None = None,
    fraction: int = 100,
    quote: bool = False,
) -> str:
    """Create a commodity and return its ID.

    Args:
        client: FastAPI test client
        mnemonic: Currency code (e.g., BRL, USD)
        namespace: Commodity namespace
        fullname: Full name of the commodity
        fraction: Smallest fraction (100 for cents)
        quote: Whether this commodity has quotes

    Returns:
        Commodity ID (string)
    """
    if fullname is None:
        fullname = mnemonic
    
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
    assert response.status_code == 201, f"Failed to create commodity: {response.json()}"
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
    code: str | None = None,
) -> str:
    """Create an account and return its ID.

    Args:
        client: FastAPI test client
        book_id: Book ID this account belongs to
        commodity_id: Commodity ID for this account
        name: Account name
        account_type: Account type (ROOT, ASSET, LIABILITY, etc.)
        parent_id: Parent account ID (optional)
        is_placeholder: Whether this is a placeholder account
        code: Account code (optional)

    Returns:
        Account ID (string)
    """
    payload = {
        "book_id": book_id,
        "name": name,
        "type": account_type,
        "commodity_id": commodity_id,
        "is_placeholder": is_placeholder,
    }
    if parent_id is not None:
        payload["parent_id"] = parent_id
    if code is not None:
        payload["code"] = code
    
    response = client.post("/accounts", json=payload)
    assert response.status_code == 201, f"Failed to create account: {response.json()}"
    return response.json()["id"]


def create_root_account(
    client,
    *,
    book_id: str,
    commodity_id: str,
    name: str = "Root",
) -> str:
    """Create a root account and return its ID.

    Args:
        client: FastAPI test client
        book_id: Book ID this account belongs to
        commodity_id: Commodity ID for this account
        name: Account name

    Returns:
        Account ID (string)
    """
    return create_account(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        name=name,
        account_type="ROOT",
        is_placeholder=True,
    )


def create_customer(
    client,
    *,
    book_id: str,
    currency_guid: str,
    name: str = "Test Customer",
    customer_id: str = "C0001",
    notes: str | None = None,
    addr_email: str | None = None,
) -> str:
    """Create a customer and return its GUID.

    Args:
        client: FastAPI test client
        book_id: Book ID
        currency_guid: Currency commodity GUID
        name: Customer name
        customer_id: Customer ID code
        notes: Optional notes
        addr_email: Optional email address

    Returns:
        Customer GUID (string)
    """
    payload = {
        "book_id": book_id,
        "name": name,
        "id": customer_id,
        "currency_guid": currency_guid,
    }
    if notes is not None:
        payload["notes"] = notes
    if addr_email is not None:
        payload["addr_email"] = addr_email
    
    response = client.post("/customers", json=payload)
    assert response.status_code == 201, f"Failed to create customer: {response.json()}"
    return response.json()["guid"]


def create_vendor(
    client,
    *,
    book_id: str,
    currency_guid: str,
    name: str = "Test Vendor",
    vendor_id: str = "V0001",
    notes: str | None = None,
    addr_phone: str | None = None,
) -> str:
    """Create a vendor and return its GUID.

    Args:
        client: FastAPI test client
        book_id: Book ID
        currency_guid: Currency commodity GUID
        name: Vendor name
        vendor_id: Vendor ID code
        notes: Optional notes
        addr_phone: Optional phone number

    Returns:
        Vendor GUID (string)
    """
    payload = {
        "book_id": book_id,
        "name": name,
        "id": vendor_id,
        "currency_guid": currency_guid,
    }
    if notes is not None:
        payload["notes"] = notes
    if addr_phone is not None:
        payload["addr_phone"] = addr_phone
    
    response = client.post("/vendors", json=payload)
    assert response.status_code == 201, f"Failed to create vendor: {response.json()}"
    return response.json()["guid"]


def create_transaction(
    client,
    *,
    currency_guid: str,
    account_id: str,
    counter_account_id: str,
    value_num: int,
    value_denom: int = 100,
    post_date: str | None = None,
    description: str = "Test transaction",
    num: str | None = None,
) -> str:
    """Create a simple two-split transaction and return its GUID.

    Args:
        client: FastAPI test client
        currency_guid: Currency commodity GUID
        account_id: First split account ID
        counter_account_id: Second split account ID (counter entry)
        value_num: Value numerator
        value_denom: Value denominator
        post_date: Transaction post date (ISO format)
        description: Transaction description
        num: Transaction number

    Returns:
        Transaction GUID (string)
    """
    payload = {
        "currency_guid": currency_guid,
        "description": description,
        "splits": [
            {
                "account_guid": account_id,
                "memo": "",
                "action": "",
                "reconcile_state": "n",
                "value_num": value_num,
                "value_denom": value_denom,
                "quantity_num": value_num,
                "quantity_denom": value_denom,
            },
            {
                "account_guid": counter_account_id,
                "memo": "",
                "action": "",
                "reconcile_state": "n",
                "value_num": -value_num,
                "value_denom": value_denom,
                "quantity_num": -value_num,
                "quantity_denom": value_denom,
            },
        ],
    }
    if post_date is not None:
        payload["post_date"] = post_date
    if num is not None:
        payload["num"] = num
    
    response = client.post("/transactions", json=payload)
    assert response.status_code == 201, f"Failed to create transaction: {response.json()}"
    return response.json()["guid"]


def find_tree_node(nodes: list[dict], account_id: str) -> dict | None:
    """Recursively find a node in an account tree by ID.

    Args:
        nodes: List of tree nodes
        account_id: Account ID to find

    Returns:
        Tree node dictionary or None if not found
    """
    for node in nodes:
        if node["id"] == account_id:
            return node
        found = find_tree_node(node.get("children", []), account_id)
        if found is not None:
            return found
    return None
