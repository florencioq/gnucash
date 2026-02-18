# 03.01 - Logical Model

## Overview

Current logical model includes:
- `Book`
- `DocumentNumberCounter`
- `User`
- `UserBookAccess`
- `Commodity`
- `Account`
- `Customer`
- `Vendor`
- `Invoice` (also used for bills through owner polymorphism)
- `InvoiceEntry`
- `Lot`
- `Transaction`
- `Split`

## Core relationships

- `Book` 1:N `Account`
- `Book` 1:N `Customer`
- `Book` 1:N `Vendor`
- `Book` 1:N `Invoice`
- `Book` 1:N `DocumentNumberCounter`
- `User` 1:N `UserBookAccess`
- `Book` 1:N `UserBookAccess`
- `Book` 0..1:N default setup account references (`default_payables_account_guid`, `default_receivables_account_guid`, `default_iss_recoverable_account_guid`) to `Account`
- `Commodity` 1:N `Account`
- `Commodity` 1:N `Transaction`
- `Commodity` 1:N `Customer`/`Vendor`/`Invoice`
- `Account` 1:N `Account` (self hierarchy)
- `Customer` 0..1:1 `Account` (`income_account_guid`)
- `Vendor` 0..1:1 `Account` (`expense_account_guid`)
- `Invoice` 1:N `InvoiceEntry`
- `Account` 1:N `InvoiceEntry`
- `Account` 1:N `Lot`
- `Transaction` 1:N `Split`
- `Account` 1:N `Split`

## Business modeling notes

- Bills and invoices share one persistence model (`invoices`) distinguished by `owner_type` (`VENDOR` vs `CUSTOMER`).
- Invoice/bill business-number sequencing uses per-book/per-owner-type counters (`DocumentNumberCounter`) for collision-safe auto-number reservation.
- Authorization uses global user roles (`is_superuser`) plus book-scoped grants (`UserBookAccess.role`).
- Open-balance control for invoice/bill posting uses lots (`post_lot`) and linked splits.
- Retained-at-source tax in invoicing is represented in posting splits via dedicated retained-tax asset account when applicable.
- Income statement APIs are read models derived from `transactions` + `splits` + account types.

## Representation independence

This model defines logical relationships and contracts without imposing specific storage engine details.
