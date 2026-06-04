# Changelog

All notable changes to the STRL-Ideate desktop app and supporting tooling are documented here.

This project is a local-first, security-hardened downstream fork of Excalidraw. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the desktop app is versioned via `strl-v*` tags (desktop releases are **local-only** — no published GitHub release). Tooling that is not desktop-versioned is tracked under [Unreleased].

## [Unreleased] — Tooling

Host-side and MCP-server work shipped since `strl-v0.2.0` that is not tied to a desktop app version.

### Added

- **Network MCP transport (Streamable HTTP).** `packages/strl-mcp-server` gained an opt-in HTTP transport alongside the default stdio one. `STRL_MCP_TRANSPORT=http` (or setting any `STRL_MCP_HTTP_PORT`) starts a `node:http` listener wrapping the MCP SDK's `StreamableHTTPServerTransport` (SDK 1.29.0 — **no new dependency**), implementing the centralized model: one MCP server on the host, remote dev machines connect as clients. One transport per session (`POST` = messages, `GET` = server→client SSE, `DELETE` = terminate). (2026-06-03)
- **LAN serving scripts.** `scripts/strl-serve.sh` (one-off foreground serve of the MCP HTTP server + a static `http-server` of `excalidraw-app/build`) plus `.strl-serve.env` (gitignored, holds the bearer token) and the committed `.strl-serve.env.example` template. (2026-06-03)
- **System-level systemd services.** `scripts/systemd/` (source of truth: `strl-mcp.service` + `strl-web.service` + `install.sh` + `README.md`) installs to `/etc/systemd/system/`, `enabled` at boot (no login required), running as `User=sclmain` with `Restart=on-failure`. Replaces the session-bound serve script for production on the host. Services run prebuilt artifacts and do **not** auto-rebuild — restart after any rebuild (`restart strl-mcp` after the MCP server; `pnpm build` then `restart strl-web` after the web app or a desktop `dist:*`, which clobbers `excalidraw-app/build`). (2026-06-04)
- Gitignore for the local MCP diagram workdir (`/diagrams/`). (2026-06-03)

### Security

- **MCP HTTP transport hardening.** Fail-closed: refuses to bind a non-loopback host without `STRL_MCP_HTTP_TOKEN`. Bearer auth on every request when a token is set (no-token → 401). DNS-rebinding guard (`enableDnsRebindingProtection` + `STRL_MCP_HTTP_ALLOWED_HOSTS`). 16 MB request body cap; requests scoped to `STRL_MCP_HTTP_PATH` (default `/mcp`). The lone unavoidable `http.createServer` call is isolated in `src/httpListener.ts` so **only that file** is SAST-excluded (CWE-319), keeping `bin.ts`'s auth + session routing fully scanned. Cleartext caveat: plain HTTP carries the token + payloads in clear on the LAN — front with TLS or an SSH tunnel on untrusted networks.

## [0.2.1] — 2026-06-04

Patch release shipping two desktop-only fixes, with Linux (AppImage + deb) and Windows (NSIS + portable, Wine-signed) installers rebuilt and checksummed. macOS not rebuilt (requires a Mac). Tagged `strl-v0.2.1`. (Fixes landed 2026-06-03.)

### Fixed

- **Canvas fonts fell back to a system font on desktop** (web was unaffected). A comment edit inside the injected `window.EXCALIDRAW_ASSET_PATH = window.origin` inline script changed its sha256, but the hard-coded CSP script hash in `desktop/src/main.ts` was never updated — the strict hash-pinned `script-src` then blocked the script, leaving `EXCALIDRAW_ASSET_PATH` undefined and every canvas FontFace with an empty `src`. **Fix:** `main.ts` now derives the CSP script hashes from the **built** `index.html` at runtime (`getInlineScriptHashes`) instead of hard-coding them, so a script-body edit can no longer leave a stale hash. The CSP stays strict (a runtime-injected script isn't in the served file, so its hash isn't in the set).
- **Opening a diagram flipped the editor dark → light.** Theme is a per-viewer setting (`appState.ts` `theme: { export: false }`), never stored in `.excalidraw` files, and the package default is `THEME.LIGHT`. `useDesktopIntegration.applyScene` loaded without a `localAppState`, so `restoreAppState` fell back to light and `updateScene` flipped the editor on every open **and** every external/MCP live-reload (both share `applyScene`). **Fix:** `applyScene` now captures the live `theme` before load and re-asserts it onto the restored state — package untouched, fork-friendly.

### Changed

- Bumped `desktop/package.json` 0.2.0 → 0.2.1.
- Extended the `STRL_SMOKE` boot probe to assert `assetPath` (proof the inline asset-path script executed and font loading is not CSP-blocked — the regression that slipped past the old `dark`/`hasEditor`-only probe).
- Re-pinned the two pixel-marker checks in `cdp-runtime-smoke.mjs` to light theme (dark mode is rendered via a render-time `DARK_THEME_FILTER` that inverts the raw pixels `getImageData` reads; the old assertions had passed only because of the theme bug now fixed).

## [0.2.0] — 2026-06-02

First tagged desktop release (`strl-v0.2.0`), packaging the local-first Electron app after the supply-chain hardening, residual-clearing, and build-tooling modernization passes.

### Added

- Desktop app version bump to 0.2.0 with a `strl-v*` tag-triggered installer build.
- Release-artifact audit of the packaged v0.2.0 desktop build (verdict **GO**) — confirmed no network phone-home, no embedded secrets, fonts fully self-hosted, and the Electron hardening (strict `app://` CSP, `contextIsolation`/`sandbox`/`nodeIntegration:false`, the `sceneOpenPaths` save-target allowlist, `isValidOrigin` wildcard rejection) byte-faithful in the shipped `main.js`.

### Changed

- Desktop releases are **local-only** — dropped the GitHub Actions tag-trigger.
- Modernized stale build tooling: dropped dead `size-limit` (ancient puppeteer), workbox 7.4.1, electron-builder 26.11.
- Migrated lint to ESLint 9 flat config (clears the `eslint@7.32.0` CVE).
- Refreshed `CLAUDE.md` to pnpm + the supply-chain gate; fixed stale install guidance.

### Security

- Cleared residual findings: SAST → 0, in-flight deps green (asar@4), web build now ships a `<meta>` CSP + authoritative `/public/_headers` CSP and self-hosts all web fonts.
- Hardened desktop IPC + AI fetch (post-Tier-B security reassessment): fixed a **critical** arbitrary-file-write — `strl:opened` now adopts a save target only if main itself issued the path for opening (`sceneOpenPaths` allowlist); tightened `isValidOrigin` to reject wildcard hosts; added an http(s)-only guard at the BYO AI fetch sites.
- Dependency currency Tiers A/B/C + transitive-vuln pnpm overrides; vite 5 → 8.0.14 (+ vitest 4 cascade) and esbuild override 0.28.0 — Snyk SCA findings driven 63 → 0.

### Notes

- One inert residual: a `cdnjs.cloudflare.com/pdfobject.min.js` string vendored inside `jsPDF` — dead code (PDF export uses `.output('arraybuffer'/'bloburl')`, never `pdfobjectnewwindow`) and CSP-blocked regardless.
