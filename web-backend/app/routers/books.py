from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..db import get_session
from ..models import Book
from ..schemas import BookCreate, BookOut
from ..utils import new_guid

router = APIRouter()

@router.post("", response_model=BookOut)
async def create_book(payload: BookCreate, session: AsyncSession = Depends(get_session)):
    book = Book(id=new_guid(), name=payload.name)
    session.add(book)
    await session.commit()
    await session.refresh(book)
    return book

@router.get("", response_model=list[BookOut])
async def list_books(session: AsyncSession = Depends(get_session)):
    res = await session.execute(select(Book))
    return res.scalars().all()

@router.get("/{book_id}", response_model=BookOut)
async def get_book(book_id: str, session: AsyncSession = Depends(get_session)):
    book = await session.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book
