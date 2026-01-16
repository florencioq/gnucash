import pytest


@pytest.mark.asyncio
async def test_accounts_crud_tree_and_move(client):
    # Seed book and commodity
    r = await client.post("/books", json={"name": "B1"})
    book = r.json()
    r = await client.post("/commodities", json={
        "namespace": "CURRENCY",
        "mnemonic": "EUR",
        "fullname": "Euro",
        "fraction": 100,
        "quote": False,
    })
    commodity = r.json()

    # Create root account
    r = await client.post("/accounts", json={
        "book_id": book["id"],
        "name": "Assets",
        "type": "ASSET",
        "commodity_id": commodity["id"],
        "is_placeholder": True,
    })
    assert r.status_code == 200
    root = r.json()

    # Create child account
    r = await client.post("/accounts", json={
        "book_id": book["id"],
        "parent_id": root["id"],
        "name": "Cash",
        "type": "ASSET",
        "commodity_id": commodity["id"],
    })
    child = r.json()

    # Sibling uniqueness conflict
    r = await client.post("/accounts", json={
        "book_id": book["id"],
        "parent_id": root["id"],
        "name": "Cash",
        "type": "ASSET",
        "commodity_id": commodity["id"],
    })
    assert r.status_code == 409

    # Tree
    r = await client.get("/accounts/tree", params={"book_id": book["id"]})
    assert r.status_code == 200
    tree = r.json()
    assert len(tree) == 1
    assert tree[0]["id"] == root["id"]
    assert any(n["id"] == child["id"] for n in tree[0]["children"])

    # Cycle detection: cannot make root a child of its current descendant
    r = await client.post(f"/accounts/{root['id']}/move", params={"new_parent_id": child["id"]})
    assert r.status_code == 400

    # Move child under None (to root) is allowed and no cycle
    r = await client.post(f"/accounts/{child['id']}/move", params={"new_parent_id": None})
    assert r.status_code == 200
    moved = r.json()
    assert moved["parent_id"] is None

    # Delete guard: cannot delete account with children
    # Re-parent child back to root, then try delete root
    r = await client.post(f"/accounts/{child['id']}/move", params={"new_parent_id": root['id']})
    assert r.status_code == 200
    r = await client.delete(f"/accounts/{root['id']}")
    assert r.status_code == 400