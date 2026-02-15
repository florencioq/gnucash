from __future__ import annotations

from collections import defaultdict
from fractions import Fraction

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import api_error
from app.models import Account, Split
from app.schemas import AccountTreeNode


def validate_parent_constraints(
    db: Session,
    *,
    account_id: str,
    book_id: str,
    parent_id: str | None,
) -> None:
    if parent_id is None:
        return
    if parent_id == account_id:
        raise api_error(400, "INVALID_PARENT", "account cannot be its own parent", {"parent_id": parent_id})

    parent = db.get(Account, parent_id)
    if parent is None:
        raise api_error(400, "INVALID_PARENT", "parent_id does not reference an existing account", {"parent_id": parent_id})
    if parent.book_id != book_id:
        raise api_error(
            400,
            "INVALID_PARENT",
            "parent_id must reference an account in the same book",
            {"parent_id": parent_id, "book_id": book_id},
        )

    cursor = parent
    visited: set[str] = set()
    while cursor is not None:
        if cursor.id == account_id:
            raise api_error(409, "ACCOUNT_CYCLE", "account hierarchy cannot contain cycles", {"account_id": account_id})
        if cursor.id in visited:
            raise api_error(409, "ACCOUNT_CYCLE", "account hierarchy cannot contain cycles", {"account_id": account_id})
        visited.add(cursor.id)
        if cursor.parent_id is None:
            break
        cursor = db.get(Account, cursor.parent_id)


def build_account_tree(db: Session, *, book_id: str) -> list[AccountTreeNode]:
    accounts = db.execute(select(Account).where(Account.book_id == book_id).order_by(Account.name.asc())).scalars().all()
    account_ids = [account.id for account in accounts]

    balances_by_account: dict[str, Fraction] = defaultdict(lambda: Fraction(0, 1))
    if account_ids:
        split_rows = db.execute(
            select(Split.account_guid, Split.value_num, Split.value_denom).where(Split.account_guid.in_(account_ids))
        ).all()
        for account_guid, value_num, value_denom in split_rows:
            balances_by_account[account_guid] += Fraction(value_num, value_denom)

    by_parent: dict[str | None, list[Account]] = defaultdict(list)
    for account in accounts:
        by_parent[account.parent_id].append(account)

    def build_node(account: Account) -> AccountTreeNode:
        children = sorted(by_parent.get(account.id, []), key=lambda x: x.name)
        balance = balances_by_account.get(account.id, Fraction(0, 1))
        return AccountTreeNode(
            id=account.id,
            book_id=account.book_id,
            parent_id=account.parent_id,
            name=account.name,
            code=account.code,
            type=account.type.value,
            commodity_id=account.commodity_id,
            is_placeholder=account.is_placeholder,
            balance_num=balance.numerator,
            balance_denom=balance.denominator,
            children=[build_node(child) for child in children],
        )

    roots = sorted(by_parent.get(None, []), key=lambda x: x.name)
    return [build_node(root) for root in roots]
