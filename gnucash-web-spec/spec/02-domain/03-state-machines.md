# 02.03 - State Machines

## Current status (v0.1.0)

There is no formal lifecycle state machine for `Book`, `Commodity`, or `Account`.

In v0.1.0:
- entities are considered active from creation;
- updates are direct mutations of allowed attributes;
- physical deletion is allowed, subject to integrity invariants.

## Future extension

A future version MAY introduce explicit states (for example, archived, locked) without invalidating existing identifiers.
