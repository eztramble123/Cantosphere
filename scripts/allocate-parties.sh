#!/usr/bin/env bash
set -euo pipefail

JSON_API_URL="${CANTON_JSON_API_URL:-http://localhost:4021}"

echo "Allocating parties via JSON API at $JSON_API_URL..."

allocate_party() {
  local party_hint="$1"
  local display_name="$2"

  echo -n "  Allocating $display_name... "
  RESPONSE=$(curl -sf -X POST "$JSON_API_URL/v2/parties" \
    -H "Content-Type: application/json" \
    -d "{
      \"partyIdHint\": \"$party_hint\",
      \"displayName\": \"$display_name\"
    }" 2>&1) || {
    echo "FAILED (party may already exist)"
    return 0
  }

  PARTY_ID=$(echo "$RESPONSE" | grep -o '"party"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"party"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')

  if [ -n "$PARTY_ID" ]; then
    echo "$PARTY_ID"
  else
    echo "OK (response: $RESPONSE)"
  fi
}

allocate_party "MarketplaceOperator" "MarketplaceOperator"
allocate_party "AppProvider" "AppProvider"
allocate_party "Validator1" "Validator1"

echo ""
echo "Party allocation complete."
echo "Set these in your .env file:"
echo "  CANTON_PARTY_MARKETPLACE_OPERATOR=<MarketplaceOperator party ID>"
echo "  CANTON_PARTY_APP_PROVIDER=<AppProvider party ID>"
echo "  CANTON_PARTY_VALIDATOR1=<Validator1 party ID>"
