#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import re
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

import psycopg
from psycopg import sql
from psycopg.errors import UndefinedTable
from psycopg.rows import dict_row


ACCOUNT_TYPE_MAP = {
    "ROOT": "ROOT",
    "ASSET": "ASSET",
    "BANK": "ASSET",
    "CASH": "ASSET",
    "CHECKING": "ASSET",
    "SAVINGS": "ASSET",
    "MONEYMRKT": "ASSET",
    "STOCK": "ASSET",
    "MUTUAL": "ASSET",
    "CURRENCY": "ASSET",
    "RECEIVABLE": "ASSET",
    "TRADING": "ASSET",
    "LIABILITY": "LIABILITY",
    "CREDIT": "LIABILITY",
    "PAYABLE": "LIABILITY",
    "INCOME": "INCOME",
    "EXPENSE": "EXPENSE",
    "EQUITY": "EQUITY",
}


@dataclass(frozen=True)
class SourceBook:
    id: str
    root_account_id: str
    root_template_id: str


@dataclass(frozen=True)
class SourceCommodity:
    id: str
    namespace: str
    mnemonic: str
    fullname: str | None
    fraction: int
    quote: bool


@dataclass(frozen=True)
class SourceAccount:
    id: str
    name: str
    account_type: str
    commodity_id: str | None
    parent_id: str | None
    code: str | None
    description: str | None
    is_placeholder: bool


@dataclass(frozen=True)
class PreparedAccount:
    id: str
    book_id: str
    parent_id: str | None
    name: str
    code: str | None
    description: str | None
    account_type: str
    commodity_id: str
    is_placeholder: bool


@dataclass(frozen=True)
class SourceCustomer:
    guid: str
    name: str
    customer_id: str
    notes: str
    active: bool
    discount_num: int
    discount_denom: int
    credit_num: int
    credit_denom: int
    currency_guid: str
    tax_override: bool
    addr_name: str | None
    addr_addr1: str | None
    addr_addr2: str | None
    addr_addr3: str | None
    addr_addr4: str | None
    addr_phone: str | None
    addr_fax: str | None
    addr_email: str | None
    shipaddr_name: str | None
    shipaddr_addr1: str | None
    shipaddr_addr2: str | None
    shipaddr_addr3: str | None
    shipaddr_addr4: str | None
    shipaddr_phone: str | None
    shipaddr_fax: str | None
    shipaddr_email: str | None
    terms_guid: str | None
    tax_included: int | None
    taxtable_guid: str | None


@dataclass(frozen=True)
class SourceVendor:
    guid: str
    name: str
    vendor_id: str
    notes: str
    currency_guid: str
    active: bool
    tax_override: bool
    addr_name: str | None
    addr_addr1: str | None
    addr_addr2: str | None
    addr_addr3: str | None
    addr_addr4: str | None
    addr_phone: str | None
    addr_fax: str | None
    addr_email: str | None
    terms_guid: str | None
    tax_inc: str | None
    tax_table_guid: str | None


@dataclass(frozen=True)
class SourceInvoice:
    guid: str
    invoice_id: str
    date_opened: datetime | None
    date_posted: datetime | None
    notes: str
    active: bool
    currency_guid: str
    owner_type_raw: int | None
    owner_guid: str | None
    terms_guid: str | None
    billing_id: str | None
    post_txn: str | None
    post_lot: str | None
    post_acc: str | None
    billto_type: int | None
    billto_guid: str | None
    charge_amt_num: int | None
    charge_amt_denom: int | None


@dataclass(frozen=True)
class SourceEntry:
    guid: str
    date: datetime
    date_entered: datetime | None
    description: str | None
    action: str | None
    notes: str | None
    quantity_num: int
    quantity_denom: int
    i_acct: str | None
    i_price_num: int
    i_price_denom: int
    i_discount_num: int
    i_discount_denom: int
    invoice_guid: str | None
    i_disc_type: str | None
    i_disc_how: str | None
    i_taxable: bool
    i_taxincluded: bool
    i_taxtable: str | None
    b_paytype: int | None
    billable: bool | None
    billto_type: int | None
    billto_guid: str | None
    b_acct: str | None
    b_price_num: int
    b_price_denom: int
    bill_guid: str | None
    b_taxable: bool
    b_taxincluded: bool
    b_taxtable: str | None


@dataclass(frozen=True)
class SourceTransaction:
    guid: str
    currency_guid: str
    num: str
    post_date: datetime | None
    enter_date: datetime | None
    description: str | None


@dataclass(frozen=True)
class SourceSplit:
    guid: str
    tx_guid: str
    account_guid: str
    memo: str
    action: str
    reconcile_state: str
    reconcile_date: datetime | None
    value_num: int
    value_denom: int
    quantity_num: int
    quantity_denom: int
    lot_guid: str | None


@dataclass(frozen=True)
class SourceLot:
    guid: str
    account_guid: str | None
    is_closed: bool


@dataclass
class SyncStats:
    inserted: int = 0
    updated: int = 0
    reused: int = 0


def warn(message: str) -> None:
    print(f"warning: {message}", file=sys.stderr)


def _load_backend_dotenv() -> None:
    root = Path(__file__).resolve().parents[1]
    env_file = root / ".env"
    if not env_file.exists():
        return

    for line in env_file.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("\"").strip("'"))


def clip_text(value: str | None, max_len: int, *, field: str, entity_id: str, tracker: dict[str, int]) -> str | None:
    if value is None:
        return None
    if len(value) <= max_len:
        return value

    tracker[field] = tracker.get(field, 0) + 1
    if tracker[field] <= 5:
        warn(f"{field} for {entity_id} exceeded {max_len} chars and was truncated")
    return value[:max_len]


def normalize_guid(raw: str, *, field: str) -> str:
    try:
        return str(UUID(raw.strip()))
    except (ValueError, AttributeError) as exc:
        raise ValueError(f"invalid GUID in {field}: {raw!r}") from exc


def normalize_optional_guid(raw: str | None, *, field: str) -> str | None:
    if raw is None:
        return None
    stripped = raw.strip()
    if not stripped:
        return None
    try:
        return normalize_guid(stripped, field=field)
    except ValueError:
        warn(f"{field} has invalid guid {raw!r}; value will be ignored")
        return None


def normalize_optional_int(value: int | None) -> int | None:
    if value is None:
        return None
    return int(value)


def as_bool(value: object, *, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value != 0
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"1", "true", "t", "yes", "y", "on"}:
            return True
        if normalized in {"0", "false", "f", "no", "n", "off"}:
            return False
    return bool(value)


def resolve_target_conninfo(target_url: str | None) -> str:
    _load_backend_dotenv()
    raw = (target_url or os.getenv("DATABASE_URL", "")).strip()
    if not raw:
        raise ValueError("missing target database URL; use --target-url or set DATABASE_URL")

    return re.sub(r"^postgresql\+[a-zA-Z0-9_]+://", "postgresql://", raw)


def read_source_books(conn: psycopg.Connection, schema: str) -> list[SourceBook]:
    query = sql.SQL(
        "SELECT guid, root_account_guid, root_template_guid "
        "FROM {}.books "
        "ORDER BY guid ASC"
    ).format(sql.Identifier(schema))
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(query)
        rows = cur.fetchall()

    return [
        SourceBook(
            id=normalize_guid(row["guid"], field="books.guid"),
            root_account_id=normalize_guid(row["root_account_guid"], field="books.root_account_guid"),
            root_template_id=normalize_guid(row["root_template_guid"], field="books.root_template_guid"),
        )
        for row in rows
    ]


def read_source_commodities(conn: psycopg.Connection, schema: str) -> list[SourceCommodity]:
    query = sql.SQL(
        "SELECT guid, namespace, mnemonic, fullname, fraction, quote_flag "
        "FROM {}.commodities "
        "ORDER BY guid ASC"
    ).format(sql.Identifier(schema))
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(query)
        rows = cur.fetchall()

    return [
        SourceCommodity(
            id=normalize_guid(row["guid"], field="commodities.guid"),
            namespace=str(row["namespace"]),
            mnemonic=str(row["mnemonic"]),
            fullname=row["fullname"],
            fraction=int(row["fraction"]),
            quote=bool(row["quote_flag"]),
        )
        for row in rows
    ]


def read_source_accounts(conn: psycopg.Connection, schema: str) -> list[SourceAccount]:
    query = sql.SQL(
        "SELECT guid, name, account_type, commodity_guid, parent_guid, code, description, placeholder "
        "FROM {}.accounts "
        "ORDER BY guid ASC"
    ).format(sql.Identifier(schema))
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(query)
        rows = cur.fetchall()

    accounts: list[SourceAccount] = []
    for row in rows:
        parent_guid = row["parent_guid"]
        commodity_guid = row["commodity_guid"]
        accounts.append(
            SourceAccount(
                id=normalize_guid(row["guid"], field="accounts.guid"),
                name=str(row["name"]),
                account_type=str(row["account_type"]).upper(),
                commodity_id=normalize_guid(commodity_guid, field="accounts.commodity_guid") if commodity_guid else None,
                parent_id=normalize_guid(parent_guid, field="accounts.parent_guid") if parent_guid else None,
                code=row["code"],
                description=row["description"],
                is_placeholder=bool(row["placeholder"]),
            )
        )
    return accounts


def read_source_customers(conn: psycopg.Connection, schema: str) -> list[SourceCustomer]:
    query = sql.SQL(
        """
        SELECT
            guid,
            name,
            id,
            notes,
            active,
            discount_num,
            discount_denom,
            credit_num,
            credit_denom,
            currency,
            tax_override,
            addr_name,
            addr_addr1,
            addr_addr2,
            addr_addr3,
            addr_addr4,
            addr_phone,
            addr_fax,
            addr_email,
            shipaddr_name,
            shipaddr_addr1,
            shipaddr_addr2,
            shipaddr_addr3,
            shipaddr_addr4,
            shipaddr_phone,
            shipaddr_fax,
            shipaddr_email,
            terms,
            tax_included,
            taxtable
        FROM {}.customers
        ORDER BY guid ASC
        """
    ).format(sql.Identifier(schema))
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(query)
            rows = cur.fetchall()
    except UndefinedTable:
        warn(f"table {schema}.customers does not exist; skipping customers import")
        return []

    customers: list[SourceCustomer] = []
    for row in rows:
        customers.append(
            SourceCustomer(
                guid=normalize_guid(row["guid"], field="customers.guid"),
                name=str(row["name"]),
                customer_id=str(row["id"]),
                notes=str(row["notes"]),
                active=bool(row["active"]),
                discount_num=int(row["discount_num"]),
                discount_denom=int(row["discount_denom"]),
                credit_num=int(row["credit_num"]),
                credit_denom=int(row["credit_denom"]),
                currency_guid=normalize_guid(row["currency"], field="customers.currency"),
                tax_override=bool(row["tax_override"]),
                addr_name=row["addr_name"],
                addr_addr1=row["addr_addr1"],
                addr_addr2=row["addr_addr2"],
                addr_addr3=row["addr_addr3"],
                addr_addr4=row["addr_addr4"],
                addr_phone=row["addr_phone"],
                addr_fax=row["addr_fax"],
                addr_email=row["addr_email"],
                shipaddr_name=row["shipaddr_name"],
                shipaddr_addr1=row["shipaddr_addr1"],
                shipaddr_addr2=row["shipaddr_addr2"],
                shipaddr_addr3=row["shipaddr_addr3"],
                shipaddr_addr4=row["shipaddr_addr4"],
                shipaddr_phone=row["shipaddr_phone"],
                shipaddr_fax=row["shipaddr_fax"],
                shipaddr_email=row["shipaddr_email"],
                terms_guid=normalize_optional_guid(row["terms"], field="customers.terms"),
                tax_included=int(row["tax_included"]) if row["tax_included"] is not None else None,
                taxtable_guid=normalize_optional_guid(row["taxtable"], field="customers.taxtable"),
            )
        )
    return customers


def read_source_vendors(conn: psycopg.Connection, schema: str) -> list[SourceVendor]:
    query = sql.SQL(
        """
        SELECT
            guid,
            name,
            id,
            notes,
            currency,
            active,
            tax_override,
            addr_name,
            addr_addr1,
            addr_addr2,
            addr_addr3,
            addr_addr4,
            addr_phone,
            addr_fax,
            addr_email,
            terms,
            tax_inc,
            tax_table
        FROM {}.vendors
        ORDER BY guid ASC
        """
    ).format(sql.Identifier(schema))
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(query)
            rows = cur.fetchall()
    except UndefinedTable:
        warn(f"table {schema}.vendors does not exist; skipping vendors import")
        return []

    vendors: list[SourceVendor] = []
    for row in rows:
        vendors.append(
            SourceVendor(
                guid=normalize_guid(row["guid"], field="vendors.guid"),
                name=str(row["name"]),
                vendor_id=str(row["id"]),
                notes=str(row["notes"]),
                currency_guid=normalize_guid(row["currency"], field="vendors.currency"),
                active=bool(row["active"]),
                tax_override=bool(row["tax_override"]),
                addr_name=row["addr_name"],
                addr_addr1=row["addr_addr1"],
                addr_addr2=row["addr_addr2"],
                addr_addr3=row["addr_addr3"],
                addr_addr4=row["addr_addr4"],
                addr_phone=row["addr_phone"],
                addr_fax=row["addr_fax"],
                addr_email=row["addr_email"],
                terms_guid=normalize_optional_guid(row["terms"], field="vendors.terms"),
                tax_inc=row["tax_inc"],
                tax_table_guid=normalize_optional_guid(row["tax_table"], field="vendors.tax_table"),
            )
        )
    return vendors


def read_source_invoices(conn: psycopg.Connection, schema: str) -> list[SourceInvoice]:
    query = sql.SQL(
        """
        SELECT
            guid,
            id,
            date_opened,
            date_posted,
            notes,
            active,
            currency,
            owner_type,
            owner_guid,
            terms,
            billing_id,
            post_txn,
            post_lot,
            post_acc,
            billto_type,
            billto_guid,
            charge_amt_num,
            charge_amt_denom
        FROM {}.invoices
        ORDER BY guid ASC
        """
    ).format(sql.Identifier(schema))
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(query)
            rows = cur.fetchall()
    except UndefinedTable:
        warn(f"table {schema}.invoices does not exist; skipping invoices import")
        return []

    invoices: list[SourceInvoice] = []
    for row in rows:
        invoices.append(
            SourceInvoice(
                guid=normalize_guid(row["guid"], field="invoices.guid"),
                invoice_id=str(row["id"]),
                date_opened=row["date_opened"],
                date_posted=row["date_posted"],
                notes=str(row["notes"]),
                active=as_bool(row["active"]),
                currency_guid=normalize_guid(row["currency"], field="invoices.currency"),
                owner_type_raw=normalize_optional_int(row["owner_type"]),
                owner_guid=normalize_optional_guid(row["owner_guid"], field="invoices.owner_guid"),
                terms_guid=normalize_optional_guid(row["terms"], field="invoices.terms"),
                billing_id=row["billing_id"],
                post_txn=normalize_optional_guid(row["post_txn"], field="invoices.post_txn"),
                post_lot=normalize_optional_guid(row["post_lot"], field="invoices.post_lot"),
                post_acc=normalize_optional_guid(row["post_acc"], field="invoices.post_acc"),
                billto_type=normalize_optional_int(row["billto_type"]),
                billto_guid=normalize_optional_guid(row["billto_guid"], field="invoices.billto_guid"),
                charge_amt_num=normalize_optional_int(row["charge_amt_num"]),
                charge_amt_denom=normalize_optional_int(row["charge_amt_denom"]),
            )
        )
    return invoices


def read_source_entries(conn: psycopg.Connection, schema: str) -> list[SourceEntry]:
    query = sql.SQL(
        """
        SELECT
            guid,
            date,
            date_entered,
            description,
            action,
            notes,
            quantity_num,
            quantity_denom,
            i_acct,
            i_price_num,
            i_price_denom,
            i_discount_num,
            i_discount_denom,
            invoice,
            i_disc_type,
            i_disc_how,
            i_taxable,
            i_taxincluded,
            i_taxtable,
            b_paytype,
            billable,
            billto_type,
            billto_guid,
            b_acct,
            b_price_num,
            b_price_denom,
            bill,
            b_taxable,
            b_taxincluded,
            b_taxtable
        FROM {}.entries
        ORDER BY guid ASC
        """
    ).format(sql.Identifier(schema))
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(query)
            rows = cur.fetchall()
    except UndefinedTable:
        warn(f"table {schema}.entries does not exist; skipping entries import")
        return []

    entries: list[SourceEntry] = []
    for row in rows:
        if row["date"] is None:
            warn(f"entry {row['guid']} has null date and will be skipped")
            continue

        entries.append(
            SourceEntry(
                guid=normalize_guid(row["guid"], field="entries.guid"),
                date=row["date"],
                date_entered=row["date_entered"],
                description=row["description"],
                action=row["action"],
                notes=row["notes"],
                quantity_num=int(row["quantity_num"] or 0),
                quantity_denom=int(row["quantity_denom"] or 1),
                i_acct=normalize_optional_guid(row["i_acct"], field="entries.i_acct"),
                i_price_num=int(row["i_price_num"] or 0),
                i_price_denom=int(row["i_price_denom"] or 1),
                i_discount_num=int(row["i_discount_num"] or 0),
                i_discount_denom=int(row["i_discount_denom"] or 1),
                invoice_guid=normalize_optional_guid(row["invoice"], field="entries.invoice"),
                i_disc_type=row["i_disc_type"],
                i_disc_how=row["i_disc_how"],
                i_taxable=as_bool(row["i_taxable"]),
                i_taxincluded=as_bool(row["i_taxincluded"]),
                i_taxtable=normalize_optional_guid(row["i_taxtable"], field="entries.i_taxtable"),
                b_paytype=normalize_optional_int(row["b_paytype"]),
                billable=as_bool(row["billable"]) if row["billable"] is not None else None,
                billto_type=normalize_optional_int(row["billto_type"]),
                billto_guid=normalize_optional_guid(row["billto_guid"], field="entries.billto_guid"),
                b_acct=normalize_optional_guid(row["b_acct"], field="entries.b_acct"),
                b_price_num=int(row["b_price_num"] or 0),
                b_price_denom=int(row["b_price_denom"] or 1),
                bill_guid=normalize_optional_guid(row["bill"], field="entries.bill"),
                b_taxable=as_bool(row["b_taxable"]),
                b_taxincluded=as_bool(row["b_taxincluded"]),
                b_taxtable=normalize_optional_guid(row["b_taxtable"], field="entries.b_taxtable"),
            )
        )
    return entries


def read_source_transactions(conn: psycopg.Connection, schema: str) -> list[SourceTransaction]:
    query = sql.SQL(
        """
        SELECT
            guid,
            currency_guid,
            num,
            post_date,
            enter_date,
            description
        FROM {}.transactions
        ORDER BY guid ASC
        """
    ).format(sql.Identifier(schema))
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(query)
            rows = cur.fetchall()
    except UndefinedTable:
        warn(f"table {schema}.transactions does not exist; skipping transactions import")
        return []

    return [
        SourceTransaction(
            guid=normalize_guid(row["guid"], field="transactions.guid"),
            currency_guid=normalize_guid(row["currency_guid"], field="transactions.currency_guid"),
            num=str(row["num"]),
            post_date=row["post_date"],
            enter_date=row["enter_date"],
            description=row["description"],
        )
        for row in rows
    ]


def read_source_splits(conn: psycopg.Connection, schema: str) -> list[SourceSplit]:
    query = sql.SQL(
        """
        SELECT
            guid,
            tx_guid,
            account_guid,
            memo,
            action,
            reconcile_state,
            reconcile_date,
            value_num,
            value_denom,
            quantity_num,
            quantity_denom,
            lot_guid
        FROM {}.splits
        ORDER BY guid ASC
        """
    ).format(sql.Identifier(schema))
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(query)
            rows = cur.fetchall()
    except UndefinedTable:
        warn(f"table {schema}.splits does not exist; skipping splits import")
        return []

    return [
        SourceSplit(
            guid=normalize_guid(row["guid"], field="splits.guid"),
            tx_guid=normalize_guid(row["tx_guid"], field="splits.tx_guid"),
            account_guid=normalize_guid(row["account_guid"], field="splits.account_guid"),
            memo=str(row["memo"] or ""),
            action=str(row["action"] or ""),
            reconcile_state=(str(row["reconcile_state"] or "n")[:1] or "n"),
            reconcile_date=row["reconcile_date"],
            value_num=int(row["value_num"] or 0),
            value_denom=int(row["value_denom"] or 1),
            quantity_num=int(row["quantity_num"] or 0),
            quantity_denom=int(row["quantity_denom"] or 1),
            lot_guid=normalize_optional_guid(row["lot_guid"], field="splits.lot_guid"),
        )
        for row in rows
    ]


def read_source_lots(conn: psycopg.Connection, schema: str) -> list[SourceLot]:
    query = sql.SQL(
        """
        SELECT
            guid,
            account_guid,
            is_closed
        FROM {}.lots
        ORDER BY guid ASC
        """
    ).format(sql.Identifier(schema))
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(query)
            rows = cur.fetchall()
    except UndefinedTable:
        warn(f"table {schema}.lots does not exist; skipping lots import")
        return []

    return [
        SourceLot(
            guid=normalize_guid(row["guid"], field="lots.guid"),
            account_guid=normalize_optional_guid(row["account_guid"], field="lots.account_guid"),
            is_closed=as_bool(row["is_closed"]),
        )
        for row in rows
    ]


def normalize_positive(value: int, *, field: str, entity_id: str) -> int:
    if value > 0:
        return value
    warn(f"{field} for {entity_id} is <= 0; coerced to 1")
    return 1


def resolve_business_book_id(source_books: list[SourceBook], explicit_book_id: str | None) -> str:
    if explicit_book_id:
        return normalize_guid(explicit_book_id, field="--business-book-id")
    if len(source_books) == 1:
        return source_books[0].id
    raise ValueError(
        "multiple books found in source; specify --business-book-id for customers/vendors"
    )


def resolve_invoice_owner_type(owner_type_raw: int | None, owner_guid: str | None, *, customer_ids: set[str], vendor_ids: set[str]) -> str:
    if owner_type_raw == 2:
        return "CUSTOMER"
    if owner_type_raw == 4:
        return "VENDOR"

    if owner_guid and owner_guid in customer_ids:
        return "CUSTOMER"
    if owner_guid and owner_guid in vendor_ids:
        return "VENDOR"

    warn(
        f"invoice owner_type {owner_type_raw!r} with owner_guid={owner_guid!r} "
        "is unknown; defaulting to CUSTOMER"
    )
    return "CUSTOMER"


def map_account_to_book(accounts: list[SourceAccount], books: list[SourceBook]) -> dict[str, str]:
    account_by_id = {account.id: account for account in accounts}
    children_by_parent: dict[str, list[str]] = defaultdict(list)
    for account in accounts:
        if account.parent_id:
            children_by_parent[account.parent_id].append(account.id)

    account_book: dict[str, str] = {}
    for book in books:
        for root_id in (book.root_account_id, book.root_template_id):
            if root_id not in account_by_id:
                warn(f"book {book.id} points to missing root account {root_id}")
                continue

            stack = [root_id]
            while stack:
                current = stack.pop()
                assigned_book = account_book.get(current)
                if assigned_book is not None and assigned_book != book.id:
                    raise RuntimeError(
                        f"account {current} appears in multiple books ({assigned_book}, {book.id})"
                    )
                if assigned_book == book.id:
                    continue

                account_book[current] = book.id
                stack.extend(children_by_parent.get(current, []))

    unassigned = [account.id for account in accounts if account.id not in account_book]
    if not unassigned:
        return account_book

    if len(books) == 1:
        fallback_book = books[0].id
        for account_id in unassigned:
            account_book[account_id] = fallback_book
        warn(f"{len(unassigned)} accounts had no reachable root and were assigned to book {fallback_book}")
        return account_book

    sample = ", ".join(unassigned[:10])
    raise RuntimeError(
        f"{len(unassigned)} accounts could not be assigned to any book. "
        f"Sample IDs: {sample}"
    )


def map_account_type(raw_type: str, fallback: str | None) -> str:
    mapped = ACCOUNT_TYPE_MAP.get(raw_type)
    if mapped is not None:
        return mapped
    if fallback is not None:
        warn(f"unknown account type {raw_type!r}; using fallback {fallback}")
        return fallback
    raise ValueError(
        f"unsupported account type {raw_type!r}. "
        "Use --unknown-type-fallback to force a type."
    )


def sync_commodities(
    conn: psycopg.Connection,
    source_commodities: list[SourceCommodity],
    *,
    dry_run: bool,
) -> tuple[dict[str, str], SyncStats]:
    stats = SyncStats()
    truncation: dict[str, int] = {}
    source_to_target: dict[str, str] = {}

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT id, namespace, mnemonic FROM commodities")
        target_rows = cur.fetchall()

        by_id = {row["id"]: row for row in target_rows}
        by_key = {(row["namespace"], row["mnemonic"]): row["id"] for row in target_rows}

        for item in source_commodities:
            namespace = clip_text(item.namespace, 32, field="commodities.namespace", entity_id=item.id, tracker=truncation)
            mnemonic = clip_text(item.mnemonic, 16, field="commodities.mnemonic", entity_id=item.id, tracker=truncation)
            fullname = clip_text(item.fullname, 128, field="commodities.fullname", entity_id=item.id, tracker=truncation)
            key = (namespace, mnemonic)

            if item.id in by_id:
                source_to_target[item.id] = item.id
                stats.updated += 1
                if not dry_run:
                    cur.execute(
                        """
                        UPDATE commodities
                        SET namespace = %s,
                            mnemonic = %s,
                            fullname = %s,
                            fraction = %s,
                            quote = %s
                        WHERE id = %s
                        """,
                        (namespace, mnemonic, fullname, item.fraction, item.quote, item.id),
                    )
                continue

            if key in by_key:
                existing_id = by_key[key]
                source_to_target[item.id] = existing_id
                stats.reused += 1
                if not dry_run:
                    cur.execute(
                        """
                        UPDATE commodities
                        SET fullname = %s,
                            fraction = %s,
                            quote = %s
                        WHERE id = %s
                        """,
                        (fullname, item.fraction, item.quote, existing_id),
                    )
                continue

            source_to_target[item.id] = item.id
            stats.inserted += 1
            by_key[key] = item.id
            if not dry_run:
                cur.execute(
                    """
                    INSERT INTO commodities (id, namespace, mnemonic, fullname, fraction, quote)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (item.id, namespace, mnemonic, fullname, item.fraction, item.quote),
                )

    return source_to_target, stats


def build_book_name(book: SourceBook, account_lookup: dict[str, SourceAccount], tracker: dict[str, int]) -> str:
    root = account_lookup.get(book.root_account_id)
    if root and root.name.strip():
        return clip_text(
            f"GnuCash - {root.name.strip()}",
            120,
            field="books.name",
            entity_id=book.id,
            tracker=tracker,
        ) or f"GnuCash - {book.id[:8]}"
    return f"GnuCash - {book.id[:8]}"


def sync_books(
    conn: psycopg.Connection,
    source_books: list[SourceBook],
    accounts: list[SourceAccount],
    *,
    dry_run: bool,
) -> SyncStats:
    stats = SyncStats()
    now = datetime.now(UTC)
    truncation: dict[str, int] = {}
    account_lookup = {account.id: account for account in accounts}
    imported_ids: list[str] = []

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT id, name FROM books")
        current_books = {row["id"]: row["name"] for row in cur.fetchall()}

        for book in source_books:
            imported_ids.append(book.id)
            if book.id in current_books:
                stats.updated += 1
                if current_books[book.id]:
                    continue
                generated_name = build_book_name(book, account_lookup, truncation)
                if not dry_run:
                    cur.execute("UPDATE books SET name = %s WHERE id = %s", (generated_name, book.id))
                continue

            stats.inserted += 1
            generated_name = build_book_name(book, account_lookup, truncation)
            if not dry_run:
                cur.execute(
                    """
                    INSERT INTO books (id, name, is_active, created_at)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (book.id, generated_name, False, now),
                )

        cur.execute(
            """
            SELECT id
            FROM books
            WHERE is_active IS TRUE
            ORDER BY created_at ASC, id ASC
            LIMIT 1
            """
        )
        active = cur.fetchone()
        if active is None and imported_ids:
            chosen = imported_ids[0]
            if not dry_run:
                cur.execute("UPDATE books SET is_active = FALSE WHERE is_active IS TRUE")
                cur.execute("UPDATE books SET is_active = TRUE WHERE id = %s", (chosen,))
            warn(f"no active book found; set imported book {chosen} as active")

    return stats


def prepare_accounts(
    source_accounts: list[SourceAccount],
    account_book_map: dict[str, str],
    commodity_id_map: dict[str, str],
    *,
    unknown_type_fallback: str | None,
) -> list[PreparedAccount]:
    truncation: dict[str, int] = {}
    prepared: list[PreparedAccount] = []
    book_default_commodity: dict[str, str] = {}

    for source in source_accounts:
        source_book_id = account_book_map[source.id]
        if source.commodity_id and source_book_id not in book_default_commodity:
            book_default_commodity[source_book_id] = source.commodity_id

    for source in source_accounts:
        source_book_id = account_book_map[source.id]
        resolved_commodity_id = source.commodity_id
        if resolved_commodity_id is None:
            if source.account_type != "ROOT":
                raise RuntimeError(f"account {source.id} has null commodity_guid")
            resolved_commodity_id = book_default_commodity.get(source_book_id)
            if resolved_commodity_id is None:
                raise RuntimeError(
                    f"ROOT account {source.id} has null commodity_guid and no fallback commodity in book {source_book_id}"
                )
            warn(
                f"ROOT account {source.id} has null commodity_guid; "
                f"using fallback commodity {resolved_commodity_id} from book {source_book_id}"
            )

        target_commodity_id = commodity_id_map.get(resolved_commodity_id)
        if target_commodity_id is None:
            raise RuntimeError(
                f"account {source.id} references unknown commodity {resolved_commodity_id}"
            )

        mapped_type = map_account_type(source.account_type, unknown_type_fallback)
        parent_id = source.parent_id
        if mapped_type == "ROOT":
            parent_id = None

        name = clip_text(source.name, 120, field="accounts.name", entity_id=source.id, tracker=truncation)
        code = clip_text(source.code, 64, field="accounts.code", entity_id=source.id, tracker=truncation)
        description = clip_text(
            source.description, 255, field="accounts.description", entity_id=source.id, tracker=truncation
        )

        prepared.append(
            PreparedAccount(
                id=source.id,
                book_id=source_book_id,
                parent_id=parent_id,
                name=name or "",
                code=code,
                description=description,
                account_type=mapped_type,
                commodity_id=target_commodity_id,
                is_placeholder=source.is_placeholder or mapped_type == "ROOT",
            )
        )

    return prepared


def sync_accounts(conn: psycopg.Connection, prepared_accounts: list[PreparedAccount], *, dry_run: bool) -> SyncStats:
    stats = SyncStats()
    pending = {account.id: account for account in prepared_accounts}
    now = datetime.now(UTC)

    with conn.cursor() as cur:
        cur.execute("SELECT id FROM accounts")
        existing_ids = {row[0] for row in cur.fetchall()}
        known_ids = set(existing_ids)

        while pending:
            progressed = False
            for account_id in list(pending.keys()):
                account = pending[account_id]
                if account.parent_id and account.parent_id not in known_ids:
                    continue

                if account.id in existing_ids:
                    stats.updated += 1
                else:
                    stats.inserted += 1

                if not dry_run:
                    cur.execute(
                        """
                        INSERT INTO accounts (
                            id,
                            book_id,
                            parent_id,
                            name,
                            code,
                            description,
                            type,
                            commodity_id,
                            is_placeholder,
                            created_at,
                            updated_at
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (id) DO UPDATE SET
                            book_id = EXCLUDED.book_id,
                            parent_id = EXCLUDED.parent_id,
                            name = EXCLUDED.name,
                            code = EXCLUDED.code,
                            description = EXCLUDED.description,
                            type = EXCLUDED.type,
                            commodity_id = EXCLUDED.commodity_id,
                            is_placeholder = EXCLUDED.is_placeholder,
                            updated_at = EXCLUDED.updated_at
                        """,
                        (
                            account.id,
                            account.book_id,
                            account.parent_id,
                            account.name,
                            account.code,
                            account.description,
                            account.account_type,
                            account.commodity_id,
                            account.is_placeholder,
                            now,
                            now,
                        ),
                    )

                known_ids.add(account.id)
                pending.pop(account_id)
                progressed = True

            if progressed:
                continue

            missing_parents: list[str] = []
            for account in pending.values():
                if account.parent_id and account.parent_id not in known_ids:
                    missing_parents.append(account.parent_id)
            sample = ", ".join(sorted(set(missing_parents))[:10])
            raise RuntimeError(
                "unable to resolve account hierarchy; missing parents in target/source. "
                f"Sample parent IDs: {sample}"
            )

    return stats


def sync_customers(
    conn: psycopg.Connection,
    source_customers: list[SourceCustomer],
    commodity_id_map: dict[str, str],
    *,
    book_id: str,
    dry_run: bool,
) -> SyncStats:
    stats = SyncStats()
    now = datetime.now(UTC)
    truncation: dict[str, int] = {}

    with conn.cursor() as cur:
        cur.execute("SELECT guid FROM customers")
        existing_ids = {row[0] for row in cur.fetchall()}

        for item in source_customers:
            currency_guid = commodity_id_map.get(item.currency_guid)
            if currency_guid is None:
                raise RuntimeError(
                    f"customer {item.guid} references unknown currency commodity {item.currency_guid}"
                )

            if item.guid in existing_ids:
                stats.updated += 1
            else:
                stats.inserted += 1

            discount_denom = normalize_positive(
                item.discount_denom, field="customers.discount_denom", entity_id=item.guid
            )
            credit_denom = normalize_positive(
                item.credit_denom, field="customers.credit_denom", entity_id=item.guid
            )

            name = clip_text(item.name, 2048, field="customers.name", entity_id=item.guid, tracker=truncation) or ""
            customer_id = clip_text(
                item.customer_id, 2048, field="customers.id", entity_id=item.guid, tracker=truncation
            ) or ""
            notes = clip_text(item.notes, 2048, field="customers.notes", entity_id=item.guid, tracker=truncation) or ""

            values = (
                item.guid,
                book_id,
                name,
                customer_id,
                notes,
                item.active,
                item.discount_num,
                discount_denom,
                item.credit_num,
                credit_denom,
                currency_guid,
                item.tax_override,
                clip_text(item.addr_name, 1024, field="customers.addr_name", entity_id=item.guid, tracker=truncation),
                clip_text(item.addr_addr1, 1024, field="customers.addr_addr1", entity_id=item.guid, tracker=truncation),
                clip_text(item.addr_addr2, 1024, field="customers.addr_addr2", entity_id=item.guid, tracker=truncation),
                clip_text(item.addr_addr3, 1024, field="customers.addr_addr3", entity_id=item.guid, tracker=truncation),
                clip_text(item.addr_addr4, 1024, field="customers.addr_addr4", entity_id=item.guid, tracker=truncation),
                clip_text(item.addr_phone, 128, field="customers.addr_phone", entity_id=item.guid, tracker=truncation),
                clip_text(item.addr_fax, 128, field="customers.addr_fax", entity_id=item.guid, tracker=truncation),
                clip_text(item.addr_email, 256, field="customers.addr_email", entity_id=item.guid, tracker=truncation),
                clip_text(
                    item.shipaddr_name, 1024, field="customers.shipaddr_name", entity_id=item.guid, tracker=truncation
                ),
                clip_text(
                    item.shipaddr_addr1, 1024, field="customers.shipaddr_addr1", entity_id=item.guid, tracker=truncation
                ),
                clip_text(
                    item.shipaddr_addr2, 1024, field="customers.shipaddr_addr2", entity_id=item.guid, tracker=truncation
                ),
                clip_text(
                    item.shipaddr_addr3, 1024, field="customers.shipaddr_addr3", entity_id=item.guid, tracker=truncation
                ),
                clip_text(
                    item.shipaddr_addr4, 1024, field="customers.shipaddr_addr4", entity_id=item.guid, tracker=truncation
                ),
                clip_text(
                    item.shipaddr_phone, 128, field="customers.shipaddr_phone", entity_id=item.guid, tracker=truncation
                ),
                clip_text(
                    item.shipaddr_fax, 128, field="customers.shipaddr_fax", entity_id=item.guid, tracker=truncation
                ),
                clip_text(
                    item.shipaddr_email, 256, field="customers.shipaddr_email", entity_id=item.guid, tracker=truncation
                ),
                item.terms_guid,
                item.tax_included,
                item.taxtable_guid,
                now,
                now,
            )

            if not dry_run:
                cur.execute(
                    """
                    INSERT INTO customers (
                        guid,
                        book_id,
                        name,
                        id,
                        notes,
                        active,
                        discount_num,
                        discount_denom,
                        credit_num,
                        credit_denom,
                        currency_guid,
                        tax_override,
                        addr_name,
                        addr_addr1,
                        addr_addr2,
                        addr_addr3,
                        addr_addr4,
                        addr_phone,
                        addr_fax,
                        addr_email,
                        shipaddr_name,
                        shipaddr_addr1,
                        shipaddr_addr2,
                        shipaddr_addr3,
                        shipaddr_addr4,
                        shipaddr_phone,
                        shipaddr_fax,
                        shipaddr_email,
                        terms_guid,
                        tax_included,
                        taxtable_guid,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    )
                    ON CONFLICT (guid) DO UPDATE SET
                        book_id = EXCLUDED.book_id,
                        name = EXCLUDED.name,
                        id = EXCLUDED.id,
                        notes = EXCLUDED.notes,
                        active = EXCLUDED.active,
                        discount_num = EXCLUDED.discount_num,
                        discount_denom = EXCLUDED.discount_denom,
                        credit_num = EXCLUDED.credit_num,
                        credit_denom = EXCLUDED.credit_denom,
                        currency_guid = EXCLUDED.currency_guid,
                        tax_override = EXCLUDED.tax_override,
                        addr_name = EXCLUDED.addr_name,
                        addr_addr1 = EXCLUDED.addr_addr1,
                        addr_addr2 = EXCLUDED.addr_addr2,
                        addr_addr3 = EXCLUDED.addr_addr3,
                        addr_addr4 = EXCLUDED.addr_addr4,
                        addr_phone = EXCLUDED.addr_phone,
                        addr_fax = EXCLUDED.addr_fax,
                        addr_email = EXCLUDED.addr_email,
                        shipaddr_name = EXCLUDED.shipaddr_name,
                        shipaddr_addr1 = EXCLUDED.shipaddr_addr1,
                        shipaddr_addr2 = EXCLUDED.shipaddr_addr2,
                        shipaddr_addr3 = EXCLUDED.shipaddr_addr3,
                        shipaddr_addr4 = EXCLUDED.shipaddr_addr4,
                        shipaddr_phone = EXCLUDED.shipaddr_phone,
                        shipaddr_fax = EXCLUDED.shipaddr_fax,
                        shipaddr_email = EXCLUDED.shipaddr_email,
                        terms_guid = EXCLUDED.terms_guid,
                        tax_included = EXCLUDED.tax_included,
                        taxtable_guid = EXCLUDED.taxtable_guid,
                        updated_at = EXCLUDED.updated_at
                    """,
                    values,
                )

    return stats


def sync_vendors(
    conn: psycopg.Connection,
    source_vendors: list[SourceVendor],
    commodity_id_map: dict[str, str],
    *,
    book_id: str,
    dry_run: bool,
) -> SyncStats:
    stats = SyncStats()
    now = datetime.now(UTC)
    truncation: dict[str, int] = {}

    with conn.cursor() as cur:
        cur.execute("SELECT guid FROM vendors")
        existing_ids = {row[0] for row in cur.fetchall()}

        for item in source_vendors:
            currency_guid = commodity_id_map.get(item.currency_guid)
            if currency_guid is None:
                raise RuntimeError(
                    f"vendor {item.guid} references unknown currency commodity {item.currency_guid}"
                )

            if item.guid in existing_ids:
                stats.updated += 1
            else:
                stats.inserted += 1

            name = clip_text(item.name, 2048, field="vendors.name", entity_id=item.guid, tracker=truncation) or ""
            vendor_id = clip_text(item.vendor_id, 2048, field="vendors.id", entity_id=item.guid, tracker=truncation) or ""
            notes = clip_text(item.notes, 2048, field="vendors.notes", entity_id=item.guid, tracker=truncation) or ""

            values = (
                item.guid,
                book_id,
                name,
                vendor_id,
                notes,
                currency_guid,
                item.active,
                item.tax_override,
                clip_text(item.addr_name, 1024, field="vendors.addr_name", entity_id=item.guid, tracker=truncation),
                clip_text(item.addr_addr1, 1024, field="vendors.addr_addr1", entity_id=item.guid, tracker=truncation),
                clip_text(item.addr_addr2, 1024, field="vendors.addr_addr2", entity_id=item.guid, tracker=truncation),
                clip_text(item.addr_addr3, 1024, field="vendors.addr_addr3", entity_id=item.guid, tracker=truncation),
                clip_text(item.addr_addr4, 1024, field="vendors.addr_addr4", entity_id=item.guid, tracker=truncation),
                clip_text(item.addr_phone, 128, field="vendors.addr_phone", entity_id=item.guid, tracker=truncation),
                clip_text(item.addr_fax, 128, field="vendors.addr_fax", entity_id=item.guid, tracker=truncation),
                clip_text(item.addr_email, 256, field="vendors.addr_email", entity_id=item.guid, tracker=truncation),
                item.terms_guid,
                clip_text(item.tax_inc, 2048, field="vendors.tax_inc", entity_id=item.guid, tracker=truncation),
                item.tax_table_guid,
                now,
                now,
            )

            if not dry_run:
                cur.execute(
                    """
                    INSERT INTO vendors (
                        guid,
                        book_id,
                        name,
                        id,
                        notes,
                        currency_guid,
                        active,
                        tax_override,
                        addr_name,
                        addr_addr1,
                        addr_addr2,
                        addr_addr3,
                        addr_addr4,
                        addr_phone,
                        addr_fax,
                        addr_email,
                        terms_guid,
                        tax_inc,
                        tax_table_guid,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    )
                    ON CONFLICT (guid) DO UPDATE SET
                        book_id = EXCLUDED.book_id,
                        name = EXCLUDED.name,
                        id = EXCLUDED.id,
                        notes = EXCLUDED.notes,
                        currency_guid = EXCLUDED.currency_guid,
                        active = EXCLUDED.active,
                        tax_override = EXCLUDED.tax_override,
                        addr_name = EXCLUDED.addr_name,
                        addr_addr1 = EXCLUDED.addr_addr1,
                        addr_addr2 = EXCLUDED.addr_addr2,
                        addr_addr3 = EXCLUDED.addr_addr3,
                        addr_addr4 = EXCLUDED.addr_addr4,
                        addr_phone = EXCLUDED.addr_phone,
                        addr_fax = EXCLUDED.addr_fax,
                        addr_email = EXCLUDED.addr_email,
                        terms_guid = EXCLUDED.terms_guid,
                        tax_inc = EXCLUDED.tax_inc,
                        tax_table_guid = EXCLUDED.tax_table_guid,
                        updated_at = EXCLUDED.updated_at
                    """,
                    values,
                )

    return stats


def sync_transactions(
    conn: psycopg.Connection,
    source_transactions: list[SourceTransaction],
    commodity_id_map: dict[str, str],
    *,
    dry_run: bool,
) -> tuple[SyncStats, set[str]]:
    stats = SyncStats()
    truncation: dict[str, int] = {}

    with conn.cursor() as cur:
        cur.execute("SELECT guid FROM transactions")
        existing_ids = {row[0] for row in cur.fetchall()}
        known_ids = set(existing_ids)

        for item in source_transactions:
            currency_guid = commodity_id_map.get(item.currency_guid)
            if currency_guid is None:
                raise RuntimeError(
                    f"transaction {item.guid} references unknown commodity {item.currency_guid}"
                )

            if item.guid in existing_ids:
                stats.updated += 1
            else:
                stats.inserted += 1

            num = clip_text(item.num, 2048, field="transactions.num", entity_id=item.guid, tracker=truncation) or ""
            description = clip_text(
                item.description, 2048, field="transactions.description", entity_id=item.guid, tracker=truncation
            )

            if not dry_run:
                cur.execute(
                    """
                    INSERT INTO transactions (
                        guid,
                        currency_guid,
                        num,
                        post_date,
                        enter_date,
                        description
                    )
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (guid) DO UPDATE SET
                        currency_guid = EXCLUDED.currency_guid,
                        num = EXCLUDED.num,
                        post_date = EXCLUDED.post_date,
                        enter_date = EXCLUDED.enter_date,
                        description = EXCLUDED.description
                    """,
                    (
                        item.guid,
                        currency_guid,
                        num,
                        item.post_date,
                        item.enter_date,
                        description,
                    ),
                )
            known_ids.add(item.guid)

    return stats, known_ids


def sync_invoices(
    conn: psycopg.Connection,
    source_invoices: list[SourceInvoice],
    commodity_id_map: dict[str, str],
    account_book_map: dict[str, str],
    *,
    business_book_id: str,
    customer_ids: set[str],
    vendor_ids: set[str],
    dry_run: bool,
) -> tuple[SyncStats, set[str]]:
    stats = SyncStats()
    now = datetime.now(UTC)
    truncation: dict[str, int] = {}

    with conn.cursor() as cur:
        cur.execute("SELECT guid FROM invoices")
        existing_ids = {row[0] for row in cur.fetchall()}
        known_ids = set(existing_ids)

        for item in source_invoices:
            currency_guid = commodity_id_map.get(item.currency_guid)
            if currency_guid is None:
                raise RuntimeError(
                    f"invoice {item.guid} references unknown currency commodity {item.currency_guid}"
                )

            if item.owner_guid is None:
                warn(f"invoice {item.guid} has null owner_guid and will be skipped")
                continue

            owner_type = resolve_invoice_owner_type(
                item.owner_type_raw,
                item.owner_guid,
                customer_ids=customer_ids,
                vendor_ids=vendor_ids,
            )

            book_id = business_book_id
            if item.post_acc and item.post_acc in account_book_map:
                book_id = account_book_map[item.post_acc]
            elif item.post_acc:
                warn(
                    f"invoice {item.guid} references post_acc {item.post_acc} outside imported accounts; "
                    f"using fallback book {business_book_id}"
                )

            if item.guid in existing_ids:
                stats.updated += 1
            else:
                stats.inserted += 1

            invoice_id = clip_text(item.invoice_id, 2048, field="invoices.id", entity_id=item.guid, tracker=truncation) or ""
            notes = clip_text(item.notes, 2048, field="invoices.notes", entity_id=item.guid, tracker=truncation) or ""
            billing_id = clip_text(
                item.billing_id, 2048, field="invoices.billing_id", entity_id=item.guid, tracker=truncation
            )

            if not dry_run:
                cur.execute(
                    """
                    INSERT INTO invoices (
                        guid,
                        book_id,
                        id,
                        invoice_type,
                        date_opened,
                        date_posted,
                        notes,
                        active,
                        currency_guid,
                        owner_type,
                        owner_guid,
                        terms,
                        billing_id,
                        post_txn,
                        post_lot,
                        post_acc,
                        billto_type,
                        billto_guid,
                        charge_amt_num,
                        charge_amt_denom,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    )
                    ON CONFLICT (guid) DO UPDATE SET
                        book_id = EXCLUDED.book_id,
                        id = EXCLUDED.id,
                        invoice_type = EXCLUDED.invoice_type,
                        date_opened = EXCLUDED.date_opened,
                        date_posted = EXCLUDED.date_posted,
                        notes = EXCLUDED.notes,
                        active = EXCLUDED.active,
                        currency_guid = EXCLUDED.currency_guid,
                        owner_type = EXCLUDED.owner_type,
                        owner_guid = EXCLUDED.owner_guid,
                        terms = EXCLUDED.terms,
                        billing_id = EXCLUDED.billing_id,
                        post_txn = EXCLUDED.post_txn,
                        post_lot = EXCLUDED.post_lot,
                        post_acc = EXCLUDED.post_acc,
                        billto_type = EXCLUDED.billto_type,
                        billto_guid = EXCLUDED.billto_guid,
                        charge_amt_num = EXCLUDED.charge_amt_num,
                        charge_amt_denom = EXCLUDED.charge_amt_denom,
                        updated_at = EXCLUDED.updated_at
                    """,
                    (
                        item.guid,
                        book_id,
                        invoice_id,
                        "INVOICE",
                        item.date_opened,
                        item.date_posted,
                        notes,
                        item.active,
                        currency_guid,
                        owner_type,
                        item.owner_guid,
                        item.terms_guid,
                        billing_id,
                        item.post_txn,
                        item.post_lot,
                        item.post_acc,
                        item.billto_type,
                        item.billto_guid,
                        item.charge_amt_num,
                        item.charge_amt_denom,
                        now,
                        now,
                    ),
                )
            known_ids.add(item.guid)

    return stats, known_ids


def sync_lots(
    conn: psycopg.Connection,
    source_lots: list[SourceLot],
    *,
    known_account_ids: set[str],
    dry_run: bool,
) -> tuple[SyncStats, set[str]]:
    stats = SyncStats()

    with conn.cursor() as cur:
        cur.execute("SELECT guid FROM lots")
        existing_ids = {row[0] for row in cur.fetchall()}
        known_lot_ids = set(existing_ids)

        for item in source_lots:
            if item.account_guid is None:
                warn(f"lot {item.guid} has null account_guid and will be skipped")
                continue
            if item.account_guid not in known_account_ids:
                warn(f"lot {item.guid} references unknown account {item.account_guid} and will be skipped")
                continue

            if item.guid in existing_ids:
                stats.updated += 1
            else:
                stats.inserted += 1

            if not dry_run:
                cur.execute(
                    """
                    INSERT INTO lots (guid, account_guid, is_closed)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (guid) DO UPDATE SET
                        account_guid = EXCLUDED.account_guid,
                        is_closed = EXCLUDED.is_closed
                    """,
                    (item.guid, item.account_guid, item.is_closed),
                )
            known_lot_ids.add(item.guid)

    return stats, known_lot_ids


def sync_splits(
    conn: psycopg.Connection,
    source_splits: list[SourceSplit],
    *,
    known_transaction_ids: set[str],
    known_account_ids: set[str],
    dry_run: bool,
) -> SyncStats:
    stats = SyncStats()
    truncation: dict[str, int] = {}

    with conn.cursor() as cur:
        cur.execute("SELECT guid FROM splits")
        existing_ids = {row[0] for row in cur.fetchall()}

        for item in source_splits:
            if item.tx_guid not in known_transaction_ids:
                warn(f"split {item.guid} references unknown transaction {item.tx_guid} and will be skipped")
                continue
            if item.account_guid not in known_account_ids:
                warn(f"split {item.guid} references unknown account {item.account_guid} and will be skipped")
                continue

            if item.guid in existing_ids:
                stats.updated += 1
            else:
                stats.inserted += 1

            memo = clip_text(item.memo, 2048, field="splits.memo", entity_id=item.guid, tracker=truncation) or ""
            action = clip_text(item.action, 2048, field="splits.action", entity_id=item.guid, tracker=truncation) or ""
            reconcile_state = (item.reconcile_state[:1] or "n")
            value_denom = normalize_positive(item.value_denom, field="splits.value_denom", entity_id=item.guid)
            quantity_denom = normalize_positive(
                item.quantity_denom, field="splits.quantity_denom", entity_id=item.guid
            )

            if not dry_run:
                cur.execute(
                    """
                    INSERT INTO splits (
                        guid,
                        tx_guid,
                        account_guid,
                        memo,
                        action,
                        reconcile_state,
                        reconcile_date,
                        value_num,
                        value_denom,
                        quantity_num,
                        quantity_denom,
                        lot_guid
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (guid) DO UPDATE SET
                        tx_guid = EXCLUDED.tx_guid,
                        account_guid = EXCLUDED.account_guid,
                        memo = EXCLUDED.memo,
                        action = EXCLUDED.action,
                        reconcile_state = EXCLUDED.reconcile_state,
                        reconcile_date = EXCLUDED.reconcile_date,
                        value_num = EXCLUDED.value_num,
                        value_denom = EXCLUDED.value_denom,
                        quantity_num = EXCLUDED.quantity_num,
                        quantity_denom = EXCLUDED.quantity_denom,
                        lot_guid = EXCLUDED.lot_guid
                    """,
                    (
                        item.guid,
                        item.tx_guid,
                        item.account_guid,
                        memo,
                        action,
                        reconcile_state,
                        item.reconcile_date,
                        item.value_num,
                        value_denom,
                        item.quantity_num,
                        quantity_denom,
                        item.lot_guid,
                    ),
                )

    return stats


def sync_entries(
    conn: psycopg.Connection,
    source_entries: list[SourceEntry],
    *,
    known_invoice_ids: set[str],
    known_account_ids: set[str],
    dry_run: bool,
) -> SyncStats:
    stats = SyncStats()
    now = datetime.now(UTC)
    truncation: dict[str, int] = {}

    with conn.cursor() as cur:
        cur.execute("SELECT guid FROM entries")
        existing_ids = {row[0] for row in cur.fetchall()}

        for item in source_entries:
            if item.invoice_guid and item.i_acct:
                resolved_invoice_guid = item.invoice_guid
                resolved_account_guid = item.i_acct
                resolved_price_num = item.i_price_num
                resolved_price_denom = item.i_price_denom
                resolved_taxable = item.i_taxable
                resolved_taxincluded = item.i_taxincluded
                resolved_taxtable = item.i_taxtable
            elif item.bill_guid and item.b_acct:
                resolved_invoice_guid = item.bill_guid
                resolved_account_guid = item.b_acct
                resolved_price_num = item.b_price_num
                resolved_price_denom = item.b_price_denom
                resolved_taxable = item.b_taxable
                resolved_taxincluded = item.b_taxincluded
                resolved_taxtable = item.b_taxtable
            else:
                warn(
                    f"entry {item.guid} has neither invoice+i_acct nor bill+b_acct and will be skipped"
                )
                continue

            if resolved_invoice_guid not in known_invoice_ids:
                warn(f"entry {item.guid} references unknown invoice {resolved_invoice_guid} and will be skipped")
                continue
            if resolved_account_guid not in known_account_ids:
                warn(f"entry {item.guid} references unknown account {resolved_account_guid} and will be skipped")
                continue

            if item.guid in existing_ids:
                stats.updated += 1
            else:
                stats.inserted += 1

            quantity_denom = normalize_positive(
                item.quantity_denom, field="entries.quantity_denom", entity_id=item.guid
            )
            price_denom = normalize_positive(
                resolved_price_denom, field="entries.i_price_denom", entity_id=item.guid
            )
            discount_denom = normalize_positive(
                item.i_discount_denom, field="entries.i_discount_denom", entity_id=item.guid
            )
            i_disc_type = (
                clip_text(item.i_disc_type or "PERCENT", 32, field="entries.i_disc_type", entity_id=item.guid, tracker=truncation)
                or "PERCENT"
            )
            i_disc_how = (
                clip_text(item.i_disc_how or "PRETAX", 32, field="entries.i_disc_how", entity_id=item.guid, tracker=truncation)
                or "PRETAX"
            )
            description = clip_text(
                item.description, 2048, field="entries.description", entity_id=item.guid, tracker=truncation
            )
            action = clip_text(item.action, 2048, field="entries.action", entity_id=item.guid, tracker=truncation)
            notes = clip_text(item.notes, 2048, field="entries.notes", entity_id=item.guid, tracker=truncation)

            if not dry_run:
                cur.execute(
                    """
                    INSERT INTO entries (
                        guid,
                        date,
                        date_entered,
                        description,
                        action,
                        notes,
                        quantity_num,
                        quantity_denom,
                        i_acct,
                        i_price_num,
                        i_price_denom,
                        i_discount_num,
                        i_discount_denom,
                        invoice,
                        i_disc_type,
                        i_disc_how,
                        i_taxable,
                        i_taxincluded,
                        i_taxtable,
                        b_paytype,
                        billable,
                        billto_type,
                        billto_guid,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s
                    )
                    ON CONFLICT (guid) DO UPDATE SET
                        date = EXCLUDED.date,
                        date_entered = EXCLUDED.date_entered,
                        description = EXCLUDED.description,
                        action = EXCLUDED.action,
                        notes = EXCLUDED.notes,
                        quantity_num = EXCLUDED.quantity_num,
                        quantity_denom = EXCLUDED.quantity_denom,
                        i_acct = EXCLUDED.i_acct,
                        i_price_num = EXCLUDED.i_price_num,
                        i_price_denom = EXCLUDED.i_price_denom,
                        i_discount_num = EXCLUDED.i_discount_num,
                        i_discount_denom = EXCLUDED.i_discount_denom,
                        invoice = EXCLUDED.invoice,
                        i_disc_type = EXCLUDED.i_disc_type,
                        i_disc_how = EXCLUDED.i_disc_how,
                        i_taxable = EXCLUDED.i_taxable,
                        i_taxincluded = EXCLUDED.i_taxincluded,
                        i_taxtable = EXCLUDED.i_taxtable,
                        b_paytype = EXCLUDED.b_paytype,
                        billable = EXCLUDED.billable,
                        billto_type = EXCLUDED.billto_type,
                        billto_guid = EXCLUDED.billto_guid,
                        updated_at = EXCLUDED.updated_at
                    """,
                    (
                        item.guid,
                        item.date,
                        item.date_entered,
                        description,
                        action,
                        notes,
                        item.quantity_num,
                        quantity_denom,
                        resolved_account_guid,
                        resolved_price_num,
                        price_denom,
                        item.i_discount_num,
                        discount_denom,
                        resolved_invoice_guid,
                        i_disc_type,
                        i_disc_how,
                        resolved_taxable,
                        resolved_taxincluded,
                        resolved_taxtable,
                        item.b_paytype,
                        item.billable,
                        item.billto_type,
                        item.billto_guid,
                        now,
                        now,
                    ),
                )

    return stats


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Import core and business data from GnuCash PostgreSQL into web-backend",
    )
    parser.add_argument("--source-host", default="localhost", help="Source PostgreSQL host")
    parser.add_argument("--source-port", type=int, default=5431, help="Source PostgreSQL port")
    parser.add_argument("--source-db", default="gnucash", help="Source database name")
    parser.add_argument("--source-user", default="gnucash_user", help="Source database user")
    parser.add_argument("--source-password", default="gnucash_pass", help="Source database password")
    parser.add_argument("--source-schema", default="public", help="Source schema containing books/accounts/commodities")
    parser.add_argument(
        "--target-url",
        default=None,
        help="Target database URL (defaults to DATABASE_URL from env/web-backend .env)",
    )
    parser.add_argument(
        "--unknown-type-fallback",
        choices=["ROOT", "ASSET", "LIABILITY", "INCOME", "EXPENSE", "EQUITY"],
        default=None,
        help="Fallback account type for unknown GnuCash account types",
    )
    parser.add_argument(
        "--business-book-id",
        default=None,
        help="Book UUID in target used for imported customers/vendors (default: source book when only one)",
    )
    parser.add_argument("--skip-customers", action="store_true", help="Skip customers import")
    parser.add_argument("--skip-vendors", action="store_true", help="Skip vendors import")
    parser.add_argument("--skip-transactions", action="store_true", help="Skip transactions import")
    parser.add_argument("--skip-splits", action="store_true", help="Skip splits import")
    parser.add_argument("--skip-lots", action="store_true", help="Skip lots import")
    parser.add_argument("--skip-invoices", action="store_true", help="Skip invoices import")
    parser.add_argument("--skip-entries", action="store_true", help="Skip entries import")
    parser.add_argument("--dry-run", action="store_true", help="Validate and show counts without writing to target")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        target_conninfo = resolve_target_conninfo(args.target_url)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    source_conn_kwargs = {
        "host": args.source_host,
        "port": args.source_port,
        "dbname": args.source_db,
        "user": args.source_user,
        "password": args.source_password,
    }

    try:
        with psycopg.connect(**source_conn_kwargs) as source_conn:
            books = read_source_books(source_conn, args.source_schema)
            commodities = read_source_commodities(source_conn, args.source_schema)
            accounts = read_source_accounts(source_conn, args.source_schema)
            customers = [] if args.skip_customers else read_source_customers(source_conn, args.source_schema)
            vendors = [] if args.skip_vendors else read_source_vendors(source_conn, args.source_schema)
            transactions = [] if args.skip_transactions else read_source_transactions(source_conn, args.source_schema)
            splits = [] if args.skip_splits else read_source_splits(source_conn, args.source_schema)
            lots = [] if args.skip_lots else read_source_lots(source_conn, args.source_schema)
            invoices = [] if args.skip_invoices else read_source_invoices(source_conn, args.source_schema)
            entries = [] if args.skip_entries else read_source_entries(source_conn, args.source_schema)
    except Exception as exc:  # noqa: BLE001
        print(f"error: failed to read source database: {exc}", file=sys.stderr)
        return 1

    if not books:
        print("error: source database has no books", file=sys.stderr)
        return 1
    if not commodities:
        print("error: source database has no commodities", file=sys.stderr)
        return 1
    if not accounts:
        print("error: source database has no accounts", file=sys.stderr)
        return 1

    try:
        account_book_map = map_account_to_book(accounts, books)
    except Exception as exc:  # noqa: BLE001
        print(f"error: failed to map accounts to books: {exc}", file=sys.stderr)
        return 1

    try:
        business_book_id = resolve_business_book_id(books, args.business_book_id)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    customer_ids = {item.guid for item in customers}
    vendor_ids = {item.guid for item in vendors}

    try:
        with psycopg.connect(target_conninfo) as target_conn:
            with target_conn.transaction():
                commodity_id_map, commodity_stats = sync_commodities(
                    target_conn, commodities, dry_run=args.dry_run
                )
                book_stats = sync_books(target_conn, books, accounts, dry_run=args.dry_run)
                prepared_accounts = prepare_accounts(
                    accounts,
                    account_book_map,
                    commodity_id_map,
                    unknown_type_fallback=args.unknown_type_fallback,
                )
                account_stats = sync_accounts(target_conn, prepared_accounts, dry_run=args.dry_run)

                with target_conn.cursor() as cur:
                    cur.execute("SELECT id FROM accounts")
                    known_account_ids = {row[0] for row in cur.fetchall()}

                customer_stats = sync_customers(
                    target_conn,
                    customers,
                    commodity_id_map,
                    book_id=business_book_id,
                    dry_run=args.dry_run,
                )
                vendor_stats = sync_vendors(
                    target_conn,
                    vendors,
                    commodity_id_map,
                    book_id=business_book_id,
                    dry_run=args.dry_run,
                )
                if args.skip_transactions:
                    transaction_stats = SyncStats()
                    with target_conn.cursor() as cur:
                        cur.execute("SELECT guid FROM transactions")
                        known_transaction_ids = {row[0] for row in cur.fetchall()}
                else:
                    transaction_stats, known_transaction_ids = sync_transactions(
                        target_conn,
                        transactions,
                        commodity_id_map,
                        dry_run=args.dry_run,
                    )

                if args.skip_invoices:
                    invoice_stats = SyncStats()
                    with target_conn.cursor() as cur:
                        cur.execute("SELECT guid FROM invoices")
                        known_invoice_ids = {row[0] for row in cur.fetchall()}
                else:
                    invoice_stats, known_invoice_ids = sync_invoices(
                        target_conn,
                        invoices,
                        commodity_id_map,
                        account_book_map,
                        business_book_id=business_book_id,
                        customer_ids=customer_ids,
                        vendor_ids=vendor_ids,
                        dry_run=args.dry_run,
                    )

                if args.skip_lots:
                    lot_stats = SyncStats()
                else:
                    lot_stats, _ = sync_lots(
                        target_conn,
                        lots,
                        known_account_ids=known_account_ids,
                        dry_run=args.dry_run,
                    )

                if args.skip_splits:
                    split_stats = SyncStats()
                else:
                    split_stats = sync_splits(
                        target_conn,
                        splits,
                        known_transaction_ids=known_transaction_ids,
                        known_account_ids=known_account_ids,
                        dry_run=args.dry_run,
                    )

                if args.skip_entries:
                    entry_stats = SyncStats()
                else:
                    entry_stats = sync_entries(
                        target_conn,
                        entries,
                        known_invoice_ids=known_invoice_ids,
                        known_account_ids=known_account_ids,
                        dry_run=args.dry_run,
                    )
    except Exception as exc:  # noqa: BLE001
        print(f"error: failed to import into target database: {exc}", file=sys.stderr)
        return 1

    mode = "DRY-RUN" if args.dry_run else "IMPORT"
    print(
        f"[{mode}] source counts: books={len(books)}, commodities={len(commodities)}, "
        f"accounts={len(accounts)}, customers={len(customers)}, vendors={len(vendors)}, "
        f"transactions={len(transactions)}, splits={len(splits)}, lots={len(lots)}, "
        f"invoices={len(invoices)}, entries={len(entries)}"
    )
    print(
        f"[{mode}] commodities: inserted={commodity_stats.inserted}, "
        f"updated={commodity_stats.updated}, reused_by_namespace_mnemonic={commodity_stats.reused}"
    )
    print(f"[{mode}] books: inserted={book_stats.inserted}, updated={book_stats.updated}")
    print(f"[{mode}] accounts: inserted={account_stats.inserted}, updated={account_stats.updated}")
    print(f"[{mode}] customers: inserted={customer_stats.inserted}, updated={customer_stats.updated}")
    print(f"[{mode}] vendors: inserted={vendor_stats.inserted}, updated={vendor_stats.updated}")
    print(f"[{mode}] transactions: inserted={transaction_stats.inserted}, updated={transaction_stats.updated}")
    print(f"[{mode}] invoices: inserted={invoice_stats.inserted}, updated={invoice_stats.updated}")
    print(f"[{mode}] lots: inserted={lot_stats.inserted}, updated={lot_stats.updated}")
    print(f"[{mode}] splits: inserted={split_stats.inserted}, updated={split_stats.updated}")
    print(f"[{mode}] entries: inserted={entry_stats.inserted}, updated={entry_stats.updated}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
