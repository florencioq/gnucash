from __future__ import annotations

from sqlalchemy import func, select

from app.models import Book, Commodity
from app.services.seeds import SEED_BOOK_ID, SEED_COMMODITY_BRL_ID, seed_minimum_data


def test_seed_minimum_data_creates_required_entities(db_session):
    seed_minimum_data(db_session)

    book = db_session.get(Book, SEED_BOOK_ID)
    assert book is not None
    assert book.name == "Demo"
    assert book.created_at is not None

    commodity = db_session.get(Commodity, SEED_COMMODITY_BRL_ID)
    assert commodity is not None
    assert commodity.namespace == "CURRENCY"
    assert commodity.mnemonic == "BRL"
    assert commodity.fullname == "Brazilian Real"
    assert commodity.fraction == 100
    assert commodity.quote is False


def test_seed_minimum_data_is_idempotent(db_session):
    seed_minimum_data(db_session)
    seed_minimum_data(db_session)
    seed_minimum_data(db_session)

    book_count = db_session.execute(
        select(func.count()).select_from(Book).where(Book.id == SEED_BOOK_ID)
    ).scalar_one()
    assert book_count == 1

    commodity_count = db_session.execute(
        select(func.count()).select_from(Commodity).where(Commodity.namespace == "CURRENCY", Commodity.mnemonic == "BRL")
    ).scalar_one()
    assert commodity_count == 1
