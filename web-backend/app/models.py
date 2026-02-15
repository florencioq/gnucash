from __future__ import annotations
from datetime import datetime, UTC
from enum import Enum as PyEnum
from typing import Optional, List

from sqlalchemy import (
    String, Integer, Boolean, DateTime, ForeignKey, Enum, UniqueConstraint, Index, BigInteger, CheckConstraint
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class AccountType(PyEnum):
    ROOT = "ROOT"
    ASSET = "ASSET"
    LIABILITY = "LIABILITY"
    INCOME = "INCOME"
    EXPENSE = "EXPENSE"
    EQUITY = "EQUITY"


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
    transactions: Mapped[List[Transaction]] = relationship(back_populates="currency")


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
    splits: Mapped[List[Split]] = relationship(back_populates="account")

    __table_args__ = (
        Index("ix_accounts_book_parent_name", "book_id", "parent_id", "name"),
    )


class Transaction(Base):
    __tablename__ = "transactions"

    guid: Mapped[str] = mapped_column(String(36), primary_key=True)
    currency_guid: Mapped[str] = mapped_column(ForeignKey("commodities.id"), index=True)
    num: Mapped[str] = mapped_column(String(2048), default="")
    post_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    enter_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    description: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)

    currency: Mapped[Commodity] = relationship(back_populates="transactions")
    splits: Mapped[List[Split]] = relationship(
        back_populates="transaction",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_transactions_post_date", "post_date"),
    )


class Split(Base):
    __tablename__ = "splits"

    guid: Mapped[str] = mapped_column(String(36), primary_key=True)
    tx_guid: Mapped[str] = mapped_column(ForeignKey("transactions.guid", ondelete="CASCADE"), index=True)
    account_guid: Mapped[str] = mapped_column(ForeignKey("accounts.id"), index=True)
    memo: Mapped[str] = mapped_column(String(2048), default="")
    action: Mapped[str] = mapped_column(String(2048), default="")
    reconcile_state: Mapped[str] = mapped_column(String(1), default="n")
    reconcile_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    value_num: Mapped[int] = mapped_column(BigInteger)
    value_denom: Mapped[int] = mapped_column(BigInteger)
    quantity_num: Mapped[int] = mapped_column(BigInteger)
    quantity_denom: Mapped[int] = mapped_column(BigInteger)
    lot_guid: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)

    transaction: Mapped[Transaction] = relationship(back_populates="splits")
    account: Mapped[Account] = relationship(back_populates="splits")

    __table_args__ = (
        CheckConstraint("value_denom > 0", name="ck_splits_value_denom_positive"),
        CheckConstraint("quantity_denom > 0", name="ck_splits_quantity_denom_positive"),
    )
