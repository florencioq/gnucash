from __future__ import annotations

from datetime import date
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import api_error
from app.models import Account, AccountType, Book
from app.schemas import (
    AccountTransfersReportOut,
    FinancialDashboardOut,
    IncomeStatementAccountEntriesOut,
    IncomeStatementMatrixOut,
    IncomeStatementOut,
    InvoiceSettlementByCustomerReportOut,
)
from app.services.authorization import ensure_book_read_access
from app.services.reports import (
    build_account_transfers_report,
    build_financial_dashboard,
    build_income_statement,
    build_income_statement_matrix,
    build_invoice_settlement_by_customer_report,
    list_income_statement_account_entries,
)

router = APIRouter(prefix="/reports", tags=["Reports"])


def _parse_month(month: str) -> tuple[int, int]:
    parts = month.split("-")
    if len(parts) != 2:
        raise api_error(400, "INVALID_MONTH", "month must follow YYYY-MM")

    try:
        year = int(parts[0])
        month_number = int(parts[1])
    except ValueError as exc:
        raise api_error(400, "INVALID_MONTH", "month must follow YYYY-MM") from exc

    if year < 1900 or year > 3000 or month_number < 1 or month_number > 12:
        raise api_error(400, "INVALID_MONTH", "month must be a valid year-month")
    return year, month_number


def _month_marker(year: int, month: int) -> int:
    return year * 12 + (month - 1)


@router.get("/income-statement", response_model=IncomeStatementOut)
def get_income_statement(
    book_id: UUID = Query(...),
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    db: Session = Depends(get_db),
) -> dict:
    book_id_str = str(book_id)
    ensure_book_read_access(db, book_id=book_id_str)
    if db.get(Book, book_id_str) is None:
        raise api_error(400, "INVALID_BOOK", "book_id must reference an existing book", {"book_id": book_id_str})

    year, month_number = _parse_month(month)
    return build_income_statement(db, book_id=book_id_str, year=year, month=month_number)


@router.get("/income-statement/matrix", response_model=IncomeStatementMatrixOut)
def get_income_statement_matrix(
    book_id: UUID = Query(...),
    start_month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    end_month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    db: Session = Depends(get_db),
) -> dict:
    book_id_str = str(book_id)
    ensure_book_read_access(db, book_id=book_id_str)
    if db.get(Book, book_id_str) is None:
        raise api_error(400, "INVALID_BOOK", "book_id must reference an existing book", {"book_id": book_id_str})

    start_year, start_month_number = _parse_month(start_month)
    end_year, end_month_number = _parse_month(end_month)
    start_marker = _month_marker(start_year, start_month_number)
    end_marker = _month_marker(end_year, end_month_number)
    if start_marker > end_marker:
        raise api_error(
            400,
            "INVALID_MONTH_RANGE",
            "start_month must be less than or equal to end_month",
            {"start_month": start_month, "end_month": end_month},
        )
    if (end_marker - start_marker + 1) > 36:
        raise api_error(
            400,
            "INVALID_MONTH_RANGE",
            "month range is limited to 36 months",
            {"max_months": 36},
        )

    return build_income_statement_matrix(
        db,
        book_id=book_id_str,
        start_year=start_year,
        start_month=start_month_number,
        end_year=end_year,
        end_month=end_month_number,
    )


@router.get(
    "/income-statement/accounts/{account_id}/entries",
    response_model=IncomeStatementAccountEntriesOut,
)
def get_income_statement_account_entries(
    account_id: UUID,
    book_id: UUID = Query(...),
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    db: Session = Depends(get_db),
) -> dict:
    book_id_str = str(book_id)
    ensure_book_read_access(db, book_id=book_id_str)
    account_id_str = str(account_id)
    account = db.get(Account, account_id_str)
    if account is None:
        raise api_error(404, "NOT_FOUND", "requested resource was not found")
    if account.book_id != book_id_str:
        raise api_error(
            400,
            "INVALID_ACCOUNT",
            "account_id must reference an account in the selected book",
            {"account_id": account_id_str, "book_id": book_id_str},
        )
    if account.type not in (AccountType.INCOME, AccountType.EXPENSE):
        raise api_error(
            409,
            "INVALID_ACCOUNT_TYPE",
            "account must be INCOME or EXPENSE for this report",
            {"account_id": account_id_str, "account_type": account.type.value},
        )

    year, month_number = _parse_month(month)
    return list_income_statement_account_entries(
        db,
        account=account,
        year=year,
        month=month_number,
    )


@router.get("/financial-dashboard", response_model=FinancialDashboardOut)
def get_financial_dashboard(
    book_id: UUID = Query(...),
    year: int = Query(..., ge=1900, le=3000),
    db: Session = Depends(get_db),
) -> dict:
    book_id_str = str(book_id)
    ensure_book_read_access(db, book_id=book_id_str)
    if db.get(Book, book_id_str) is None:
        raise api_error(400, "INVALID_BOOK", "book_id must reference an existing book", {"book_id": book_id_str})
    return build_financial_dashboard(db, book_id=book_id_str, year=year)


@router.get(
    "/invoices/settlement-by-customer",
    response_model=InvoiceSettlementByCustomerReportOut,
)
def get_invoice_settlement_by_customer_report(
    book_id: UUID = Query(...),
    customer_guid: UUID | None = Query(default=None),
    posted_start_date: date | None = Query(default=None),
    posted_end_date: date | None = Query(default=None),
    sort_key: Literal[
        "customer",
        "invoice_id",
        "date_posted",
        "posted_month_end_date",
        "settled_date",
        "days_difference",
    ] = Query(default="posted_month_end_date"),
    sort_direction: Literal["asc", "desc"] = Query(default="asc"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    db: Session = Depends(get_db),
) -> dict:
    book_id_str = str(book_id)
    ensure_book_read_access(db, book_id=book_id_str)
    if db.get(Book, book_id_str) is None:
        raise api_error(400, "INVALID_BOOK", "book_id must reference an existing book", {"book_id": book_id_str})

    if posted_start_date and posted_end_date and posted_start_date > posted_end_date:
        raise api_error(
            400,
            "INVALID_DATE_RANGE",
            "posted_start_date must be less than or equal to posted_end_date",
            {"posted_start_date": str(posted_start_date), "posted_end_date": str(posted_end_date)},
        )

    return build_invoice_settlement_by_customer_report(
        db,
        book_id=book_id_str,
        customer_guid=str(customer_guid) if customer_guid is not None else None,
        posted_start_date=posted_start_date,
        posted_end_date=posted_end_date,
        sort_key=sort_key,
        sort_direction=sort_direction,
        page=page,
        page_size=page_size,
    )


@router.get("/account-transfers", response_model=AccountTransfersReportOut)
def get_account_transfers_report(
    book_id: UUID = Query(...),
    source_account_id: list[UUID] = Query(default=[]),
    dest_account_id: list[UUID] = Query(default=[]),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    sort_direction: Literal["asc", "desc"] = Query(default="asc"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    db: Session = Depends(get_db),
) -> dict:
    book_id_str = str(book_id)
    ensure_book_read_access(db, book_id=book_id_str)
    if db.get(Book, book_id_str) is None:
        raise api_error(400, "INVALID_BOOK", "book_id must reference an existing book", {"book_id": book_id_str})

    if start_date and end_date and start_date > end_date:
        raise api_error(
            400,
            "INVALID_DATE_RANGE",
            "start_date must be less than or equal to end_date",
            {"start_date": str(start_date), "end_date": str(end_date)},
        )

    return build_account_transfers_report(
        db,
        book_id=book_id_str,
        source_account_ids=[str(i) for i in source_account_id],
        dest_account_ids=[str(i) for i in dest_account_id],
        start_date=start_date,
        end_date=end_date,
        sort_direction=sort_direction,
        page=page,
        page_size=page_size,
    )
