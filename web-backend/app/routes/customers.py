from __future__ import annotations

from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import api_error
from app.models import Account, AccountType, Book, Commodity, Customer, Invoice
from app.schemas import CustomerCreate, CustomerOut, CustomerPatch
from app.services.authorization import ensure_book_read_access, ensure_book_write_access

router = APIRouter(prefix="/customers", tags=["Customers"])


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


def _resolve_income_account_guid(
    db: Session,
    *,
    book_id: str,
    income_account_guid: str | None,
) -> str | None:
    if income_account_guid is None:
        return None

    account = db.get(Account, income_account_guid)
    if account is None:
        raise api_error(
            400,
            "INVALID_ACCOUNT",
            "income_account_guid must reference an existing account",
            {"income_account_guid": income_account_guid},
        )
    if account.book_id != book_id:
        raise api_error(
            409,
            "INVALID_ACCOUNT_BOOK",
            "income account must belong to the same book as the customer",
            {
                "income_account_guid": income_account_guid,
                "book_id": book_id,
                "account_book_id": account.book_id,
            },
        )
    if account.type != AccountType.INCOME:
        raise api_error(
            409,
            "INVALID_ACCOUNT_TYPE",
            "customer default income account must use type INCOME",
            {"income_account_guid": income_account_guid, "account_type": account.type.value},
        )
    if account.is_placeholder:
        raise api_error(
            409,
            "INVALID_ACCOUNT",
            "income account cannot be a placeholder account",
            {"income_account_guid": income_account_guid},
        )
    return account.id


@router.post("", response_model=CustomerOut, status_code=201)
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db)) -> Customer:
    book_id = str(payload.book_id)
    currency_guid = str(payload.currency_guid)
    income_account_guid = str(payload.income_account_guid) if payload.income_account_guid else None
    terms_guid = str(payload.terms_guid) if payload.terms_guid else None
    taxtable_guid = str(payload.taxtable_guid) if payload.taxtable_guid else None

    ensure_book_write_access(db, book_id=book_id)

    _ensure_book_and_currency_exist(db, book_id=book_id, currency_guid=currency_guid)
    resolved_income_account_guid = _resolve_income_account_guid(
        db,
        book_id=book_id,
        income_account_guid=income_account_guid,
    )

    customer = Customer(
        guid=str(payload.guid or uuid4()),
        book_id=book_id,
        name=payload.name,
        id=payload.id,
        notes=payload.notes,
        active=payload.active,
        discount_num=payload.discount_num,
        discount_denom=payload.discount_denom,
        credit_num=payload.credit_num,
        credit_denom=payload.credit_denom,
        currency_guid=currency_guid,
        income_account_guid=resolved_income_account_guid,
        tax_override=payload.tax_override,
        addr_name=payload.addr_name,
        addr_addr1=payload.addr_addr1,
        addr_addr2=payload.addr_addr2,
        addr_addr3=payload.addr_addr3,
        addr_addr4=payload.addr_addr4,
        addr_phone=payload.addr_phone,
        addr_fax=payload.addr_fax,
        addr_email=payload.addr_email,
        shipaddr_name=payload.shipaddr_name,
        shipaddr_addr1=payload.shipaddr_addr1,
        shipaddr_addr2=payload.shipaddr_addr2,
        shipaddr_addr3=payload.shipaddr_addr3,
        shipaddr_addr4=payload.shipaddr_addr4,
        shipaddr_phone=payload.shipaddr_phone,
        shipaddr_fax=payload.shipaddr_fax,
        shipaddr_email=payload.shipaddr_email,
        terms_guid=terms_guid,
        tax_included=payload.tax_included,
        taxtable_guid=taxtable_guid,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@router.get("", response_model=list[CustomerOut])
def list_customers(book_id: UUID = Query(...), db: Session = Depends(get_db)) -> list[Customer]:
    book_id_str = str(book_id)
    ensure_book_read_access(db, book_id=book_id_str)
    return (
        db.execute(select(Customer).where(Customer.book_id == book_id_str).order_by(Customer.name.asc()))
        .scalars()
        .all()
    )


@router.get("/{customer_guid}", response_model=CustomerOut)
def get_customer(customer_guid: UUID, db: Session = Depends(get_db)) -> Customer:
    customer = db.get(Customer, str(customer_guid))
    if not customer:
        raise api_error(404, "NOT_FOUND", "requested resource was not found")
    ensure_book_read_access(db, book_id=customer.book_id)
    return customer


@router.patch("/{customer_guid}", response_model=CustomerOut)
def patch_customer(customer_guid: UUID, payload: CustomerPatch, db: Session = Depends(get_db)) -> Customer:
    customer = db.get(Customer, str(customer_guid))
    if not customer:
        raise api_error(404, "NOT_FOUND", "requested resource was not found")
    ensure_book_write_access(db, book_id=customer.book_id)

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
    if "taxtable_guid" in data:
        data["taxtable_guid"] = str(data["taxtable_guid"]) if data["taxtable_guid"] else None
    if "income_account_guid" in data:
        income_account_guid = str(data["income_account_guid"]) if data["income_account_guid"] else None
        data["income_account_guid"] = _resolve_income_account_guid(
            db,
            book_id=customer.book_id,
            income_account_guid=income_account_guid,
        )

    for key, value in data.items():
        setattr(customer, key, value)

    db.commit()
    db.refresh(customer)
    return customer


@router.delete("/{customer_guid}", status_code=204)
def delete_customer(customer_guid: UUID, db: Session = Depends(get_db)) -> None:
    customer = db.get(Customer, str(customer_guid))
    if not customer:
        raise api_error(404, "NOT_FOUND", "requested resource was not found")
    ensure_book_write_access(db, book_id=customer.book_id)

    has_invoices = db.execute(
        select(Invoice.guid)
        .where(Invoice.owner_type == "CUSTOMER", Invoice.owner_guid == customer.guid)
        .limit(1)
    ).scalar_one_or_none()
    if has_invoices:
        raise api_error(
            409,
            "CUSTOMER_HAS_INVOICES",
            "customer cannot be deleted while invoices exist",
            {"customer_guid": customer.guid},
        )

    db.delete(customer)
    db.commit()
