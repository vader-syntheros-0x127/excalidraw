# STRL-Ideate host services (systemd, system-level)

Two **system** services keep the centralized stack up on the host (`192.168.12.222`) so remote dev machines can draw via MCP and browse the web preview — surviving reboot/logout, restarting on crash:

| Unit | What | Port |
| --- | --- | --- |
| `strl-mcp.service` | MCP server, Streamable HTTP (remote agents connect as clients) | `0.0.0.0:7337` |
| `strl-web.service` | static `excalidraw-app/build` preview | `0.0.0.0:8080` |

They run as **`User=sclmain`** (not root). Config/token come from the gitignored `.strl-serve.env` (template: `.strl-serve.env.example`). Shared canvas workdir is the gitignored `<repo>/diagrams/`.

## Install / update the units

```bash
scripts/systemd/install.sh           # copy units to /etc/systemd/system, enable+start
```

Manage:

```bash
sudo systemctl status  strl-mcp strl-web
sudo systemctl restart strl-mcp
sudo journalctl -u strl-mcp -f
```

## ⚠️ Update the services WHENEVER THE APP IS UPDATED

The services run **already-built artifacts** — they do **not** auto-rebuild. After any change that rebuilds the MCP server or the web app, you MUST restart them, or the LAN keeps serving the old build:

| You changed / rebuilt | Do this |
| --- | --- |
| `packages/strl-mcp-server` (e.g. `pnpm -C packages/strl-mcp-server build`) | `sudo systemctl restart strl-mcp` |
| the web app (`pnpm build`) | `sudo systemctl restart strl-web` |
| **the desktop app** (`pnpm -C desktop dist:*`) | `dist:*` overwrites `excalidraw-app/build` with the **desktop**-mode build — so afterward run `pnpm build` (restore web build) **then** `sudo systemctl restart strl-web` |
| edited a `.service` file | `scripts/systemd/install.sh` (re-copies + `daemon-reload` + restart) |

Shortcut for the common case (rebuild MCP + web, then bounce both):

```bash
pnpm -C packages/strl-mcp-server build && pnpm build \
  && sudo systemctl restart strl-mcp strl-web
```

Run the supply-chain gate (Snyk SCA + Code, org `syntheros`) **before** any of those rebuilds — see [docs/STRL-CUSTOMIZATIONS.md](../../docs/STRL-CUSTOMIZATIONS.md).
