#!/usr/bin/env bash
set -euo pipefail

umask 077

usage() {
  cat <<'USAGE'
Usage:
  backup_pg.sh <db_name> [output_dir]

Environment variables:
  PGHOST, PGPORT, PGUSER, PGPASSWORD  Connection settings (or use ~/.pgpass)
  PGDUMP_FORMAT                     pg_dump format: c (custom), p (plain), t, d
  PGDUMP_EXTRA                      Extra pg_dump flags (space-separated)
  KEEP_DAYS                         Delete backups older than N days (0 = keep all)

Examples:
  PGHOST=localhost PGUSER=postgres ./backup_pg.sh mydb ./backups
  PGDUMP_FORMAT=p PGDUMP_EXTRA='--no-owner --no-privileges' ./backup_pg.sh mydb
  KEEP_DAYS=14 ./backup_pg.sh mydb /var/backups/pg
USAGE
}

DB_NAME="${1:-}"
OUT_DIR="${2:-./backups}"

if [[ -z "$DB_NAME" ]]; then
  usage
  exit 2
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump not found in PATH" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

PGDUMP_FORMAT="${PGDUMP_FORMAT:-c}"
PGDUMP_EXTRA="${PGDUMP_EXTRA:-}"
KEEP_DAYS="${KEEP_DAYS:-0}"

TS="$(date +"%Y%m%d_%H%M%S")"
EXT="dump"
if [[ "$PGDUMP_FORMAT" == "p" ]]; then
  EXT="sql"
fi

OUT_FILE="$OUT_DIR/${DB_NAME}_${TS}.${EXT}"

ARGS=( -F "$PGDUMP_FORMAT" -f "$OUT_FILE" )

if [[ -n "$PGDUMP_EXTRA" ]]; then
  read -r -a EXTRA_ARR <<<"$PGDUMP_EXTRA"
  ARGS+=( "${EXTRA_ARR[@]}" )
fi

ARGS+=( "$DB_NAME" )

echo "[backup_pg] Iniciando backup do banco '$DB_NAME'..."
if pg_dump "${ARGS[@]}"; then
  echo "[backup_pg] Backup salvo em: $OUT_FILE"
else
  echo "[backup_pg] Falha ao executar backup." >&2
  exit 1
fi

if [[ "$KEEP_DAYS" =~ ^[0-9]+$ ]] && (( KEEP_DAYS > 0 )); then
  echo "[backup_pg] Removendo backups mais antigos que $KEEP_DAYS dias..."
  find "$OUT_DIR" -type f -name "${DB_NAME}_*.*" -mtime "+$KEEP_DAYS" -print -delete
fi

echo "[backup_pg] Concluído."
