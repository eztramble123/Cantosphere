#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DOCKER_DIR="$PROJECT_DIR/docker"

echo "Starting Canton sandbox..."
docker compose -f "$DOCKER_DIR/docker-compose.yml" up -d

echo "Waiting for Canton to be healthy..."
MAX_RETRIES=60
RETRY_INTERVAL=5

for i in $(seq 1 $MAX_RETRIES); do
  if curl -sf http://localhost:4021/v2/version > /dev/null 2>&1; then
    echo "Canton sandbox is ready!"
    echo "  Admin API (gRPC): localhost:5002"
    echo "  JSON Ledger API:  localhost:4021"
    echo "  Canton Postgres:  localhost:5433"
    exit 0
  fi
  echo "  Attempt $i/$MAX_RETRIES — waiting ${RETRY_INTERVAL}s..."
  sleep $RETRY_INTERVAL
done

echo "ERROR: Canton sandbox failed to become healthy after $((MAX_RETRIES * RETRY_INTERVAL))s"
docker compose -f "$DOCKER_DIR/docker-compose.yml" logs canton
exit 1
