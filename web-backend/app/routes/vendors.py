from __future__ import annotations

from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import api_error
from app.models import Account, AccountType, Book, Commodity, Invoice, Vendor
from app.schemas import VendorCreate, VendorOut, VendorPatch
from app.services.authorization import ensure_book_read_access, ensure_book_write_access

router = APIRouter(prefix="/vendors", tags=["Vendors"])


def _ensure_book_and_currency_exist(db: Session, *, book_id: str, currency_guid: str) -> None:
    if db.get(Book, book_id) is None:
        raise api_error(400, "INVALID_BOOK", "book_id must reference an existing book", {"book_id": book_id})
    if db.get(Commodity, currency_guid) is None:
        raise api_error(
            400,
            "INVALID_CURRENCY",
            "currency_guid must reference an existing commodity",
            {"currency_guid": currency_guid},
        )


def _resolve_expense_account_guid(
    db: Session,
    *,
    book_id: str,
    expense_account_guid: str | None,
) -> str | None:
    if expense_account_guid is None:
        return None

    account = db.get(Account, expense_account_guid)
    if account is None:
        raise api_error(
            400,
            "INVALID_ACCOUNT",
            "expense_account_guid must reference an existing account",
            {"expense_account_guid": expense_account_guid},
        )
    if account.book_id != book_id:
        raise api_error(
            409,
            "INVALID_ACCOUNT_BOOK",
            "expense account must belong to the same book as the vendor",
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
            "vendor default expense account must use type EXPENSE",
            {"expense_account_guid": expense_account_guid, "account_type": account.type.value},
        )
    if account.is_placeholder:
        raise api_error(
            409,
            "INVALID_ACCOUNT",
            "expense account cannot be a placeholder account",
            {"expense_account_guid": expense_account_guid},
        )
    return account.id


@router.post("", response_model=VendorOut, status_code=201)
def create_vendor(payload: VendorCreate, db: Session = Depends(get_db)) -> Vendor:
    book_id = str(payload.book_id)
    currency_guid = str(payload.currency_guid)
    expense_account_guid = str(payload.expense_account_guid) if payload.expense_account_guid else None
    terms_guid = str(payload.terms_guid) if payload.terms_guid else None
    tax_table_guid = str(payload.tax_table_guid) if payload.tax_table_guid else None

    ensure_book_write_access(db, book_id=book_id)

    _ensure_book_and_currency_exist(db, book_id=book_id, currency_guid=currency_guid)
    resolved_expense_account_guid = _resolve_expense_account_guid(
        db,
        book_id=book_id,
        expense_account_guid=expense_account_guid,
    )

    vendor = Vendor(
        guid=str(payload.guid or uuid4()),
        book_id=book_id,
        name=payload.name,
        id=payload.id,
        notes=payload.notes,
        currency_guid=currency_guid,
        expense_account_guid=resolved_expense_account_guid,
        active=payload.active,
        tax_override=payload.tax_override,
        addr_name=payload.addr_name,
        addr_addr1=payload.addr_addr1,
        addr_addr2=payload.addr_addr2,
        addr_addr3=payload.addr_addr3,
        addr_addr4=payload.addr_addr4,
        addr_phone=payload.addr_phone,
        addr_fax=payload.addr_fax,
        addr_email=payload.addr_email,
        terms_guid=terms_guid,
        tax_inc=payload.tax_inc,
        tax_table_guid=tax_table_guid,
    )
    db.add(vendor)
    db.commit()
    db.refresh(vendor)
    return vendor


@router.get("", response_model=list[VendorOut])
def list_vendors(book_id: UUID = Query(...), db: Session = Depends(get_db)) -> list[Vendor]:
    book_id_str = str(book_id)
    ensure_book_read_access(db, book_id=book_id_str)
    return db.execute(select(Vendor).where(Vendor.book_id == book_id_str).order_by(Vendor.name.asc())).scalars().all()


@router.get("/{vendor_guid}", response_model=VendorOut)
def get_vendor(vendor_guid: UUID, db: Session = Depends(get_db)) -> Vendor:
    vendor = db.get(Vendor, str(vendor_guid))
    if not vendor:
        raise api_error(404, "NOT_FOUND", "requested resource was not found")
    ensure_book_read_access(db, book_id=vendor.book_id)
    return vendor


@router.patch("/{vendor_guid}", response_model=VendorOut)
def patch_vendor(vendor_guid: UUID, payload: VendorPatch, db: Session = Depends(get_db)) -> Vendor:
    vendor = db.get(Vendor, str(vendor_guid))
    if not vendor:
        raise api_error(404, "NOT_FOUND", "requested resource was not found")
    ensure_book_write_access(db, book_id=vendor.book_id)

    data = payload.model_dump(exclude_unset=True)

    if "currency_guid" in data and data["currency_guid"] is not None:
        currency_guid = str(data["currency_guid"])
        if db.get(Commodity, currency_guid) is None:
            raise api_error(
                400,
                "INVALID_CURRENCY",
                "currency_guid must reference an existing commodity",
                {"currency_guid": currency_guid},
            )
        data["currency_guid"] = currency_guid

    if "terms_guid" in data:
        data["terms_guid"] = str(data["terms_guid"]) if data["terms_guid"] else None
    if "tax_table_guid" in data:
        data["tax_table_guid"] = str(data["tax_table_guid"]) if data["tax_table_guid"] else None
    if "expense_account_guid" in data:
        expense_account_guid = str(data["expense_account_guid"]) if data["expense_account_guid"] else None
        data["expense_account_guid"] = _resolve_expense_account_guid(
            db,
            book_id=vendor.book_id,
            expense_account_guid=expense_account_guid,
        )

    for key, value in data.items():
        setattr(vendor, key, value)

    db.commit()
    db.refresh(vendor)
    return vendor


@router.delete("/{vendor_guid}", status_code=204)
def delete_vendor(vendor_guid: UUID, db: Session = Depends(get_db)) -> None:
    vendor = db.get(Vendor, str(vendor_guid))
    if not vendor:
        raise api_error(404, "NOT_FOUND", "requested resource was not found")
    ensure_book_write_access(db, book_id=vendor.book_id)
    has_bills = db.execute(
        select(Invoice.guid)
        .where(Invoice.owner_type == "VENDOR", Invoice.owner_guid == vendor.guid)
        .limit(1)
    ).scalar_one_or_none()
    if has_bills:
        raise api_error(
            409,
            "VENDOR_HAS_BILLS",
            "vendor cannot be deleted while bills exist",
            {"vendor_guid": vendor.guid},
        )
    db.delete(vendor)
    db.commit()
