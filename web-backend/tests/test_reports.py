from __future__ import annotations

import pytest


def create_book(client, name: str = "Demo") -> str:
    response = client.post("/books", json={"name": name})
    assert response.status_code == 201
    return response.json()["id"]


def create_commodity(client, mnemonic: str = "BRL") -> str:
    response = client.post(
        "/commodities",
        json={
            "namespace": "CURRENCY",
            "mnemonic": mnemonic,
            "fullname": mnemonic,
            "fraction": 100,
            "quote": False,
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def create_account(
    client,
    *,
    book_id: str,
    commodity_id: str,
    name: str,
    account_type: str,
    parent_id: str | None = None,
) -> str:
    payload = {
        "book_id": book_id,
        "commodity_id": commodity_id,
        "name": name,
        "type": account_type,
        "is_placeholder": account_type == "ROOT",
    }
    if parent_id is not None:
        payload["parent_id"] = parent_id
    response = client.post("/accounts", json=payload)
    assert response.status_code == 201
    return response.json()["id"]


def post_transaction(
    client,
    *,
    commodity_id: str,
    account_id: str,
    counter_account_id: str,
    value_num: int,
    post_date: str,
    description: str,
) -> None:
    response = client.post(
        "/transactions",
        json={
            "currency_guid": commodity_id,
            "post_date": post_date,
            "description": description,
            "splits": [
                {
                    "account_guid": account_id,
                    "memo": "",
                    "action": "",
                    "reconcile_state": "n",
                    "value_num": value_num,
                    "value_denom": 100,
                    "quantity_num": value_num,
                    "quantity_denom": 100,
                },
                {
                    "account_guid": counter_account_id,
                    "memo": "",
                    "action": "",
                    "reconcile_state": "n",
                    "value_num": -value_num,
                    "value_denom": 100,
                    "quantity_num": -value_num,
                    "quantity_denom": 100,
                },
            ],
        },
    )
    assert response.status_code == 201


def test_income_statement_report_monthly_summary(client):
    book_id = create_book(client)
    commodity_id = create_commodity(client)
    root_id = create_account(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        name="Root",
        account_type="ROOT",
    )
    asset_id = create_account(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        parent_id=root_id,
        name="Bank",
        account_type="ASSET",
    )
    income_id = create_account(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        parent_id=root_id,
        name="Sales",
        account_type="INCOME",
    )
    expense_id = create_account(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        parent_id=root_id,
        name="Rent",
        account_type="EXPENSE",
    )

    post_transaction(
        client,
        commodity_id=commodity_id,
        account_id=income_id,
        counter_account_id=asset_id,
        value_num=-120000,
        post_date="2025-02-10T10:00:00Z",
        description="Sales last year",
    )
    post_transaction(
        client,
        commodity_id=commodity_id,
        account_id=expense_id,
        counter_account_id=asset_id,
        value_num=50000,
        post_date="2025-02-11T10:00:00Z",
        description="Rent last year",
    )
    post_transaction(
        client,
        commodity_id=commodity_id,
        account_id=income_id,
        counter_account_id=asset_id,
        value_num=-100000,
        post_date="2026-01-10T10:00:00Z",
        description="Sales previous month",
    )
    post_transaction(
        client,
        commodity_id=commodity_id,
        account_id=expense_id,
        counter_account_id=asset_id,
        value_num=30000,
        post_date="2026-01-12T10:00:00Z",
        description="Rent previous month",
    )
    post_transaction(
        client,
        commodity_id=commodity_id,
        account_id=income_id,
        counter_account_id=asset_id,
        value_num=-150000,
        post_date="2026-02-15T10:00:00Z",
        description="Sales current month",
    )
    post_transaction(
        client,
        commodity_id=commodity_id,
        account_id=expense_id,
        counter_account_id=asset_id,
        value_num=40000,
        post_date="2026-02-18T10:00:00Z",
        description="Rent current month",
    )

    response = client.get(f"/reports/income-statement?book_id={book_id}&month=2026-02")
    assert response.status_code == 200
    payload = response.json()

    assert payload["month"] == "2026-02"
    assert payload["summary"]["revenue"] == pytest.approx(1500.0)
    assert payload["summary"]["expenses"] == pytest.approx(400.0)
    assert payload["summary"]["net_income"] == pytest.approx(1100.0)
    assert payload["summary"]["margin_percent"] == pytest.approx(73.33)

    assert payload["comparisons"]["previous_month"]["period"] == "2026-01"
    assert payload["comparisons"]["previous_month"]["net_income"] == pytest.approx(700.0)
    assert payload["comparisons"]["previous_month"]["delta_net_income"] == pytest.approx(400.0)

    assert payload["comparisons"]["same_month_last_year"]["period"] == "2025-02"
    assert payload["comparisons"]["same_month_last_year"]["net_income"] == pytest.approx(700.0)
    assert payload["comparisons"]["same_month_last_year"]["delta_net_income"] == pytest.approx(400.0)

    assert len(payload["series"]) == 12
    assert payload["series"][-1]["period"] == "2026-02"
    assert payload["series"][-1]["net_income"] == pytest.approx(1100.0)

    lines_by_account = {line["account_id"]: line for line in payload["lines"]}
    assert lines_by_account[income_id]["amount"] == pytest.approx(1500.0)
    assert lines_by_account[expense_id]["amount"] == pytest.approx(400.0)


def test_income_statement_entries_drilldown(client):
    book_id = create_book(client)
    commodity_id = create_commodity(client)
    root_id = create_account(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        name="Root",
        account_type="ROOT",
    )
    asset_id = create_account(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        parent_id=root_id,
        name="Bank",
        account_type="ASSET",
    )
    income_id = create_account(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        parent_id=root_id,
        name="Services",
        account_type="INCOME",
    )

    post_transaction(
        client,
        commodity_id=commodity_id,
        account_id=income_id,
        counter_account_id=asset_id,
        value_num=-80000,
        post_date="2026-02-08T10:00:00Z",
        description="Contract A",
    )
    post_transaction(
        client,
        commodity_id=commodity_id,
        account_id=income_id,
        counter_account_id=asset_id,
        value_num=-70000,
        post_date="2026-02-20T10:00:00Z",
        description="Contract B",
    )
    post_transaction(
        client,
        commodity_id=commodity_id,
        account_id=income_id,
        counter_account_id=asset_id,
        value_num=-60000,
        post_date="2026-01-20T10:00:00Z",
        description="Out of month",
    )

    response = client.get(
        f"/reports/income-statement/accounts/{income_id}/entries?book_id={book_id}&month=2026-02"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["account_id"] == income_id
    assert payload["month"] == "2026-02"
    assert payload["total_amount"] == pytest.approx(1500.0)
    assert len(payload["entries"]) == 2
    assert payload["entries"][0]["description"] == "Contract B"
    assert payload["entries"][1]["description"] == "Contract A"
    assert payload["entries"][0]["amount"] == pytest.approx(700.0)
    assert payload["entries"][1]["amount"] == pytest.approx(800.0)

    invalid = client.get(
        f"/reports/income-statement/accounts/{asset_id}/entries?book_id={book_id}&month=2026-02"
    )
    assert invalid.status_code == 409
    assert invalid.json()["code"] == "INVALID_ACCOUNT_TYPE"


def test_income_statement_matrix_by_month_and_account(client):
    book_id = create_book(client)
    commodity_id = create_commodity(client)
    root_id = create_account(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        name="Root",
        account_type="ROOT",
    )
    bank_id = create_account(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        parent_id=root_id,
        name="Bank",
        account_type="ASSET",
    )
    sales_id = create_account(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        parent_id=root_id,
        name="Sales",
        account_type="INCOME",
    )
    support_id = create_account(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        parent_id=root_id,
        name="Support",
        account_type="INCOME",
    )
    rent_id = create_account(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        parent_id=root_id,
        name="Rent",
        account_type="EXPENSE",
    )

    post_transaction(
        client,
        commodity_id=commodity_id,
        account_id=sales_id,
        counter_account_id=bank_id,
        value_num=-90000,
        post_date="2026-01-10T10:00:00Z",
        description="Sales Jan",
    )
    post_transaction(
        client,
        commodity_id=commodity_id,
        account_id=rent_id,
        counter_account_id=bank_id,
        value_num=30000,
        post_date="2026-01-12T10:00:00Z",
        description="Rent Jan",
    )
    post_transaction(
        client,
        commodity_id=commodity_id,
        account_id=sales_id,
        counter_account_id=bank_id,
        value_num=-100000,
        post_date="2026-02-11T10:00:00Z",
        description="Sales Feb",
    )
    post_transaction(
        client,
        commodity_id=commodity_id,
        account_id=support_id,
        counter_account_id=bank_id,
        value_num=-20000,
        post_date="2026-02-14T10:00:00Z",
        description="Support Feb",
    )
    post_transaction(
        client,
        commodity_id=commodity_id,
        account_id=rent_id,
        counter_account_id=bank_id,
        value_num=40000,
        post_date="2026-02-16T10:00:00Z",
        description="Rent Feb",
    )

    response = client.get(
        f"/reports/income-statement/matrix?book_id={book_id}&start_month=2026-01&end_month=2026-02"
    )
    assert response.status_code == 200
    payload = response.json()

    assert payload["periods"] == ["2026-01", "2026-02"]
    assert payload["revenue_totals"] == pytest.approx([900.0, 1200.0])
    assert payload["expense_totals"] == pytest.approx([300.0, 400.0])
    assert payload["net_income_totals"] == pytest.approx([600.0, 800.0])

    rows_by_id = {row["account_id"]: row for row in payload["rows"]}
    assert rows_by_id[sales_id]["amounts"] == pytest.approx([900.0, 1000.0])
    assert rows_by_id[support_id]["amounts"] == pytest.approx([0.0, 200.0])
    assert rows_by_id[rent_id]["amounts"] == pytest.approx([300.0, 400.0])

    invalid_range = client.get(
        f"/reports/income-statement/matrix?book_id={book_id}&start_month=2026-02&end_month=2026-01"
    )
    assert invalid_range.status_code == 400
    assert invalid_range.json()["code"] == "INVALID_MONTH_RANGE"
