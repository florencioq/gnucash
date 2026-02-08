from __future__ import annotations


def test_create_and_get_book(client):
    created = client.post('/books', json={'name': 'Demo'})
    assert created.status_code == 201
    payload = created.json()
    assert payload['name'] == 'Demo'
    assert payload['id']

    fetched = client.get(f"/books/{payload['id']}")
    assert fetched.status_code == 200
    assert fetched.json()['id'] == payload['id']
