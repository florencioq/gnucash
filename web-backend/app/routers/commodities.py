from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from ..db import get_session
from ..models import Commodity
from ..schemas import CommodityCreate, CommodityOut
from ..utils import new_guid

router = APIRouter()

@router.post("", response_model=CommodityOut)
async def create_commodity(payload: CommodityCreate, session: AsyncSession = Depends(get_session)):
    commodity = Commodity(
        id=new_guid(),
        namespace=payload.namespace,
        mnemonic=payload.mnemonic,
        fullname=payload.fullname,
        fraction=payload.fraction,
        quote=payload.quote,
    )
    session.add(commodity)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=409, detail="Commodity namespace+mnemonic must be unique")
    await session.refresh(commodity)
    return commodity

@router.get("", response_model=list[CommodityOut])
async def list_commodities(namespace: str | None = None, mnemonic: str | None = None, session: AsyncSession = Depends(get_session)):
    stmt = select(Commodity)
    if namespace:
        stmt = stmt.where(Commodity.namespace == namespace)
    if mnemonic:
        stmt = stmt.where(Commodity.mnemonic == mnemonic)
    res = await session.execute(stmt)
    return res.scalars().all()

@router.get("/{commodity_id}", response_model=CommodityOut)
async def get_commodity(commodity_id: str, session: AsyncSession = Depends(get_session)):
    commodity = await session.get(Commodity, commodity_id)
    if not commodity:
        raise HTTPException(status_code=404, detail="Commodity not found")
    return commodity
