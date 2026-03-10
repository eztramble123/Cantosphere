#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DOCKER_DIR="$PROJECT_DIR/docker"

echo "Resetting Canton sandbox (removing volumes)..."
docker compose -f "$DOCKER_DIR/docker-compose.yml" down -v
echo "Volumes removed."

echo "Restarting Canton sandbox..."
exec "$SCRIPT_DIR/sandbox-start.sh"
