# web-frontend

React + Bootstrap 5 frontend for the GnuCash web spec.

## Setup

```bash
npm install
```

## Run

```bash
npm run dev
```

## Run with Docker Compose (backend + frontend + db)

From project root:

```bash
docker compose up --build
```

URLs:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`

## API base URL

By default the UI calls `http://localhost:8000`. Override with:

```bash
VITE_API_BASE_URL=http://localhost:8000 npm run dev
```

## Root accounts

Root accounts must be created with `type=ROOT`. The parent selector is disabled for ROOT and no explicit `(root)` option is provided.

## Account ledger

The app includes a dedicated `Ledger` tab:
- list postings with running balance by account;
- create a new posting directly from the ledger by selecting counter-account, date, history, and amount.
- open ledger directly from the account tree using the ledger button on each non-root account.
- edit and delete existing postings directly in ledger rows.

## Monthly income statement (DRE)

The app includes a dedicated `DRE Mensal` tab:
- matrix view with columns by `year-month` and rows by revenue/expense accounts;
- start and end period filters (`YYYY-MM`);
- search and account-type filters for matrix rows.

## Customers and vendors

The app includes dedicated `Customers` and `Vendors` tabs:
- register entities with core GnuCash-style fields (`name`, `id`, `currency`, `notes`, `active`);
- manage billing/contact fields;
- edit and delete existing records by book.
