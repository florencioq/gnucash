from __future__ import annotations

from calendar import monthrange
from collections import defaultdict
from datetime import UTC, date, datetime, time
from fractions import Fraction
from math import ceil
from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Account, AccountType, Commodity, Customer, Invoice, InvoiceEntry, Split, Transaction


def _shift_month(year: int, month: int, delta: int) -> tuple[int, int]:
    absolute = year * 12 + (month - 1) + delta
    shifted_year = absolute // 12
    shifted_month = (absolute % 12) + 1
    return shifted_year, shifted_month


def _month_key(year: int, month: int) -> str:
    return f"{year:04d}-{month:02d}"


def _month_sequence(
    *,
    start_year: int,
    start_month: int,
    end_year: int,
    end_month: int,
) -> list[str]:
    periods: list[str] = []
    cursor_year, cursor_month = start_year, start_month
    end_marker = end_year * 12 + (end_month - 1)
    while (cursor_year * 12 + (cursor_month - 1)) <= end_marker:
        periods.append(_month_key(cursor_year, cursor_month))
        cursor_year, cursor_month = _shift_month(cursor_year, cursor_month, 1)
    return periods


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


def build_income_statement_matrix(
    db: Session,
    *,
    book_id: str,
    start_year: int,
    start_month: int,
    end_year: int,
    end_month: int,
) -> dict:
    all_accounts = db.execute(
        select(Account).where(Account.book_id == book_id)
    ).scalars().all()
    all_accounts_by_id = {account.id: account for account in all_accounts}

    path_cache: dict[str, str] = {}
    same_type_ancestor_cache: dict[str, list[str]] = {}

    def build_account_path(account_id: str, visited: set[str] | None = None) -> str:
        cached = path_cache.get(account_id)
        if cached is not None:
            return cached

        account = all_accounts_by_id.get(account_id)
        if account is None:
            return account_id

        if visited is None:
            visited = set()
        if account_id in visited:
            # Safety fallback for inconsistent cyclic hierarchies.
            return account.name
        visited.add(account_id)

        if not account.parent_id:
            path_cache[account_id] = account.name
            return account.name

        parent = all_accounts_by_id.get(account.parent_id)
        if parent is None:
            path_cache[account_id] = account.name
            return account.name

        if parent.type == AccountType.ROOT:
            path_cache[account_id] = account.name
            return account.name

        parent_path = build_account_path(parent.id, visited)
        full_path = f"{parent_path} / {account.name}"
        path_cache[account_id] = full_path
        return full_path

    def same_type_ancestor_ids(account_id: str) -> list[str]:
        cached = same_type_ancestor_cache.get(account_id)
        if cached is not None:
            return cached

        account = all_accounts_by_id.get(account_id)
        if account is None:
            same_type_ancestor_cache[account_id] = []
            return []

        ancestors: list[str] = []
        seen: set[str] = set()
        parent_id = account.parent_id
        while parent_id and parent_id not in seen:
            seen.add(parent_id)
            parent = all_accounts_by_id.get(parent_id)
            if parent is None:
                break
            if parent.type != account.type:
                break
            ancestors.append(parent.id)
            parent_id = parent.parent_id

        same_type_ancestor_cache[account_id] = ancestors
        return ancestors

    accounts = db.execute(
        select(Account).where(
            Account.book_id == book_id,
            Account.type.in_([AccountType.INCOME, AccountType.EXPENSE]),
        )
    ).scalars().all()
    periods = _month_sequence(
        start_year=start_year,
        start_month=start_month,
        end_year=end_year,
        end_month=end_month,
    )
    period_index = {period: index for index, period in enumerate(periods)}
    account_ids = [account.id for account in accounts]

    monthly_by_account: dict[str, list[Fraction]] = {
        account.id: [Fraction(0, 1) for _ in periods] for account in accounts
    }
    revenue_totals = [Fraction(0, 1) for _ in periods]
    expense_totals = [Fraction(0, 1) for _ in periods]

    query_start = _month_start(start_year, start_month)
    _, query_end = _month_window(end_year, end_month)

    if account_ids and periods:
        movement_date = func.coalesce(Transaction.post_date, Transaction.enter_date)
        rows = db.execute(
            select(
                Split.account_guid,
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

        accounts_by_id = {account.id: account for account in accounts}
        for row in rows:
            account = accounts_by_id.get(row.account_guid)
            if account is None or row.movement_date is None:
                continue
            movement_date_value: datetime = row.movement_date
            if movement_date_value.tzinfo is None:
                movement_date_value = movement_date_value.replace(tzinfo=UTC)
            period = _month_key(movement_date_value.year, movement_date_value.month)
            index = period_index.get(period)
            if index is None:
                continue

            normalized = _normalized_amount(account.type, _as_fraction(row.value_num, row.value_denom))
            monthly_by_account[account.id][index] += normalized
            for ancestor_account_id in same_type_ancestor_ids(account.id):
                monthly_by_account[ancestor_account_id][index] += normalized
            account_type_value = account.type.value if isinstance(account.type, AccountType) else str(account.type)
            if account_type_value == "INCOME":
                revenue_totals[index] += normalized
            elif account_type_value == "EXPENSE":
                expense_totals[index] += normalized

    rows_out = []
    for account in sorted(accounts, key=lambda item: (item.type.value, build_account_path(item.id).lower())):
        values = monthly_by_account.get(account.id, [Fraction(0, 1) for _ in periods])
        if all(value == 0 for value in values):
            continue
        rows_out.append(
            {
                "account_id": account.id,
                "account_name": build_account_path(account.id),
                "account_code": account.code,
                "account_type": account.type.value,
                "amounts": [_as_float(value) for value in values],
                "total_amount": _as_float(sum(values, Fraction(0, 1))),
            }
        )

    net_income_totals = [revenue_totals[idx] - expense_totals[idx] for idx in range(len(periods))]

    currency_mnemonic = None
    if accounts:
        currency_mnemonic = db.execute(
            select(Commodity.mnemonic).where(Commodity.id == accounts[0].commodity_id)
        ).scalar_one_or_none()

    return {
        "book_id": book_id,
        "start_month": _month_key(start_year, start_month),
        "end_month": _month_key(end_year, end_month),
        "periods": periods,
        "currency_mnemonic": currency_mnemonic,
        "rows": rows_out,
        "revenue_totals": [_as_float(value) for value in revenue_totals],
        "expense_totals": [_as_float(value) for value in expense_totals],
        "net_income_totals": [_as_float(value) for value in net_income_totals],
    }


def build_invoice_settlement_by_customer_report(
    db: Session,
    *,
    book_id: str,
    customer_guid: str | None,
    posted_start_date: date | None,
    posted_end_date: date | None,
    sort_key: Literal[
        "customer",
        "invoice_id",
        "date_posted",
        "posted_month_end_date",
        "settled_date",
        "days_difference",
    ],
    sort_direction: Literal["asc", "desc"],
    page: int,
    page_size: int,
) -> dict:
    def invoice_total_amount(invoice: Invoice, entries: list[InvoiceEntry]) -> Fraction:
        total = Fraction(0, 1)
        for entry in entries:
            quantity = Fraction(entry.quantity_num, entry.quantity_denom)
            unit_price = Fraction(entry.i_price_num, entry.i_price_denom)
            base = quantity * unit_price
            discount_ratio = Fraction(entry.i_discount_num, entry.i_discount_denom)
            discount_type = (entry.i_disc_type or "").strip().upper()
            if discount_type in {"VALUE", "VAL"}:
                discount_amount = discount_ratio
            else:
                discount_amount = base * discount_ratio
            total += base - discount_amount

        invoice_type = (invoice.invoice_type or "INVOICE").strip().upper()
        sign = Fraction(-1, 1) if invoice_type == "CREDIT_NOTE" else Fraction(1, 1)
        return abs(total * sign)

    reference_today = datetime.now(UTC).date()

    invoice_rows_stmt = (
        select(Invoice, Customer.name)
        .outerjoin(
            Customer,
            (Customer.guid == Invoice.owner_guid) & (Customer.book_id == Invoice.book_id),
        )
        .where(Invoice.book_id == book_id, Invoice.owner_type == "CUSTOMER")
        .where(Invoice.date_posted.is_not(None))
        .where(Invoice.post_lot.is_not(None))
        .where(Invoice.post_acc.is_not(None))
        .where(Invoice.post_txn.is_not(None))
    )
    if customer_guid:
        invoice_rows_stmt = invoice_rows_stmt.where(Invoice.owner_guid == customer_guid)
    if posted_start_date is not None:
        invoice_rows_stmt = invoice_rows_stmt.where(
            Invoice.date_posted >= datetime.combine(posted_start_date, time.min, tzinfo=UTC)
        )
    if posted_end_date is not None:
        invoice_rows_stmt = invoice_rows_stmt.where(
            Invoice.date_posted <= datetime.combine(posted_end_date, time.max, tzinfo=UTC)
        )

    invoice_rows = db.execute(
        invoice_rows_stmt.order_by(Invoice.date_posted.asc(), Invoice.id.asc(), Invoice.guid.asc())
    ).all()
    if not invoice_rows:
        return {
            "book_id": book_id,
            "items": [],
            "customer_summaries": [],
            "page": 1,
            "page_size": page_size,
            "total_items": 0,
            "total_pages": 1,
        }

    invoice_ids = [invoice.guid for invoice, _customer_name in invoice_rows]
    invoice_entries = db.execute(
        select(InvoiceEntry).where(InvoiceEntry.invoice_guid.in_(invoice_ids))
    ).scalars().all()
    entries_by_invoice: dict[str, list[InvoiceEntry]] = defaultdict(list)
    for entry in invoice_entries:
        entries_by_invoice[entry.invoice_guid].append(entry)

    lot_guids = {invoice.post_lot for invoice, _customer_name in invoice_rows if invoice.post_lot}
    movement_date = func.coalesce(Transaction.post_date, Transaction.enter_date)
    lot_split_rows = db.execute(
        select(
            Split.lot_guid,
            Split.account_guid,
            Split.tx_guid,
            Split.value_num,
            Split.value_denom,
            movement_date.label("movement_date"),
        )
        .join(Transaction, Transaction.guid == Split.tx_guid)
        .where(Split.lot_guid.in_(lot_guids))
        .order_by(Split.lot_guid.asc(), movement_date.asc(), Split.tx_guid.asc(), Split.guid.asc())
    ).all()

    splits_by_lot: dict[str, list] = defaultdict(list)
    for row in lot_split_rows:
        splits_by_lot[row.lot_guid].append(row)

    items: list[dict] = []
    customer_names: dict[str, str | None] = {}
    for invoice, customer_name in invoice_rows:
        if not invoice.date_posted or not invoice.post_lot or not invoice.post_acc or not invoice.post_txn:
            continue

        posted_at = invoice.date_posted
        if posted_at.tzinfo is None:
            posted_at = posted_at.replace(tzinfo=UTC)

        customer_names[invoice.owner_guid] = customer_name
        lot_balance = Fraction(0, 1)
        latest_payment_date: date | None = None
        for row in splits_by_lot.get(invoice.post_lot, []):
            if row.account_guid != invoice.post_acc:
                continue
            lot_balance += Fraction(row.value_num, row.value_denom)
            if row.tx_guid == invoice.post_txn:
                continue
            if row.movement_date is None:
                continue
            movement_at = row.movement_date
            if movement_at.tzinfo is None:
                movement_at = movement_at.replace(tzinfo=UTC)
            movement_day = movement_at.date()
            if latest_payment_date is None or movement_day > latest_payment_date:
                latest_payment_date = movement_day

        posted_month_end_day = date(posted_at.year, posted_at.month, monthrange(posted_at.year, posted_at.month)[1])
        if lot_balance == 0:
            payment_status = "PAID"
            reference_date = latest_payment_date or reference_today
        else:
            payment_status = "OPEN"
            reference_date = reference_today
        days_difference = (reference_date - posted_month_end_day).days
        total_amount = invoice_total_amount(invoice, entries_by_invoice.get(invoice.guid, []))
        items.append(
            {
                "customer_guid": invoice.owner_guid,
                "customer_name": customer_name,
                "invoice_guid": invoice.guid,
                "invoice_id": invoice.id or "",
                "payment_status": payment_status,
                "currency_guid": invoice.currency_guid,
                "total_num": total_amount.numerator,
                "total_denom": total_amount.denominator,
                "date_posted": posted_at,
                "posted_month_end_date": posted_month_end_day,
                "settled_date": reference_date,
                "days_difference": days_difference,
            }
        )

    summary_days_by_customer: dict[str, list[int]] = defaultdict(list)
    for item in items:
        summary_days_by_customer[item["customer_guid"]].append(item["days_difference"])

    customer_summaries = []
    for item_customer_guid, days in summary_days_by_customer.items():
        customer_summaries.append(
            {
                "customer_guid": item_customer_guid,
                "customer_name": customer_names.get(item_customer_guid),
                "invoice_count": len(days),
                "avg_days_difference": round(sum(days) / len(days), 2),
                "min_days_difference": min(days),
                "max_days_difference": max(days),
            }
        )

    customer_summaries.sort(
        key=lambda item: (str(item["customer_name"] or "").lower(), str(item["customer_guid"] or ""))
    )

    def sort_value(item: dict) -> tuple:
        if sort_key == "customer":
            return (str(item.get("customer_name") or "").lower(),)
        if sort_key == "invoice_id":
            return (str(item.get("invoice_id") or "").lower(),)
        if sort_key == "date_posted":
            return (item.get("date_posted"),)
        if sort_key == "posted_month_end_date":
            return (item.get("posted_month_end_date"),)
        if sort_key == "settled_date":
            return (item.get("settled_date"),)
        if sort_key == "days_difference":
            return (int(item.get("days_difference") or 0),)
        return (item.get("date_posted"),)

    reverse = sort_direction == "desc"
    items.sort(
        key=lambda item: (
            sort_value(item),
            str(item.get("invoice_id") or "").lower(),
            str(item.get("invoice_guid") or ""),
        ),
        reverse=reverse,
    )

    total_items = len(items)
    total_pages = max(1, ceil(total_items / page_size)) if total_items else 1
    current_page = min(page, total_pages)
    offset = (current_page - 1) * page_size
    paged_items = items[offset:offset + page_size]

    return {
        "book_id": book_id,
        "items": paged_items,
        "customer_summaries": customer_summaries,
        "page": current_page,
        "page_size": page_size,
        "total_items": total_items,
        "total_pages": total_pages,
    }
