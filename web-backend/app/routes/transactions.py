from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.errors import api_error
from app.models import Account, Split, Transaction
from app.schemas import TransactionCreate, TransactionOut, TransactionPatch
from app.services.transactions import build_validated_splits, ensure_currency_exists

router = APIRouter(prefix="/transactions", tags=["Transactions"])


@router.post("", response_model=TransactionOut, status_code=201)
def create_transaction(payload: TransactionCreate, db: Session = Depends(get_db)) -> Transaction:
    tx_guid = str(payload.guid or uuid4())
    currency_guid = str(payload.currency_guid)

    ensure_currency_exists(db, currency_guid=currency_guid)
    splits, _book_id = build_validated_splits(db, tx_guid=tx_guid, split_payloads=payload.splits)

    transaction = Transaction(
        guid=tx_guid,
        currency_guid=currency_guid,
        num=payload.num,
        post_date=payload.post_date,
        enter_date=payload.enter_date or datetime.now(UTC),
        description=payload.description,
    )
    transaction.splits = splits
    db.add(transaction)
    db.commit()

    return db.execute(
        select(Transaction)
        .where(Transaction.guid == tx_guid)
        .options(selectinload(Transaction.splits))
    ).scalar_one()


@router.get("", response_model=list[TransactionOut])
def list_transactions(book_id: UUID = Query(...), db: Session = Depends(get_db)) -> list[Transaction]:
    stmt = (
        select(Transaction)
        .join(Split, Split.tx_guid == Transaction.guid)
        .join(Account, Account.id == Split.account_guid)
        .where(Account.book_id == str(book_id))
        .options(selectinload(Transaction.splits))
        .order_by(Transaction.post_date.asc(), Transaction.enter_date.asc(), Transaction.guid.asc())
    )
    return db.execute(stmt).unique().scalars().all()


@router.get("/{tx_guid}", response_model=TransactionOut)
def get_transaction(tx_guid: UUID, db: Session = Depends(get_db)) -> Transaction:
    transaction = db.execute(
        select(Transaction)
        .where(Transaction.guid == str(tx_guid))
        .options(selectinload(Transaction.splits))
    ).scalar_one_or_none()
    if not transaction:
        raise api_error(404, "NOT_FOUND", "requested resource was not found")
    return transaction


@router.patch("/{tx_guid}", response_model=TransactionOut)
def patch_transaction(tx_guid: UUID, payload: TransactionPatch, db: Session = Depends(get_db)) -> Transaction:
    transaction = db.execute(
        select(Transaction)
        .where(Transaction.guid == str(tx_guid))
        .options(selectinload(Transaction.splits))
    ).scalar_one_or_none()
    if not transaction:
        raise api_error(404, "NOT_FOUND", "requested resource was not found")

    if "currency_guid" in payload.model_fields_set:
        if payload.currency_guid is None:
            raise api_error(400, "INVALID_CURRENCY", "currency_guid cannot be null")
        currency_guid = str(payload.currency_guid)
        ensure_currency_exists(db, currency_guid=currency_guid)
        transaction.currency_guid = currency_guid

    if "num" in payload.model_fields_set:
        transaction.num = payload.num or ""
    if "post_date" in payload.model_fields_set:
        transaction.post_date = payload.post_date
    if "enter_date" in payload.model_fields_set:
        transaction.enter_date = payload.enter_date
    if "description" in payload.model_fields_set:
        transaction.description = payload.description

    if "splits" in payload.model_fields_set:
        if payload.splits is None:
            raise api_error(400, "INVALID_SPLITS", "splits cannot be null")
        new_splits, _book_id = build_validated_splits(db, tx_guid=transaction.guid, split_payloads=payload.splits)
        transaction.splits.clear()
        transaction.splits.extend(new_splits)

    db.commit()
    return db.execute(
        select(Transaction)
        .where(Transaction.guid == transaction.guid)
        .options(selectinload(Transaction.splits))
    ).scalar_one()


@router.delete("/{tx_guid}", status_code=204)
def delete_transaction(tx_guid: UUID, db: Session = Depends(get_db)) -> None:
    transaction = db.get(Transaction, str(tx_guid))
    if not transaction:
        raise api_error(404, "NOT_FOUND", "requested resource was not found")
    db.delete(transaction)
    db.commit()
