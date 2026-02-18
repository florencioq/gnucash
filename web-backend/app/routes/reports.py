from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import api_error
from app.models import Account, AccountType, Book
from app.schemas import IncomeStatementAccountEntriesOut, IncomeStatementMatrixOut, IncomeStatementOut
from app.services.authorization import ensure_book_read_access
from app.services.reports import (
    build_income_statement,
    build_income_statement_matrix,
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
