from __future__ import annotations

from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import api_error
from app.models import Account, Commodity, Customer, Invoice, Transaction, Vendor
from app.schemas import CommodityCreate, CommodityOut, CommodityPatch
from app.services.authorization import require_superuser

router = APIRouter(prefix="/commodities", tags=["Commodities"])


@router.post("", response_model=CommodityOut, status_code=201)
def create_commodity(payload: CommodityCreate, db: Session = Depends(get_db)) -> Commodity:
    require_superuser(db)
    commodity = Commodity(
        id=str(payload.id or uuid4()),
        namespace=payload.namespace,
        mnemonic=payload.mnemonic,
        fullname=payload.fullname,
        fraction=payload.fraction,
        quote=payload.quote,
    )
    db.add(commodity)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise api_error(409, "COMMODITY_NAMESPACE_MNEMONIC_EXISTS", "namespace+mnemonic must be unique")
    db.refresh(commodity)
    return commodity


@router.get("", response_model=list[CommodityOut])
def list_commodities(namespace: str | None = Query(default=None), db: Session = Depends(get_db)) -> list[Commodity]:
    stmt = select(Commodity)
    if namespace:
        stmt = stmt.where(Commodity.namespace == namespace)
    return db.execute(stmt.order_by(Commodity.namespace.asc(), Commodity.mnemonic.asc())).scalars().all()


@router.get("/{commodity_id}", response_model=CommodityOut)
def get_commodity(commodity_id: UUID, db: Session = Depends(get_db)) -> Commodity:
    commodity = db.get(Commodity, str(commodity_id))
    if not commodity:
        raise api_error(404, "NOT_FOUND", "requested resource was not found")
    return commodity


@router.patch("/{commodity_id}", response_model=CommodityOut)
def patch_commodity(commodity_id: UUID, payload: CommodityPatch, db: Session = Depends(get_db)) -> Commodity:
    require_superuser(db)
    commodity = db.get(Commodity, str(commodity_id))
    if not commodity:
        raise api_error(404, "NOT_FOUND", "requested resource was not found")

    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(commodity, key, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise api_error(409, "COMMODITY_NAMESPACE_MNEMONIC_EXISTS", "namespace+mnemonic must be unique")
    db.refresh(commodity)
    return commodity


@router.delete("/{commodity_id}", status_code=204)
def delete_commodity(commodity_id: UUID, db: Session = Depends(get_db)) -> None:
    require_superuser(db)
    commodity = db.get(Commodity, str(commodity_id))
    if not commodity:
        raise api_error(404, "NOT_FOUND", "requested resource was not found")

    referenced = db.execute(select(Account.id).where(Account.commodity_id == commodity.id).limit(1)).scalar_one_or_none()
    if referenced:
        raise api_error(
            409,
            "COMMODITY_IN_USE",
            "commodity cannot be deleted while referenced by accounts",
            {"commodity_id": commodity.id},
        )

    referenced_by_customers = db.execute(
        select(Customer.guid).where(Customer.currency_guid == commodity.id).limit(1)
    ).scalar_one_or_none()
    if referenced_by_customers:
        raise api_error(
            409,
            "COMMODITY_IN_USE",
            "commodity cannot be deleted while referenced by customers",
            {"commodity_id": commodity.id},
        )

    referenced_by_vendors = db.execute(
        select(Vendor.guid).where(Vendor.currency_guid == commodity.id).limit(1)
    ).scalar_one_or_none()
    if referenced_by_vendors:
        raise api_error(
            409,
            "COMMODITY_IN_USE",
            "commodity cannot be deleted while referenced by vendors",
            {"commodity_id": commodity.id},
        )

    referenced_by_invoices = db.execute(
        select(Invoice.guid).where(Invoice.currency_guid == commodity.id).limit(1)
    ).scalar_one_or_none()
    if referenced_by_invoices:
        raise api_error(
            409,
            "COMMODITY_IN_USE",
            "commodity cannot be deleted while referenced by invoices",
            {"commodity_id": commodity.id},
        )

    used_as_currency = db.execute(
        select(Transaction.guid).where(Transaction.currency_guid == commodity.id).limit(1)
    ).scalar_one_or_none()
    if used_as_currency:
        raise api_error(
            409,
            "COMMODITY_IN_USE",
            "commodity cannot be deleted while referenced by transactions",
            {"commodity_id": commodity.id},
        )

    db.delete(commodity)
    db.commit()
