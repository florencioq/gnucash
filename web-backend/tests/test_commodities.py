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
