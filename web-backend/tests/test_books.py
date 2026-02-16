from __future__ import annotations


def test_create_and_get_book(client):
    created = client.post('/books', json={'name': 'Demo'})
    assert created.status_code == 201
    payload = created.json()
    assert payload['name'] == 'Demo'
    assert payload['id']
    assert payload['is_active'] is True

    fetched = client.get(f"/books/{payload['id']}")
    assert fetched.status_code == 200
    assert fetched.json()['id'] == payload['id']

    active = client.get("/books/active")
    assert active.status_code == 200
    assert active.json()["id"] == payload["id"]


def test_switch_active_book(client):
    first = client.post("/books", json={"name": "Book A"})
    assert first.status_code == 201
    first_id = first.json()["id"]

    second = client.post("/books", json={"name": "Book B"})
    assert second.status_code == 201
    second_id = second.json()["id"]
    assert second.json()["is_active"] is False

    activate_second = client.patch(f"/books/{second_id}", json={"is_active": True})
    assert activate_second.status_code == 200
    assert activate_second.json()["is_active"] is True

    active = client.get("/books/active")
    assert active.status_code == 200
    assert active.json()["id"] == second_id

    first_after = client.get(f"/books/{first_id}")
    assert first_after.status_code == 200
    assert first_after.json()["is_active"] is False


def test_reject_deactivating_only_active_book(client):
    created = client.post("/books", json={"name": "Only"})
    assert created.status_code == 201
    book_id = created.json()["id"]

    response = client.patch(f"/books/{book_id}", json={"is_active": False})
    assert response.status_code == 409
    assert response.json()["code"] == "ACTIVE_BOOK_REQUIRED"
