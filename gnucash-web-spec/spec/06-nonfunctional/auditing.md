# 06 - Auditing

## Current requirements

1. `created_at` MUST be recorded for entities that expose creation timestamps (`Book`, `Account`, `Customer`, `Vendor`, `Invoice`, `Entry`).
2. `updated_at` MUST be refreshed on mutable entities that expose update timestamps (`Account`, `Customer`, `Vendor`, `Invoice`, `Entry`).
3. `Transaction.enter_date` MUST be recorded for posted transactions.
4. Timestamp fields exposed by API MUST be UTC RFC3339-compatible strings.

## Scope boundary

- Full audit trail (actor, before/after diff, reason) is outside current conformance scope.
