from __future__ import annotations

from collections import defaultdict
from datetime import UTC, date, datetime, time
from fractions import Fraction
from math import ceil
from typing import Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.errors import api_error
from app.models import Account, AccountType, Book, Commodity, Vendor, Invoice, InvoiceEntry, Lot, Split, Transaction
from app.schemas import (
    BillCreate,
    InvoiceEntryCreate,
    InvoiceEntryDiscountHowSchema,
    InvoiceEntryDiscountTypeSchema,
    InvoiceEntryOut,
    InvoicePaymentCreate,
    InvoicePaymentOut,
    BillPostRequest,
    InvoiceEntryPatch,
    BillListItemOut,
    BillListPageOut,
    BillOut,
    BillPatch,
)
from app.services.authorization import ensure_book_read_access, ensure_book_write_access
from app.services.document_numbers import observe_manual_document_number, reserve_next_document_number

router = APIRouter(prefix="/bills", tags=["Bills"])


def _resolved_bill_id(db: Session, *, book_id: str, owner_type: str, requested_id: str | None) -> str:
    normalized = str(requested_id or "").strip()
    if normalized:
        observe_manual_document_number(
            db,
            book_id=book_id,
            owner_type=owner_type,
            document_id=normalized,
        )
        return normalized
    return reserve_next_document_number(
        db,
        book_id=book_id,
        owner_type=owner_type,
    )


def _ensure_book_currency_vendor(
    db: Session,
    *,
    book_id: str,
    currency_guid: str,
    vendor_guid: str,
) -> Vendor:
    if db.get(Book, book_id) is None:
        raise api_error(400, "INVALID_BOOK", "book_id must reference an existing book", {"book_id": book_id})
    if db.get(Commodity, currency_guid) is None:
        raise api_error(
            400,
            "INVALID_CURRENCY",
            "currency_guid must reference an existing commodity",
            {"currency_guid": currency_guid},
        )

    vendor = db.get(Vendor, vendor_guid)
    if vendor is None:
        raise api_error(
            400,
            "INVALID_VENDOR",
            "vendor_guid must reference an existing vendor",
            {"vendor_guid": vendor_guid},
        )
    if vendor.book_id != book_id:
        raise api_error(
            409,
            "INVALID_VENDOR_BOOK",
            "vendor must belong to the same book as the bill",
            {"vendor_guid": vendor_guid, "book_id": book_id, "vendor_book_id": vendor.book_id},
        )
    return vendor


def _ensure_expense_account(
    db: Session,
    *,
    expense_account_guid: str,
    book_id: str,
) -> None:
    account = db.get(Account, expense_account_guid)
    if account is None:
        raise api_error(
            400,
            "INVALID_ACCOUNT",
            "expense account must reference an existing account",
            {"expense_account_guid": expense_account_guid},
        )
    if account.book_id != book_id:
        raise api_error(
            409,
            "INVALID_ACCOUNT_BOOK",
            "expense account must belong to the same book as the bill",
            {
                "expense_account_guid": expense_account_guid,
                "book_id": book_id,
                "account_book_id": account.book_id,
            },
        )
    if account.type != AccountType.EXPENSE:
        raise api_error(
            409,
            "INVALID_ACCOUNT_TYPE",
            "vendor bill entry account must use type EXPENSE",
            {"expense_account_guid": expense_account_guid, "account_type": account.type.value},
        )


def _ensure_post_account(
    db: Session,
    *,
    post_account_guid: str,
    book_id: str,
    currency_guid: str,
) -> Account:
    account = db.get(Account, post_account_guid)
    if account is None:
        raise api_error(
            400,
            "INVALID_POST_ACCOUNT",
            "post account must reference an existing account",
            {"post_account_guid": post_account_guid},
        )
    if account.book_id != book_id:
        raise api_error(
            409,
            "INVALID_POST_ACCOUNT_BOOK",
            "post account must belong to the same book as the bill",
            {"post_account_guid": post_account_guid, "book_id": book_id, "account_book_id": account.book_id},
        )
    if account.type != AccountType.LIABILITY:
        raise api_error(
            409,
            "INVALID_POST_ACCOUNT_TYPE",
            "vendor bill posting account must use type LIABILITY",
            {"post_account_guid": post_account_guid, "account_type": account.type.value},
        )
    if account.is_placeholder:
        raise api_error(
            409,
            "INVALID_POST_ACCOUNT",
            "post account cannot be a placeholder account",
            {"post_account_guid": post_account_guid},
        )
    if account.commodity_id != currency_guid:
        raise api_error(
            409,
            "INVALID_POST_ACCOUNT_COMMODITY",
            "post account commodity must match bill currency",
            {
                "post_account_guid": post_account_guid,
                "post_account_commodity_id": account.commodity_id,
                "bill_currency_guid": currency_guid,
            },
        )
    return account


def _ensure_payment_transfer_account(
    db: Session,
    *,
    transfer_account_guid: str,
    book_id: str,
    currency_guid: str,
    post_account_guid: str,
) -> Account:
    account = db.get(Account, transfer_account_guid)
    if account is None:
        raise api_error(
            400,
            "INVALID_PAYMENT_ACCOUNT",
            "payment transfer account must reference an existing account",
            {"transfer_account_guid": transfer_account_guid},
        )
    if account.book_id != book_id:
        raise api_error(
            409,
            "INVALID_PAYMENT_ACCOUNT_BOOK",
            "payment transfer account must belong to the same book as the bill",
            {
                "transfer_account_guid": transfer_account_guid,
                "book_id": book_id,
                "account_book_id": account.book_id,
            },
        )
    if account.type == AccountType.ROOT:
        raise api_error(
            409,
            "INVALID_PAYMENT_ACCOUNT_TYPE",
            "payment transfer account cannot use type ROOT",
            {"transfer_account_guid": transfer_account_guid, "account_type": account.type.value},
        )
    if account.is_placeholder:
        raise api_error(
            409,
            "INVALID_PAYMENT_ACCOUNT",
            "payment transfer account cannot be a placeholder account",
            {"transfer_account_guid": transfer_account_guid},
        )
    if account.commodity_id != currency_guid:
        raise api_error(
            409,
            "INVALID_PAYMENT_ACCOUNT_COMMODITY",
            "payment transfer account commodity must match bill currency",
            {
                "transfer_account_guid": transfer_account_guid,
                "transfer_account_commodity_id": account.commodity_id,
                "bill_currency_guid": currency_guid,
            },
        )
    if account.id == post_account_guid:
        raise api_error(
            409,
            "INVALID_PAYMENT_ACCOUNT",
            "payment transfer account must be different from the bill posting account",
            {"transfer_account_guid": transfer_account_guid, "post_account_guid": post_account_guid},
        )
    return account


def _ensure_bill_unposted(invoice: Invoice) -> None:
    if invoice.post_txn or invoice.date_posted is not None:
        raise api_error(
            409,
            "BILL_ALREADY_POSTED",
            "bill is posted; unpost before changing this resource",
            {"bill_guid": invoice.guid},
        )


def _ensure_bill_posted(invoice: Invoice) -> None:
    if not invoice.post_txn or invoice.date_posted is None:
        raise api_error(
            409,
            "BILL_NOT_POSTED",
            "bill is not posted",
            {"bill_guid": invoice.guid},
        )
    if not invoice.post_lot or not invoice.post_acc:
        raise api_error(
            409,
            "BILL_POSTING_INCOMPLETE",
            "bill posting metadata is incomplete",
            {
                "bill_guid": invoice.guid,
                "post_tx_guid": invoice.post_txn,
                "post_lot_guid": invoice.post_lot,
                "post_account_guid": invoice.post_acc,
            },
        )


def _fraction_to_split_parts(*, amount: Fraction, fraction: int) -> tuple[int, int]:
    scaled = amount * fraction
    if scaled.denominator != 1:
        raise api_error(
            409,
            "BILL_AMOUNT_FRACTION_MISMATCH",
            "bill amount cannot be represented with commodity fraction",
            {"amount_num": amount.numerator, "amount_denom": amount.denominator, "commodity_fraction": fraction},
        )
    return scaled.numerator, fraction


def _normalized_discount_type(value: str | None) -> str:
    normalized = (value or "").strip().upper()
    if normalized in {"", "PERCENT", "%"}:
        return InvoiceEntryDiscountTypeSchema.PERCENT.value
    if normalized in {"VALUE", "VAL"}:
        return InvoiceEntryDiscountTypeSchema.VALUE.value
    return InvoiceEntryDiscountTypeSchema.PERCENT.value


def _normalized_discount_how(value: str | None) -> str:
    normalized = (value or "").strip().upper()
    if normalized in {"", "PRETAX"}:
        return InvoiceEntryDiscountHowSchema.PRETAX.value
    if normalized in {"SAMETIME", "SAME_TIME"}:
        return InvoiceEntryDiscountHowSchema.SAMETIME.value
    if normalized in {"POSTTAX", "POST_TAX"}:
        return InvoiceEntryDiscountHowSchema.POSTTAX.value
    return InvoiceEntryDiscountHowSchema.PRETAX.value


def _entry_totals(entry: InvoiceEntry) -> tuple[Fraction, Fraction, Fraction]:
    quantity = Fraction(entry.quantity_num, entry.quantity_denom)
    unit_price = Fraction(entry.i_price_num, entry.i_price_denom)
    base = quantity * unit_price

    discount_ratio = Fraction(entry.i_discount_num, entry.i_discount_denom)
    discount_type = _normalized_discount_type(entry.i_disc_type)
    discount_amount = discount_ratio if discount_type == InvoiceEntryDiscountTypeSchema.VALUE.value else base * discount_ratio

    subtotal = base - discount_amount
    tax = Fraction(0, 1)
    total = subtotal + tax
    return subtotal, tax, total


def _entry_to_out(entry: InvoiceEntry) -> dict:
    subtotal, tax, total = _entry_totals(entry)
    return {
        "guid": entry.guid,
        "invoice_guid": entry.invoice_guid,
        "date": entry.date,
        "date_entered": entry.date_entered,
        "description": entry.description,
        "action": entry.action,
        "notes": entry.notes,
        "income_account_guid": entry.i_acct,
        "quantity_num": entry.quantity_num,
        "quantity_denom": entry.quantity_denom,
        "unit_price_num": entry.i_price_num,
        "unit_price_denom": entry.i_price_denom,
        "discount_num": entry.i_discount_num,
        "discount_denom": entry.i_discount_denom,
        "discount_type": _normalized_discount_type(entry.i_disc_type),
        "discount_how": _normalized_discount_how(entry.i_disc_how),
        "taxable": bool(entry.i_taxable),
        "tax_included": bool(entry.i_taxincluded),
        "tax_table_guid": entry.i_taxtable,
        "subtotal_num": subtotal.numerator,
        "subtotal_denom": subtotal.denominator,
        "tax_num": tax.numerator,
        "tax_denom": tax.denominator,
        "total_num": total.numerator,
        "total_denom": total.denominator,
        "created_at": entry.created_at,
        "updated_at": entry.updated_at,
    }


def _bill_sign(invoice: Invoice) -> Fraction:
    invoice_type = (invoice.invoice_type or "INVOICE").strip().upper()
    return Fraction(1, 1) if invoice_type == "CREDIT_NOTE" else Fraction(-1, 1)


def _lot_balance(db: Session, *, lot_guid: str, account_guid: str) -> Fraction:
    rows = db.execute(
        select(Split.value_num, Split.value_denom).where(Split.lot_guid == lot_guid, Split.account_guid == account_guid)
    ).all()
    balance = Fraction(0, 1)
    for value_num, value_denom in rows:
        balance += Fraction(value_num, value_denom)
    return balance


def _bill_payments(db: Session, *, invoice: Invoice) -> list[dict]:
    if not invoice.post_lot or not invoice.post_txn or not invoice.post_acc:
        return []

    payment_txs = db.execute(
        select(Transaction)
        .join(Split, Split.tx_guid == Transaction.guid)
        .where(
            Split.lot_guid == invoice.post_lot,
            Split.account_guid == invoice.post_acc,
            Transaction.guid != invoice.post_txn,
        )
        .options(selectinload(Transaction.splits))
        .order_by(Transaction.post_date.asc(), Transaction.guid.asc())
    ).unique().scalars().all()

    payments: list[dict] = []
    for tx in payment_txs:
        lot_value = Fraction(0, 1)
        fallback_memo = ""
        for split in tx.splits:
            if split.lot_guid == invoice.post_lot and split.account_guid == invoice.post_acc:
                lot_value += Fraction(split.value_num, split.value_denom)
                if not fallback_memo:
                    fallback_memo = split.memo or ""
        if lot_value == 0:
            continue

        transfer_split = next(
            (split for split in tx.splits if split.account_guid != invoice.post_acc),
            None,
        )
        amount = abs(lot_value)
        payment_payload = InvoicePaymentOut(
            tx_guid=tx.guid,
            transfer_account_guid=transfer_split.account_guid if transfer_split else invoice.post_acc,
            lot_guid=invoice.post_lot,
            payment_date=tx.post_date,
            memo=tx.description or fallback_memo,
            amount_num=amount.numerator,
            amount_denom=amount.denominator,
        )
        payments.append(payment_payload.model_dump())
    return payments


def _bill_status(invoice: Invoice, *, total_amount: Fraction, open_amount: Fraction) -> str:
    if not invoice.active:
        return "INACTIVE"
    if invoice.date_posted is None:
        return "UNPAID"
    if open_amount == 0:
        return "PAID"
    if total_amount != 0 and abs(open_amount) < abs(total_amount):
        return "PARTIAL"
    return "POSTED"


def _bill_to_out(db: Session, invoice: Invoice) -> dict:
    sorted_entries = sorted(
        invoice.entries,
        key=lambda item: (item.date or datetime.min.replace(tzinfo=UTC), item.guid),
    )

    subtotal_sum = Fraction(0, 1)
    tax_sum = Fraction(0, 1)
    total_sum = Fraction(0, 1)
    entry_payloads = []
    for entry in sorted_entries:
        subtotal, tax, total = _entry_totals(entry)
        subtotal_sum += subtotal
        tax_sum += tax
        total_sum += total
        entry_payloads.append(_entry_to_out(entry))

    invoice_type = (invoice.invoice_type or "INVOICE").strip().upper()
    if invoice_type not in {"INVOICE", "CREDIT_NOTE"}:
        invoice_type = "INVOICE"

    signed_total = total_sum * _bill_sign(invoice)
    open_signed = signed_total
    payments: list[dict] = []
    if invoice.date_posted is not None and invoice.post_lot and invoice.post_acc:
        open_signed = _lot_balance(db, lot_guid=invoice.post_lot, account_guid=invoice.post_acc)
        payments = _bill_payments(db, invoice=invoice)

    total_amount = abs(signed_total)
    open_amount = abs(open_signed)
    paid_amount = total_amount - open_amount

    return {
        "guid": invoice.guid,
        "book_id": invoice.book_id,
        "type": invoice_type,
        "id": invoice.id,
        "date_opened": invoice.date_opened,
        "date_posted": invoice.date_posted,
        "notes": invoice.notes or "",
        "active": bool(invoice.active),
        "currency_guid": invoice.currency_guid,
        "vendor_guid": invoice.owner_guid,
        "terms": invoice.terms,
        "billing_id": invoice.billing_id,
        "post_tx_guid": invoice.post_txn,
        "post_lot_guid": invoice.post_lot,
        "post_account_guid": invoice.post_acc,
        "status": _bill_status(invoice, total_amount=total_amount, open_amount=open_amount),
        "subtotal_num": subtotal_sum.numerator,
        "subtotal_denom": subtotal_sum.denominator,
        "tax_num": tax_sum.numerator,
        "tax_denom": tax_sum.denominator,
        "total_num": total_sum.numerator,
        "total_denom": total_sum.denominator,
        "paid_amount_num": paid_amount.numerator,
        "paid_amount_denom": paid_amount.denominator,
        "open_amount_num": open_amount.numerator,
        "open_amount_denom": open_amount.denominator,
        "payments": payments,
        "entries": entry_payloads,
        "created_at": invoice.created_at,
        "updated_at": invoice.updated_at,
    }


def _bill_amounts(db: Session, invoice: Invoice) -> tuple[Fraction, Fraction, Fraction]:
    total_sum = Fraction(0, 1)
    for entry in invoice.entries:
        _, _, total = _entry_totals(entry)
        total_sum += total

    signed_total = total_sum * _bill_sign(invoice)
    open_signed = signed_total
    if invoice.date_posted is not None and invoice.post_lot and invoice.post_acc:
        open_signed = _lot_balance(db, lot_guid=invoice.post_lot, account_guid=invoice.post_acc)

    return total_sum, abs(signed_total), abs(open_signed)


def _payment_state_from_amounts(*, total_amount: Fraction, open_amount: Fraction) -> str:
    if open_amount == 0:
        return "PAID"
    if total_amount != 0 and open_amount < total_amount:
        return "PARTIAL"
    return "UNPAID"


def _bill_to_list_item(db: Session, invoice: Invoice, *, vendor_name: str | None) -> dict:
    total_sum, total_amount, open_amount = _bill_amounts(db, invoice)
    return BillListItemOut(
        guid=invoice.guid,
        book_id=invoice.book_id,
        id=invoice.id,
        date_opened=invoice.date_opened,
        date_posted=invoice.date_posted,
        currency_guid=invoice.currency_guid,
        vendor_guid=invoice.owner_guid,
        vendor_name=vendor_name,
        status=_bill_status(invoice, total_amount=total_amount, open_amount=open_amount),
        payment_status=_payment_state_from_amounts(total_amount=total_amount, open_amount=open_amount),
        total_num=total_sum.numerator,
        total_denom=total_sum.denominator,
        open_amount_num=open_amount.numerator,
        open_amount_denom=open_amount.denominator,
    ).model_dump()


def _bill_sort_value(item: dict, *, sort_key: str) -> tuple:
    if sort_key == "id":
        return (str(item.get("id") or "").lower(),)
    if sort_key == "vendor":
        return (str(item.get("vendor_name") or "").lower(),)
    if sort_key == "date_opened":
        return (item.get("date_opened") or datetime.min.replace(tzinfo=UTC),)
    if sort_key == "date_posted":
        return (item.get("date_posted") or datetime.min.replace(tzinfo=UTC),)
    if sort_key == "posted_status":
        return (1 if item.get("date_posted") else 0,)
    if sort_key == "payment_status":
        order = {"UNPAID": 0, "PARTIAL": 1, "PAID": 2}
        return (order.get(str(item.get("payment_status") or "UNPAID"), 0),)
    if sort_key == "total":
        return (abs(Fraction(item["total_num"], item["total_denom"])),)
    if sort_key == "open":
        return (abs(Fraction(item["open_amount_num"], item["open_amount_denom"])),)
    return (item.get("date_opened") or datetime.min.replace(tzinfo=UTC),)


def _apply_posted_filters(
    stmt,
    *,
    posted_filter: Literal["ALL", "POSTED", "UNPOSTED"],
    posted_start_date: date | None,
    posted_end_date: date | None,
):
    if posted_filter == "POSTED":
        stmt = stmt.where(Invoice.date_posted.is_not(None))
    elif posted_filter == "UNPOSTED":
        stmt = stmt.where(Invoice.date_posted.is_(None))

    if posted_start_date is not None:
        start_at = datetime.combine(posted_start_date, time.min, tzinfo=UTC)
        stmt = stmt.where(Invoice.date_posted >= start_at)
    if posted_end_date is not None:
        end_at = datetime.combine(posted_end_date, time.max, tzinfo=UTC)
        stmt = stmt.where(Invoice.date_posted <= end_at)
    return stmt


def _load_bill(db: Session, *, bill_guid: str) -> Invoice:
    invoice = db.execute(
        select(Invoice)
        .where(Invoice.guid == bill_guid, Invoice.owner_type == "VENDOR")
        .options(selectinload(Invoice.entries))
    ).scalar_one_or_none()
    if invoice is None:
        raise api_error(404, "NOT_FOUND", "requested resource was not found")
    ensure_book_read_access(db, book_id=invoice.book_id)
    return invoice


def _load_bill_entry(db: Session, *, bill_guid: str, entry_guid: str) -> InvoiceEntry:
    entry = db.execute(
        select(InvoiceEntry)
        .where(InvoiceEntry.guid == entry_guid, InvoiceEntry.invoice_guid == bill_guid)
    ).scalar_one_or_none()
    if entry is None:
        raise api_error(404, "NOT_FOUND", "requested resource was not found")
    return entry


@router.post("", response_model=BillOut, status_code=201)
def create_bill(payload: BillCreate, db: Session = Depends(get_db)) -> dict:
    book_id = str(payload.book_id)
    currency_guid = str(payload.currency_guid)
    vendor_guid = str(payload.vendor_guid)
    ensure_book_write_access(db, book_id=book_id)
    _ensure_book_currency_vendor(
        db,
        book_id=book_id,
        currency_guid=currency_guid,
        vendor_guid=vendor_guid,
    )

    invoice = Invoice(
        guid=str(payload.guid or uuid4()),
        book_id=book_id,
        id=_resolved_bill_id(
            db,
            book_id=book_id,
            owner_type="VENDOR",
            requested_id=payload.id,
        ),
        invoice_type=payload.type.value,
        date_opened=payload.date_opened or datetime.now(UTC),
        date_posted=None,
        notes=payload.notes,
        active=payload.active,
        currency_guid=currency_guid,
        owner_type="VENDOR",
        owner_guid=vendor_guid,
        terms=payload.terms,
        billing_id=payload.billing_id,
    )
    db.add(invoice)
    db.commit()

    hydrated = _load_bill(db, bill_guid=invoice.guid)
    return _bill_to_out(db, hydrated)


@router.get("", response_model=list[BillOut])
def list_bills(
    book_id: UUID = Query(...),
    vendor_guid: UUID | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[dict]:
    book_id_str = str(book_id)
    ensure_book_read_access(db, book_id=book_id_str)
    stmt = (
        select(Invoice)
        .where(Invoice.book_id == book_id_str, Invoice.owner_type == "VENDOR")
        .options(selectinload(Invoice.entries))
        .order_by(Invoice.date_opened.asc(), Invoice.id.asc(), Invoice.guid.asc())
    )
    if vendor_guid is not None:
        stmt = stmt.where(Invoice.owner_guid == str(vendor_guid))
    invoices = db.execute(stmt).scalars().all()
    return [_bill_to_out(db, invoice) for invoice in invoices]


@router.get("/list", response_model=BillListPageOut)
def list_bills_paginated(
    book_id: UUID = Query(...),
    vendor_guid: UUID | None = Query(default=None),
    posted_filter: Literal["ALL", "POSTED", "UNPOSTED"] = Query(default="ALL"),
    payment_filter: Literal["ALL", "PAID", "UNPAID", "PARTIAL", "OPEN"] = Query(default="ALL"),
    posted_start_date: date | None = Query(default=None),
    posted_end_date: date | None = Query(default=None),
    sort_key: Literal["id", "vendor", "date_opened", "date_posted", "posted_status", "payment_status", "total", "open"] = Query(default="date_opened"),
    sort_direction: Literal["asc", "desc"] = Query(default="desc"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    db: Session = Depends(get_db),
) -> dict:
    book_id_str = str(book_id)
    ensure_book_read_access(db, book_id=book_id_str)
    base_stmt = select(Invoice).where(Invoice.book_id == book_id_str, Invoice.owner_type == "VENDOR")
    if vendor_guid is not None:
        base_stmt = base_stmt.where(Invoice.owner_guid == str(vendor_guid))
    base_stmt = _apply_posted_filters(
        base_stmt,
        posted_filter=posted_filter,
        posted_start_date=posted_start_date,
        posted_end_date=posted_end_date,
    )

    needs_python_filter_or_sort = payment_filter != "ALL" or sort_key in {"vendor", "payment_status", "total", "open"}

    if not needs_python_filter_or_sort:
        total_items = int(db.execute(select(func.count()).select_from(base_stmt.subquery())).scalar_one())
        total_pages = max(1, ceil(total_items / page_size)) if total_items else 1
        current_page = min(page, total_pages)
        offset = (current_page - 1) * page_size

        posted_order_expr = case((Invoice.date_posted.is_(None), 0), else_=1)
        order_expr = {
            "id": Invoice.id,
            "date_opened": Invoice.date_opened,
            "date_posted": Invoice.date_posted,
            "posted_status": posted_order_expr,
        }.get(sort_key, Invoice.date_opened)

        order_fn = order_expr.asc if sort_direction == "asc" else order_expr.desc
        tie_fn = Invoice.guid.asc if sort_direction == "asc" else Invoice.guid.desc
        page_stmt = (
            base_stmt
            .options(selectinload(Invoice.entries))
            .order_by(order_fn(), tie_fn())
            .offset(offset)
            .limit(page_size)
        )
        invoices = db.execute(page_stmt).scalars().all()
        vendor_ids = {invoice.owner_guid for invoice in invoices}
        vendors_by_guid = {
            guid: name
            for guid, name in db.execute(select(Vendor.guid, Vendor.name).where(Vendor.guid.in_(vendor_ids))).all()
        } if vendor_ids else {}
        items = [
            _bill_to_list_item(db, invoice, vendor_name=vendors_by_guid.get(invoice.owner_guid))
            for invoice in invoices
        ]
        return {
            "items": items,
            "page": current_page,
            "page_size": page_size,
            "total_items": total_items,
            "total_pages": total_pages,
        }

    stmt = base_stmt.options(selectinload(Invoice.entries)).order_by(
        Invoice.date_opened.asc(),
        Invoice.id.asc(),
        Invoice.guid.asc(),
    )
    invoices = db.execute(stmt).scalars().all()

    vendor_ids = {invoice.owner_guid for invoice in invoices}
    vendors_by_guid = {
        guid: name
        for guid, name in db.execute(select(Vendor.guid, Vendor.name).where(Vendor.guid.in_(vendor_ids))).all()
    } if vendor_ids else {}

    items = [
        _bill_to_list_item(db, invoice, vendor_name=vendors_by_guid.get(invoice.owner_guid))
        for invoice in invoices
    ]
    if payment_filter == "OPEN":
        items = [
            item
            for item in items
            if Fraction(item["open_amount_num"], item["open_amount_denom"]) != 0
        ]
    elif payment_filter != "ALL":
        items = [item for item in items if item["payment_status"] == payment_filter]

    reverse = sort_direction == "desc"
    items.sort(
        key=lambda item: (_bill_sort_value(item, sort_key=sort_key), str(item.get("guid") or "")),
        reverse=reverse,
    )

    total_items = len(items)
    total_pages = max(1, ceil(total_items / page_size)) if total_items else 1
    current_page = min(page, total_pages)
    offset = (current_page - 1) * page_size
    paged_items = items[offset:offset + page_size]

    return {
        "items": paged_items,
        "page": current_page,
        "page_size": page_size,
        "total_items": total_items,
        "total_pages": total_pages,
    }


@router.get("/{bill_guid}", response_model=BillOut)
def get_bill(bill_guid: UUID, db: Session = Depends(get_db)) -> dict:
    invoice = _load_bill(db, bill_guid=str(bill_guid))
    return _bill_to_out(db, invoice)


@router.patch("/{bill_guid}", response_model=BillOut)
def patch_bill(bill_guid: UUID, payload: BillPatch, db: Session = Depends(get_db)) -> dict:
    invoice = _load_bill(db, bill_guid=str(bill_guid))
    ensure_book_write_access(db, book_id=invoice.book_id)
    data = payload.model_dump(exclude_unset=True)

    if "date_posted" in data:
        raise api_error(
            400,
            "BILL_DATE_POSTED_READ_ONLY",
            "date_posted is managed by bill post/unpost endpoints",
        )

    if invoice.post_txn or invoice.date_posted is not None:
        blocked_fields = {"type", "id", "date_opened", "currency_guid", "vendor_guid", "terms", "billing_id"}
        attempted = sorted(field for field in blocked_fields if field in data)
        if attempted:
            raise api_error(
                409,
                "BILL_ALREADY_POSTED",
                "bill is posted; unpost before changing posting fields",
                {"bill_guid": invoice.guid, "fields": attempted},
            )

    if "currency_guid" in data:
        if data["currency_guid"] is None:
            raise api_error(400, "INVALID_CURRENCY", "currency_guid cannot be null")
        currency_guid = str(data["currency_guid"])
        if db.get(Commodity, currency_guid) is None:
            raise api_error(
                400,
                "INVALID_CURRENCY",
                "currency_guid must reference an existing commodity",
                {"currency_guid": currency_guid},
            )
        invoice.currency_guid = currency_guid

    if "vendor_guid" in data:
        if data["vendor_guid"] is None:
            raise api_error(400, "INVALID_VENDOR", "vendor_guid cannot be null")
        vendor_guid = str(data["vendor_guid"])
        vendor = db.get(Vendor, vendor_guid)
        if vendor is None:
            raise api_error(
                400,
                "INVALID_VENDOR",
                "vendor_guid must reference an existing vendor",
                {"vendor_guid": vendor_guid},
            )
        if vendor.book_id != invoice.book_id:
            raise api_error(
                409,
                "INVALID_VENDOR_BOOK",
                "vendor must belong to the same book as the bill",
                {"vendor_guid": vendor_guid, "book_id": invoice.book_id, "vendor_book_id": vendor.book_id},
            )
        invoice.owner_guid = vendor_guid

    if "type" in data and data["type"] is not None:
        invoice.invoice_type = data["type"].value
    if "id" in data:
        invoice.id = data["id"] or ""
    if "date_opened" in data:
        invoice.date_opened = data["date_opened"]
    if "notes" in data:
        invoice.notes = data["notes"] or ""
    if "active" in data and data["active"] is not None:
        invoice.active = data["active"]
    if "terms" in data:
        invoice.terms = data["terms"]
    if "billing_id" in data:
        invoice.billing_id = data["billing_id"]

    db.commit()
    hydrated = _load_bill(db, bill_guid=invoice.guid)
    return _bill_to_out(db, hydrated)


@router.post("/{bill_guid}/post", response_model=BillOut)
def post_bill(bill_guid: UUID, payload: BillPostRequest, db: Session = Depends(get_db)) -> dict:
    invoice = _load_bill(db, bill_guid=str(bill_guid))
    ensure_book_write_access(db, book_id=invoice.book_id)
    _ensure_bill_unposted(invoice)

    if not invoice.entries:
        raise api_error(
            409,
            "BILL_WITHOUT_ENTRIES",
            "bill must contain at least one entry before posting",
            {"bill_guid": invoice.guid},
        )

    currency = db.get(Commodity, invoice.currency_guid)
    if currency is None:
        raise api_error(
            400,
            "INVALID_CURRENCY",
            "bill currency must reference an existing commodity",
            {"currency_guid": invoice.currency_guid},
        )
    if currency.fraction <= 0:
        raise api_error(
            409,
            "INVALID_CURRENCY_FRACTION",
            "commodity fraction must be positive",
            {"currency_guid": currency.id, "fraction": currency.fraction},
        )

    post_account_guid = str(payload.post_account_guid)
    _ensure_post_account(
        db,
        post_account_guid=post_account_guid,
        book_id=invoice.book_id,
        currency_guid=invoice.currency_guid,
    )

    invoice_type = (invoice.invoice_type or "INVOICE").strip().upper()
    sign = Fraction(1, 1) if invoice_type == "CREDIT_NOTE" else Fraction(-1, 1)

    payable_total = Fraction(0, 1)
    expense_totals: dict[str, Fraction] = defaultdict(lambda: Fraction(0, 1))
    for entry in invoice.entries:
        _, _, total = _entry_totals(entry)
        signed_total = total * sign
        payable_total += signed_total
        expense_totals[entry.i_acct] += -signed_total

    if payable_total == 0:
        raise api_error(
            409,
            "BILL_TOTAL_ZERO",
            "bill total must be non-zero to post",
            {"bill_guid": invoice.guid},
        )

    post_date = payload.post_date or datetime.now(UTC)
    if post_date.tzinfo is None:
        post_date = post_date.replace(tzinfo=UTC)

    tx_guid = str(uuid4())
    lot_guid = str(uuid4())
    lot = Lot(guid=lot_guid, account_guid=post_account_guid, is_closed=False)

    description = (payload.memo or "").strip() or f"Post bill {invoice.id}"
    transaction = Transaction(
        guid=tx_guid,
        currency_guid=invoice.currency_guid,
        num=invoice.id or "",
        post_date=post_date,
        enter_date=datetime.now(UTC),
        description=description,
    )

    split_payloads: list[Split] = []
    payable_num, payable_denom = _fraction_to_split_parts(amount=payable_total, fraction=currency.fraction)
    split_payloads.append(
        Split(
            guid=str(uuid4()),
            tx_guid=tx_guid,
            account_guid=post_account_guid,
            memo=invoice.id or "",
            action="",
            reconcile_state="n",
            reconcile_date=None,
            value_num=payable_num,
            value_denom=payable_denom,
            quantity_num=payable_num,
            quantity_denom=payable_denom,
            lot_guid=lot_guid,
        )
    )

    for expense_account_guid in sorted(expense_totals):
        amount = expense_totals[expense_account_guid]
        if amount == 0:
            continue
        value_num, value_denom = _fraction_to_split_parts(amount=amount, fraction=currency.fraction)
        split_payloads.append(
            Split(
                guid=str(uuid4()),
                tx_guid=tx_guid,
                account_guid=expense_account_guid,
                memo=invoice.id or "",
                action="",
                reconcile_state="n",
                reconcile_date=None,
                value_num=value_num,
                value_denom=value_denom,
                quantity_num=value_num,
                quantity_denom=value_denom,
                lot_guid=None,
            )
        )

    if len(split_payloads) < 2:
        raise api_error(
            409,
            "INVALID_POSTING_SPLITS",
            "bill posting requires at least two non-zero splits",
            {"bill_guid": invoice.guid},
        )

    split_balance = Fraction(0, 1)
    for split in split_payloads:
        split_balance += Fraction(split.value_num, split.value_denom)
    if split_balance != 0:
        raise api_error(
            409,
            "POSTING_UNBALANCED",
            "generated posting splits are unbalanced",
            {"balance_num": split_balance.numerator, "balance_denom": split_balance.denominator},
        )

    transaction.splits = split_payloads
    db.add(lot)
    db.add(transaction)

    invoice.date_posted = post_date
    invoice.post_txn = transaction.guid
    invoice.post_lot = lot.guid
    invoice.post_acc = post_account_guid

    db.commit()
    hydrated = _load_bill(db, bill_guid=invoice.guid)
    return _bill_to_out(db, hydrated)


@router.post("/{bill_guid}/unpost", response_model=BillOut)
def unpost_bill(bill_guid: UUID, db: Session = Depends(get_db)) -> dict:
    invoice = _load_bill(db, bill_guid=str(bill_guid))
    ensure_book_write_access(db, book_id=invoice.book_id)
    if not invoice.post_txn and invoice.date_posted is None:
        raise api_error(
            409,
            "BILL_NOT_POSTED",
            "bill is not posted",
            {"bill_guid": invoice.guid},
        )
    if not invoice.post_txn:
        raise api_error(
            409,
            "BILL_POSTING_MISSING_TX",
            "bill posting metadata is inconsistent; post_txn is required to unpost",
            {"bill_guid": invoice.guid},
        )

    if invoice.post_lot:
        payment_split = db.execute(
            select(Split.guid)
            .where(Split.lot_guid == invoice.post_lot)
            .where(Split.tx_guid != invoice.post_txn)
            .limit(1)
        ).scalar_one_or_none()
        if payment_split:
            raise api_error(
                409,
                "BILL_HAS_PAYMENTS",
                "bill cannot be unposted while payment splits exist in its lot",
                {"bill_guid": invoice.guid, "post_lot_guid": invoice.post_lot},
            )

    posting_tx = db.get(Transaction, invoice.post_txn)
    if posting_tx is None:
        raise api_error(
            409,
            "BILL_POSTING_MISSING_TX",
            "bill posting transaction was not found",
            {"bill_guid": invoice.guid, "post_tx_guid": invoice.post_txn},
        )

    db.delete(posting_tx)
    if invoice.post_lot:
        lot = db.get(Lot, invoice.post_lot)
        if lot is not None:
            db.delete(lot)

    invoice.date_posted = None
    invoice.post_txn = None
    invoice.post_lot = None
    invoice.post_acc = None

    db.commit()
    hydrated = _load_bill(db, bill_guid=invoice.guid)
    return _bill_to_out(db, hydrated)


@router.post("/{bill_guid}/payments", response_model=BillOut)
def create_bill_payment(bill_guid: UUID, payload: InvoicePaymentCreate, db: Session = Depends(get_db)) -> dict:
    invoice = _load_bill(db, bill_guid=str(bill_guid))
    ensure_book_write_access(db, book_id=invoice.book_id)
    _ensure_bill_posted(invoice)

    lot = db.get(Lot, invoice.post_lot)
    if lot is None:
        raise api_error(
            409,
            "BILL_POSTING_MISSING_LOT",
            "bill posting lot was not found",
            {"bill_guid": invoice.guid, "post_lot_guid": invoice.post_lot},
        )
    if lot.account_guid != invoice.post_acc:
        raise api_error(
            409,
            "BILL_POSTING_INCONSISTENT",
            "bill posting lot does not belong to the bill posting account",
            {"bill_guid": invoice.guid, "post_lot_guid": lot.guid, "lot_account_guid": lot.account_guid},
        )

    currency = db.get(Commodity, invoice.currency_guid)
    if currency is None:
        raise api_error(
            400,
            "INVALID_CURRENCY",
            "bill currency must reference an existing commodity",
            {"currency_guid": invoice.currency_guid},
        )
    if currency.fraction <= 0:
        raise api_error(
            409,
            "INVALID_CURRENCY_FRACTION",
            "commodity fraction must be positive",
            {"currency_guid": currency.id, "fraction": currency.fraction},
        )

    transfer_account_guid = str(payload.transfer_account_guid)
    _ensure_payment_transfer_account(
        db,
        transfer_account_guid=transfer_account_guid,
        book_id=invoice.book_id,
        currency_guid=invoice.currency_guid,
        post_account_guid=invoice.post_acc,
    )

    payment_amount = Fraction(payload.amount_num, payload.amount_denom)
    if payment_amount <= 0:
        raise api_error(
            400,
            "INVALID_PAYMENT_AMOUNT",
            "payment amount must be greater than zero",
            {"amount_num": payload.amount_num, "amount_denom": payload.amount_denom},
        )

    open_balance = _lot_balance(db, lot_guid=invoice.post_lot, account_guid=invoice.post_acc)
    if open_balance == 0:
        raise api_error(
            409,
            "BILL_ALREADY_PAID",
            "bill lot is already fully settled",
            {"bill_guid": invoice.guid, "post_lot_guid": invoice.post_lot},
        )
    if payment_amount > abs(open_balance):
        raise api_error(
            409,
            "PAYMENT_EXCEEDS_OPEN_BALANCE",
            "payment amount exceeds bill open balance",
            {
                "bill_guid": invoice.guid,
                "amount_num": payment_amount.numerator,
                "amount_denom": payment_amount.denominator,
                "open_amount_num": open_balance.numerator,
                "open_amount_denom": open_balance.denominator,
            },
        )

    payable_signed_amount = -payment_amount if open_balance > 0 else payment_amount
    payable_num, payable_denom = _fraction_to_split_parts(
        amount=payable_signed_amount,
        fraction=currency.fraction,
    )
    transfer_num, transfer_denom = _fraction_to_split_parts(
        amount=-payable_signed_amount,
        fraction=currency.fraction,
    )

    payment_date = payload.payment_date or datetime.now(UTC)
    if payment_date.tzinfo is None:
        payment_date = payment_date.replace(tzinfo=UTC)

    tx_guid = str(uuid4())
    description = (payload.memo or "").strip() or f"Payment bill {invoice.id}"
    payment_tx = Transaction(
        guid=tx_guid,
        currency_guid=invoice.currency_guid,
        num=invoice.id or "",
        post_date=payment_date,
        enter_date=datetime.now(UTC),
        description=description,
    )
    payment_tx.splits = [
        Split(
            guid=str(uuid4()),
            tx_guid=tx_guid,
            account_guid=invoice.post_acc,
            memo=invoice.id or "",
            action="",
            reconcile_state="n",
            reconcile_date=None,
            value_num=payable_num,
            value_denom=payable_denom,
            quantity_num=payable_num,
            quantity_denom=payable_denom,
            lot_guid=invoice.post_lot,
        ),
        Split(
            guid=str(uuid4()),
            tx_guid=tx_guid,
            account_guid=transfer_account_guid,
            memo=invoice.id or "",
            action="",
            reconcile_state="n",
            reconcile_date=None,
            value_num=transfer_num,
            value_denom=transfer_denom,
            quantity_num=transfer_num,
            quantity_denom=transfer_denom,
            lot_guid=None,
        ),
    ]

    db.add(payment_tx)
    lot.is_closed = open_balance + payable_signed_amount == 0
    db.commit()
    hydrated = _load_bill(db, bill_guid=invoice.guid)
    return _bill_to_out(db, hydrated)


@router.post("/{bill_guid}/payments/{payment_tx_guid}/undo", response_model=BillOut)
def undo_bill_payment(bill_guid: UUID, payment_tx_guid: UUID, db: Session = Depends(get_db)) -> dict:
    invoice = _load_bill(db, bill_guid=str(bill_guid))
    ensure_book_write_access(db, book_id=invoice.book_id)
    _ensure_bill_posted(invoice)

    payment_tx_guid_str = str(payment_tx_guid)
    if payment_tx_guid_str == invoice.post_txn:
        raise api_error(
            409,
            "INVALID_BILL_PAYMENT_TX",
            "bill posting transaction cannot be undone as a payment",
            {"bill_guid": invoice.guid, "payment_tx_guid": payment_tx_guid_str},
        )

    payment_tx = db.execute(
        select(Transaction).where(Transaction.guid == payment_tx_guid_str).options(selectinload(Transaction.splits))
    ).scalar_one_or_none()
    if payment_tx is None:
        raise api_error(404, "NOT_FOUND", "requested resource was not found")

    has_invoice_lot_split = any(
        split.lot_guid == invoice.post_lot and split.account_guid == invoice.post_acc
        for split in payment_tx.splits
    )
    if not has_invoice_lot_split:
        raise api_error(
            404,
            "NOT_FOUND",
            "requested resource was not found",
        )

    db.delete(payment_tx)
    db.flush()

    lot = db.get(Lot, invoice.post_lot)
    if lot is None:
        raise api_error(
            409,
            "BILL_POSTING_MISSING_LOT",
            "bill posting lot was not found",
            {"bill_guid": invoice.guid, "post_lot_guid": invoice.post_lot},
        )
    lot.is_closed = _lot_balance(db, lot_guid=invoice.post_lot, account_guid=invoice.post_acc) == 0

    db.commit()
    hydrated = _load_bill(db, bill_guid=invoice.guid)
    return _bill_to_out(db, hydrated)


@router.delete("/{bill_guid}", status_code=204)
def delete_bill(bill_guid: UUID, db: Session = Depends(get_db)) -> None:
    invoice = _load_bill(db, bill_guid=str(bill_guid))
    ensure_book_write_access(db, book_id=invoice.book_id)
    _ensure_bill_unposted(invoice)
    db.delete(invoice)
    db.commit()


@router.post("/{bill_guid}/entries", response_model=InvoiceEntryOut, status_code=201)
def create_bill_entry(bill_guid: UUID, payload: InvoiceEntryCreate, db: Session = Depends(get_db)) -> dict:
    invoice = _load_bill(db, bill_guid=str(bill_guid))
    ensure_book_write_access(db, book_id=invoice.book_id)
    _ensure_bill_unposted(invoice)

    income_account_guid = str(payload.income_account_guid)
    _ensure_expense_account(db, expense_account_guid=income_account_guid, book_id=invoice.book_id)

    entry = InvoiceEntry(
        guid=str(payload.guid or uuid4()),
        date=payload.date,
        date_entered=datetime.now(UTC),
        description=payload.description,
        action=payload.action,
        notes=payload.notes,
        quantity_num=payload.quantity_num,
        quantity_denom=payload.quantity_denom,
        i_acct=income_account_guid,
        i_price_num=payload.unit_price_num,
        i_price_denom=payload.unit_price_denom,
        i_discount_num=payload.discount_num,
        i_discount_denom=payload.discount_denom,
        invoice_guid=invoice.guid,
        i_disc_type=payload.discount_type.value,
        i_disc_how=payload.discount_how.value,
        i_taxable=payload.taxable,
        i_taxincluded=payload.tax_included,
        i_taxtable=str(payload.tax_table_guid) if payload.tax_table_guid else None,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _entry_to_out(entry)


@router.patch("/{bill_guid}/entries/{entry_guid}", response_model=InvoiceEntryOut)
def patch_bill_entry(
    bill_guid: UUID,
    entry_guid: UUID,
    payload: InvoiceEntryPatch,
    db: Session = Depends(get_db),
) -> dict:
    invoice = _load_bill(db, bill_guid=str(bill_guid))
    ensure_book_write_access(db, book_id=invoice.book_id)
    _ensure_bill_unposted(invoice)

    entry = _load_bill_entry(db, bill_guid=invoice.guid, entry_guid=str(entry_guid))
    data = payload.model_dump(exclude_unset=True)

    if "income_account_guid" in data:
        if data["income_account_guid"] is None:
            raise api_error(400, "INVALID_ACCOUNT", "income_account_guid cannot be null")
        income_account_guid = str(data["income_account_guid"])
        _ensure_expense_account(db, expense_account_guid=income_account_guid, book_id=invoice.book_id)
        entry.i_acct = income_account_guid

    if "date" in data:
        if data["date"] is None:
            raise api_error(400, "INVALID_ENTRY", "date cannot be null")
        entry.date = data["date"]
    if "description" in data:
        entry.description = data["description"]
    if "action" in data:
        entry.action = data["action"]
    if "notes" in data:
        entry.notes = data["notes"]
    if "quantity_num" in data:
        if data["quantity_num"] is None:
            raise api_error(400, "INVALID_ENTRY", "quantity_num cannot be null")
        entry.quantity_num = data["quantity_num"]
    if "quantity_denom" in data:
        if data["quantity_denom"] is None:
            raise api_error(400, "INVALID_ENTRY", "quantity_denom cannot be null")
        entry.quantity_denom = data["quantity_denom"]
    if "unit_price_num" in data:
        if data["unit_price_num"] is None:
            raise api_error(400, "INVALID_ENTRY", "unit_price_num cannot be null")
        entry.i_price_num = data["unit_price_num"]
    if "unit_price_denom" in data:
        if data["unit_price_denom"] is None:
            raise api_error(400, "INVALID_ENTRY", "unit_price_denom cannot be null")
        entry.i_price_denom = data["unit_price_denom"]
    if "discount_num" in data:
        if data["discount_num"] is None:
            raise api_error(400, "INVALID_ENTRY", "discount_num cannot be null")
        entry.i_discount_num = data["discount_num"]
    if "discount_denom" in data:
        if data["discount_denom"] is None:
            raise api_error(400, "INVALID_ENTRY", "discount_denom cannot be null")
        entry.i_discount_denom = data["discount_denom"]
    if "discount_type" in data and data["discount_type"] is not None:
        entry.i_disc_type = data["discount_type"].value
    if "discount_how" in data and data["discount_how"] is not None:
        entry.i_disc_how = data["discount_how"].value
    if "taxable" in data and data["taxable"] is not None:
        entry.i_taxable = data["taxable"]
    if "tax_included" in data and data["tax_included"] is not None:
        entry.i_taxincluded = data["tax_included"]
    if "tax_table_guid" in data:
        entry.i_taxtable = str(data["tax_table_guid"]) if data["tax_table_guid"] else None

    db.commit()
    db.refresh(entry)
    return _entry_to_out(entry)


@router.delete("/{bill_guid}/entries/{entry_guid}", status_code=204)
def delete_bill_entry(bill_guid: UUID, entry_guid: UUID, db: Session = Depends(get_db)) -> None:
    invoice = _load_bill(db, bill_guid=str(bill_guid))
    ensure_book_write_access(db, book_id=invoice.book_id)
    _ensure_bill_unposted(invoice)

    entry = _load_bill_entry(db, bill_guid=invoice.guid, entry_guid=str(entry_guid))
    db.delete(entry)
    db.commit()
