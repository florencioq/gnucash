# 08 - Release Plan: Immediate Backlog

## Purpose

Track near-term implementation items that are planned for upcoming cycles and do not require changing the current contract baseline.

## Prioritized items

1. Payment history should show vendor context for bill references.
   - `Status`: planned
   - `Priority`: high
   - `Scope`: payment-history UI entries linked to bill documents.
   - `Requirement`: when rendering payment-history entries for bill payments, the UI SHOULD display vendor name together with bill number.
   - `Display example`: `Compra 1234 - Fornecedor ABC`.
   - `Fallback`: when vendor data is missing/unresolvable, UI SHOULD keep bill number and render fallback label `fornecedor não encontrado`.
