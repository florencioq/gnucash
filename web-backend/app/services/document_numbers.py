from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import DocumentNumberCounter, Invoice


def _scan_existing_numeric_ids(
    db: Session,
    *,
    book_id: str,
    owner_type: str,
    minimum_width: int,
) -> tuple[int, int]:
    existing_ids = db.execute(
        select(Invoice.id).where(
            Invoice.book_id == book_id,
            Invoice.owner_type == owner_type,
        )
    ).scalars().all()

    highest_value = 0
    width = minimum_width
    for existing_id in existing_ids:
        normalized = str(existing_id or "").strip()
        if not normalized.isdigit():
            continue
        width = max(width, len(normalized))
        highest_value = max(highest_value, int(normalized))
    return highest_value + 1, width


def _lock_or_create_counter(
    db: Session,
    *,
    book_id: str,
    owner_type: str,
    minimum_width: int,
    floor_next_value: int = 1,
    floor_width: int = 1,
) -> DocumentNumberCounter:
    floor_next_value = max(1, floor_next_value)
    floor_width = max(1, floor_width, minimum_width)

    while True:
        counter = db.execute(
            select(DocumentNumberCounter)
            .where(
                DocumentNumberCounter.book_id == book_id,
                DocumentNumberCounter.owner_type == owner_type,
            )
            .with_for_update()
        ).scalar_one_or_none()
        if counter is not None:
            return counter

        seeded_next_value, seeded_width = _scan_existing_numeric_ids(
            db,
            book_id=book_id,
            owner_type=owner_type,
            minimum_width=minimum_width,
        )
        seeded_next_value = max(seeded_next_value, floor_next_value)
        seeded_width = max(seeded_width, floor_width)

        try:
            with db.begin_nested():
                db.add(
                    DocumentNumberCounter(
                        book_id=book_id,
                        owner_type=owner_type,
                        next_value=seeded_next_value,
                        width=seeded_width,
                    )
                )
                db.flush()
        except IntegrityError:
            # Another concurrent transaction inserted the counter first; retry and lock it.
            continue


def observe_manual_document_number(
    db: Session,
    *,
    book_id: str,
    owner_type: str,
    document_id: str,
    minimum_width: int = 6,
) -> None:
    normalized = str(document_id or "").strip()
    if not normalized.isdigit():
        return

    floor_next_value = int(normalized) + 1
    floor_width = len(normalized)

    counter = _lock_or_create_counter(
        db,
        book_id=book_id,
        owner_type=owner_type,
        minimum_width=minimum_width,
        floor_next_value=floor_next_value,
        floor_width=floor_width,
    )
    counter.next_value = max(counter.next_value, floor_next_value)
    counter.width = max(counter.width, floor_width, minimum_width)
    db.flush()


def reserve_next_document_number(
    db: Session,
    *,
    book_id: str,
    owner_type: str,
    minimum_width: int = 6,
) -> str:
    counter = _lock_or_create_counter(
        db,
        book_id=book_id,
        owner_type=owner_type,
        minimum_width=minimum_width,
    )
    value = counter.next_value
    counter.next_value = value + 1
    counter.width = max(counter.width, len(str(value)), minimum_width)
    db.flush()
    return str(value).zfill(counter.width)
