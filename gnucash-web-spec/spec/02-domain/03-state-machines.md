# 02.03 - State Machines

## Book activation

`Book.is_active` transition rules:
- `create`: new book may be active; first book becomes active automatically.
- `patch is_active=true`: target book becomes active and others become inactive.
- `patch is_active=false`: allowed only if another active book exists.
- `delete active book`: first remaining book becomes active.

## Invoice and bill lifecycle

Computed status machine:
- `UNPAID`: not posted.
- `POSTED`: posted and open amount equals total (no payments).
- `PARTIAL`: posted and `0 < open_amount < total`.
- `PAID`: posted and `open_amount = 0`.
- `INACTIVE`: header `active=false`.

Operational transitions:
- `create` -> `UNPAID`
- `post` -> `POSTED` (default path without retained-at-source tax)
- `post` -> `PARTIAL` when retained-at-source tax reduces open amount at posting time
- `payments` -> `PARTIAL` or `PAID`
- `payment undo` -> `POSTED` or `PARTIAL`
- `unpost` -> `UNPAID`
- `patch active=false` -> `INACTIVE`

Due-date transitions:
- `post`: sets `date_due` from request `due_date` (or `post_date` when omitted).
- `unpost`: clears `date_due` because posting transaction (and due-date slot) is removed.

## Transaction linkage guard

Transactions linked to invoice/bill posting/payment flows are immutable through generic transaction patch/delete APIs.
