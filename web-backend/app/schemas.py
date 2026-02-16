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

    @field_serializer(
        "created_at",
        "updated_at",
        "post_date",
        "enter_date",
        "reconcile_date",
        "date",
        "date_entered",
        "date_opened",
        "date_posted",
        check_fields=False,
    )
    def serialize_dt(self, value: datetime | None) -> str | None:
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=UTC)
        return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


class BookCreate(BaseModel):
    id: UUID | None = None
    name: str | None = Field(default=None, max_length=120)
    is_active: bool | None = None


class BookPatch(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    is_active: bool | None = None


class BookOut(BaseOut):
    id: str
    name: str | None
    is_active: bool
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
    code: str | None = None
    type: AccountTypeSchema
    commodity_id: str
    is_placeholder: bool
    balance_num: int = 0
    balance_denom: int = 1
    children: list["AccountTreeNode"] = Field(default_factory=list)


AccountTreeNode.model_rebuild()


class CustomerCreate(BaseModel):
    guid: UUID | None = None
    book_id: UUID
    name: str = Field(max_length=2048)
    id: str = Field(max_length=2048)
    notes: str = Field(default="", max_length=2048)
    active: bool = True
    discount_num: int = 0
    discount_denom: int = Field(default=1, gt=0)
    credit_num: int = 0
    credit_denom: int = Field(default=1, gt=0)
    currency_guid: UUID
    tax_override: bool = False
    addr_name: str | None = Field(default=None, max_length=1024)
    addr_addr1: str | None = Field(default=None, max_length=1024)
    addr_addr2: str | None = Field(default=None, max_length=1024)
    addr_addr3: str | None = Field(default=None, max_length=1024)
    addr_addr4: str | None = Field(default=None, max_length=1024)
    addr_phone: str | None = Field(default=None, max_length=128)
    addr_fax: str | None = Field(default=None, max_length=128)
    addr_email: str | None = Field(default=None, max_length=256)
    shipaddr_name: str | None = Field(default=None, max_length=1024)
    shipaddr_addr1: str | None = Field(default=None, max_length=1024)
    shipaddr_addr2: str | None = Field(default=None, max_length=1024)
    shipaddr_addr3: str | None = Field(default=None, max_length=1024)
    shipaddr_addr4: str | None = Field(default=None, max_length=1024)
    shipaddr_phone: str | None = Field(default=None, max_length=128)
    shipaddr_fax: str | None = Field(default=None, max_length=128)
    shipaddr_email: str | None = Field(default=None, max_length=256)
    terms_guid: UUID | None = None
    tax_included: int | None = None
    taxtable_guid: UUID | None = None


class CustomerPatch(BaseModel):
    name: str | None = Field(default=None, max_length=2048)
    id: str | None = Field(default=None, max_length=2048)
    notes: str | None = Field(default=None, max_length=2048)
    active: bool | None = None
    discount_num: int | None = None
    discount_denom: int | None = Field(default=None, gt=0)
    credit_num: int | None = None
    credit_denom: int | None = Field(default=None, gt=0)
    currency_guid: UUID | None = None
    tax_override: bool | None = None
    addr_name: str | None = Field(default=None, max_length=1024)
    addr_addr1: str | None = Field(default=None, max_length=1024)
    addr_addr2: str | None = Field(default=None, max_length=1024)
    addr_addr3: str | None = Field(default=None, max_length=1024)
    addr_addr4: str | None = Field(default=None, max_length=1024)
    addr_phone: str | None = Field(default=None, max_length=128)
    addr_fax: str | None = Field(default=None, max_length=128)
    addr_email: str | None = Field(default=None, max_length=256)
    shipaddr_name: str | None = Field(default=None, max_length=1024)
    shipaddr_addr1: str | None = Field(default=None, max_length=1024)
    shipaddr_addr2: str | None = Field(default=None, max_length=1024)
    shipaddr_addr3: str | None = Field(default=None, max_length=1024)
    shipaddr_addr4: str | None = Field(default=None, max_length=1024)
    shipaddr_phone: str | None = Field(default=None, max_length=128)
    shipaddr_fax: str | None = Field(default=None, max_length=128)
    shipaddr_email: str | None = Field(default=None, max_length=256)
    terms_guid: UUID | None = None
    tax_included: int | None = None
    taxtable_guid: UUID | None = None


class CustomerOut(BaseOut):
    guid: str
    book_id: str
    name: str
    id: str
    notes: str
    active: bool
    discount_num: int
    discount_denom: int
    credit_num: int
    credit_denom: int
    currency_guid: str
    tax_override: bool
    addr_name: str | None
    addr_addr1: str | None
    addr_addr2: str | None
    addr_addr3: str | None
    addr_addr4: str | None
    addr_phone: str | None
    addr_fax: str | None
    addr_email: str | None
    shipaddr_name: str | None
    shipaddr_addr1: str | None
    shipaddr_addr2: str | None
    shipaddr_addr3: str | None
    shipaddr_addr4: str | None
    shipaddr_phone: str | None
    shipaddr_fax: str | None
    shipaddr_email: str | None
    terms_guid: str | None
    tax_included: int | None
    taxtable_guid: str | None
    created_at: datetime
    updated_at: datetime


class VendorCreate(BaseModel):
    guid: UUID | None = None
    book_id: UUID
    name: str = Field(max_length=2048)
    id: str = Field(max_length=2048)
    notes: str = Field(default="", max_length=2048)
    currency_guid: UUID
    active: bool = True
    tax_override: bool = False
    addr_name: str | None = Field(default=None, max_length=1024)
    addr_addr1: str | None = Field(default=None, max_length=1024)
    addr_addr2: str | None = Field(default=None, max_length=1024)
    addr_addr3: str | None = Field(default=None, max_length=1024)
    addr_addr4: str | None = Field(default=None, max_length=1024)
    addr_phone: str | None = Field(default=None, max_length=128)
    addr_fax: str | None = Field(default=None, max_length=128)
    addr_email: str | None = Field(default=None, max_length=256)
    terms_guid: UUID | None = None
    tax_inc: str | None = Field(default=None, max_length=2048)
    tax_table_guid: UUID | None = None


class VendorPatch(BaseModel):
    name: str | None = Field(default=None, max_length=2048)
    id: str | None = Field(default=None, max_length=2048)
    notes: str | None = Field(default=None, max_length=2048)
    currency_guid: UUID | None = None
    active: bool | None = None
    tax_override: bool | None = None
    addr_name: str | None = Field(default=None, max_length=1024)
    addr_addr1: str | None = Field(default=None, max_length=1024)
    addr_addr2: str | None = Field(default=None, max_length=1024)
    addr_addr3: str | None = Field(default=None, max_length=1024)
    addr_addr4: str | None = Field(default=None, max_length=1024)
    addr_phone: str | None = Field(default=None, max_length=128)
    addr_fax: str | None = Field(default=None, max_length=128)
    addr_email: str | None = Field(default=None, max_length=256)
    terms_guid: UUID | None = None
    tax_inc: str | None = Field(default=None, max_length=2048)
    tax_table_guid: UUID | None = None


class VendorOut(BaseOut):
    guid: str
    book_id: str
    name: str
    id: str
    notes: str
    currency_guid: str
    active: bool
    tax_override: bool
    addr_name: str | None
    addr_addr1: str | None
    addr_addr2: str | None
    addr_addr3: str | None
    addr_addr4: str | None
    addr_phone: str | None
    addr_fax: str | None
    addr_email: str | None
    terms_guid: str | None
    tax_inc: str | None
    tax_table_guid: str | None
    created_at: datetime
    updated_at: datetime


class InvoiceTypeSchema(str, Enum):
    INVOICE = "INVOICE"
    CREDIT_NOTE = "CREDIT_NOTE"


class InvoiceEntryDiscountTypeSchema(str, Enum):
    PERCENT = "PERCENT"
    VALUE = "VALUE"


class InvoiceEntryDiscountHowSchema(str, Enum):
    PRETAX = "PRETAX"
    SAMETIME = "SAMETIME"
    POSTTAX = "POSTTAX"


class InvoiceEntryCreate(BaseModel):
    guid: UUID | None = None
    date: datetime
    description: str | None = Field(default=None, max_length=2048)
    action: str | None = Field(default=None, max_length=2048)
    notes: str | None = Field(default=None, max_length=2048)
    income_account_guid: UUID
    quantity_num: int
    quantity_denom: int = Field(gt=0)
    unit_price_num: int
    unit_price_denom: int = Field(gt=0)
    discount_num: int = 0
    discount_denom: int = Field(default=1, gt=0)
    discount_type: InvoiceEntryDiscountTypeSchema = InvoiceEntryDiscountTypeSchema.PERCENT
    discount_how: InvoiceEntryDiscountHowSchema = InvoiceEntryDiscountHowSchema.PRETAX
    taxable: bool = False
    tax_included: bool = False
    tax_table_guid: UUID | None = None


class InvoiceEntryPatch(BaseModel):
    date: datetime | None = None
    description: str | None = Field(default=None, max_length=2048)
    action: str | None = Field(default=None, max_length=2048)
    notes: str | None = Field(default=None, max_length=2048)
    income_account_guid: UUID | None = None
    quantity_num: int | None = None
    quantity_denom: int | None = Field(default=None, gt=0)
    unit_price_num: int | None = None
    unit_price_denom: int | None = Field(default=None, gt=0)
    discount_num: int | None = None
    discount_denom: int | None = Field(default=None, gt=0)
    discount_type: InvoiceEntryDiscountTypeSchema | None = None
    discount_how: InvoiceEntryDiscountHowSchema | None = None
    taxable: bool | None = None
    tax_included: bool | None = None
    tax_table_guid: UUID | None = None


class InvoiceEntryOut(BaseOut):
    guid: str
    invoice_guid: str
    date: datetime
    date_entered: datetime | None
    description: str | None
    action: str | None
    notes: str | None
    income_account_guid: str
    quantity_num: int
    quantity_denom: int
    unit_price_num: int
    unit_price_denom: int
    discount_num: int
    discount_denom: int
    discount_type: InvoiceEntryDiscountTypeSchema
    discount_how: InvoiceEntryDiscountHowSchema
    taxable: bool
    tax_included: bool
    tax_table_guid: str | None
    subtotal_num: int
    subtotal_denom: int
    tax_num: int
    tax_denom: int
    total_num: int
    total_denom: int
    created_at: datetime
    updated_at: datetime


class InvoiceCreate(BaseModel):
    guid: UUID | None = None
    book_id: UUID
    type: InvoiceTypeSchema = InvoiceTypeSchema.INVOICE
    id: str = Field(max_length=2048)
    date_opened: datetime | None = None
    notes: str = Field(default="", max_length=2048)
    active: bool = True
    currency_guid: UUID
    customer_guid: UUID
    terms: str | None = Field(default=None, max_length=36)
    billing_id: str | None = Field(default=None, max_length=2048)


class InvoicePatch(BaseModel):
    type: InvoiceTypeSchema | None = None
    id: str | None = Field(default=None, max_length=2048)
    date_opened: datetime | None = None
    date_posted: datetime | None = None
    notes: str | None = Field(default=None, max_length=2048)
    active: bool | None = None
    currency_guid: UUID | None = None
    customer_guid: UUID | None = None
    terms: str | None = Field(default=None, max_length=36)
    billing_id: str | None = Field(default=None, max_length=2048)


class InvoiceOut(BaseOut):
    guid: str
    book_id: str
    type: InvoiceTypeSchema
    id: str
    date_opened: datetime | None
    date_posted: datetime | None
    notes: str
    active: bool
    currency_guid: str
    customer_guid: str
    terms: str | None
    billing_id: str | None
    status: str
    subtotal_num: int
    subtotal_denom: int
    tax_num: int
    tax_denom: int
    total_num: int
    total_denom: int
    entries: list[InvoiceEntryOut]
    created_at: datetime
    updated_at: datetime


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
