from __future__ import annotations

from datetime import UTC, datetime

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


def create_posted_invoice(
    client,
    *,
    book_id: str,
    currency_guid: str,
    customer_guid: str,
    invoice_id: str,
    income_account_guid: str,
    receivable_account_guid: str,
    date_opened: str,
    post_date: str,
) -> str:
    create_response = client.post(
        "/invoices",
        json={
            "book_id": book_id,
            "id": invoice_id,
            "currency_guid": currency_guid,
            "customer_guid": customer_guid,
            "date_opened": date_opened,
        },
    )
    assert create_response.status_code == 201
    invoice_guid = create_response.json()["guid"]

    entry_response = client.post(
        f"/invoices/{invoice_guid}/entries",
        json={
            "date": date_opened,
            "description": f"Serviço {invoice_id}",
            "income_account_guid": income_account_guid,
            "quantity_num": 1,
            "quantity_denom": 1,
            "unit_price_num": 10000,
            "unit_price_denom": 100,
        },
    )
    assert entry_response.status_code == 201

    post_response = client.post(
        f"/invoices/{invoice_guid}/post",
        json={
            "post_account_guid": receivable_account_guid,
            "post_date": post_date,
        },
    )
    assert post_response.status_code == 200
    return invoice_guid


def pay_invoice(
    client,
    *,
    invoice_guid: str,
    bank_account_guid: str,
    payment_date: str,
    amount_num: int = 10000,
    amount_denom: int = 100,
) -> None:
    payment_response = client.post(
        f"/invoices/{invoice_guid}/payments",
        json={
            "transfer_account_guid": bank_account_guid,
            "amount_num": amount_num,
            "amount_denom": amount_denom,
            "payment_date": payment_date,
        },
    )
    assert payment_response.status_code == 200


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
    income_group_id = create_account(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        parent_id=root_id,
        name="Services",
        account_type="INCOME",
    )
    sales_id = create_account(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        parent_id=income_group_id,
        name="Sales",
        account_type="INCOME",
    )
    support_id = create_account(
        client,
        book_id=book_id,
        commodity_id=commodity_id,
        parent_id=income_group_id,
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
    assert rows_by_id[income_group_id]["account_name"] == "Services"
    assert rows_by_id[income_group_id]["amounts"] == pytest.approx([900.0, 1200.0])
    assert rows_by_id[sales_id]["account_name"] == "Services / Sales"
    assert rows_by_id[support_id]["account_name"] == "Services / Support"
    assert rows_by_id[sales_id]["amounts"] == pytest.approx([900.0, 1000.0])
    assert rows_by_id[support_id]["amounts"] == pytest.approx([0.0, 200.0])
    assert rows_by_id[rent_id]["amounts"] == pytest.approx([300.0, 400.0])

    invalid_range = client.get(
        f"/reports/income-statement/matrix?book_id={book_id}&start_month=2026-02&end_month=2026-01"
    )
    assert invalid_range.status_code == 400
    assert invalid_range.json()["code"] == "INVALID_MONTH_RANGE"


def test_invoice_settlement_by_customer_report(client):
    book_id = create_book(client)
    currency_id = create_commodity(client, "BRL")
    root_id = create_account(
        client,
        book_id=book_id,
        commodity_id=currency_id,
        name="Root",
        account_type="ROOT",
    )
    receivable_id = create_account(
        client,
        book_id=book_id,
        commodity_id=currency_id,
        parent_id=root_id,
        name="Contas a Receber",
        account_type="ASSET",
    )
    income_id = create_account(
        client,
        book_id=book_id,
        commodity_id=currency_id,
        parent_id=root_id,
        name="Receita",
        account_type="INCOME",
    )
    bank_id = create_account(
        client,
        book_id=book_id,
        commodity_id=currency_id,
        parent_id=root_id,
        name="Banco",
        account_type="ASSET",
    )

    customer_a_response = client.post(
        "/customers",
        json={
            "book_id": book_id,
            "name": "Cliente A",
            "id": "C-A",
            "currency_guid": currency_id,
        },
    )
    assert customer_a_response.status_code == 201
    customer_a = customer_a_response.json()["guid"]

    customer_b_response = client.post(
        "/customers",
        json={
            "book_id": book_id,
            "name": "Cliente B",
            "id": "C-B",
            "currency_guid": currency_id,
        },
    )
    assert customer_b_response.status_code == 201
    customer_b = customer_b_response.json()["guid"]

    inv_a1 = create_posted_invoice(
        client,
        book_id=book_id,
        currency_guid=currency_id,
        customer_guid=customer_a,
        invoice_id="000101",
        income_account_guid=income_id,
        receivable_account_guid=receivable_id,
        date_opened="2026-01-10T00:00:00Z",
        post_date="2026-01-15T00:00:00Z",
    )
    pay_invoice(
        client,
        invoice_guid=inv_a1,
        bank_account_guid=bank_id,
        payment_date="2026-02-10T00:00:00Z",
    )

    inv_a2 = create_posted_invoice(
        client,
        book_id=book_id,
        currency_guid=currency_id,
        customer_guid=customer_a,
        invoice_id="000102",
        income_account_guid=income_id,
        receivable_account_guid=receivable_id,
        date_opened="2026-01-03T00:00:00Z",
        post_date="2026-01-05T00:00:00Z",
    )
    pay_invoice(
        client,
        invoice_guid=inv_a2,
        bank_account_guid=bank_id,
        payment_date="2026-01-20T00:00:00Z",
    )

    inv_b1 = create_posted_invoice(
        client,
        book_id=book_id,
        currency_guid=currency_id,
        customer_guid=customer_b,
        invoice_id="000201",
        income_account_guid=income_id,
        receivable_account_guid=receivable_id,
        date_opened="2026-02-05T00:00:00Z",
        post_date="2026-02-10T00:00:00Z",
    )
    pay_invoice(
        client,
        invoice_guid=inv_b1,
        bank_account_guid=bank_id,
        payment_date="2026-02-28T00:00:00Z",
    )

    create_posted_invoice(
        client,
        book_id=book_id,
        currency_guid=currency_id,
        customer_guid=customer_b,
        invoice_id="000202",
        income_account_guid=income_id,
        receivable_account_guid=receivable_id,
        date_opened="2026-02-11T00:00:00Z",
        post_date="2026-02-11T00:00:00Z",
    )

    response = client.get(
        f"/reports/invoices/settlement-by-customer?book_id={book_id}&sort_key=invoice_id&sort_direction=asc"
    )
    assert response.status_code == 200
    payload = response.json()
    today = datetime.now(UTC).date().isoformat()
    assert payload["book_id"] == book_id
    assert payload["total_items"] == 4
    assert len(payload["items"]) == 4

    by_invoice = {item["invoice_id"]: item for item in payload["items"]}
    assert by_invoice["000101"]["payment_status"] == "PAID"
    assert by_invoice["000101"]["currency_guid"] == currency_id
    assert by_invoice["000101"]["total_num"] == 100
    assert by_invoice["000101"]["total_denom"] == 1
    assert by_invoice["000101"]["posted_month_end_date"] == "2026-01-31"
    assert by_invoice["000101"]["settled_date"] == "2026-02-10"
    assert by_invoice["000101"]["days_difference"] == 10

    assert by_invoice["000102"]["payment_status"] == "PAID"
    assert by_invoice["000102"]["currency_guid"] == currency_id
    assert by_invoice["000102"]["total_num"] == 100
    assert by_invoice["000102"]["total_denom"] == 1
    assert by_invoice["000102"]["posted_month_end_date"] == "2026-01-31"
    assert by_invoice["000102"]["settled_date"] == "2026-01-20"
    assert by_invoice["000102"]["days_difference"] == -11

    assert by_invoice["000201"]["payment_status"] == "PAID"
    assert by_invoice["000201"]["currency_guid"] == currency_id
    assert by_invoice["000201"]["total_num"] == 100
    assert by_invoice["000201"]["total_denom"] == 1
    assert by_invoice["000201"]["posted_month_end_date"] == "2026-02-28"
    assert by_invoice["000201"]["settled_date"] == "2026-02-28"
    assert by_invoice["000201"]["days_difference"] == 0

    assert by_invoice["000202"]["payment_status"] == "OPEN"
    assert by_invoice["000202"]["currency_guid"] == currency_id
    assert by_invoice["000202"]["total_num"] == 100
    assert by_invoice["000202"]["total_denom"] == 1
    assert by_invoice["000202"]["posted_month_end_date"] == "2026-02-28"
    assert by_invoice["000202"]["settled_date"] == today

    summaries_by_customer = {item["customer_guid"]: item for item in payload["customer_summaries"]}
    assert len(summaries_by_customer) == 2
    assert summaries_by_customer[customer_a]["invoice_count"] == 2
    assert summaries_by_customer[customer_a]["avg_days_difference"] == pytest.approx(-0.5)
    assert summaries_by_customer[customer_a]["min_days_difference"] == -11
    assert summaries_by_customer[customer_a]["max_days_difference"] == 10

    expected_open_days = (datetime.now(UTC).date() - datetime(2026, 2, 28, tzinfo=UTC).date()).days
    assert summaries_by_customer[customer_b]["invoice_count"] == 2
    assert summaries_by_customer[customer_b]["avg_days_difference"] == pytest.approx((0 + expected_open_days) / 2)
    assert summaries_by_customer[customer_b]["min_days_difference"] == expected_open_days
    assert summaries_by_customer[customer_b]["max_days_difference"] == 0

    by_customer_response = client.get(
        f"/reports/invoices/settlement-by-customer?book_id={book_id}&customer_guid={customer_a}"
    )
    assert by_customer_response.status_code == 200
    by_customer_payload = by_customer_response.json()
    assert by_customer_payload["total_items"] == 2
    assert all(item["customer_guid"] == customer_a for item in by_customer_payload["items"])


def test_invoice_settlement_by_customer_report_invalid_date_range(client):
    book_id = create_book(client)
    response = client.get(
        f"/reports/invoices/settlement-by-customer?book_id={book_id}&posted_start_date=2026-02-10&posted_end_date=2026-02-01"
    )
    assert response.status_code == 400
    assert response.json()["code"] == "INVALID_DATE_RANGE"
