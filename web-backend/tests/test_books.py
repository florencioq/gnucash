import pytest


@pytest.mark.asyncio
async def test_books_crud(client):
    # Create
    r = await client.post("/books", json={"name": "My Book"})
    assert r.status_code == 200
    book = r.json()
    assert book["name"] == "My Book"

    # Get
    r = await client.get(f"/books/{book['id']}")
    assert r.status_code == 200
    assert r.json()["id"] == book["id"]

    # List
    r = await client.get("/books")
    assert r.status_code == 200
    items = r.json()
    assert any(b["id"] == book["id"] for b in items)