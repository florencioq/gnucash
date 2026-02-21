from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Slot

TRANS_DATE_DUE_SLOT_NAME = "trans-date-due"
TRANS_DATE_DUE_SLOT_TYPE = 10


def normalize_datetime_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def set_transaction_due_date(db: Session, *, transaction_guid: str, due_date: datetime) -> datetime:
    normalized_due_date = normalize_datetime_utc(due_date)
    slot = db.execute(
        select(Slot)
        .where(Slot.obj_guid == transaction_guid, Slot.name == TRANS_DATE_DUE_SLOT_NAME)
        .order_by(Slot.id.desc())
        .limit(1)
    ).scalar_one_or_none()
    if slot is None:
        slot = Slot(
            obj_guid=transaction_guid,
            name=TRANS_DATE_DUE_SLOT_NAME,
            slot_type=TRANS_DATE_DUE_SLOT_TYPE,
            timespec_val=normalized_due_date,
        )
        db.add(slot)
    else:
        slot.slot_type = TRANS_DATE_DUE_SLOT_TYPE
        slot.timespec_val = normalized_due_date
    return normalized_due_date


def load_due_dates_by_tx_guid(db: Session, *, tx_guids: set[str]) -> dict[str, datetime]:
    if not tx_guids:
        return {}
    rows = db.execute(
        select(Slot.obj_guid, Slot.timespec_val)
        .where(Slot.obj_guid.in_(tx_guids), Slot.name == TRANS_DATE_DUE_SLOT_NAME)
        .order_by(Slot.id.asc())
    ).all()
    due_dates: dict[str, datetime] = {}
    for tx_guid, timespec_val in rows:
        if tx_guid and timespec_val is not None:
            due_dates[tx_guid] = normalize_datetime_utc(timespec_val)
    return due_dates
