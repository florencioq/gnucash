from __future__ import annotations


def create_book(client, name='Demo'):
    return client.post('/books', json={'name': name}).json()['id']


def create_commodity(client, mnemonic='BRL'):
    return client.post(
        '/commodities',
        json={
            'namespace': 'CURRENCY',
            'mnemonic': mnemonic,
            'fullname': mnemonic,
            'fraction': 100,
            'quote': False,
        },
    ).json()['id']


def test_account_tree_and_same_book_parent_rule(client):
    book_a = create_book(client, 'A')
    book_b = create_book(client, 'B')
    commodity_id = create_commodity(client)

    root = client.post(
        '/accounts',
        json={
            'book_id': book_a,
            'name': 'Assets',
            'type': 'ASSET',
            'commodity_id': commodity_id,
            'is_placeholder': True,
        },
    )
    assert root.status_code == 201
    root_id = root.json()['id']

    invalid_cross_book = client.post(
        '/accounts',
        json={
            'book_id': book_b,
            'parent_id': root_id,
            'name': 'Cash',
            'type': 'ASSET',
            'commodity_id': commodity_id,
            'is_placeholder': False,
        },
    )
    assert invalid_cross_book.status_code == 400
    assert invalid_cross_book.json()['code'] == 'INVALID_PARENT'

    child = client.post(
        '/accounts',
        json={
            'book_id': book_a,
            'parent_id': root_id,
            'name': 'Cash',
            'type': 'ASSET',
            'commodity_id': commodity_id,
            'is_placeholder': False,
        },
    )
    assert child.status_code == 201

    tree = client.get(f'/accounts/tree?book_id={book_a}')
    assert tree.status_code == 200
    roots = tree.json()
    assert len(roots) == 1
    assert roots[0]['name'] == 'Assets'
    assert roots[0]['children'][0]['name'] == 'Cash'


def test_delete_restriction_account_with_children(client):
    book_id = create_book(client)
    commodity_id = create_commodity(client)

    root_id = client.post(
        '/accounts',
        json={
            'book_id': book_id,
            'name': 'Assets',
            'type': 'ASSET',
            'commodity_id': commodity_id,
            'is_placeholder': True,
        },
    ).json()['id']

    client.post(
        '/accounts',
        json={
            'book_id': book_id,
            'parent_id': root_id,
            'name': 'Cash',
            'type': 'ASSET',
            'commodity_id': commodity_id,
            'is_placeholder': False,
        },
    )

    resp = client.delete(f'/accounts/{root_id}')
    assert resp.status_code == 409
    assert resp.json()['code'] == 'ACCOUNT_HAS_CHILDREN'
