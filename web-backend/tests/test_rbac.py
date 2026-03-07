from __future__ import annotations

from app.config import settings


def _bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _setup(client, monkeypatch) -> dict:
    """Enable auth, bootstrap admin, create book + resources, create unprivileged user."""
    monkeypatch.setattr(settings, "auth_required", True)

    admin = client.post("/auth/register", json={"email": "admin@test.com", "password": "12345678"})
    assert admin.status_code == 201
    admin_token = client.post("/auth/login", json={"email": "admin@test.com", "password": "12345678"}).json()["access_token"]
    ah = _bearer(admin_token)

    book_id = client.post("/books", json={"name": "B"}, headers=ah).json()["id"]

    currency_id = client.post(
        "/commodities",
        json={"namespace": "CURRENCY", "mnemonic": "BRL", "fullname": "BRL", "fraction": 100, "quote": False},
        headers=ah,
    ).json()["id"]

    def _acct(name, atype, parent_id=None, placeholder=False):
        payload = {"book_id": book_id, "name": name, "type": atype, "commodity_id": currency_id, "is_placeholder": placeholder}
        if parent_id:
            payload["parent_id"] = parent_id
        r = client.post("/accounts", json=payload, headers=ah)
        assert r.status_code == 201, r.json()
        return r.json()["id"]

    root_id = _acct("Root", "ROOT", placeholder=True)
    income_id = _acct("Income", "INCOME", root_id)
    asset_id = _acct("Asset", "ASSET", root_id)
    expense_id = _acct("Expense", "EXPENSE", root_id)
    liability_id = _acct("Liability", "LIABILITY", root_id)

    customer_id = client.post(
        "/customers", json={"book_id": book_id, "name": "C", "id": "C001", "currency_guid": currency_id}, headers=ah
    ).json()["guid"]
    vendor_id = client.post(
        "/vendors", json={"book_id": book_id, "name": "V", "id": "V001", "currency_guid": currency_id}, headers=ah
    ).json()["guid"]

    user_r = client.post("/auth/register", json={"email": "user@test.com", "password": "12345678"}, headers=ah)
    assert user_r.status_code == 201
    user_id = user_r.json()["id"]
    user_token = client.post("/auth/login", json={"email": "user@test.com", "password": "12345678"}).json()["access_token"]
    uh = _bearer(user_token)

    return dict(
        ah=ah,
        uh=uh,
        user_id=user_id,
        book_id=book_id,
        currency_id=currency_id,
        income_id=income_id,
        asset_id=asset_id,
        expense_id=expense_id,
        liability_id=liability_id,
        customer_id=customer_id,
        vendor_id=vendor_id,
    )


def test_no_book_access_blocks_reads_on_invoices_bills_transactions_reports(client, monkeypatch):
    ctx = _setup(client, monkeypatch)
    uh = ctx["uh"]
    book_id = ctx["book_id"]

    assert client.get(f"/invoices?book_id={book_id}", headers=uh).status_code == 403
    assert client.get(
        f"/invoices/list?book_id={book_id}&sort_key=id&sort_direction=asc&page=1&page_size=25", headers=uh
    ).status_code == 403

    assert client.get(f"/bills?book_id={book_id}", headers=uh).status_code == 403
    assert client.get(
        f"/bills/list?book_id={book_id}&sort_key=id&sort_direction=asc&page=1&page_size=25", headers=uh
    ).status_code == 403

    assert client.get(f"/transactions?book_id={book_id}", headers=uh).status_code == 403

    assert client.get(f"/reports/income-statement?book_id={book_id}&month=2026-02", headers=uh).status_code == 403
    assert client.get(
        f"/reports/income-statement/matrix?book_id={book_id}&start_month=2026-01&end_month=2026-02", headers=uh
    ).status_code == 403
    assert client.get(f"/reports/invoices/settlement-by-customer?book_id={book_id}", headers=uh).status_code == 403


def test_viewer_can_read_but_not_write_invoices(client, monkeypatch):
    ctx = _setup(client, monkeypatch)
    ah, uh = ctx["ah"], ctx["uh"]
    book_id, user_id = ctx["book_id"], ctx["user_id"]
    currency_id, customer_id = ctx["currency_id"], ctx["customer_id"]

    client.put(f"/auth/users/{user_id}/books/{book_id}", json={"role": "VIEWER"}, headers=ah)

    assert client.get(f"/invoices?book_id={book_id}", headers=uh).status_code == 200
    assert client.get(
        f"/invoices/list?book_id={book_id}&sort_key=id&sort_direction=asc&page=1&page_size=25", headers=uh
    ).status_code == 200

    create_resp = client.post(
        "/invoices",
        json={"book_id": book_id, "id": "000001", "currency_guid": currency_id, "customer_guid": customer_id},
        headers=uh,
    )
    assert create_resp.status_code == 403
    assert create_resp.json()["code"] == "FORBIDDEN_BOOK"


def test_viewer_can_read_but_not_write_bills(client, monkeypatch):
    ctx = _setup(client, monkeypatch)
    ah, uh = ctx["ah"], ctx["uh"]
    book_id, user_id = ctx["book_id"], ctx["user_id"]
    currency_id, vendor_id = ctx["currency_id"], ctx["vendor_id"]

    client.put(f"/auth/users/{user_id}/books/{book_id}", json={"role": "VIEWER"}, headers=ah)

    assert client.get(f"/bills?book_id={book_id}", headers=uh).status_code == 200
    assert client.get(
        f"/bills/list?book_id={book_id}&sort_key=id&sort_direction=asc&page=1&page_size=25", headers=uh
    ).status_code == 200

    create_resp = client.post(
        "/bills",
        json={"book_id": book_id, "id": "B00001", "currency_guid": currency_id, "vendor_guid": vendor_id},
        headers=uh,
    )
    assert create_resp.status_code == 403
    assert create_resp.json()["code"] == "FORBIDDEN_BOOK"


def test_viewer_can_read_but_not_write_transactions(client, monkeypatch):
    ctx = _setup(client, monkeypatch)
    ah, uh = ctx["ah"], ctx["uh"]
    book_id, user_id = ctx["book_id"], ctx["user_id"]
    currency_id = ctx["currency_id"]
    income_id, asset_id = ctx["income_id"], ctx["asset_id"]

    client.put(f"/auth/users/{user_id}/books/{book_id}", json={"role": "VIEWER"}, headers=ah)

    assert client.get(f"/transactions?book_id={book_id}", headers=uh).status_code == 200

    create_resp = client.post(
        "/transactions",
        json={
            "currency_guid": currency_id,
            "splits": [
                {"account_guid": income_id, "memo": "", "action": "", "reconcile_state": "n", "value_num": -100, "value_denom": 1, "quantity_num": -100, "quantity_denom": 1},
                {"account_guid": asset_id, "memo": "", "action": "", "reconcile_state": "n", "value_num": 100, "value_denom": 1, "quantity_num": 100, "quantity_denom": 1},
            ],
        },
        headers=uh,
    )
    assert create_resp.status_code == 403
    assert create_resp.json()["code"] == "FORBIDDEN_BOOK"


def test_viewer_can_read_reports(client, monkeypatch):
    ctx = _setup(client, monkeypatch)
    ah, uh = ctx["ah"], ctx["uh"]
    book_id, user_id = ctx["book_id"], ctx["user_id"]

    client.put(f"/auth/users/{user_id}/books/{book_id}", json={"role": "VIEWER"}, headers=ah)

    assert client.get(f"/reports/income-statement?book_id={book_id}&month=2026-02", headers=uh).status_code == 200
    assert client.get(
        f"/reports/income-statement/matrix?book_id={book_id}&start_month=2026-01&end_month=2026-02", headers=uh
    ).status_code == 200
    assert client.get(f"/reports/invoices/settlement-by-customer?book_id={book_id}", headers=uh).status_code == 200


def test_editor_can_write_invoices_bills_and_transactions(client, monkeypatch):
    ctx = _setup(client, monkeypatch)
    ah, uh = ctx["ah"], ctx["uh"]
    book_id, user_id = ctx["book_id"], ctx["user_id"]
    currency_id = ctx["currency_id"]
    customer_id, vendor_id = ctx["customer_id"], ctx["vendor_id"]
    income_id, asset_id = ctx["income_id"], ctx["asset_id"]

    client.put(f"/auth/users/{user_id}/books/{book_id}", json={"role": "EDITOR"}, headers=ah)

    invoice = client.post(
        "/invoices",
        json={"book_id": book_id, "id": "000001", "currency_guid": currency_id, "customer_guid": customer_id},
        headers=uh,
    )
    assert invoice.status_code == 201

    bill = client.post(
        "/bills",
        json={"book_id": book_id, "id": "B00001", "currency_guid": currency_id, "vendor_guid": vendor_id},
        headers=uh,
    )
    assert bill.status_code == 201

    tx = client.post(
        "/transactions",
        json={
            "currency_guid": currency_id,
            "splits": [
                {"account_guid": income_id, "memo": "", "action": "", "reconcile_state": "n", "value_num": -100, "value_denom": 1, "quantity_num": -100, "quantity_denom": 1},
                {"account_guid": asset_id, "memo": "", "action": "", "reconcile_state": "n", "value_num": 100, "value_denom": 1, "quantity_num": 100, "quantity_denom": 1},
            ],
        },
        headers=uh,
    )
    assert tx.status_code == 201
