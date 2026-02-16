from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime
from fractions import Fraction

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Account, AccountType, Commodity, Split, Transaction


def _shift_month(year: int, month: int, delta: int) -> tuple[int, int]:
    absolute = year * 12 + (month - 1) + delta
    shifted_year = absolute // 12
    shifted_month = (absolute % 12) + 1
    return shifted_year, shifted_month


def _month_key(year: int, month: int) -> str:
    return f"{year:04d}-{month:02d}"


def _month_start(year: int, month: int) -> datetime:
    return datetime(year, month, 1, tzinfo=UTC)


def _month_window(year: int, month: int) -> tuple[datetime, datetime]:
    next_year, next_month = _shift_month(year, month, 1)
    return _month_start(year, month), _month_start(next_year, next_month)


def _as_fraction(value_num: int, value_denom: int) -> Fraction:
    return Fraction(value_num, value_denom)


def _normalized_amount(account_type: AccountType | str, amount: Fraction) -> Fraction:
    kind = account_type.value if isinstance(account_type, AccountType) else str(account_type)
    if kind == "INCOME":
        return -amount
    if kind == "EXPENSE":
        return amount
    return Fraction(0, 1)


def _as_float(amount: Fraction) -> float:
    return round(float(amount), 2)


def build_income_statement(
    db: Session,
    *,
    book_id: str,
    year: int,
    month: int,
) -> dict:
    accounts = db.execute(
        select(Account).where(
            Account.book_id == book_id,
            Account.type.in_([AccountType.INCOME, AccountType.EXPENSE]),
        )
    ).scalars().all()
    accounts_by_id = {account.id: account for account in accounts}
    account_ids = list(accounts_by_id.keys())

    selected_key = _month_key(year, month)
    previous_year, previous_month = _shift_month(year, month, -1)
    previous_key = _month_key(previous_year, previous_month)
    last_year, last_year_month = _shift_month(year, month, -12)
    last_year_key = _month_key(last_year, last_year_month)

    query_start = _month_start(last_year, last_year_month)
    _, query_end = _month_window(year, month)

    points: dict[str, dict[str, Fraction]] = defaultdict(
        lambda: {
            "revenue": Fraction(0, 1),
            "expenses": Fraction(0, 1),
        }
    )
    account_amounts: dict[str, Fraction] = defaultdict(lambda: Fraction(0, 1))
    account_txs: dict[str, set[str]] = defaultdict(set)

    if account_ids:
        movement_date = func.coalesce(Transaction.post_date, Transaction.enter_date)
        rows = db.execute(
            select(
                Split.account_guid,
                Split.tx_guid,
                Split.value_num,
                Split.value_denom,
                movement_date.label("movement_date"),
            )
            .join(Transaction, Transaction.guid == Split.tx_guid)
            .where(Split.account_guid.in_(account_ids))
            .where(movement_date >= query_start)
            .where(movement_date < query_end)
            .order_by(movement_date.asc(), Split.tx_guid.asc(), Split.guid.asc())
        ).all()

        for row in rows:
            account = accounts_by_id.get(row.account_guid)
            if account is None or row.movement_date is None:
                continue

            movement_date_value: datetime = row.movement_date
            if movement_date_value.tzinfo is None:
                movement_date_value = movement_date_value.replace(tzinfo=UTC)

            bucket = _month_key(movement_date_value.year, movement_date_value.month)
            raw_amount = _as_fraction(row.value_num, row.value_denom)
            normalized = _normalized_amount(account.type, raw_amount)
            account_type_value = account.type.value if isinstance(account.type, AccountType) else str(account.type)

            if account_type_value == "INCOME":
                points[bucket]["revenue"] += normalized
            elif account_type_value == "EXPENSE":
                points[bucket]["expenses"] += normalized

            if bucket == selected_key:
                account_amounts[account.id] += normalized
                account_txs[account.id].add(row.tx_guid)

    selected_revenue = points[selected_key]["revenue"]
    selected_expenses = points[selected_key]["expenses"]
    selected_net = selected_revenue - selected_expenses

    previous_net = points[previous_key]["revenue"] - points[previous_key]["expenses"]
    yoy_net = points[last_year_key]["revenue"] - points[last_year_key]["expenses"]

    def comparison_payload(period_key: str, base_value: Fraction) -> dict:
        delta = selected_net - base_value
        delta_percent = None if base_value == 0 else _as_float((delta / abs(base_value)) * 100)
        return {
            "period": period_key,
            "net_income": _as_float(base_value),
            "delta_net_income": _as_float(delta),
            "delta_percent": delta_percent,
        }

    line_items = []
    for account in accounts:
        amount = account_amounts.get(account.id, Fraction(0, 1))
        if amount == 0:
            continue
        line_items.append(
            {
                "account_id": account.id,
                "account_name": account.name,
                "account_code": account.code,
                "account_type": account.type.value,
                "amount": _as_float(amount),
                "transaction_count": len(account_txs.get(account.id, set())),
            }
        )

    line_items.sort(key=lambda item: (item["account_type"], -abs(item["amount"]), item["account_name"]))

    series = []
    for offset in range(-11, 1):
        item_year, item_month = _shift_month(year, month, offset)
        key = _month_key(item_year, item_month)
        revenue = points[key]["revenue"]
        expenses = points[key]["expenses"]
        net_income = revenue - expenses
        series.append(
            {
                "period": key,
                "revenue": _as_float(revenue),
                "expenses": _as_float(expenses),
                "net_income": _as_float(net_income),
            }
        )

    revenue_float = _as_float(selected_revenue)
    expenses_float = _as_float(selected_expenses)
    net_float = _as_float(selected_net)
    margin_percent = None if selected_revenue == 0 else _as_float((selected_net / selected_revenue) * 100)

    currency_mnemonic = None
    if accounts:
        currency_mnemonic = db.execute(
            select(Commodity.mnemonic).where(Commodity.id == accounts[0].commodity_id)
        ).scalar_one_or_none()

    return {
        "book_id": book_id,
        "month": selected_key,
        "currency_mnemonic": currency_mnemonic,
        "summary": {
            "revenue": revenue_float,
            "expenses": expenses_float,
            "net_income": net_float,
            "margin_percent": margin_percent,
        },
        "groups": [
            {"group_key": "REVENUE", "label": "Receita Líquida", "amount": revenue_float},
            {"group_key": "EXPENSE", "label": "Custos e Despesas", "amount": expenses_float},
        ],
        "waterfall": [
            {"group_key": "REVENUE", "label": "Receita Líquida", "amount": revenue_float},
            {"group_key": "EXPENSE", "label": "Custos e Despesas", "amount": -expenses_float},
            {"group_key": "RESULT", "label": "Lucro Líquido", "amount": net_float},
        ],
        "lines": line_items,
        "series": series,
        "comparisons": {
            "previous_month": comparison_payload(previous_key, previous_net),
            "same_month_last_year": comparison_payload(last_year_key, yoy_net),
        },
    }


def list_income_statement_account_entries(
    db: Session,
    *,
    account: Account,
    year: int,
    month: int,
) -> dict:
    movement_date = func.coalesce(Transaction.post_date, Transaction.enter_date)
    start, end = _month_window(year, month)

    rows = db.execute(
        select(
            Split.guid,
            Split.tx_guid,
            Split.memo,
            Split.value_num,
            Split.value_denom,
            Transaction.description,
            movement_date.label("movement_date"),
        )
        .join(Transaction, Transaction.guid == Split.tx_guid)
        .where(Split.account_guid == account.id)
        .where(movement_date >= start)
        .where(movement_date < end)
        .order_by(movement_date.desc(), Split.tx_guid.desc(), Split.guid.desc())
    ).all()

    entries = []
    total_amount = Fraction(0, 1)
    for row in rows:
        raw_amount = _as_fraction(row.value_num, row.value_denom)
        normalized = _normalized_amount(account.type, raw_amount)
        total_amount += normalized
        entries.append(
            {
                "split_guid": row.guid,
                "transaction_guid": row.tx_guid,
                "movement_date": row.movement_date,
                "description": row.description,
                "memo": row.memo,
                "amount": _as_float(normalized),
            }
        )

    return {
        "account_id": account.id,
        "account_name": account.name,
        "account_code": account.code,
        "account_type": account.type.value,
        "month": _month_key(year, month),
        "total_amount": _as_float(total_amount),
        "entries": entries,
    }
