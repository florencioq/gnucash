#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

COMPOSE_FILE="${REPO_ROOT}/docker-compose.yml"
ENV_FILE=""
DOCKER_CONTEXT_NAME=""
PULL_DB=1
BUILD_APPS=1
FORCE_RECREATE=1
PRUNE_IMAGES=0
DRY_RUN=0

SERVICES=(db web-backend web-frontend)

usage() {
  cat <<USAGE
Usage: $(basename "$0") [options]

Atualiza a stack Docker do projeto (db + web-backend + web-frontend):
1) pull da imagem do banco
2) build --pull das imagens de app
3) up -d (com --force-recreate por padrao)

Options:
  -f, --compose-file PATH   Caminho do docker compose file (default: ${REPO_ROOT}/docker-compose.yml)
  -e, --env-file PATH       Caminho do env file para o compose (opcional)
  -c, --context NAME        Docker context remoto (opcional; sem isso usa o contexto local/padrao)
      --skip-pull-db        Nao executa pull da imagem do db
      --skip-build          Nao executa build das imagens web-backend/web-frontend
      --no-force-recreate   Executa up sem --force-recreate
      --prune-images        Executa docker image prune -f ao final
      --dry-run             Mostra os comandos e sai sem executar
  -h, --help                Mostra esta ajuda
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -f|--compose-file)
      if [[ $# -lt 2 ]]; then
        echo "Erro: faltou valor para $1" >&2
        exit 1
      fi
      COMPOSE_FILE="$2"
      shift 2
      ;;
    -e|--env-file)
      if [[ $# -lt 2 ]]; then
        echo "Erro: faltou valor para $1" >&2
        exit 1
      fi
      ENV_FILE="$2"
      shift 2
      ;;
    -c|--context)
      if [[ $# -lt 2 ]]; then
        echo "Erro: faltou valor para $1" >&2
        exit 1
      fi
      DOCKER_CONTEXT_NAME="$2"
      shift 2
      ;;
    --skip-pull-db)
      PULL_DB=0
      shift
      ;;
    --skip-build)
      BUILD_APPS=0
      shift
      ;;
    --no-force-recreate)
      FORCE_RECREATE=0
      shift
      ;;
    --prune-images)
      PRUNE_IMAGES=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Erro: opcao desconhecida: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "Erro: comando 'docker' nao encontrado." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Erro: plugin 'docker compose' nao disponivel." >&2
  exit 1
fi

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "Erro: compose file nao encontrado: ${COMPOSE_FILE}" >&2
  exit 1
fi

if [[ -n "${DOCKER_CONTEXT_NAME}" ]] && [[ -z "${ENV_FILE}" ]]; then
  if [[ -f "${REPO_ROOT}/.env.prod" ]]; then
    ENV_FILE="${REPO_ROOT}/.env.prod"
  else
    echo "Erro: --context informado sem --env-file e .env.prod nao encontrado em ${REPO_ROOT}" >&2
    exit 1
  fi
fi

if [[ -n "${ENV_FILE}" ]] && [[ ! -f "${ENV_FILE}" ]]; then
  echo "Erro: env file nao encontrado: ${ENV_FILE}" >&2
  exit 1
fi

DOCKER_CMD=(docker)
if [[ -n "${DOCKER_CONTEXT_NAME}" ]]; then
  DOCKER_CMD+=(--context "${DOCKER_CONTEXT_NAME}")
fi

COMPOSE_CMD=("${DOCKER_CMD[@]}" compose -f "${COMPOSE_FILE}")
if [[ -n "${ENV_FILE}" ]]; then
  COMPOSE_CMD+=(--env-file "${ENV_FILE}")
fi

run_cmd() {
  if [[ ${DRY_RUN} -eq 1 ]]; then
    printf 'DRY-RUN:'
    printf ' %q' "$@"
    printf '\n'
    return 0
  fi
  "$@"
}

echo "[update-docker] compose file: ${COMPOSE_FILE}"
if [[ -n "${ENV_FILE}" ]]; then
  echo "[update-docker] env file: ${ENV_FILE}"
fi
if [[ -n "${DOCKER_CONTEXT_NAME}" ]]; then
  echo "[update-docker] docker context: ${DOCKER_CONTEXT_NAME}"
else
  echo "[update-docker] docker context: local/padrao"
fi
if [[ ${DRY_RUN} -eq 1 ]]; then
  echo "[update-docker] modo: dry-run (nenhuma alteracao sera aplicada)"
fi

echo "[update-docker] Atualizando stack: ${SERVICES[*]}"

if [[ ${PULL_DB} -eq 1 ]]; then
  echo "[update-docker] Pull da imagem do banco..."
  run_cmd "${COMPOSE_CMD[@]}" pull db
fi

if [[ ${BUILD_APPS} -eq 1 ]]; then
  echo "[update-docker] Build --pull das imagens de app..."
  run_cmd "${COMPOSE_CMD[@]}" build --pull web-backend web-frontend
fi

UP_ARGS=(up -d)
if [[ ${FORCE_RECREATE} -eq 1 ]]; then
  UP_ARGS+=(--force-recreate)
fi

echo "[update-docker] Recriando containers..."
run_cmd "${COMPOSE_CMD[@]}" "${UP_ARGS[@]}" "${SERVICES[@]}"

echo "[update-docker] Status atual:"
run_cmd "${COMPOSE_CMD[@]}" ps

if [[ ${PRUNE_IMAGES} -eq 1 ]]; then
  echo "[update-docker] Limpando imagens nao utilizadas..."
  run_cmd "${DOCKER_CMD[@]}" image prune -f
fi

echo "[update-docker] Concluido."
