# 03.01 - Logical Model

## Overview

Logical model with three entities:
- `Book`
- `Commodity`
- `Account`

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
