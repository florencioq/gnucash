from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime
from fractions import Fraction
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.errors import api_error
from app.models import Account, AccountType, Book, Commodity, Customer, Invoice, InvoiceEntry, Lot, Split, Transaction
from app.schemas import (
    InvoiceCreate,
    InvoiceEntryCreate,
    InvoiceEntryDiscountHowSchema,
    InvoiceEntryDiscountTypeSchema,
    InvoiceEntryOut,
    InvoicePostRequest,
    InvoiceEntryPatch,
    InvoiceOut,
    InvoicePatch,
)

router = APIRouter(prefix="/invoices", tags=["Invoices"])


def _ensure_book_currency_customer(
    db: Session,
    *,
    book_id: str,
    currency_guid: str,
    customer_guid: str,
) -> Customer:
    if db.get(Book, book_id) is None:
        raise api_error(400, "INVALID_BOOK", "book_id must reference an existing book", {"book_id": book_id})
    if db.get(Commodity, currency_guid) is None:
        raise api_error(
            400,
            "INVALID_CURRENCY",
            "currency_guid must reference an existing commodity",
            {"currency_guid": currency_guid},
        )

    customer = db.get(Customer, customer_guid)
    if customer is None:
        raise api_error(
            400,
            "INVALID_CUSTOMER",
            "customer_guid must reference an existing customer",
            {"customer_guid": customer_guid},
        )
    if customer.book_id != book_id:
        raise api_error(
            409,
            "INVALID_CUSTOMER_BOOK",
            "customer must belong to the same book as the invoice",
            {"customer_guid": customer_guid, "book_id": book_id, "customer_book_id": customer.book_id},
        )
    return customer


def _ensure_income_account(
    db: Session,
    *,
    income_account_guid: str,
    book_id: str,
) -> None:
    account = db.get(Account, income_account_guid)
    if account is None:
        raise api_error(
            400,
            "INVALID_ACCOUNT",
            "income account must reference an existing account",
            {"income_account_guid": income_account_guid},
        )
    if account.book_id != book_id:
        raise api_error(
            409,
            "INVALID_ACCOUNT_BOOK",
            "income account must belong to the same book as the invoice",
            {
                "income_account_guid": income_account_guid,
                "book_id": book_id,
                "account_book_id": account.book_id,
            },
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
            "post account must belong to the same book as the invoice",
            {"post_account_guid": post_account_guid, "book_id": book_id, "account_book_id": account.book_id},
        )
    if account.type != AccountType.ASSET:
        raise api_error(
            409,
            "INVALID_POST_ACCOUNT_TYPE",
            "customer invoice posting account must use type ASSET",
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
            "post account commodity must match invoice currency",
            {
                "post_account_guid": post_account_guid,
                "post_account_commodity_id": account.commodity_id,
                "invoice_currency_guid": currency_guid,
            },
        )
    return account


def _ensure_invoice_unposted(invoice: Invoice) -> None:
    if invoice.post_txn or invoice.date_posted is not None:
        raise api_error(
            409,
            "INVOICE_ALREADY_POSTED",
            "invoice is posted; unpost before changing this resource",
            {"invoice_guid": invoice.guid},
        )


def _fraction_to_split_parts(*, amount: Fraction, fraction: int) -> tuple[int, int]:
    scaled = amount * fraction
    if scaled.denominator != 1:
        raise api_error(
            409,
            "INVOICE_AMOUNT_FRACTION_MISMATCH",
            "invoice amount cannot be represented with commodity fraction",
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


def _invoice_status(invoice: Invoice) -> str:
    if not invoice.active:
        return "INACTIVE"
    if invoice.date_posted is None:
        return "UNPAID"
    return "POSTED"


def _invoice_to_out(invoice: Invoice) -> dict:
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
        "customer_guid": invoice.owner_guid,
        "terms": invoice.terms,
        "billing_id": invoice.billing_id,
        "post_tx_guid": invoice.post_txn,
        "post_lot_guid": invoice.post_lot,
        "post_account_guid": invoice.post_acc,
        "status": _invoice_status(invoice),
        "subtotal_num": subtotal_sum.numerator,
        "subtotal_denom": subtotal_sum.denominator,
        "tax_num": tax_sum.numerator,
        "tax_denom": tax_sum.denominator,
        "total_num": total_sum.numerator,
        "total_denom": total_sum.denominator,
        "entries": entry_payloads,
        "created_at": invoice.created_at,
        "updated_at": invoice.updated_at,
    }


def _load_invoice(db: Session, *, invoice_guid: str) -> Invoice:
    invoice = db.execute(
        select(Invoice)
        .where(Invoice.guid == invoice_guid)
        .options(selectinload(Invoice.entries))
    ).scalar_one_or_none()
    if invoice is None:
        raise api_error(404, "NOT_FOUND", "requested resource was not found")
    return invoice


def _load_invoice_entry(db: Session, *, invoice_guid: str, entry_guid: str) -> InvoiceEntry:
    entry = db.execute(
        select(InvoiceEntry)
        .where(InvoiceEntry.guid == entry_guid, InvoiceEntry.invoice_guid == invoice_guid)
    ).scalar_one_or_none()
    if entry is None:
        raise api_error(404, "NOT_FOUND", "requested resource was not found")
    return entry


@router.post("", response_model=InvoiceOut, status_code=201)
def create_invoice(payload: InvoiceCreate, db: Session = Depends(get_db)) -> dict:
    book_id = str(payload.book_id)
    currency_guid = str(payload.currency_guid)
    customer_guid = str(payload.customer_guid)
    _ensure_book_currency_customer(
        db,
        book_id=book_id,
        currency_guid=currency_guid,
        customer_guid=customer_guid,
    )

    invoice = Invoice(
        guid=str(payload.guid or uuid4()),
        book_id=book_id,
        id=payload.id,
        invoice_type=payload.type.value,
        date_opened=payload.date_opened or datetime.now(UTC),
        date_posted=None,
        notes=payload.notes,
        active=payload.active,
        currency_guid=currency_guid,
        owner_type="CUSTOMER",
        owner_guid=customer_guid,
        terms=payload.terms,
        billing_id=payload.billing_id,
    )
    db.add(invoice)
    db.commit()

    hydrated = _load_invoice(db, invoice_guid=invoice.guid)
    return _invoice_to_out(hydrated)


@router.get("", response_model=list[InvoiceOut])
def list_invoices(
    book_id: UUID = Query(...),
    customer_guid: UUID | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[dict]:
    stmt = (
        select(Invoice)
        .where(Invoice.book_id == str(book_id))
        .options(selectinload(Invoice.entries))
        .order_by(Invoice.date_opened.asc(), Invoice.id.asc(), Invoice.guid.asc())
    )
    if customer_guid is not None:
        stmt = stmt.where(Invoice.owner_guid == str(customer_guid))
    invoices = db.execute(stmt).scalars().all()
    return [_invoice_to_out(invoice) for invoice in invoices]


@router.get("/{invoice_guid}", response_model=InvoiceOut)
def get_invoice(invoice_guid: UUID, db: Session = Depends(get_db)) -> dict:
    invoice = _load_invoice(db, invoice_guid=str(invoice_guid))
    return _invoice_to_out(invoice)


@router.patch("/{invoice_guid}", response_model=InvoiceOut)
def patch_invoice(invoice_guid: UUID, payload: InvoicePatch, db: Session = Depends(get_db)) -> dict:
    invoice = _load_invoice(db, invoice_guid=str(invoice_guid))
    data = payload.model_dump(exclude_unset=True)

    if "date_posted" in data:
        raise api_error(
            400,
            "DATE_POSTED_READ_ONLY",
            "date_posted is managed by invoice post/unpost endpoints",
        )

    if invoice.post_txn or invoice.date_posted is not None:
        blocked_fields = {"type", "id", "date_opened", "currency_guid", "customer_guid", "terms", "billing_id"}
        attempted = sorted(field for field in blocked_fields if field in data)
        if attempted:
            raise api_error(
                409,
                "INVOICE_ALREADY_POSTED",
                "invoice is posted; unpost before changing posting fields",
                {"invoice_guid": invoice.guid, "fields": attempted},
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

    if "customer_guid" in data:
        if data["customer_guid"] is None:
            raise api_error(400, "INVALID_CUSTOMER", "customer_guid cannot be null")
        customer_guid = str(data["customer_guid"])
        customer = db.get(Customer, customer_guid)
        if customer is None:
            raise api_error(
                400,
                "INVALID_CUSTOMER",
                "customer_guid must reference an existing customer",
                {"customer_guid": customer_guid},
            )
        if customer.book_id != invoice.book_id:
            raise api_error(
                409,
                "INVALID_CUSTOMER_BOOK",
                "customer must belong to the same book as the invoice",
                {"customer_guid": customer_guid, "book_id": invoice.book_id, "customer_book_id": customer.book_id},
            )
        invoice.owner_guid = customer_guid

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
    hydrated = _load_invoice(db, invoice_guid=invoice.guid)
    return _invoice_to_out(hydrated)


@router.post("/{invoice_guid}/post", response_model=InvoiceOut)
def post_invoice(invoice_guid: UUID, payload: InvoicePostRequest, db: Session = Depends(get_db)) -> dict:
    invoice = _load_invoice(db, invoice_guid=str(invoice_guid))
    _ensure_invoice_unposted(invoice)

    if not invoice.entries:
        raise api_error(
            409,
            "INVOICE_WITHOUT_ENTRIES",
            "invoice must contain at least one entry before posting",
            {"invoice_guid": invoice.guid},
        )

    currency = db.get(Commodity, invoice.currency_guid)
    if currency is None:
        raise api_error(
            400,
            "INVALID_CURRENCY",
            "invoice currency must reference an existing commodity",
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
    sign = Fraction(-1, 1) if invoice_type == "CREDIT_NOTE" else Fraction(1, 1)

    receivable_total = Fraction(0, 1)
    income_totals: dict[str, Fraction] = defaultdict(lambda: Fraction(0, 1))
    for entry in invoice.entries:
        _, _, total = _entry_totals(entry)
        signed_total = total * sign
        receivable_total += signed_total
        income_totals[entry.i_acct] += -signed_total

    if receivable_total == 0:
        raise api_error(
            409,
            "INVOICE_TOTAL_ZERO",
            "invoice total must be non-zero to post",
            {"invoice_guid": invoice.guid},
        )

    post_date = payload.post_date or datetime.now(UTC)
    if post_date.tzinfo is None:
        post_date = post_date.replace(tzinfo=UTC)

    tx_guid = str(uuid4())
    lot_guid = str(uuid4())
    lot = Lot(guid=lot_guid, account_guid=post_account_guid, is_closed=False)

    description = (payload.memo or "").strip() or f"Post invoice {invoice.id}"
    transaction = Transaction(
        guid=tx_guid,
        currency_guid=invoice.currency_guid,
        num=invoice.id or "",
        post_date=post_date,
        enter_date=datetime.now(UTC),
        description=description,
    )

    split_payloads: list[Split] = []
    receivable_num, receivable_denom = _fraction_to_split_parts(amount=receivable_total, fraction=currency.fraction)
    split_payloads.append(
        Split(
            guid=str(uuid4()),
            tx_guid=tx_guid,
            account_guid=post_account_guid,
            memo=invoice.id or "",
            action="",
            reconcile_state="n",
            reconcile_date=None,
            value_num=receivable_num,
            value_denom=receivable_denom,
            quantity_num=receivable_num,
            quantity_denom=receivable_denom,
            lot_guid=lot_guid,
        )
    )

    for income_account_guid in sorted(income_totals):
        amount = income_totals[income_account_guid]
        if amount == 0:
            continue
        value_num, value_denom = _fraction_to_split_parts(amount=amount, fraction=currency.fraction)
        split_payloads.append(
            Split(
                guid=str(uuid4()),
                tx_guid=tx_guid,
                account_guid=income_account_guid,
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
            "invoice posting requires at least two non-zero splits",
            {"invoice_guid": invoice.guid},
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
    hydrated = _load_invoice(db, invoice_guid=invoice.guid)
    return _invoice_to_out(hydrated)


@router.post("/{invoice_guid}/unpost", response_model=InvoiceOut)
def unpost_invoice(invoice_guid: UUID, db: Session = Depends(get_db)) -> dict:
    invoice = _load_invoice(db, invoice_guid=str(invoice_guid))
    if not invoice.post_txn and invoice.date_posted is None:
        raise api_error(
            409,
            "INVOICE_NOT_POSTED",
            "invoice is not posted",
            {"invoice_guid": invoice.guid},
        )
    if not invoice.post_txn:
        raise api_error(
            409,
            "INVOICE_POSTING_MISSING_TX",
            "invoice posting metadata is inconsistent; post_txn is required to unpost",
            {"invoice_guid": invoice.guid},
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
                "INVOICE_HAS_PAYMENTS",
                "invoice cannot be unposted while payment splits exist in its lot",
                {"invoice_guid": invoice.guid, "post_lot_guid": invoice.post_lot},
            )

    posting_tx = db.get(Transaction, invoice.post_txn)
    if posting_tx is None:
        raise api_error(
            409,
            "INVOICE_POSTING_MISSING_TX",
            "invoice posting transaction was not found",
            {"invoice_guid": invoice.guid, "post_tx_guid": invoice.post_txn},
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
    hydrated = _load_invoice(db, invoice_guid=invoice.guid)
    return _invoice_to_out(hydrated)


@router.delete("/{invoice_guid}", status_code=204)
def delete_invoice(invoice_guid: UUID, db: Session = Depends(get_db)) -> None:
    invoice = db.get(Invoice, str(invoice_guid))
    if invoice is None:
        raise api_error(404, "NOT_FOUND", "requested resource was not found")
    _ensure_invoice_unposted(invoice)
    db.delete(invoice)
    db.commit()


@router.post("/{invoice_guid}/entries", response_model=InvoiceEntryOut, status_code=201)
def create_invoice_entry(invoice_guid: UUID, payload: InvoiceEntryCreate, db: Session = Depends(get_db)) -> dict:
    invoice = db.get(Invoice, str(invoice_guid))
    if invoice is None:
        raise api_error(404, "NOT_FOUND", "requested resource was not found")
    _ensure_invoice_unposted(invoice)

    income_account_guid = str(payload.income_account_guid)
    _ensure_income_account(db, income_account_guid=income_account_guid, book_id=invoice.book_id)

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


@router.patch("/{invoice_guid}/entries/{entry_guid}", response_model=InvoiceEntryOut)
def patch_invoice_entry(
    invoice_guid: UUID,
    entry_guid: UUID,
    payload: InvoiceEntryPatch,
    db: Session = Depends(get_db),
) -> dict:
    invoice = db.get(Invoice, str(invoice_guid))
    if invoice is None:
        raise api_error(404, "NOT_FOUND", "requested resource was not found")
    _ensure_invoice_unposted(invoice)

    entry = _load_invoice_entry(db, invoice_guid=invoice.guid, entry_guid=str(entry_guid))
    data = payload.model_dump(exclude_unset=True)

    if "income_account_guid" in data:
        if data["income_account_guid"] is None:
            raise api_error(400, "INVALID_ACCOUNT", "income_account_guid cannot be null")
        income_account_guid = str(data["income_account_guid"])
        _ensure_income_account(db, income_account_guid=income_account_guid, book_id=invoice.book_id)
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


@router.delete("/{invoice_guid}/entries/{entry_guid}", status_code=204)
def delete_invoice_entry(invoice_guid: UUID, entry_guid: UUID, db: Session = Depends(get_db)) -> None:
    invoice = db.get(Invoice, str(invoice_guid))
    if invoice is None:
        raise api_error(404, "NOT_FOUND", "requested resource was not found")
    _ensure_invoice_unposted(invoice)

    entry = _load_invoice_entry(db, invoice_guid=invoice.guid, entry_guid=str(entry_guid))
    db.delete(entry)
    db.commit()
