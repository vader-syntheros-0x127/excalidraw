#!/usr/bin/env bash
# STRL: install/refresh the host-side systemd (system-level) services from the
# repo copies, then enable + (re)start them. Idempotent — also use it after
# editing a .service file. Requires sudo. See README.md for the update workflow.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST=/etc/systemd/system
UNITS=(strl-mcp.service strl-web.service)

for u in "${UNITS[@]}"; do
  sudo install -m 0644 "${HERE}/${u}" "${DEST}/${u}"
  echo "installed ${DEST}/${u}"
done

sudo systemctl daemon-reload
sudo systemctl enable --now "${UNITS[@]}"
echo
sudo systemctl --no-pager is-active "${UNITS[@]}" || true
echo "done — manage with: sudo systemctl {status,restart,stop} ${UNITS[*]}"
