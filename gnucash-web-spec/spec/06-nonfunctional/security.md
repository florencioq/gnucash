# 06 - Security

## Scope boundary

This spec does not define authentication/authorization product policy.

## Current requirements

1. API MUST validate structural payloads and business invariants before persistence.
2. Error messages MUST avoid leaking stack traces or internal SQL details.
3. IDs MUST be treated as opaque references.
4. Destructive operations with business risk (for example invoice-linked transaction edits) MUST be blocked by server-side guards.
5. CORS policy SHOULD be explicitly configured.

## Future-ready guidance

- Contract may be extended with tenant context and authorization claims without breaking current payload shapes.
