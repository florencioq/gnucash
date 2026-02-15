from __future__ import annotations

from fractions import Fraction
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import api_error
from app.models import Account, Commodity, Split
from app.schemas import SplitIn


def ensure_currency_exists(db: Session, *, currency_guid: str) -> None:
    if db.get(Commodity, currency_guid) is None:
        raise api_error(
            400,
            "INVALID_CURRENCY",
            "currency_guid must reference an existing commodity",
            {"currency_guid": currency_guid},
        )


def build_validated_splits(
    db: Session,
    *,
    tx_guid: str,
    split_payloads: list[SplitIn],
) -> tuple[list[Split], str]:
    if len(split_payloads) < 2:
        raise api_error(
            400,
            "INVALID_SPLITS",
            "a transaction must contain at least two splits",
            {"minimum_splits": 2},
        )

    requested_account_ids = [str(split.account_guid) for split in split_payloads]
    accounts = db.execute(
        select(Account).where(Account.id.in_(set(requested_account_ids)))
    ).scalars().all()
    accounts_by_id = {account.id: account for account in accounts}

    for account_id in requested_account_ids:
        if account_id not in accounts_by_id:
            raise api_error(
                400,
                "INVALID_ACCOUNT",
                "split account_guid must reference an existing account",
                {"account_guid": account_id},
            )

    book_ids = {accounts_by_id[account_id].book_id for account_id in requested_account_ids}
    if len(book_ids) != 1:
        raise api_error(
            409,
            "INVALID_TRANSACTION_BOOK",
            "all split accounts must belong to the same book",
            {"book_ids": sorted(book_ids)},
        )
    book_id = next(iter(book_ids))

    balance = Fraction(0, 1)
    for split in split_payloads:
        balance += Fraction(split.value_num, split.value_denom)
    if balance != 0:
        raise api_error(
            409,
            "TRANSACTION_UNBALANCED",
            "sum of split values must be zero",
            {"balance_num": balance.numerator, "balance_denom": balance.denominator},
        )

    built_splits: list[Split] = []
    for split in split_payloads:
        built_splits.append(
            Split(
                guid=str(split.guid or uuid4()),
                tx_guid=tx_guid,
                account_guid=str(split.account_guid),
                memo=split.memo,
                action=split.action,
                reconcile_state=split.reconcile_state,
                reconcile_date=split.reconcile_date,
                value_num=split.value_num,
                value_denom=split.value_denom,
                quantity_num=split.quantity_num,
                quantity_denom=split.quantity_denom,
                lot_guid=str(split.lot_guid) if split.lot_guid else None,
            )
        )

    return built_splits, book_id
