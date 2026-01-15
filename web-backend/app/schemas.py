from __future__ import annotations
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict

class AccountType(str, Enum):
    ASSET = "ASSET"
    LIABILITY = "LIABILITY"
    INCOME = "INCOME"
    EXPENSE = "EXPENSE"
    EQUITY = "EQUITY"

# Books
class BookCreate(BaseModel):
    name: Optional[str] = None

class BookOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: Optional[str]
    created_at: datetime

# Commodities
class CommodityCreate(BaseModel):
    namespace: str = Field(..., examples=["CURRENCY"]) 
    mnemonic: str = Field(..., examples=["USD"]) 
    fullname: Optional[str] = None
    fraction: int = Field(..., gt=0)
    quote: bool = False

class CommodityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    namespace: str
    mnemonic: str
    fullname: Optional[str]
    fraction: int
    quote: bool

# Accounts
class AccountCreate(BaseModel):
    book_id: str
    name: str
    type: AccountType
    commodity_id: str
    parent_id: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    is_placeholder: bool = False

class AccountUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[AccountType] = None
    commodity_id: Optional[str] = None
    parent_id: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    is_placeholder: Optional[bool] = None

class AccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    book_id: str
    parent_id: Optional[str]
    name: str
    code: Optional[str]
    description: Optional[str]
    type: AccountType
    commodity_id: str
    is_placeholder: bool
    created_at: datetime
    updated_at: datetime

class AccountNode(AccountOut):
    children: List["AccountNode"] = Field(default_factory=list)

# Pagination helpers
class ListResponse(BaseModel):
    total: int
    items: List
    next_cursor: Optional[str] = None
