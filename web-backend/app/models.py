from __future__ import annotations
from datetime import datetime, UTC
from enum import Enum as PyEnum
from typing import Optional, List

from sqlalchemy import (
    String, Integer, Boolean, DateTime, ForeignKey, Enum, UniqueConstraint, Index
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class AccountType(PyEnum):
    ASSET = "ASSET"
    LIABILITY = "LIABILITY"
    INCOME = "INCOME"
    EXPENSE = "EXPENSE"
    EQUITY = "EQUITY"
    ROOT = "ROOT"


class Book(Base):
    __tablename__ = "books"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    accounts: Mapped[List[Account]] = relationship(back_populates="book")


class Commodity(Base):
    __tablename__ = "commodities"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    namespace: Mapped[str] = mapped_column(String(32), index=True)  # e.g., CURRENCY, FUND
    mnemonic: Mapped[str] = mapped_column(String(16), index=True)    # e.g., USD, EUR
    fullname: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    fraction: Mapped[int] = mapped_column(Integer)  # smallest common unit (SCU)
    quote: Mapped[bool] = mapped_column(Boolean, default=False)

    __table_args__ = (
        UniqueConstraint("namespace", "mnemonic", name="uq_commodity_namespace_mnemonic"),
    )

    accounts: Mapped[List[Account]] = relationship(back_populates="commodity")


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    book_id: Mapped[str] = mapped_column(ForeignKey("books.id"), index=True)
    parent_id: Mapped[Optional[str]] = mapped_column(ForeignKey("accounts.id"), nullable=True, index=True)

    name: Mapped[str] = mapped_column(String(120), index=True)
    code: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    type: Mapped[AccountType] = mapped_column(Enum(AccountType))
    commodity_id: Mapped[str] = mapped_column(ForeignKey("commodities.id"), index=True)
    is_placeholder: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    book: Mapped[Book] = relationship(back_populates="accounts")
    commodity: Mapped[Commodity] = relationship(back_populates="accounts")

    parent: Mapped[Optional[Account]] = relationship(remote_side="Account.id", back_populates="children")
    children: Mapped[List[Account]] = relationship(back_populates="parent")

    __table_args__ = (
        Index("ix_accounts_book_parent_name", "book_id", "parent_id", "name"),
    )
