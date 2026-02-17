# 00 - Introduction

## Purpose

This document defines the current domain/API contract independently of implementation details.

The specification:
- MUST describe entities, invariants, and observable behaviors.
- MUST avoid framework, database, ORM, UI toolkit, or runtime choices in `spec/**`.
- MAY be implemented in different stacks as long as contracts are preserved.

## Scope

Includes:
- Book, Commodity, Account, Customer, Vendor
- Invoice/Bill lifecycle operations
- Transaction/Split posting operations
- Account-tree balances and income statement reporting APIs

Does not include:
- authn/authz product policy
- tax-table calculation rules
- inventory and stock valuation models
- accounting close and period lock workflows

## Conformance

An implementation is conformant if it:
- enforces invariants in `spec/02-domain/02-invariants.md`;
- exposes behavior equivalent to `spec/04-api/openapi.yaml`;
- follows endpoint semantics in `spec/04-api/endpoints.md`;
- passes acceptance scenarios and automated tests described in `spec/07-testing/acceptance-tests.md`.
