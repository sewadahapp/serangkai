#!/usr/bin/env bash
# Local Serangkai MCP proxy.
#
# Registers `serangkai` with an MCP client as a stdio->HTTP bridge to the app's
# Streamable HTTP endpoint. Two auth modes:
#
#   SERANGKAI_MCP_AUTH=oauth   no secret on disk; mcp-remote opens a browser
#   (default)                  bearer token from .env.serangkai-mcp
#
# The token is never written into opencode.json (which is committed).
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env.serangkai-mcp"
BASE_URL="${SERANGKAI_MCP_URL:-http://localhost:6969}"
AUTH_MODE="${SERANGKAI_MCP_AUTH:-token}"

if [[ "$AUTH_MODE" == "oauth" ]]; then
  # OAuth needs the callback to reach a browser-local port, so the bridge is
  # always driven over loopback. --allow-http is for localhost only.
  exec bunx mcp-remote "$BASE_URL/api/mcp" --allow-http
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "serangkai-mcp: missing $ENV_FILE" >&2
  echo "Create it with: SERANGKAI_MCP_TOKEN=<token from /settings>" >&2
  echo "Or connect with OAuth instead: SERANGKAI_MCP_AUTH=oauth $0" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

if [[ -z "${SERANGKAI_MCP_TOKEN:-}" ]]; then
  echo "serangkai-mcp: SERANGKAI_MCP_TOKEN is empty in $ENV_FILE" >&2
  exit 1
fi

exec bunx mcp-remote "$BASE_URL/api/mcp" \
  --header "Authorization: Bearer ${SERANGKAI_MCP_TOKEN}"
