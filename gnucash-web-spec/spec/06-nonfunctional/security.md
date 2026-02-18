# 06 - Security

## Authentication baseline

1. API provides JWT-based authentication endpoints at `/auth/*`.
2. Passwords MUST be stored as salted, iterated hashes (no plaintext storage).
3. Access and refresh tokens MUST be signed server-side and validated on protected routes.
4. Token payload must include expiration and token type (`access` / `refresh`).
5. Global route protection is controlled by `AUTH_REQUIRED`:
   - `false`: business endpoints are public (current backward-compatible default).
   - `true`: business endpoints require valid bearer access token.
6. First-user bootstrap registration is allowed only when user table is empty and must create a superuser.
7. After bootstrap, user registration requires authenticated superuser.

## Authorization baseline

1. User model includes:
   - `is_superuser` global privilege flag.
   - optional per-book grants in `user_book_access` with role `VIEWER|EDITOR`.
2. Superuser bypasses book-level authorization checks.
3. Non-superuser access policy:
   - read endpoints for a target book require grant `VIEWER` or `EDITOR`.
   - write endpoints for a target book require grant `EDITOR`.
4. User-management endpoints (`/auth/users` and `/auth/users/{user_id}/books*`) require superuser.
5. Book and commodity mutations require superuser.

## Current requirements

1. API MUST validate structural payloads and business invariants before persistence.
2. Error messages MUST avoid leaking stack traces or internal SQL details.
3. IDs MUST be treated as opaque references.
4. Destructive operations with business risk (for example invoice-linked transaction edits) MUST be blocked by server-side guards.
5. CORS policy SHOULD be explicitly configured.

## Future-ready guidance

- Contract may be extended with tenant context and authorization claims without breaking current payload shapes.
