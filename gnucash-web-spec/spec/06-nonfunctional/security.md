# 06 - Security

## Authentication baseline

1. API provides JWT-based authentication endpoints at `/auth/*`.
2. Passwords MUST be stored as salted, iterated hashes (no plaintext storage).
3. Access and refresh tokens MUST be signed server-side and validated on protected routes.
4. Token payload must include expiration and token type (`access` / `refresh`).
5. Global route protection is controlled by `AUTH_REQUIRED`:
   - `false`: business endpoints are public (current backward-compatible default).
   - `true`: business endpoints require valid bearer access token.

## Current requirements

1. API MUST validate structural payloads and business invariants before persistence.
2. Error messages MUST avoid leaking stack traces or internal SQL details.
3. IDs MUST be treated as opaque references.
4. Destructive operations with business risk (for example invoice-linked transaction edits) MUST be blocked by server-side guards.
5. CORS policy SHOULD be explicitly configured.

## Future-ready guidance

- Contract may be extended with tenant context and authorization claims without breaking current payload shapes.
