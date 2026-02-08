from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Book, Commodity

SEED_BOOK_ID = "6f68f651-c9c3-4f95-9f44-f2e8f4a8ef74"
SEED_COMMODITY_BRL_ID = "182c9998-96f1-46c9-bd4d-56bde24800d3"


def seed_minimum_data(db: Session) -> None:
    book = db.get(Book, SEED_BOOK_ID)
    if book is None:
        book = Book(id=SEED_BOOK_ID, name="Demo")
        db.add(book)
    else:
        book.name = "Demo"

    commodity = db.get(Commodity, SEED_COMMODITY_BRL_ID)
    if commodity is None:
        commodity = db.execute(
            select(Commodity).where(Commodity.namespace == "CURRENCY", Commodity.mnemonic == "BRL")
        ).scalar_one_or_none()

    if commodity is None:
        commodity = Commodity(
            id=SEED_COMMODITY_BRL_ID,
            namespace="CURRENCY",
            mnemonic="BRL",
            fullname="Brazilian Real",
            fraction=100,
            quote=False,
        )
        db.add(commodity)
    else:
        commodity.namespace = "CURRENCY"
        commodity.mnemonic = "BRL"
        commodity.fullname = "Brazilian Real"
        commodity.fraction = 100
        commodity.quote = False

    db.commit()
