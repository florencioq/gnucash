# 03.01 - Logical Model

## Overview

Logical model with three entities:
- `Book`
- `Commodity`
- `Account`

This logical model is the normative API/domain view and is aligned with the legacy relational baseline documented in `spec/03-data/04.gnucash-database.md`.

## Relationships

- `Book` 1:N `Account`
- `Commodity` 1:N `Account`
- `Account` 1:N `Account` (self-reference via parent/children)

## Logical constraints

- Every `Account` belongs to exactly one `Book`.
- Every `Account` references exactly one `Commodity`.
- `parent_id` is optional and, when present, references an `Account` in the same `Book`.
- The `Account` hierarchy per `Book` MUST be acyclic.

## Representation independence

This model defines logical relationships and contracts without imposing specific SQL, storage engine, or internal persistence format.

## Legacy baseline alignment

- SQL implementations MAY keep physical compatibility with the legacy GnuCash tables in `spec/03-data/04.gnucash-database.md`.
- When legacy physical naming differs from the contract (for example `guid` vs `id`, `parent_guid` vs `parent_id`), implementations MUST preserve equivalent observable behavior at the API boundary.
- Implementations SHOULD add relational hardening (foreign keys, unique constraints, and check constraints) to enforce this logical model at the database level.
