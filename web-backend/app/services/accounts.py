from __future__ import annotations
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import HTTPException
from ..models import Account, Book, Commodity

async def ensure_book_exists(session: AsyncSession, book_id: str):
    if not await session.get(Book, book_id):
        raise HTTPException(status_code=400, detail="Invalid book_id")

async def ensure_commodity_exists(session: AsyncSession, commodity_id: str):
    if not await session.get(Commodity, commodity_id):
        raise HTTPException(status_code=400, detail="Invalid commodity_id")

async def ensure_parent_valid(session: AsyncSession, parent_id: Optional[str], book_id: str):
    if parent_id is None:
        return
    parent = await session.get(Account, parent_id)
    if not parent:
        raise HTTPException(status_code=400, detail="Invalid parent_id")
    if parent.book_id != book_id:
        raise HTTPException(status_code=400, detail="Parent must belong to same book")

async def ensure_name_unique(session: AsyncSession, book_id: str, parent_id: Optional[str], name: str, exclude_id: Optional[str] = None):
    stmt = select(func.count()).select_from(Account).where(
        Account.book_id == book_id,
        Account.parent_id == parent_id,
        Account.name == name,
    )
    if exclude_id:
        stmt = stmt.where(Account.id != exclude_id)
    res = await session.execute(stmt)
    if res.scalar_one() > 0:
        raise HTTPException(status_code=409, detail="Account name must be unique among siblings")

async def check_no_cycle(session: AsyncSession, account_id: str, new_parent_id: Optional[str]):
    if new_parent_id is None:
        return
    if account_id == new_parent_id:
        raise HTTPException(status_code=400, detail="Parent cannot be self")
    # Collect descendants of account_id
    descendants = set()
    to_visit = {account_id}
    while to_visit:
        current_id = to_visit.pop()
        res = await session.execute(select(Account.id).where(Account.parent_id == current_id))
        ids = set(res.scalars().all())
        new_ids = ids - descendants
        descendants.update(new_ids)
        to_visit.update(new_ids)
    if new_parent_id in descendants:
        raise HTTPException(status_code=400, detail="Parent cannot be a descendant (cycle)")
