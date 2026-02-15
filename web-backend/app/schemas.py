from __future__ import annotations

from datetime import datetime, UTC
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_serializer


class ApiError(BaseModel):
    code: str
    message: str
    details: dict = Field(default_factory=dict)


class AccountTypeSchema(str, Enum):
    ROOT = "ROOT"
    ASSET = "ASSET"
    LIABILITY = "LIABILITY"
    INCOME = "INCOME"
    EXPENSE = "EXPENSE"
    EQUITY = "EQUITY"


class BaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    @field_serializer("created_at", "updated_at", "post_date", "enter_date", "reconcile_date", check_fields=False)
    def serialize_dt(self, value: datetime | None) -> str | None:
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=UTC)
        return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


class BookCreate(BaseModel):
    id: UUID | None = None
    name: str | None = Field(default=None, max_length=120)


class BookPatch(BaseModel):
    name: str | None = Field(default=None, max_length=120)


class BookOut(BaseOut):
    id: str
    name: str | None
    created_at: datetime


class CommodityCreate(BaseModel):
    id: UUID | None = None
    namespace: str = Field(max_length=32)
    mnemonic: str = Field(max_length=16)
    fullname: str | None = Field(default=None, max_length=128)
    fraction: int = Field(ge=1)
    quote: bool = False


class CommodityPatch(BaseModel):
    namespace: str | None = Field(default=None, max_length=32)
    mnemonic: str | None = Field(default=None, max_length=16)
    fullname: str | None = Field(default=None, max_length=128)
    fraction: int | None = Field(default=None, ge=1)
    quote: bool | None = None


class CommodityOut(BaseOut):
    id: str
    namespace: str
    mnemonic: str
    fullname: str | None
    fraction: int
    quote: bool


class AccountCreate(BaseModel):
    id: UUID | None = None
    book_id: UUID
    parent_id: UUID | None = None
    name: str = Field(max_length=120)
    code: str | None = Field(default=None, max_length=64)
    description: str | None = Field(default=None, max_length=255)
    type: AccountTypeSchema
    commodity_id: UUID
    is_placeholder: bool = False


class AccountPatch(BaseModel):
    parent_id: UUID | None = None
    name: str | None = Field(default=None, max_length=120)
    code: str | None = Field(default=None, max_length=64)
    description: str | None = Field(default=None, max_length=255)
    type: AccountTypeSchema | None = None
    commodity_id: UUID | None = None
    is_placeholder: bool | None = None


class AccountOut(BaseOut):
    id: str
    book_id: str
    parent_id: str | None
    name: str
    code: str | None
    description: str | None
    type: AccountTypeSchema
    commodity_id: str
    is_placeholder: bool
    created_at: datetime
    updated_at: datetime


class AccountTreeNode(BaseModel):
    id: str
    book_id: str
    parent_id: str | None
    name: str
    type: AccountTypeSchema
    commodity_id: str
    is_placeholder: bool
    children: list["AccountTreeNode"] = Field(default_factory=list)


AccountTreeNode.model_rebuild()


class SplitIn(BaseModel):
    guid: UUID | None = None
    account_guid: UUID
    memo: str = Field(default="", max_length=2048)
    action: str = Field(default="", max_length=2048)
    reconcile_state: str = Field(default="n", min_length=1, max_length=1)
    reconcile_date: datetime | None = None
    value_num: int
    value_denom: int = Field(gt=0)
    quantity_num: int
    quantity_denom: int = Field(gt=0)
    lot_guid: UUID | None = None


class TransactionCreate(BaseModel):
    guid: UUID | None = None
    currency_guid: UUID
    num: str = Field(default="", max_length=2048)
    post_date: datetime | None = None
    enter_date: datetime | None = None
    description: str | None = Field(default=None, max_length=2048)
    splits: list[SplitIn] = Field(min_length=2)


class TransactionPatch(BaseModel):
    currency_guid: UUID | None = None
    num: str | None = Field(default=None, max_length=2048)
    post_date: datetime | None = None
    enter_date: datetime | None = None
    description: str | None = Field(default=None, max_length=2048)
    splits: list[SplitIn] | None = Field(default=None, min_length=2)


class SplitOut(BaseOut):
    guid: str
    tx_guid: str
    account_guid: str
    memo: str
    action: str
    reconcile_state: str
    reconcile_date: datetime | None
    value_num: int
    value_denom: int
    quantity_num: int
    quantity_denom: int
    lot_guid: str | None


class TransactionOut(BaseOut):
    guid: str
    currency_guid: str
    num: str
    post_date: datetime | None
    enter_date: datetime | None
    description: str | None
    splits: list[SplitOut]
