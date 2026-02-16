from __future__ import annotations

from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import api_error
from app.models import Account, Book, Commodity, InvoiceEntry, Split
from app.schemas import AccountCreate, AccountOut, AccountPatch, AccountTreeNode
from app.services.accounts import build_account_tree, validate_parent_constraints

router = APIRouter(prefix="/accounts", tags=["Accounts"])


@router.post("", response_model=AccountOut, status_code=201)
def create_account(payload: AccountCreate, db: Session = Depends(get_db)) -> Account:
    book_id = str(payload.book_id)
    commodity_id = str(payload.commodity_id)
    parent_id = str(payload.parent_id) if payload.parent_id else None
    account_id = str(payload.id or uuid4())
    account_type = payload.type.value

    if db.get(Book, book_id) is None:
        raise api_error(400, "INVALID_BOOK", "book_id must reference an existing book", {"book_id": book_id})
    if db.get(Commodity, commodity_id) is None:
        raise api_error(400, "INVALID_COMMODITY", "commodity_id must reference an existing commodity", {"commodity_id": commodity_id})

    if parent_id is None and account_type != "ROOT":
        raise api_error(400, "INVALID_PARENT", "root accounts must use type ROOT", {"type": account_type})
    if parent_id is not None and account_type == "ROOT":
        raise api_error(400, "INVALID_PARENT", "ROOT accounts cannot have a parent", {"parent_id": parent_id})

    validate_parent_constraints(db, account_id=account_id, book_id=book_id, parent_id=parent_id)

    account = Account(
        id=account_id,
        book_id=book_id,
        parent_id=parent_id,
        name=payload.name,
        code=payload.code,
        description=payload.description,
        type=account_type,
        commodity_id=commodity_id,
        is_placeholder=payload.is_placeholder,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


@router.get("", response_model=list[AccountOut])
def list_accounts(book_id: UUID = Query(...), db: Session = Depends(get_db)) -> list[Account]:
    return db.execute(select(Account).where(Account.book_id == str(book_id)).order_by(Account.name.asc())).scalars().all()


@router.get("/tree", response_model=list[AccountTreeNode])
def get_account_tree(book_id: UUID = Query(...), db: Session = Depends(get_db)) -> list[AccountTreeNode]:
    return build_account_tree(db, book_id=str(book_id))


@router.get("/{account_id}", response_model=AccountOut)
def get_account(account_id: UUID, db: Session = Depends(get_db)) -> Account:
    account = db.get(Account, str(account_id))
    if not account:
        raise api_error(404, "NOT_FOUND", "requested resource was not found")
    return account


@router.patch("/{account_id}", response_model=AccountOut)
def patch_account(account_id: UUID, payload: AccountPatch, db: Session = Depends(get_db)) -> Account:
    account = db.get(Account, str(account_id))
    if not account:
        raise api_error(404, "NOT_FOUND", "requested resource was not found")

    data = payload.model_dump(exclude_unset=True)

    new_parent_id = account.parent_id
    if "parent_id" in data:
        new_parent_id = str(data.pop("parent_id")) if data.get("parent_id") is not None else None

    if "commodity_id" in data and data["commodity_id"] is not None:
        commodity_id = str(data["commodity_id"])
        if db.get(Commodity, commodity_id) is None:
            raise api_error(400, "INVALID_COMMODITY", "commodity_id must reference an existing commodity", {"commodity_id": commodity_id})
        data["commodity_id"] = commodity_id

    new_type = account.type
    if "type" in data and data["type"] is not None:
        new_type = data["type"].value
        data["type"] = new_type

    if new_parent_id is None and new_type != "ROOT":
        raise api_error(400, "INVALID_PARENT", "root accounts must use type ROOT", {"type": new_type})
    if new_parent_id is not None and new_type == "ROOT":
        raise api_error(400, "INVALID_PARENT", "ROOT accounts cannot have a parent", {"parent_id": new_parent_id})

    validate_parent_constraints(db, account_id=account.id, book_id=account.book_id, parent_id=new_parent_id)
    account.parent_id = new_parent_id

    for key, value in data.items():
        setattr(account, key, value)

    db.commit()
    db.refresh(account)
    return account


@router.delete("/{account_id}", status_code=204)
def delete_account(account_id: UUID, db: Session = Depends(get_db)) -> None:
    account = db.get(Account, str(account_id))
    if not account:
        raise api_error(404, "NOT_FOUND", "requested resource was not found")

    has_children = db.execute(select(Account.id).where(Account.parent_id == account.id).limit(1)).scalar_one_or_none()
    if has_children:
        raise api_error(409, "ACCOUNT_HAS_CHILDREN", "account cannot be deleted while children exist", {"account_id": account.id})

    referenced_by_splits = db.execute(
        select(Split.guid).where(Split.account_guid == account.id).limit(1)
    ).scalar_one_or_none()
    if referenced_by_splits:
        raise api_error(
            409,
            "ACCOUNT_HAS_SPLITS",
            "account cannot be deleted while it is referenced by accounting entries",
            {"account_id": account.id},
        )

    referenced_by_invoice_entries = db.execute(
        select(InvoiceEntry.guid).where(InvoiceEntry.i_acct == account.id).limit(1)
    ).scalar_one_or_none()
    if referenced_by_invoice_entries:
        raise api_error(
            409,
            "ACCOUNT_HAS_ENTRIES",
            "account cannot be deleted while it is referenced by invoice entries",
            {"account_id": account.id},
        )

    db.delete(account)
    db.commit()
