from __future__ import annotations

from tests.helpers import create_account, create_book, create_commodity


def test_account_tree_and_same_book_parent_rule(client):
    book_a = create_book(client, 'A')
    book_b = create_book(client, 'B')
    commodity_id = create_commodity(client)

    root_id = create_account(
        client,
        book_id=book_a,
        commodity_id=commodity_id,
        name='Root',
        account_type='ROOT',
        is_placeholder=True,
    )

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

    child_id = create_account(
        client,
        book_id=book_a,
        commodity_id=commodity_id,
        parent_id=root_id,
        name='Assets',
        account_type='ASSET',
    )

    tree = client.get(f'/accounts/tree?book_id={book_a}')
    assert tree.status_code == 200
    roots = tree.json()
    assert len(roots) == 1
    assert roots[0]['name'] == 'Root'
    assert roots[0]['children'][0]['name'] == 'Assets'


def test_delete_restriction_account_with_children(client):
    book_id = create_book(client)
    commodity_id = create_commodity(client)

    root_id = create_account(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        name='Root',
        account_type='ROOT',
        is_placeholder=True,
    )

    create_account(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        parent_id=root_id,
        name='Assets',
        account_type='ASSET',
    )

    resp = client.delete(f'/accounts/{root_id}')
    assert resp.status_code == 409
    assert resp.json()['code'] == 'ACCOUNT_HAS_CHILDREN'


def test_create_account_missing_required_fields(client):
    """Test validation errors when creating account without required fields."""
    book_id = create_book(client)
    
    # Missing name
    resp = client.post('/accounts', json={
        'book_id': book_id,
        'type': 'ASSET',
    })
    assert resp.status_code in (400, 422)
    
    # Missing type
    resp = client.post('/accounts', json={
        'book_id': book_id,
        'name': 'Test',
    })
    assert resp.status_code in (400, 422)
    
    # Missing book_id
    resp = client.post('/accounts', json={
        'name': 'Test',
        'type': 'ASSET',
    })
    assert resp.status_code in (400, 422)


def test_create_account_invalid_type(client):
    """Test validation error when creating account with invalid type."""
    book_id = create_book(client)
    commodity_id = create_commodity(client)
    
    resp = client.post('/accounts', json={
        'book_id': book_id,
        'name': 'Test',
        'type': 'INVALID_TYPE',
        'commodity_id': commodity_id,
        'is_placeholder': False,
    })
    assert resp.status_code in (400, 422)


def test_create_account_invalid_data_types(client):
    """Test validation errors with wrong data types."""
    book_id = create_book(client)
    commodity_id = create_commodity(client)
    
    # Boolean as string
    resp = client.post('/accounts', json={
        'book_id': book_id,
        'name': 'Test',
        'type': 'ASSET',
        'commodity_id': commodity_id,
        'is_placeholder': 'not_a_boolean',
    })
    assert resp.status_code in (400, 422)
    
    # Number as name
    resp = client.post('/accounts', json={
        'book_id': book_id,
        'name': 12345,
        'type': 'ASSET',
        'commodity_id': commodity_id,
    })
    assert resp.status_code in (400, 422)
