#!/usr/bin/env bash
# Local Serangkai MCP proxy.
#
# Registers `serangkai` with an MCP client using a bearer token WITHOUT putting
# the token in opencode.json (which is committed). The token comes from
# .env.serangkai-mcp, which is gitignored.
#
# This is a stdio->HTTP bridge: MCP clients speak stdio, the app serves
# Streamable HTTP at /api/mcp.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env.serangkai-mcp"
BASE_URL="${SERANGKAI_MCP_URL:-http://localhost:6969}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "serangkai-mcp: missing $ENV_FILE" >&2
  echo "Create it with: SERANGKAI_MCP_TOKEN=<token from /settings>" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

if [[ -z "${SERANGKAI_MCP_TOKEN:-}" ]]; then
  echo "serangkai-mcp: SERANGKAI_MCP_TOKEN is empty in $ENV_FILE" >&2
  exit 1
fi

exec npx --yes mcp-remote "$BASE_URL/api/mcp" \
  --header "Authorization: Bearer ${SERANGKAI_MCP_TOKEN}"
