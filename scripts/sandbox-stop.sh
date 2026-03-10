#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DOCKER_DIR="$PROJECT_DIR/docker"

echo "Stopping Canton sandbox..."
docker compose -f "$DOCKER_DIR/docker-compose.yml" down
echo "Canton sandbox stopped."
