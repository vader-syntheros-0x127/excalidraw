#!/usr/bin/env bash
# STRL: start the host-side STRL-Ideate services for LAN use:
#   1. the MCP server over Streamable HTTP — remote dev machines / agent
#      harnesses connect as clients and draw into the shared diagrams/ workdir
#   2. a static web preview of the built app (excalidraw-app/build)
#
# Config lives in .strl-serve.env (gitignored; copy from .strl-serve.env.example).
# Stop with: scripts/strl-serve.sh stop   (or kill the PIDs in .strl-serve.pids)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT}/.strl-serve.env"
PID_FILE="${ROOT}/.strl-serve.pids"
MCP_BIN="${ROOT}/packages/strl-mcp-server/dist/bin.js"

if [ "${1:-start}" = "stop" ]; then
  if [ -f "$PID_FILE" ]; then
    # shellcheck disable=SC2046
    kill $(cat "$PID_FILE") 2>/dev/null || true
    rm -f "$PID_FILE"
    echo "stopped."
  else
    echo "no $PID_FILE — nothing to stop."
  fi
  exit 0
fi

[ -f "$ENV_FILE" ] || { echo "ERROR: missing $ENV_FILE (copy .strl-serve.env.example, set a token)"; exit 1; }
[ -f "$MCP_BIN" ]  || { echo "ERROR: missing $MCP_BIN — run: pnpm -C packages/strl-mcp-server build"; exit 1; }
[ -d "${ROOT}/excalidraw-app/build" ] || { echo "ERROR: no web build — run: pnpm build"; exit 1; }

set -a; . "$ENV_FILE"; set +a
mkdir -p "${STRL_MCP_WORKDIR:?set STRL_MCP_WORKDIR in .strl-serve.env}"

# 1) MCP server over Streamable HTTP (env is inherited from the sourced file).
node "$MCP_BIN" &
MCP_PID=$!

# 2) Static web preview (http-server flows through the Aikido Safe Chain npx wrapper).
npx --yes http-server "${ROOT}/excalidraw-app/build" \
  -a "${STRL_WEB_BIND:-0.0.0.0}" -p "${STRL_WEB_PORT:-8080}" -c-1 &
WEB_PID=$!

echo "$MCP_PID $WEB_PID" > "$PID_FILE"
echo "strl-mcp  (http) pid=$MCP_PID -> http://${STRL_MCP_HTTP_HOST}:${STRL_MCP_HTTP_PORT}${STRL_MCP_HTTP_PATH}"
echo "strl-web (static) pid=$WEB_PID -> http://${STRL_WEB_BIND:-0.0.0.0}:${STRL_WEB_PORT:-8080}"
echo "PIDs in $PID_FILE — stop with: $0 stop"
wait
