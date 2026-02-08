# 00 - Introduction

## Purpose

This document defines the MVP domain contract independently of implementation details.

The specification:
- MUST describe entities, rules, and observable behaviors.
- MUST avoid framework, database, ORM, UI toolkit, or runtime choices in `spec/**`.
- MAY be implemented in different stacks as long as contracts are preserved.

## Scope

Includes only:
- Book
- Commodity
- Account
- CRUD
- account tree query by Book

Does not include:
- accounting postings
- computed balances
- billing
- AP/AR
- any financial flow beyond creating and maintaining the three entities

## Conformance

An implementation is conformant if it:
- enforces all invariants in `spec/02-domain/02-invariants.md`;
- exposes behavior equivalent to `spec/04-api/openapi.yaml`;
- passes the scenarios in `spec/07-testing/acceptance-tests.md`.
