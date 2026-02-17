# 03.01 - Logical Model

## Overview

Current logical model includes:
- `Book`
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
- `Commodity` 1:N `Account`
- `Commodity` 1:N `Transaction`
- `Commodity` 1:N `Customer`/`Vendor`/`Invoice`
- `Account` 1:N `Account` (self hierarchy)
- `Invoice` 1:N `InvoiceEntry`
- `Account` 1:N `InvoiceEntry`
- `Account` 1:N `Lot`
- `Transaction` 1:N `Split`
- `Account` 1:N `Split`

## Business modeling notes

- Bills and invoices share one persistence model (`invoices`) distinguished by `owner_type` (`VENDOR` vs `CUSTOMER`).
- Open-balance control for invoice/bill posting uses lots (`post_lot`) and linked splits.
- Income statement APIs are read models derived from `transactions` + `splits` + account types.

## Representation independence

This model defines logical relationships and contracts without imposing specific storage engine details.
