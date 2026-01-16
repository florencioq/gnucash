# Environment & Config

Centralize environment variables and defaults used by the backend.

## Database
- POSTGRES_HOST: default `localhost`
- POSTGRES_PORT: default `5433` (Compose publishes 5433 -> container 5432)
- POSTGRES_USER: default `gnucash`
- POSTGRES_PASSWORD: default `gnucash`
- POSTGRES_DB: default `gnucash_web`

## Service
- PORT: backend HTTP port
- LOG_LEVEL: info | debug | warn | error
- AUTH_*: tokens, keys, or provider settings

## Example `.env`
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
POSTGRES_USER=gnucash
POSTGRES_PASSWORD=gnucash
POSTGRES_DB=gnucash_web
