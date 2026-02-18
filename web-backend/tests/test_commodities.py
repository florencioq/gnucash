from __future__ import annotations


def test_unique_namespace_mnemonic(client):
    payload = {
        'namespace': 'CURRENCY',
        'mnemonic': 'BRL',
        'fullname': 'Brazilian Real',
        'fraction': 100,
        'quote': False,
    }
    ok = client.post('/commodities', json=payload)
    assert ok.status_code == 201

    dup = client.post('/commodities', json=payload)
    assert dup.status_code == 409
    assert dup.json()['code'] == 'COMMODITY_NAMESPACE_MNEMONIC_EXISTS'


def test_create_commodity_missing_required_fields(client):
    """Test validation errors when creating commodity without required fields."""
    # Missing mnemonic
    resp = client.post('/commodities', json={
        'namespace': 'CURRENCY',
        'fullname': 'Test Currency',
        'fraction': 100,
        'quote': False,
    })
    assert resp.status_code in (400, 422)
    
    # Missing namespace
    resp = client.post('/commodities', json={
        'mnemonic': 'TST',
        'fullname': 'Test Currency',
        'fraction': 100,
        'quote': False,
    })
    assert resp.status_code in (400, 422)
    
    # Missing fraction
    resp = client.post('/commodities', json={
        'namespace': 'CURRENCY',
        'mnemonic': 'TST',
        'fullname': 'Test Currency',
        'quote': False,
    })
    assert resp.status_code in (400, 422)


def test_create_commodity_invalid_data_types(client):
    """Test validation errors with wrong data types."""
    # fraction as string (non-numeric)
    resp = client.post('/commodities', json={
        'namespace': 'CURRENCY',
        'mnemonic': 'TST',
        'fullname': 'Test Currency',
        'fraction': 'one hundred',
        'quote': False,
    })
    assert resp.status_code in (400, 422)
    
    # NOTE: The API currently coerces some types automatically
    # - Numbers to strings for text fields
    # - String "yes"/"no" may be coerced to boolean
    # This is a known Pydantic behavior that could be made stricter
