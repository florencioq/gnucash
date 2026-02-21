from __future__ import annotations
from datetime import datetime, UTC
from enum import Enum as PyEnum
from typing import Optional, List

from sqlalchemy import (
    String, Integer, Boolean, DateTime, ForeignKey, Enum, UniqueConstraint, Index, BigInteger, CheckConstraint, text
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


class BookAccessRole(PyEnum):
    VIEWER = "VIEWER"
    EDITOR = "EDITOR"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC)
    )

    __table_args__ = (
        UniqueConstraint("email", name="uq_users_email"),
        Index("ix_users_email", "email", unique=True),
    )
    book_accesses: Mapped[List["UserBookAccess"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )


class Book(Base):
    __tablename__ = "books"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    default_payables_account_guid: Mapped[Optional[str]] = mapped_column(
        ForeignKey(
            "accounts.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_books_default_payables_account_guid",
        ),
        nullable=True,
        index=True,
    )
    default_receivables_account_guid: Mapped[Optional[str]] = mapped_column(
        ForeignKey(
            "accounts.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_books_default_receivables_account_guid",
        ),
        nullable=True,
        index=True,
    )
    default_iss_recoverable_account_guid: Mapped[Optional[str]] = mapped_column(
        ForeignKey(
            "accounts.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_books_default_iss_recoverable_account_guid",
        ),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    accounts: Mapped[List[Account]] = relationship(
        back_populates="book",
        foreign_keys="Account.book_id",
    )
    customers: Mapped[List[Customer]] = relationship(back_populates="book")
    vendors: Mapped[List[Vendor]] = relationship(back_populates="book")
    invoices: Mapped[List[Invoice]] = relationship(back_populates="book")
    document_number_counters: Mapped[List[DocumentNumberCounter]] = relationship(
        back_populates="book",
        cascade="all, delete-orphan",
    )
    user_accesses: Mapped[List["UserBookAccess"]] = relationship(
        back_populates="book",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index(
            "ux_books_single_active",
            "is_active",
            unique=True,
            sqlite_where=text("is_active = 1"),
            postgresql_where=text("is_active = true"),
        ),
    )


class UserBookAccess(Base):
    __tablename__ = "user_book_access"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    book_id: Mapped[str] = mapped_column(ForeignKey("books.id", ondelete="CASCADE"), primary_key=True)
    role: Mapped[BookAccessRole] = mapped_column(Enum(BookAccessRole), nullable=False, default=BookAccessRole.EDITOR)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    user: Mapped[User] = relationship(back_populates="book_accesses")
    book: Mapped[Book] = relationship(back_populates="user_accesses")


class DocumentNumberCounter(Base):
    __tablename__ = "document_number_counters"

    book_id: Mapped[str] = mapped_column(ForeignKey("books.id", ondelete="CASCADE"), primary_key=True)
    owner_type: Mapped[str] = mapped_column(String(32), primary_key=True)
    next_value: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    width: Mapped[int] = mapped_column(Integer, nullable=False, default=6)

    book: Mapped[Book] = relationship(back_populates="document_number_counters")

    __table_args__ = (
        CheckConstraint("next_value >= 1", name="ck_document_number_counters_next_value_positive"),
        CheckConstraint("width >= 1", name="ck_document_number_counters_width_positive"),
    )


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
    customers: Mapped[List[Customer]] = relationship(back_populates="currency")
    vendors: Mapped[List[Vendor]] = relationship(back_populates="currency")
    invoices: Mapped[List[Invoice]] = relationship(back_populates="currency")
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

    book: Mapped[Book] = relationship(
        back_populates="accounts",
        foreign_keys=[book_id],
    )
    commodity: Mapped[Commodity] = relationship(back_populates="accounts")

    parent: Mapped[Optional[Account]] = relationship(remote_side="Account.id", back_populates="children")
    children: Mapped[List[Account]] = relationship(back_populates="parent")
    splits: Mapped[List[Split]] = relationship(back_populates="account")
    invoice_entries: Mapped[List[InvoiceEntry]] = relationship(back_populates="income_account")
    lots: Mapped[List[Lot]] = relationship(back_populates="account")

    __table_args__ = (
        Index("ix_accounts_book_parent_name", "book_id", "parent_id", "name"),
    )


class Customer(Base):
    __tablename__ = "customers"

    guid: Mapped[str] = mapped_column(String(36), primary_key=True)
    book_id: Mapped[str] = mapped_column(ForeignKey("books.id"), index=True)
    name: Mapped[str] = mapped_column(String(2048), nullable=False)
    id: Mapped[str] = mapped_column(String(2048), nullable=False)
    notes: Mapped[str] = mapped_column(String(2048), default="")
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    discount_num: Mapped[int] = mapped_column(BigInteger, default=0)
    discount_denom: Mapped[int] = mapped_column(BigInteger, default=1)
    credit_num: Mapped[int] = mapped_column(BigInteger, default=0)
    credit_denom: Mapped[int] = mapped_column(BigInteger, default=1)

    currency_guid: Mapped[str] = mapped_column(ForeignKey("commodities.id"), index=True)
    income_account_guid: Mapped[Optional[str]] = mapped_column(
        ForeignKey("accounts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    tax_override: Mapped[bool] = mapped_column(Boolean, default=False)

    addr_name: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    addr_addr1: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    addr_addr2: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    addr_addr3: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    addr_addr4: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    addr_phone: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    addr_fax: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    addr_email: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)

    shipaddr_name: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    shipaddr_addr1: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    shipaddr_addr2: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    shipaddr_addr3: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    shipaddr_addr4: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    shipaddr_phone: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    shipaddr_fax: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    shipaddr_email: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)

    terms_guid: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    tax_included: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    taxtable_guid: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC)
    )

    book: Mapped[Book] = relationship(back_populates="customers")
    currency: Mapped[Commodity] = relationship(back_populates="customers")
    __table_args__ = (
        CheckConstraint("discount_denom > 0", name="ck_customers_discount_denom_positive"),
        CheckConstraint("credit_denom > 0", name="ck_customers_credit_denom_positive"),
    )


class Vendor(Base):
    __tablename__ = "vendors"

    guid: Mapped[str] = mapped_column(String(36), primary_key=True)
    book_id: Mapped[str] = mapped_column(ForeignKey("books.id"), index=True)
    name: Mapped[str] = mapped_column(String(2048), nullable=False)
    id: Mapped[str] = mapped_column(String(2048), nullable=False)
    notes: Mapped[str] = mapped_column(String(2048), default="")
    currency_guid: Mapped[str] = mapped_column(ForeignKey("commodities.id"), index=True)
    expense_account_guid: Mapped[Optional[str]] = mapped_column(
        ForeignKey("accounts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    tax_override: Mapped[bool] = mapped_column(Boolean, default=False)

    addr_name: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    addr_addr1: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    addr_addr2: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    addr_addr3: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    addr_addr4: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    addr_phone: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    addr_fax: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    addr_email: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)

    terms_guid: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    tax_inc: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    tax_table_guid: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC)
    )

    book: Mapped[Book] = relationship(back_populates="vendors")
    currency: Mapped[Commodity] = relationship(back_populates="vendors")


class Invoice(Base):
    __tablename__ = "invoices"

    guid: Mapped[str] = mapped_column(String(36), primary_key=True)
    book_id: Mapped[str] = mapped_column(ForeignKey("books.id"), index=True)
    id: Mapped[str] = mapped_column(String(2048), nullable=False)
    invoice_type: Mapped[str] = mapped_column(String(32), nullable=False, default="INVOICE")
    date_opened: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    date_posted: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str] = mapped_column(String(2048), default="")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    currency_guid: Mapped[str] = mapped_column(ForeignKey("commodities.id"), index=True)
    owner_type: Mapped[str] = mapped_column(String(32), default="CUSTOMER")
    owner_guid: Mapped[str] = mapped_column(String(36), index=True)
    terms: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    billing_id: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    post_txn: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    post_lot: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    post_acc: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    billto_type: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    billto_guid: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    charge_amt_num: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    charge_amt_denom: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC)
    )

    book: Mapped[Book] = relationship(back_populates="invoices")
    currency: Mapped[Commodity] = relationship(back_populates="invoices")
    entries: Mapped[List[InvoiceEntry]] = relationship(
        back_populates="invoice",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_invoices_book_date_opened", "book_id", "date_opened"),
    )


class InvoiceEntry(Base):
    __tablename__ = "entries"

    guid: Mapped[str] = mapped_column(String(36), primary_key=True)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    date_entered: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    action: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    quantity_num: Mapped[int] = mapped_column(BigInteger, nullable=False)
    quantity_denom: Mapped[int] = mapped_column(BigInteger, nullable=False)
    i_acct: Mapped[str] = mapped_column(ForeignKey("accounts.id"), nullable=False, index=True)
    i_price_num: Mapped[int] = mapped_column(BigInteger, nullable=False)
    i_price_denom: Mapped[int] = mapped_column(BigInteger, nullable=False)
    i_discount_num: Mapped[int] = mapped_column(BigInteger, default=0)
    i_discount_denom: Mapped[int] = mapped_column(BigInteger, default=1)
    invoice_guid: Mapped[str] = mapped_column("invoice", ForeignKey("invoices.guid", ondelete="CASCADE"), index=True)
    i_disc_type: Mapped[str] = mapped_column(String(32), default="PERCENT")
    i_disc_how: Mapped[str] = mapped_column(String(32), default="PRETAX")
    i_taxable: Mapped[bool] = mapped_column(Boolean, default=False)
    i_tax_num: Mapped[int] = mapped_column(BigInteger, default=0)
    i_tax_denom: Mapped[int] = mapped_column(BigInteger, default=1)
    i_taxincluded: Mapped[bool] = mapped_column(Boolean, default=False)
    i_taxtable: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    b_paytype: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    billable: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    billto_type: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    billto_guid: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC)
    )

    invoice: Mapped[Invoice] = relationship(back_populates="entries")
    income_account: Mapped[Account] = relationship(back_populates="invoice_entries")

    __table_args__ = (
        CheckConstraint("quantity_denom > 0", name="ck_entries_quantity_denom_positive"),
        CheckConstraint("i_price_denom > 0", name="ck_entries_price_denom_positive"),
        CheckConstraint("i_discount_denom > 0", name="ck_entries_discount_denom_positive"),
        CheckConstraint("i_tax_denom > 0", name="ck_entries_tax_denom_positive"),
    )


class Lot(Base):
    __tablename__ = "lots"

    guid: Mapped[str] = mapped_column(String(36), primary_key=True)
    account_guid: Mapped[str] = mapped_column(ForeignKey("accounts.id"), index=True)
    is_closed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    account: Mapped[Account] = relationship(back_populates="lots")


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
    slots: Mapped[List["Slot"]] = relationship(
        back_populates="transaction",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_transactions_post_date", "post_date"),
    )


class Slot(Base):
    __tablename__ = "slots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obj_guid: Mapped[str] = mapped_column(
        ForeignKey("transactions.guid", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(4096), nullable=False, index=True)
    slot_type: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    int64_val: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    string_val: Mapped[Optional[str]] = mapped_column(String(4096), nullable=True)
    timespec_val: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    transaction: Mapped[Transaction] = relationship(back_populates="slots")

    __table_args__ = (
        Index("ix_slots_obj_guid_name", "obj_guid", "name"),
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
