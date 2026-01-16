import pytest


@pytest.mark.asyncio
async def test_commodities_crud_and_uniqueness(client):
    payload = {
        "namespace": "CURRENCY",
        "mnemonic": "USD",
        "fullname": "US Dollar",
        "fraction": 100,
        "quote": False,
    }
    r = await client.post("/commodities", json=payload)
    assert r.status_code == 200
    commodity = r.json()
    assert commodity["mnemonic"] == "USD"

    # Duplicate should conflict
    r = await client.post("/commodities", json=payload)
    assert r.status_code == 409

    # Get
    r = await client.get(f"/commodities/{commodity['id']}")
    assert r.status_code == 200

    # List with filter
    r = await client.get("/commodities", params={"namespace": "CURRENCY"})
    assert r.status_code == 200
    assert any(c["id"] == commodity["id"] for c in r.json())