#!/usr/bin/env bash
# Local Serangkai MCP proxy.
#
# Registers `serangkai` with an MCP client as a stdio->HTTP bridge to the app's
# Streamable HTTP endpoint. Two auth modes:
#
#   SERANGKAI_MCP_AUTH=oauth          no secret on disk; opens a browser
#   SERANGKAI_MCP_AUTH=oauth-device   same, but prints a code for approval on
#                                     another machine (SSH, container, cron)
#   (default)                         bearer token from .env.serangkai-mcp
#
# The token is never written into a tracked config file.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env.serangkai-mcp"
BASE_URL="${SERANGKAI_MCP_URL:-http://localhost:6969}"
AUTH_MODE="${SERANGKAI_MCP_AUTH:-token}"

if [[ "$AUTH_MODE" == "oauth" || "$AUTH_MODE" == "oauth-device" ]]; then
  # --allow-http is for localhost only; a deployed instance must be HTTPS.
  extra=()
  if [[ "$AUTH_MODE" == "oauth-device" ]]; then
    # No callback server and no port binding: the client prints a short code
    # that can be approved from any machine. This is the SSH/headless path.
    extra+=(--device-code)
  fi
  exec bunx mcp-remote "$BASE_URL/api/mcp" --allow-http "${extra[@]}"
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
