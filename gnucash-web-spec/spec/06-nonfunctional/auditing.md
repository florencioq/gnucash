# 06 - Auditing

## Current requirements

1. `created_at` MUST be recorded when an entity is created.
2. `updated_at` MUST be refreshed on every modification of `Account`.
3. Timestamps MUST be in UTC and exposed in an RFC3339-compatible API format.

## Scope boundary

- Complete audit trail (who changed what, before/after, reason) is reserved for future phases.
- v0.2.0 MAY include operational logs, but that is not a domain conformance requirement.
