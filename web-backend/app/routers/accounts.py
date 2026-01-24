from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from ..db import get_session
from ..models import Account
from ..schemas import AccountCreate, AccountUpdate, AccountOut, AccountNode
from ..utils import new_guid
from ..services.accounts import (
    ensure_book_exists,
    ensure_commodity_exists,
    ensure_parent_valid,
    ensure_name_unique,
    check_no_cycle,
)

router = APIRouter()

@router.post("", response_model=AccountOut)
async def create_account(payload: AccountCreate, session: AsyncSession = Depends(get_session)):
    await ensure_book_exists(session, payload.book_id)
    await ensure_commodity_exists(session, payload.commodity_id)
    await ensure_parent_valid(session, payload.parent_id, payload.book_id)
    await ensure_name_unique(session, payload.book_id, payload.parent_id, payload.name)

    account = Account(
        id=new_guid(),
        book_id=payload.book_id,
        parent_id=payload.parent_id,
        name=payload.name,
        code=payload.code,
        description=payload.description,
        type=payload.type,
        commodity_id=payload.commodity_id,
        is_placeholder=payload.is_placeholder,
    )
    session.add(account)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=400, detail="Invalid references or payload")
    await session.refresh(account)
    return account

@router.get("", response_model=list[AccountOut])
async def list_accounts(
    book_id: str | None = None,
    parent_id: str | None = None,
    type: str | None = None,
    commodity_id: str | None = None,
    session: AsyncSession = Depends(get_session),
):
    stmt = select(Account)
    if book_id:
        stmt = stmt.where(Account.book_id == book_id)
    if parent_id:
        stmt = stmt.where(Account.parent_id == parent_id)
    if type:
        stmt = stmt.where(Account.type == type)
    if commodity_id:
        stmt = stmt.where(Account.commodity_id == commodity_id)
    res = await session.execute(stmt)
    return res.scalars().all()

@router.get("/tree", response_model=list[AccountNode])
async def get_accounts_tree(book_id: str, depth: int | None = None, session: AsyncSession = Depends(get_session)):
    await ensure_book_exists(session, book_id)
    res = await session.execute(select(Account).where(Account.book_id == book_id))
    accounts = res.scalars().all()
    
    # Criar um set de IDs de contas válidas para detectar órfãs
    valid_account_ids = {acc.id for acc in accounts}
    
    by_parent: dict[str | None, list[Account]] = {}
    orphaned_accounts: list[Account] = []  # Contas com parent_id inválido
    
    for acc in accounts:
        if acc.parent_id is None:
            # Conta raiz
            by_parent.setdefault(None, []).append(acc)
        elif acc.parent_id in valid_account_ids:
            # Conta com pai válido
            by_parent.setdefault(acc.parent_id, []).append(acc)
        else:
            # Conta órfã (parent_id não existe) - mostrar como raiz
            orphaned_accounts.append(acc)
            by_parent.setdefault(None, []).append(acc)
    
    # Ordenar contas por código (se tiver) ou por nome
    def sort_key(acc: Account) -> tuple:
        # Retorna (tem_codigo, codigo_ou_nome) para ordenação
        if acc.code:
            return (0, acc.code)
        return (1, acc.name)
    
    # Ordenar filhos de cada pai
    for parent_id in by_parent:
        by_parent[parent_id].sort(key=sort_key)

    def build(node: Account, current_depth: int) -> AccountNode:
        children_nodes: list[AccountNode] = []
        if depth is None or current_depth < depth:
            children = by_parent.get(node.id, [])
            # Ordenar filhos antes de construir
            children.sort(key=sort_key)
            for child in children:
                children_nodes.append(build(child, current_depth + 1))
        return AccountNode(
            id=node.id,
            book_id=node.book_id,
            parent_id=node.parent_id,
            name=node.name,
            code=node.code,
            description=node.description,
            type=node.type,
            commodity_id=node.commodity_id,
            is_placeholder=node.is_placeholder,
            created_at=node.created_at,
            updated_at=node.updated_at,
            children=children_nodes,
        )

    # Pegar todas as contas raiz (parent_id = None ou órfãs) e ordenar
    roots = by_parent.get(None, [])
    roots.sort(key=sort_key)
    return [build(r, 0) for r in roots]

@router.get("/{account_id}", response_model=AccountOut)
async def get_account(account_id: str, session: AsyncSession = Depends(get_session)):
    account = await session.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account

@router.patch("/{account_id}", response_model=AccountOut)
async def update_account(account_id: str, payload: AccountUpdate, session: AsyncSession = Depends(get_session)):
    account = await session.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    new_parent_id = payload.parent_id if payload.parent_id is not None else account.parent_id
    new_book_id = account.book_id

    if payload.parent_id is not None:
        await ensure_parent_valid(session, payload.parent_id, new_book_id)
        await check_no_cycle(session, account_id, payload.parent_id)

    new_name = payload.name if payload.name is not None else account.name
    await ensure_name_unique(session, new_book_id, new_parent_id, new_name, exclude_id=account_id)

    if payload.commodity_id is not None:
        await ensure_commodity_exists(session, payload.commodity_id)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(account, field, value)

    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=400, detail="Invalid update payload")
    await session.refresh(account)
    return account

@router.post("/{account_id}/move", response_model=AccountOut)
async def move_account(account_id: str, new_parent_id: str | None, session: AsyncSession = Depends(get_session)):
    account = await session.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    normalized_parent_id = new_parent_id.strip() if new_parent_id is not None else None
    if normalized_parent_id == "":
        normalized_parent_id = None

    await ensure_parent_valid(session, normalized_parent_id, account.book_id)
    await check_no_cycle(session, account_id, normalized_parent_id)
    await ensure_name_unique(session, account.book_id, normalized_parent_id, account.name, exclude_id=account_id)

    account.parent_id = normalized_parent_id
    await session.commit()
    await session.refresh(account)
    return account

@router.delete("/{account_id}")
async def delete_account(account_id: str, session: AsyncSession = Depends(get_session)):
    account = await session.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    # Enforce: only delete if no children
    res = await session.execute(select(Account.id).where(Account.parent_id == account_id))
    if res.scalars().first() is not None:
        raise HTTPException(status_code=400, detail="Cannot delete account with children")
    await session.delete(account)
    await session.commit()
    return {"deleted": True}
