#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Iterable

ACCOUNT_TYPE_MAP = {
    "ASSET": "ASSET",
    "LIABILITY": "LIABILITY",
    "INCOME": "INCOME",
    "EXPENSE": "EXPENSE",
    "EQUITY": "EQUITY",
    "ROOT": "ROOT",
    "BANK": "ASSET",
    "CASH": "ASSET",
    "CREDIT": "LIABILITY",
}


@dataclass
class AccountRow:
    account_id: str
    name: str
    account_type: str
    commodity_id: str
    parent_id: str | None
    code: str | None
    description: str | None
    is_placeholder: bool


def api_request(base: str, method: str, path: str, payload: dict | None = None) -> tuple[int, dict | None]:
    url = f"{base}{path}"
    data = None
    headers = {"Content-Type": "application/json"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            body = resp.read().decode("utf-8")
            return resp.status, json.loads(body) if body else None
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8")
        parsed = None
        if body:
            try:
                parsed = json.loads(body)
            except json.JSONDecodeError:
                parsed = None
        return err.code, parsed


def read_rows(path: str) -> Iterable[list[str]]:
    if path == "-":
        content = sys.stdin.read().splitlines()
    else:
        content = open(path, "r", encoding="utf-8").read().splitlines()

    for line in content:
        if not line.strip():
            continue
        if "\t" in line:
            yield list(csv.reader([line], delimiter="\t")).__next__()
        else:
            yield [col for col in line.split(" ") if col]


def parse_account(row: list[str], default_commodity_id: str | None) -> AccountRow | None:
    if len(row) < 3:
        return None

    account_id = row[0].strip()
    name = row[1].strip()
    raw_type = row[2].strip().upper()
    account_type = ACCOUNT_TYPE_MAP.get(raw_type)
    if account_type is None:
        raise ValueError(f"unsupported account type: {raw_type}")

    commodity_id = row[3].strip() if len(row) > 3 else ""
    if not commodity_id:
        if default_commodity_id:
            commodity_id = default_commodity_id
        else:
            raise ValueError(f"missing commodity_id for account {account_id}")

    parent_id = row[6].strip() if len(row) > 6 else ""
    if parent_id == "":
        parent_id = None

    code = row[7].strip() if len(row) > 7 and row[7].strip() else None
    description = row[8].strip() if len(row) > 8 and row[8].strip() else None

    is_placeholder = account_type == "ROOT"
    if len(row) > 9 and row[9].strip() in {"1", "true", "True"}:
        is_placeholder = True

    if account_type == "ROOT":
        parent_id = None

    return AccountRow(
        account_id=account_id,
        name=name,
        account_type=account_type,
        commodity_id=commodity_id,
        parent_id=parent_id,
        code=code,
        description=description,
        is_placeholder=is_placeholder,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Import accounts via API from TSV")
    parser.add_argument("--api-base", default="http://127.0.0.1:8000", help="API base URL")
    parser.add_argument("--book-id", required=True, help="Target book UUID")
    parser.add_argument("--input", required=True, help="Path to TSV file or '-' for stdin")
    parser.add_argument("--default-commodity-id", help="Fallback commodity UUID if missing")
    parser.add_argument("--skip-existing", action="store_true", help="Skip accounts that already exist")
    args = parser.parse_args()

    rows: list[AccountRow] = []
    for raw in read_rows(args.input):
        try:
            parsed = parse_account(raw, args.default_commodity_id)
        except ValueError as exc:
            print(f"error: {exc}", file=sys.stderr)
            return 1
        if parsed:
            rows.append(parsed)

    pending = rows[:]
    created: set[str] = set()
    iteration = 0

    while pending:
        iteration += 1
        progressed = False
        next_pending: list[AccountRow] = []

        for account in pending:
            if account.parent_id and account.parent_id not in created:
                next_pending.append(account)
                continue

            payload = {
                "id": account.account_id,
                "book_id": args.book_id,
                "parent_id": account.parent_id,
                "name": account.name,
                "type": account.account_type,
                "commodity_id": account.commodity_id,
                "is_placeholder": account.is_placeholder,
            }
            if account.code:
                payload["code"] = account.code
            if account.description:
                payload["description"] = account.description

            status, body = api_request(args.api_base, "POST", "/accounts", payload)
            if status == 201:
                created.add(account.account_id)
                progressed = True
                continue

            if args.skip_existing:
                status_get, _ = api_request(args.api_base, "GET", f"/accounts/{account.account_id}")
                if status_get == 200:
                    created.add(account.account_id)
                    progressed = True
                    continue

            print(f"failed to create {account.account_id} ({account.name}): {status} {body}", file=sys.stderr)
            return 1

        if not progressed:
            missing = [acc.account_id for acc in next_pending if acc.parent_id not in created]
            print(f"stuck; missing parent accounts: {missing}", file=sys.stderr)
            return 1

        pending = next_pending

    print(f"created {len(created)} accounts")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
