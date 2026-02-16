from __future__ import annotations

from uuid import UUID, uuid4

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import api_error
from app.models import Account, Book, Customer, Vendor
from app.schemas import BookCreate, BookOut, BookPatch

router = APIRouter(prefix="/books", tags=["Books"])


@router.post("", response_model=BookOut, status_code=201)
def create_book(payload: BookCreate, db: Session = Depends(get_db)) -> Book:
    book = Book(id=str(payload.id or uuid4()), name=payload.name)
    db.add(book)
    db.commit()
    db.refresh(book)
    return book


@router.get("", response_model=list[BookOut])
def list_books(db: Session = Depends(get_db)) -> list[Book]:
    return db.execute(select(Book).order_by(Book.created_at.asc())).scalars().all()


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
    for key, value in data.items():
        setattr(book, key, value)

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

    has_customers = db.execute(select(Customer.guid).where(Customer.book_id == book.id).limit(1)).scalar_one_or_none()
    if has_customers:
        raise api_error(409, "BOOK_HAS_CUSTOMERS", "book cannot be deleted while customers exist", {"book_id": book.id})

    has_vendors = db.execute(select(Vendor.guid).where(Vendor.book_id == book.id).limit(1)).scalar_one_or_none()
    if has_vendors:
        raise api_error(409, "BOOK_HAS_VENDORS", "book cannot be deleted while vendors exist", {"book_id": book.id})

    db.delete(book)
    db.commit()
