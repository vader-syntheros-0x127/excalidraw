# STRL-Ideate

**A local-first, security-hardened fork of [Excalidraw](https://github.com/excalidraw/excalidraw).**

STRL-Ideate is a hand-drawn-style virtual whiteboard for sketching diagrams and wireframes. It is a downstream fork of Excalidraw, rebranded and re-engineered to run entirely **local-first** — the collaboration, cloud, AI-backend, and telemetry surface of upstream has been stripped out, and a net-new Electron **desktop app** plus an **MCP authoring server** have been added.

> **This is a fork.** Every divergence from upstream Excalidraw is documented in **[docs/STRL-CUSTOMIZATIONS.md](docs/STRL-CUSTOMIZATIONS.md)** — the single source of truth for what changed and why. Read it before editing the fork or syncing upstream. In-code changes are marked with `// STRL:` comments; recover the full list with `git log --oneline --grep="STRL"`.

## What it is

- **A local-first whiteboard.** A scene lives only in `localStorage` (scene JSON + app state) and IndexedDB (image blobs). No account, no cloud, no telemetry.
- **A web SPA** (`excalidraw-app/`, served as a PWA) **and a packaged Electron desktop app** (`desktop/`) sharing the same renderer.
- **An MCP authoring server** (`packages/strl-mcp-server/`) that exposes the headless scene-authoring engine (`packages/strl-authoring/`) to external AI tools over stdio or HTTP.
- An exact-pinned, supply-chain-hardened **pnpm 10 workspace** monorepo (migrated off yarn 1).

## What it is NOT

- **No collaboration** — `collab/`, `share/`, Firebase, and the socket.io real-time stack are deleted (not stubbed). Room / `#json=` links no longer resolve.
- **No Excalidraw+ / cloud export**, **no Sentry telemetry**, **no AI/text-to-diagram backend dialog**, and **no excalidraw.com backend identifiers** in any build.
- **The desktop build makes no network calls at all** — fonts are bundled locally and a strict `app://` CSP blocks any remote origin.

## Repository layout

A pnpm 10 workspace monorepo (`node-linker=hoisted`, exact-pinned):

| Path | What it is |
| --- | --- |
| `excalidraw-app/` | The local-first web app (collab/backend stripped, STRL-branded, self-hosted fonts). Also the desktop renderer. |
| `desktop/` | **STRL-only** Electron desktop app (`app://` protocol, strict CSP, document model). No upstream counterpart. |
| `packages/strl-authoring/` | **STRL-only** DOM-free engine to build/edit Excalidraw scenes headlessly in Node. |
| `packages/strl-mcp-server/` | **STRL-only** MCP server exposing the authoring engine to external AI tools (stdio + HTTP transports). |
| `packages/{common,element,math,utils,excalidraw,fractional-indexing}` | Upstream-owned core component library and helpers (lint-ignored; edit surgically). |

## Supply-chain gate (read first — non-negotiable)

This project enforces a strict supply-chain gate. **Before any `pnpm install`, build, or run — every time, not only when deps change — run Snyk SCA + Code (org `syntheros`) and use the hardened install path.** Full details: [docs/STRL-CUSTOMIZATIONS.md §7](docs/STRL-CUSTOMIZATIONS.md).

- **Provenance:** registry must be `https://registry.npmjs.org/`; Aikido Safe Chain wraps pnpm/npm (verify `type pnpm` is a shell function, not the bare binary).
- **Install:** plain **`pnpm install`** run top-level so Safe Chain vets every package. `.npmrc` `minimum-release-age=1440` blocks versions < 24 h old; `onlyBuiltDependencies=[esbuild, electron]` gates lifecycle scripts. **Never** `--ignore-scripts`, and never a bare install that bypasses the Safe Chain wrapper.
- **Re-verify after every dep change:** typecheck → node smokes → vitest → app build → (web CSP: headless-chrome check) → AppImage + boot smoke + CDP. `.snyk` holds documented, time-boxed acceptances.

## Build & run quick-reference

```bash
# Web app (excalidraw-app)
pnpm start                  # dev server
pnpm build                  # production build → excalidraw-app/build

# Desktop app (Electron)
pnpm -C desktop start       # build main + launch
pnpm -C desktop dist:linux  # AppImage + deb
pnpm -C desktop dist:win    # NSIS installer + portable (cross-built on Linux via Wine)
pnpm -C desktop dist:mac    # dmg (requires a Mac)

# Tests / checks
pnpm test:typecheck         # TypeScript type checking (tsc)
pnpm test:update            # run all tests with snapshot updates
pnpm test:code              # ESLint 9 flat config, --max-warnings=0
pnpm test:other             # Prettier formatting check
pnpm fix                    # auto-fix formatting + lint
```

Notes:

- Typecheck the `desktop/` workspace separately: `pnpm -C desktop build:main`.
- Internal packages cross-reference each other by plain semver (not `workspace:*`); the hoisted node-linker and the documented `.npmrc` flags are load-bearing — see [docs/STRL-CUSTOMIZATIONS.md §2](docs/STRL-CUSTOMIZATIONS.md).

## Desktop app

A native Electron shell (`desktop/`) wrapping the editor with a real desktop document model (open/save `.excalidraw` files, recent-files start screen, `fs.watch` live-reload). It serves assets over a custom `app://` protocol behind a strict CSP and makes **no network calls** — fonts are bundled locally.

- **Current version: 0.2.1.** Built and shipped for **Linux** (AppImage + deb) and **Windows** (NSIS installer + portable, Wine-cross-built on Linux), checksummed and tagged `strl-v0.2.1`. macOS is not built (needs a Mac).
- Releases are **local-only** (no published GitHub release).
- See [docs/STRL-CUSTOMIZATIONS.md §6](docs/STRL-CUSTOMIZATIONS.md) for the IPC contract, CSP, and document model.

## MCP authoring server (local + LAN)

`packages/strl-mcp-server/` exposes the headless authoring engine (`@strl/authoring`) to AI tools. It is **dual-transport**:

- **stdio** (default) — for local registration in a single Claude Code / harness session.
- **Streamable HTTP** (`STRL_MCP_TRANSPORT=http`) — a centralized model: one server on the host that remote dev machines connect to as clients over HTTP. Hardened with bearer auth (no-token → 401 on non-loopback), a DNS-rebinding guard, and a 16 MB body cap.

> **Cleartext caveat:** plain HTTP — token and payloads travel in the clear on the LAN. For untrusted networks, front with TLS (reverse proxy) or an SSH tunnel.

### Host-side serving

`.strl-serve.env` (gitignored; template `.strl-serve.env.example`) holds the bearer token and drives both the MCP HTTP server and a static preview of `excalidraw-app/build`.

- **Production (persistent):** two system-level systemd services — `strl-mcp.service` + `strl-web.service`, source of truth in **`scripts/systemd/`** (units + `install.sh` + `README.md`). Installed to `/etc/systemd/system/`, enabled at boot, run as `User=sclmain`, `Restart=on-failure`. Manage with `sudo systemctl {status,restart,stop} strl-mcp strl-web`.
  - **They run prebuilt artifacts and do NOT auto-rebuild — restart after any rebuild** (mcp-server → `restart strl-mcp`; web `pnpm build` → `restart strl-web`). Note: `pnpm -C desktop dist:*` clobbers `excalidraw-app/build` with the desktop build, so re-run `pnpm build` then `restart strl-web`.
- **One-off fallback:** `scripts/strl-serve.sh` (foreground; don't run alongside the systemd services — port clash).

### Remote-machine registration

Run on each dev box, in its own Claude Code / harness:

```bash
claude mcp add --scope user --transport http strl-ideate http://<HOST_LAN_IP>:7337/mcp \
  --header "Authorization: Bearer <token from .strl-serve.env>"
```

Diagrams land in the host's shared, gitignored `diagrams/` workdir. The MCP server writes `.excalidraw` _files_; a running web tab does not auto-refresh over the network — open/refresh the file to view a remote agent's drawing.

See [docs/STRL-CUSTOMIZATIONS.md §13](docs/STRL-CUSTOMIZATIONS.md) for the full MCP / authoring reference.

## License

MIT — inherited from upstream Excalidraw. See [LICENSE](LICENSE).
