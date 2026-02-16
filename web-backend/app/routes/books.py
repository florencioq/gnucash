from __future__ import annotations

from uuid import UUID, uuid4

from fastapi import APIRouter, Depends
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import api_error
from app.models import Account, Book, Customer, Invoice, Vendor
from app.schemas import BookCreate, BookOut, BookPatch

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


@router.post("", response_model=BookOut, status_code=201)
def create_book(payload: BookCreate, db: Session = Depends(get_db)) -> Book:
    current_active = db.execute(_active_book_query().limit(1)).scalar_one_or_none()
    requested_active = payload.is_active
    is_active = bool(requested_active)
    if current_active is None:
        is_active = True

    book = Book(id=str(payload.id or uuid4()), name=payload.name, is_active=is_active)
    db.add(book)
    db.flush()
    if book.is_active:
        _unset_other_active_books(db, active_book_id=book.id)
    db.commit()
    db.refresh(book)
    return book


@router.get("", response_model=list[BookOut])
def list_books(db: Session = Depends(get_db)) -> list[Book]:
    return db.execute(select(Book).order_by(Book.is_active.desc(), Book.created_at.asc())).scalars().all()


@router.get("/active", response_model=BookOut)
def get_active_book(db: Session = Depends(get_db)) -> Book:
    active = db.execute(_active_book_query().limit(1)).scalar_one_or_none()
    if not active:
        raise api_error(404, "ACTIVE_BOOK_NOT_FOUND", "no active book is configured")
    return active


@router.get("/{book_id}", response_model=BookOut)
def get_book(book_id: UUID, db: Session = Depends(get_db)) -> Book:
    book = db.get(Book, str(book_id))
    if not book:
        raise api_error(404, "NOT_FOUND", "requested resource was not found")
    return book


@router.patch("/{book_id}", response_model=BookOut)
def patch_book(book_id: UUID, payload: BookPatch, db: Session = Depends(get_db)) -> Book:
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

    db.commit()
    db.refresh(book)
    return book


@router.delete("/{book_id}", status_code=204)
def delete_book(book_id: UUID, db: Session = Depends(get_db)) -> None:
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

    removed_active = bool(book.is_active)
    db.delete(book)
    db.flush()
    if removed_active:
        fallback = db.execute(select(Book).order_by(Book.created_at.asc(), Book.id.asc()).limit(1)).scalar_one_or_none()
        if fallback is not None:
            fallback.is_active = True
    db.commit()
