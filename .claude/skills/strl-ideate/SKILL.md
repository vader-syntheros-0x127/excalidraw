---
name: strl-ideate
description: Project skill for strl-excalidraw (STRL-Ideate), the hardened local-first Excalidraw fork with Electron desktop + the strl-ideate MCP authoring server (systemd-served on .222). Use when developing the MCP server, authoring engine, desktop app, or syncing from upstream excalidraw.
---

# strl-ideate (strl-excalidraw) — project skill

## What this is

Downstream security-hardened fork of excalidraw, rebranded STRL-Ideate: upstream collab/cloud/AI/telemetry **deleted**, added `packages/strl-authoring` (DOM-free Node engine) + `packages/strl-mcp-server` (the `strl-ideate` MCP: create_scene/add_shapes/add_image/edit_elements/delete_elements/get_scene/generate_image) + `desktop/` Electron shell + local-first web SPA. Centralized model: systemd services **on .222** (`strl-mcp` HTTP :7337, `strl-web` :8080); dev boxes are HTTP clients. **Read root `CLAUDE.md` + `docs/STRL-CUSTOMIZATIONS.md` (1149 lines, the single source of truth) before editing** — all fork edits carry `// STRL:` markers.

## Commands

- MCP rebuild+deploy (services run prebuilt artifacts): `pnpm -C packages/strl-mcp-server build && pnpm build && sudo systemctl restart strl-mcp strl-web`
- Smokes: `node packages/strl-authoring/smoke.mjs` · `node packages/strl-mcp-server/mcp-smoke.mjs` (7 tools)
- Web: `pnpm start` (dev :3001) · `pnpm build`. Desktop: `pnpm -C desktop start|dist:linux|dist:win`.
- Checks: `pnpm test:typecheck` **plus** `pnpm -C desktop build:main` (desktop and strl packages are OUTSIDE root tsc) · `pnpm test:update` before commit · `pnpm fix`.
- Client registration (per dev box): `claude mcp add --scope user --transport http strl-ideate http://192.168.12.222:7337/mcp --header "Authorization: Bearer <token from .strl-serve.env>"`

## Common workflows

- **Upstream sync** (§1/§12.1): `git fetch upstream` → `upstream-sync` branch reset-hard → merge into topic off `master` → on collab-path conflicts keep STRL's local-first version → re-apply dark-theme defaults if `getTheme()` rewritten → full gate (typecheck, desktop build:main, build:packages, test:update, desktop no-remote-refs, `STRL_SMOKE=1`, per-workspace Snyk + pnpm audit) → PR to master. Upstream push URL is deliberately disabled.
- **Desktop release** (local-only, no CI, §12.6): bump `desktop/package.json` → Snyk gate → dist → `STRL_SMOKE=1` boot + CDP runtime smoke (7/7) → sha256 → tag `strl-v<v>`.

## Gotchas

- `pnpm -C desktop dist:*` **clobbers `excalidraw-app/build`** — re-run `pnpm build` then restart strl-web.
- Never `--ignore-scripts` (breaks esbuild/electron); never bypass the Aikido Safe Chain wrapper (`type pnpm` must show a shell function); `.npmrc` `minimum-release-age=1440`.
- `ELECTRON_RUN_AS_NODE` is exported on .222 — GUI Electron runs need `env -u ELECTRON_RUN_AS_NODE`.
- MCP HTTP is fail-closed: non-loopback bind refuses without `STRL_MCP_HTTP_TOKEN`; but traffic is cleartext on LAN — tunnel on untrusted networks. Web tab does NOT auto-refresh on remote MCP writes (fs.watch reload is desktop/local only).
- Client config requires `STRL_MCP_WORKDIR` (sandbox: path-traversal guard, `.excalidraw` only, 50 MB cap); `generate_image` disabled unless `STRL_MCP_IMAGE_ENDPOINT/_MODEL/_KEY` set.
- Dev-port mismatch: desktop `start:dev` expects :3000, web dev serves :3001. `build:esm` still shells a yarn leftover.
- One-off `scripts/strl-serve.sh` clashes with the systemd units — never run both.

## Pointers

- `docs/STRL-CUSTOMIZATIONS.md` (§7 supply chain, §10 gotchas, §12 playbook, §13 MCP/authoring) · `scripts/systemd/` (unit source of truth) · `packages/strl-mcp-server/src/bin.ts` (transports/auth).
- Branches: `master` (PR target), `upstream-sync`, `feat/desktop-app`, `feat/ai-authoring`. Only clone: .222 `~/STRL/strl-excalidraw`; remote = vader-syntheros-0x127/excalidraw.
