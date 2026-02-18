from __future__ import annotations

from uuid import UUID, uuid4

from fastapi import APIRouter, Depends
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import api_error
from app.models import Account, AccountType, Book, Customer, Invoice, UserBookAccess, Vendor
from app.schemas import BookCreate, BookOut, BookPatch
from app.services.authorization import accessible_book_ids, ensure_book_read_access, require_superuser

router = APIRouter(prefix="/books", tags=["Books"])


def _active_book_query():
    return select(Book).where(Book.is_active.is_(True)).order_by(Book.created_at.asc(), Book.id.asc())


def _unset_other_active_books(db: Session, *, active_book_id: str) -> None:
    db.execute(
        update(Book)
        .where(Book.id != active_book_id)
        .where(Book.is_active.is_(True))
        .values(is_active=False)
    )


def _resolve_setup_account_guid(
    db: Session,
    *,
    book_id: str,
    account_guid: str | None,
    expected_type: AccountType,
    field_name: str,
) -> str | None:
    if account_guid is None:
        return None

    account = db.get(Account, account_guid)
    if account is None:
        raise api_error(
            400,
            "INVALID_ACCOUNT",
            f"{field_name} must reference an existing account",
            {field_name: account_guid},
        )
    if account.book_id != book_id:
        raise api_error(
            409,
            "INVALID_ACCOUNT_BOOK",
            f"{field_name} must belong to the same book",
            {
                field_name: account_guid,
                "book_id": book_id,
                "account_book_id": account.book_id,
            },
        )
    if account.type != expected_type:
        raise api_error(
            409,
            "INVALID_ACCOUNT_TYPE",
            f"{field_name} must use type {expected_type.value}",
            {
                field_name: account_guid,
                "account_type": account.type.value,
                "expected_type": expected_type.value,
            },
        )
    if account.is_placeholder:
        raise api_error(
            409,
            "INVALID_ACCOUNT",
            f"{field_name} cannot use a placeholder account",
            {field_name: account_guid},
        )
    return account.id


def _apply_book_setup_fields(
    db: Session,
    *,
    book: Book,
    payload_data: dict,
) -> None:
    if "default_payables_account_guid" in payload_data:
        payables_guid = (
            str(payload_data["default_payables_account_guid"])
            if payload_data["default_payables_account_guid"]
            else None
        )
        book.default_payables_account_guid = _resolve_setup_account_guid(
            db,
            book_id=book.id,
            account_guid=payables_guid,
            expected_type=AccountType.LIABILITY,
            field_name="default_payables_account_guid",
        )

    if "default_receivables_account_guid" in payload_data:
        receivables_guid = (
            str(payload_data["default_receivables_account_guid"])
            if payload_data["default_receivables_account_guid"]
            else None
        )
        book.default_receivables_account_guid = _resolve_setup_account_guid(
            db,
            book_id=book.id,
            account_guid=receivables_guid,
            expected_type=AccountType.ASSET,
            field_name="default_receivables_account_guid",
        )

    if "default_iss_recoverable_account_guid" in payload_data:
        iss_guid = (
            str(payload_data["default_iss_recoverable_account_guid"])
            if payload_data["default_iss_recoverable_account_guid"]
            else None
        )
        book.default_iss_recoverable_account_guid = _resolve_setup_account_guid(
            db,
            book_id=book.id,
            account_guid=iss_guid,
            expected_type=AccountType.ASSET,
            field_name="default_iss_recoverable_account_guid",
        )

    if (
        book.default_iss_recoverable_account_guid
        and book.default_receivables_account_guid
        and book.default_iss_recoverable_account_guid == book.default_receivables_account_guid
    ):
        raise api_error(
            409,
            "INVALID_BOOK_SETUP",
            "default_iss_recoverable_account_guid must be different from default_receivables_account_guid",
            {
                "default_receivables_account_guid": book.default_receivables_account_guid,
                "default_iss_recoverable_account_guid": book.default_iss_recoverable_account_guid,
            },
        )


@router.post("", response_model=BookOut, status_code=201)
def create_book(payload: BookCreate, db: Session = Depends(get_db)) -> Book:
    require_superuser(db)
    current_active = db.execute(_active_book_query().limit(1)).scalar_one_or_none()
    requested_active = payload.is_active
    is_active = bool(requested_active)
    if current_active is None:
        is_active = True

    book = Book(id=str(payload.id or uuid4()), name=payload.name, is_active=is_active)
    db.add(book)
    db.flush()
    create_data = payload.model_dump(exclude_unset=True)
    _apply_book_setup_fields(db, book=book, payload_data=create_data)
    if book.is_active:
        _unset_other_active_books(db, active_book_id=book.id)
    db.commit()
    db.refresh(book)
    return book


@router.get("", response_model=list[BookOut])
def list_books(db: Session = Depends(get_db)) -> list[Book]:
    allowed_book_ids = accessible_book_ids(db)
    stmt = select(Book)
    if allowed_book_ids is not None:
        if not allowed_book_ids:
            return []
        stmt = stmt.where(Book.id.in_(allowed_book_ids))
    return db.execute(stmt.order_by(Book.is_active.desc(), Book.created_at.asc())).scalars().all()


@router.get("/active", response_model=BookOut)
def get_active_book(db: Session = Depends(get_db)) -> Book:
    stmt = _active_book_query()
    allowed_book_ids = accessible_book_ids(db)
    if allowed_book_ids is not None:
        if not allowed_book_ids:
            raise api_error(404, "ACTIVE_BOOK_NOT_FOUND", "no active book is configured")
        stmt = stmt.where(Book.id.in_(allowed_book_ids))
    active = db.execute(stmt.limit(1)).scalar_one_or_none()
    if not active:
        raise api_error(404, "ACTIVE_BOOK_NOT_FOUND", "no active book is configured")
    return active


@router.get("/{book_id}", response_model=BookOut)
def get_book(book_id: UUID, db: Session = Depends(get_db)) -> Book:
    book = db.get(Book, str(book_id))
    if not book:
        raise api_error(404, "NOT_FOUND", "requested resource was not found")
    ensure_book_read_access(db, book_id=book.id)
    return book


@router.patch("/{book_id}", response_model=BookOut)
def patch_book(book_id: UUID, payload: BookPatch, db: Session = Depends(get_db)) -> Book:
    require_superuser(db)
    book = db.get(Book, str(book_id))
    if not book:
        raise api_error(404, "NOT_FOUND", "requested resource was not found")

    data = payload.model_dump(exclude_unset=True)
    if "name" in data:
        book.name = data["name"]
    if "is_active" in data and data["is_active"] is not None:
        if data["is_active"]:
            book.is_active = True
            _unset_other_active_books(db, active_book_id=book.id)
        else:
            has_other_active = db.execute(
                select(Book.id)
                .where(Book.id != book.id)
                .where(Book.is_active.is_(True))
                .limit(1)
            ).scalar_one_or_none()
            if has_other_active is None:
                raise api_error(
                    409,
                    "ACTIVE_BOOK_REQUIRED",
                    "at least one book must remain active",
                )
            book.is_active = False

    _apply_book_setup_fields(db, book=book, payload_data=data)

    db.commit()
    db.refresh(book)
    return book


@router.delete("/{book_id}", status_code=204)
def delete_book(book_id: UUID, db: Session = Depends(get_db)) -> None:
    require_superuser(db)
    book = db.get(Book, str(book_id))
    if not book:
        raise api_error(404, "NOT_FOUND", "requested resource was not found")

    has_accounts = db.execute(select(Account.id).where(Account.book_id == book.id).limit(1)).scalar_one_or_none()
    if has_accounts:
        raise api_error(409, "BOOK_HAS_ACCOUNTS", "book cannot be deleted while accounts exist", {"book_id": book.id})

    has_invoices = db.execute(select(Invoice.guid).where(Invoice.book_id == book.id).limit(1)).scalar_one_or_none()
    if has_invoices:
        raise api_error(409, "BOOK_HAS_INVOICES", "book cannot be deleted while invoices exist", {"book_id": book.id})

    has_customers = db.execute(select(Customer.guid).where(Customer.book_id == book.id).limit(1)).scalar_one_or_none()
    if has_customers:
        raise api_error(409, "BOOK_HAS_CUSTOMERS", "book cannot be deleted while customers exist", {"book_id": book.id})

    has_vendors = db.execute(select(Vendor.guid).where(Vendor.book_id == book.id).limit(1)).scalar_one_or_none()
    if has_vendors:
        raise api_error(409, "BOOK_HAS_VENDORS", "book cannot be deleted while vendors exist", {"book_id": book.id})

    has_access_assignments = db.execute(
        select(UserBookAccess.user_id).where(UserBookAccess.book_id == book.id).limit(1)
    ).scalar_one_or_none()
    if has_access_assignments:
        raise api_error(
            409,
            "BOOK_HAS_USER_ACCESS",
            "book cannot be deleted while user access assignments exist",
            {"book_id": book.id},
        )

    removed_active = bool(book.is_active)
    db.delete(book)
    db.flush()
    if removed_active:
        fallback = db.execute(select(Book).order_by(Book.created_at.asc(), Book.id.asc()).limit(1)).scalar_one_or_none()
        if fallback is not None:
            fallback.is_active = True
    db.commit()
