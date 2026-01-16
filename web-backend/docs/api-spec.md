# API Spec (Draft)

Document endpoints, request/response schemas, auth, and errors. Consider maintaining an OpenAPI file in `web-backend/docs/openapi.yaml`.

## Conventions
- JSON, snake_case fields.
- IDs as GUIDs.

## Endpoints
- Books
  - POST /books
  - GET /books
  - GET /books/{id}
- Commodities
  - POST /commodities
  - GET /commodities
  - GET /commodities/{id}
- Accounts
  - POST /accounts
  - GET /accounts
  - GET /accounts/tree?book_id=...
  - GET /accounts/{id}
  - PATCH /accounts/{id}
  - POST /accounts/{id}/move
  - DELETE /accounts/{id}

## Errors
- 400: validation errors with field details
- 404: resource not found
- 409: uniqueness conflicts
- 500: unexpected server errors

## Auth
- Describe the chosen scheme.
