# STRL-Ideate — Customization & Maintenance Reference

**STRL-Ideate** is a downstream fork of [`excalidraw/excalidraw`](https://github.com/excalidraw/excalidraw), rebranded and re-engineered to be **local-first**: the entire backend/cloud surface (real-time collaboration, Firebase, the AI text-to-diagram backend, Sentry telemetry, and the Excalidraw+ upsell) has been stripped out, the visible identity has been rebranded to "STRL-Ideate" with a generated sparkle logo and dark-mode-by-default, a first-class PNG/SVG/PDF export pipeline has been added, and a net-new Electron **desktop app** (`desktop/` workspace) wraps the editor with a real desktop document model. This document is the single source of truth for **everything that diverges from upstream** — read it before any upstream sync, brand-asset regeneration, or feature work on the fork.

### What this app **is**
- A **local-first** whiteboard. A scene lives only in `localStorage` (scene JSON + app state) and IndexedDB (image blobs). No account, no cloud, no telemetry.
- A web SPA (`excalidraw-app/`, served as a PWA) **and** a packaged Electron desktop app (`desktop/`) sharing the same renderer.
- An exact-pinned, supply-chain-hardened pnpm monorepo (migrated off yarn 1).

### What this app **is not**
- It has **no collaboration** — `collab/`, `share/`, `data/firebase.ts`, and `data/index.ts` are deleted (not stubbed). Room/`#json=` links no longer resolve.
- It has **no Excalidraw+ / cloud export**, **no Sentry**, **no AI/TTD dialog**, and **no excalidraw.com backend identifiers** baked into any build (all `VITE_APP_*` backend env vars are emptied).
- The desktop build makes **no network calls at all** — fonts are bundled locally and a strict `app://` CSP blocks any remote origin.

> **Audit-trail convention.** Every divergence from upstream is marked **twice** so it survives merges and greps cleanly: (1) a `// STRL:` / `# STRL:` code comment immediately above the change explaining *why*, and (2) a commit subject that starts with `STRL:`. Recover the full list with `git log --oneline --grep="STRL"`.

---

## Table of contents

1. [Fork, branch & upstream-sync model](#1-fork-branch--upstream-sync-model)
2. [Package-manager migration: yarn 1 → pnpm 10.34.1](#2-package-manager-migration-yarn-1--pnpm-103401)
3. [Removals & the local-first rewrite](#3-removals--the-local-first-rewrite)
4. [Branding, theming & UI](#4-branding-theming--ui)
5. [Export feature (PNG/SVG/PDF) & shared pipeline](#5-export-feature-pngsvgpdf--shared-pipeline)
6. [Desktop app (Electron)](#6-desktop-app-electron)
7. [Security, supply-chain & CI](#7-security-supply-chain--ci)
8. [Master file index](#8-master-file-index)
9. [Desktop IPC contract](#9-desktop-ipc-contract)
10. [Build & run quick-reference](#10-build--run-quick-reference)
11. [Held / deferred items](#11-held--deferred-items)
12. [Maintenance playbook](#12-maintenance-playbook)

---

## 1. Fork, branch & upstream-sync model

STRL-Ideate is a **downstream fork** of `excalidraw/excalidraw`, rebranded and made local-first, with an added Electron desktop app under `desktop/`.

### Remotes (`git remote -v`)

| Remote | URL | Push |
|---|---|---|
| `origin` | `https://github.com/vader-syntheros-0x127/excalidraw.git` | enabled (the STRL fork) |
| `upstream` | `https://github.com/excalidraw/excalidraw.git` (fetch) | **`DISABLE_PUSH_TO_UPSTREAM`** — the push URL is deliberately a bogus string so an accidental `git push upstream` fails fast |

### Branches

- **`master`** — shippable STRL line; `origin/HEAD -> origin/master`. **This is the PR target.**
- **`upstream-sync`** — local tracking branch for `upstream/master`; the staging area for pulling upstream in.
- **`feat/desktop-app`** — the desktop work branch (lands into `master` via PR).
- A large number of `remotes/upstream/*` branches are visible only because `upstream` is fetched; ignore them.

### How customizations are marked (the audit trail)

Every divergence is tagged two ways (see the convention note above): an in-code `// STRL:` comment and a `STRL:`-prefixed commit subject. The **24 STRL commits** at time of writing (newest first) span branding, stripping collab/AI/Sentry/Plus, the desktop app, the supply-chain CI, and the yarn→pnpm migration. Key anchor commits:

| Commit | Subject |
|---|---|
| `76063b85` | de-duplicate export dispatch via `sceneToExportBytes` (#9) |
| `14187b79` | stream `app://` assets via `net.fetch` instead of `readFileSync` (#7) |
| `c91641bc` | fix desktop document-model review findings (#1–#6, #8, #10) |
| `36e9d541` | supply-chain CI — installer SHA-256 checksums + Snyk/pnpm-audit workflow |
| `03ff90be` | re-enable asar (asar-aware `app://`) + split React vendor chunk |
| `a1af0b25` | document UX — autosave, recent-files start screen |
| `bcf9539b` | brand identity — STRL-Ideate logo, favicons, app icon, og-image |
| `08d5c3d0` | desktop document model + remove Socials |
| `0e7f89e4` | add Windows portable target |
| `f31357f4` | Windows + macOS packaging + CI build matrix (auto-update held) |
| `90dc3980` | branding pass — debrand visible surfaces, neutralize web SEO, drop dead deps |
| `b3d91766` | strict CSP for desktop + fully-local fonts (no CDN/esm.sh phone-home) |
| `504f36e5` | drop misleading "end-to-end encrypted" footer shield |
| `e993f64d` | migrate yarn → pnpm 10.34.1 + strip backend identifiers from web/dev builds |
| `ee0001cd` | harden desktop file-open against path traversal |
| `1f9d9e45` | strip collaboration stack + AI for a lean, local-first app |
| `60c961ca` | cleanup — drop sourcemaps, Sentry, marketing assets, examples/docs |
| `a3cabc8c` | Linux packaging (electron-builder) + ship-clean desktop build |
| `8cb6b0d9` | add desktop app (Electron) — Phases 0–2 |
| `93c2969b` | remove all Excalidraw+ upsell and cloud integration |
| `fd1e89a5` | one-time migration to dark for existing visitors |
| `d8d84c9c` | prominent PNG/SVG/PDF export button; drop Excalidraw+ cloud export |
| `657e18de` | default to dark mode |
| `abb542b5` | rebrand app shell to STRL-Ideate |

### Merge-risk map (where to prefer making changes)

| Area | Upstream counterpart | Merge risk | Guidance |
|---|---|---|---|
| `excalidraw-app/` | the SPA (web + desktop renderer) | **Low** | edit freely; this is where most STRL edits live |
| `packages/*` | the published `@excalidraw/*` **library** | **Higher** | minimize edits; keep them `STRL:`-marked and surgical — upstream rewrites these often |
| `desktop/` | **none** (net-new STRL workspace) | **Zero** | no upstream counterpart, so no conflicts |

### Upstream-sync process (intended workflow)

1. `git fetch upstream` (push to upstream is disabled; fetch is fine).
2. `git checkout upstream-sync && git reset --hard upstream/master` (or merge) to stage upstream's latest.
3. Merge/rebase `upstream-sync` into a **topic branch off `master`**, resolve conflicts. Because all STRL edits are `STRL:`-marked, conflict hunks against marked lines flag exactly what the fork changed and why.
4. Re-run the gate: **supply-chain gate before any install**, then `pnpm test:typecheck`, then `pnpm build:packages` (esbuild needs `gen:types`), then `pnpm test:update`. **Typecheck `desktop/` separately** (`pnpm -C desktop build:main`) — see the dual-vite gotcha below.
5. PR the topic branch into `master`.

**Where conflicts will land:** the highest-risk files are the library edits (`packages/excalidraw/components/ExcalidrawLogo.tsx`, `HelpDialog.tsx`, `locales/en.json`, `fonts/ExcalidrawFontFace.ts`, `vite-env.d.ts`, `scripts/woff2/woff2-vite-plugins.js`) and the two upstream-owned blocks in `excalidraw-app/App.tsx` (`renderTopRightUI` and `UIOptions.canvasActions.export`). The collab strip means `App.tsx` no longer shares structure with upstream's — an upstream change to its collab paths will conflict heavily but **the resolution is always "keep STRL's local-first version."**

---

## 2. Package-manager migration: yarn 1 → pnpm 10.34.1

Pinned via `"packageManager": "pnpm@10.34.1"` in root `package.json:4`, activated through **corepack** (`corepack enable && corepack prepare pnpm@10.34.1 --activate`) in all CI workflows. `yarn.lock` was deleted and `pnpm-lock.yaml` added in `e993f64d`. The monorepo was renamed `excalidraw-monorepo` → `strl-ideate-monorepo` (`package.json:2`).

### `.npmrc` (root) — every line is load-bearing

```ini
save-exact=true                 # pin exact versions (matches old yarn behaviour)
node-linker=hoisted             # flat node_modules, NOT pnpm's symlinked store
strict-peer-dependencies=false  # don't fail on peer mismatches (mirrors yarn 1)
link-workspace-packages=true    # resolve internal @excalidraw/* by version match
minimum-release-age=1440        # refuse deps published < 24h ago (anti-malware)
```

- **`node-linker=hoisted`** (`.npmrc:6`) — the repo relies on **phantom dependencies** and a flat tree. `excalidraw-app` uses `vite` without declaring it, and **electron-builder needs a flat `node_modules`** to trace and pack the dependency graph. pnpm's default symlinked layout would break both. **This is the single most important migration setting.**
- **`link-workspace-packages=true`** (`.npmrc:13`) — pnpm 10 defaults this **off**. The internal packages cross-reference each other as plain semver (`"0.18.0"`), **not** `workspace:*`, so without this flag pnpm would try to fetch them from the registry instead of linking the local workspace copies.
- **`strict-peer-dependencies=false`** (`.npmrc:9`) — reproduces yarn 1's tolerance of peer-dep mismatches so the large React-19 / vite-5 graph installs cleanly.
- **`minimum-release-age=1440`** (`.npmrc:16`) — supply-chain cooldown: refuses any dependency version published less than 24 h (1440 min) ago. Pairs with the pre-install Aikido Safe Chain layer and the post-install Snyk/pnpm-audit CI.
- **`save-exact=true`** (`.npmrc:2`) — no `^`/`~` ranges.

### `pnpm-workspace.yaml`

```yaml
packages:
  - "excalidraw-app"
  - "desktop"        # NEW STRL workspace
  - "packages/*"
```

`examples/` is intentionally **not** a workspace member (examples/docs were dropped in `60c961ca`).

### Root `package.json` `pnpm` block (`package.json:86–95`)

```jsonc
"pnpm": {
  "overrides": {
    "strip-ansi": "6.0.1",
    "vite-plugin-html>vite": "5.0.12"
  },
  "onlyBuiltDependencies": ["esbuild", "electron"]
}
```

- **`vite-plugin-html>vite` → `5.0.12`** — `excalidraw-app` depends on `vite-plugin-html@3.2.2`, which declares `vite` as `devDependencies ^2.8.6` / `peerDependencies >=2.0.0`. Without the override the hoisted tree would pull a **second, nested Vite v2** under `vite-plugin-html` alongside the workspace's Vite **5.0.12**. The override forces dedupe onto the single workspace Vite 5, preventing two Vites in `node_modules` and the HMR/resolution breakage that causes. (Verified: only `node_modules/vite` at v5.0.12 is present.)
- **`strip-ansi` → `6.0.1`** — pins the CJS line to avoid the dual ESM/CJS split common in transitive trees.
- **`onlyBuiltDependencies: ["esbuild", "electron"]`** — pnpm 10 blocks lifecycle (postinstall) scripts by default for security. **esbuild** and **electron** both need their postinstall to run (esbuild links its native binary; electron unpacks its binary). Allowlisting them lets `pnpm install` produce a runnable tree with **no separate rebuild step** (CI relies on this — `desktop-build.yml` notes the electron postinstall runs during the frozen-lockfile install). **Every other dependency's build scripts stay blocked** (e.g. `jspdf` installs script-free).

### Residual yarn references (migration is NOT 100 % complete — maintenance note)

- The per-package `build:esm` scripts still shell out to **`yarn gen:types`** (e.g. `packages/excalidraw/package.json` `build:esm: "... && yarn gen:types"`, same in `common`/`element`/`math`/`utils`). These run only while a yarn-1 shim resolves; if yarn is uninstalled, the package ESM build's type-gen step breaks. Candidate to migrate to `pnpm gen:types`.
- **`CLAUDE.md` still documents `yarn test:typecheck` / `yarn test:update` / `yarn fix`** and "Yarn workspaces" — **stale**; the real commands are the `pnpm` equivalents from root `package.json:61–73`.

---

## 3. Removals & the local-first rewrite

STRL-Ideate gutted Excalidraw's entire backend/cloud surface and rebuilt the app shell to be **local-first**: a scene lives only in `localStorage` + IndexedDB (for image blobs), with no Firebase, no socket.io real-time collaboration, no Sentry telemetry, and no Excalidraw+ upsell. This was done across four commits, **all in `excalidraw-app/`** (the SPA, low merge-risk) — the library `packages/*` were **not** touched by this work.

**Commit map (newest → oldest):**
- `c91641bc` (desktop document-model review fixes) — the relevant one here is **#6**, the `#url=` hashchange image-load fix in `App.tsx`.
- `1f9d9e45` — **the big strip**: deletes `collab/`, `share/`, `AI.tsx`, `data/firebase.ts`, `data/index.ts`, `tests/collab.test.tsx`; rewrites `initializeScene`/`loadImages`/effects in `App.tsx`; removes deps `firebase`, `socket.io-client`, `@excalidraw/random-username`.
- `60c961ca` — **cleanup**: removes Sentry (`sentry.ts`, `TopErrorBoundary` usage, `index.tsx` import), drops sourcemaps, deletes marketing/SEO assets, and deletes `examples/`, `dev-docs/`, `firebase-project/`.
- `93c2969b` — **Excalidraw+ removal**: strips every Plus/cloud touchpoint (menu, welcome screen, command palette, overwrite-confirm, promo banner, sidebar, index.html auto-redirect) and deletes `ExportToExcalidrawPlus.tsx`, `ExcalidrawPlusPromoBanner.tsx`, `ExcalidrawPlusIframeExport.tsx`, `AppSidebar.{tsx,scss}`.
- (Related: `d8d84c9c` added the local `StrlExportButton` replacing the cloud export — see §5.)

### 3.1 What was deleted (and why)

Verified **gone** from the tree (`git ls-files` confirms none are tracked at HEAD):

**Collaboration stack** (`1f9d9e45`):
- `excalidraw-app/collab/Collab.tsx` (1051 lines), `Portal.tsx` (257), `CollabError.tsx` (55), `CollabError.scss` (35) — the entire real-time-collab engine (socket.io rooms, pointer broadcast, element reconciliation, presence).
- `excalidraw-app/share/ShareDialog.{tsx,scss}`, `QRCode.tsx`, `qrcode.chunk.ts` — shareable-link / room-invite UI.
- `excalidraw-app/data/firebase.ts` (319) — Firebase scene + file storage.
- `excalidraw-app/data/index.ts` (307) — backend helpers (`exportToBackend`, `importFromBackend`, `getCollaborationLinkData`, `isCollaborationLink`); orphaned once collab was gone.
- `excalidraw-app/tests/collab.test.tsx` (252).

**AI** (`1f9d9e45`):
- `excalidraw-app/components/AI.tsx` (120) — the text-to-diagram (TTD) dialog wiring.

**Sentry** (`60c961ca`):
- `excalidraw-app/sentry.ts` deleted; its import dropped from `index.tsx`; `@sentry/browser` usage removed from `TopErrorBoundary.tsx`.

**Excalidraw+ / cloud** (`93c2969b`):
- `excalidraw-app/ExcalidrawPlusIframeExport.tsx` (224), `components/ExportToExcalidrawPlus.tsx` (135), `components/ExcalidrawPlusPromoBanner.tsx` (22), `components/AppSidebar.{tsx,scss}`.

**De-bloat** (`60c961ca`):
- `dev-docs/` (entire Docusaurus site, incl. its 9279-line `yarn.lock`), `firebase-project/`, and `examples/` — the commit message notes `examples/` was *"the source of the critical next CVE + mermaid-XSS audit noise."*
- Marketing/SEO assets bundled into the app: `og-image-3.png`, `robots.txt`, `screenshots/`, `oss_promo_*`, leftover `public/service-worker.js`.
- vite `sourcemap: false` (stopped shipping ~59 `.map` files).

**Dependencies removed:**
- `excalidraw-app/package.json` (`1f9d9e45`): `firebase@11.3.1`, `socket.io-client@4.7.2`, `@excalidraw/random-username@1.0.0`.
- root `package.json` (`90dc3980`): `@types/socket.io-client`; monorepo renamed `excalidraw-monorepo` → `strl-ideate-monorepo`.

**Why:** attack-surface + bundle reduction. `1f9d9e45` records collab/backend were *"deferred, non-functional in our build"* and verifies *"0 firebase/socket.io refs in the bundle."* For Plus (`93c2969b`): *"so users never see a service we don't run."*

### 3.2 The local-first `App.tsx` rewrite

`excalidraw-app/App.tsx` — net effect of `1f9d9e45` was ~486 changed lines (~50 added vs ~436 removed). Current file is **708 lines** (verified).

#### `initializeScene` — `App.tsx:159–212`
Rewritten signature: drops the `collabAPI` param and the discriminated `{isExternalScene, id, key}` union; now returns just `{ scene, isExternalScene: boolean }`.
- **Removed**: `?id=` query handling, the `#json=<id>,<key>` backend-import branch (`importFromBackend` + `bumpElementVersions`), and the entire `roomLinkData`/`startCollaboration` path (including the `document.hidden` → focus-retry dance for collab links).
- **Kept**: load from `localStorage` via `importFromLocalStorage()`, and the `#url=<href>` external-scene import which `fetch`es a remote `.excalidraw` blob, prompts via `openConfirmModal(shareableLinkConfirmDialog)` if the local scene is non-empty, and falls back to an `invalidSceneUrl` error. STRL marker at `App.tsx:159–160`.

#### `loadImages` — collapsed to local-only
Removed the `collabAPI.fetchImageFilesFromFirebase` branch and the `data.isExternalScene` → `loadFilesFromFirebase` branch (which used `FIREBASE_STORAGE_PREFIXES.shareLinkFiles`). Now: on `isInitialLoad`, collect `fileId`s from initialized image elements, fetch blobs from `LocalData.fileStorage.getFiles()` (IndexedDB), `addFiles`, and `clearObsoleteFiles`. STRL marker comment present (the only remaining `firebase` string in app **source** is this explanatory comment — all other matches live in the built bundle).

#### The `#6` hashchange image fix — `App.tsx:333` (`c91641bc`)
In the `onHashChange` handler, the call was changed from `loadImages(data)` to `loadImages(data, /* isInitialLoad */ true)` (verified at `App.tsx:319` and `App.tsx:333`). Because `loadImages` only loads referenced local images on the `isInitialLoad` path, navigating to a *new* `#url=` scene previously showed broken-image placeholders; passing `true` restores the images.

#### Removed collab state / effects / handlers
- State/atoms deleted: `collabAPI`, `isCollaborating`, `shareDialogState`, `collabError`, `isOffline`, `editorInterface`, `latestShareableLink`, `isCollabDisabled` (`isRunningInIframe`).
- Handlers deleted: `onExportToBackend` (~45 lines), `onCollabDialogOpen`, and the `collabAPI.syncElements(elements)` call inside `onChange` (now `onChange` only does `LocalData.save`).
- The main init `useEffect` guard simplified from `if (!excalidrawAPI || (!isCollabDisabled && !collabAPI))` to `if (!excalidrawAPI)`; `initializeScene({ excalidrawAPI })` no longer threads `collabAPI`. The `syncData` cross-tab handler dropped `importUsernameFromLocalStorage` and `collabAPI?.setUsername`.

#### Removed render
- Container `<div>` lost the `clsx("excalidraw-app", { "is-collaborating": isCollaborating })` (and the `clsx` import) → now plain `className="excalidraw-app"`.
- `<Excalidraw>` lost `isCollaborating` and `onPointerUpdate` props.
- `renderTopRightUI` (`App.tsx:614–624`) stripped of `CollabError` + `LiveCollaborationTrigger`; now renders only `<StrlExportButton>` (`App.tsx:621`).
- Deleted from the tree: `<AIComponents>`, `<TTDDialogTrigger>`, the `isCollaborating && isOffline` offline alert, `<ShareableLinkDialog>`, `<Collab>`, `<ShareDialog>`.
- `<CommandPalette>` lost the `liveCollaboration`, `stopSession`, and `share` items (and the GitHub/X/Discord/YouTube community links); keeps only `toggleTheme` + `installPWA`.
- `UIOptions.canvasActions.export` reduced to `{ saveFileToDisk: true }` (`App.tsx:604`).

#### `AppMainMenu` / `AppWelcomeScreen`
- `AppMainMenu.tsx` lost its `onCollabDialogOpen`/`isCollaborating`/`isCollabEnabled` props (and the live-collab menu entry); now also gated for desktop and with `Socials` removed.
- `AppWelcomeScreen.tsx` lost its `onCollabDialogOpen`/`isCollabEnabled` props and the live-collaboration center menu item (and, in `93c2969b`, the Plus heading variant + Sign-up item).

### 3.3 Sentry removal (`60c961ca`)

`excalidraw-app/components/TopErrorBoundary.tsx` — the error boundary is **kept**, but:
- `import * as Sentry from "@sentry/browser"` removed; `sentryEventId` dropped from state.
- `componentDidCatch` now `console.error(error, errorInfo)` locally instead of `Sentry.captureException` (STRL comment present).
- Bug-report link retargeted from `github.com/excalidraw/excalidraw/issues/new` → `github.com/vader-syntheros-0x127/excalidraw/issues/new`.
- The `errorSplash.trackedToSentry` paragraph removed from render.
- `index.tsx`: `import "../excalidraw-app/sentry"` removed.

### 3.4 Excalidraw+ removal (`93c2969b`)

- `app_constants.ts`: deleted `COOKIES.AUTH_STATE_COOKIE` and `isExcalidrawPlusSignedUser`.
- `index.html`: removed the auto-redirect `<script>` that sent `excplus-autoredirect=true` users to `https://app.excalidraw.com` — replaced by an STRL comment at `index.html:108`.
- `AppFooter.tsx`: in `93c2969b` set to always show the E2E shield (no Plus account check); subsequently `504f36e5` removed the shield entirely (the footer now keeps only the dev visual-debugger toggle).
- `vite-env.d.ts`: dropped `PLUS_*` env types.

### 3.5 Consequences & maintenance notes

- **Re-adding collaboration means rebuilding from scratch.** `collab/`, `share/`, `data/firebase.ts`, and `data/index.ts` are fully deleted (not stubbed), and the `App.tsx` plumbing (`collabAPI` atom, `isCollaborating`, pointer-update, reconciliation, sync) is gone. The `firebase`/`socket.io-client`/`random-username` deps are uninstalled. An upstream merge that touches `App.tsx`'s collab paths **will conflict heavily**.
- **`#url=` is the only remaining external-import path.** `#json=` (backend) and room/collab links no longer resolve.
- **Dead-but-harmless leftovers in `app_constants.ts`:** top-level `FIREBASE_STORAGE_PREFIXES` (`app_constants.ts:32`) and `ROOM_ID_BYTES` (`:37`) are now orphaned (nothing imports them; verified) and were not cleaned up — a future tidy-up candidate. By contrast `STORAGE_KEYS.LOCAL_STORAGE_COLLAB` (`:42`) is **still live** — `data/localStorage.ts` reads it for storage-size accounting and the legacy username key, so do **not** delete it.
- **`examples/` is untracked cruft in the working tree.** It is *not* tracked at HEAD (deleted in `60c961ca`, removed from workspaces in both `package.json` and `pnpm-workspace.yaml`), but stray `examples/with-nextjs` / `examples/with-script-in-browser` directories may re-materialize. They are outside the pnpm workspace so they don't build; `rm -rf examples/` to clean.
- `pnpm-workspace.yaml` workspaces are now `excalidraw-app`, `desktop`, `packages/*` (no `examples/*`).

---

## 4. Branding, theming & UI

This area covers everything a user *sees* that diverges from upstream: the **STRL-Ideate** name rebrand (HTML head, PWA manifest), the generated visual identity (sparkle logo + favicons + OG image + desktop icon), **dark mode as default** plus a one-time migration for existing visitors, and the **removal of all upstream social/community links**.

> **Merge-risk note.** The text/SEO/theme edits live in low-risk app files (`excalidraw-app/*`). The logo, the `en.json` strings, and the HelpDialog edit touch the **library** (`packages/excalidraw/*`) and are higher risk — upstream rewrites these files frequently.

### 4.1 Text rebrand → "STRL-Ideate" (`abb542b5`)

Renames every user-visible "Excalidraw" string in the app shell.

**`excalidraw-app/index.html`** (`STRL: branding` marker, line 5):
- `<title>` → `STRL-Ideate` (`index.html:6`)
- `<meta name="title">` → "Free, local whiteboard • Hand-drawn look & feel | STRL-Ideate" (`index.html:20–23`)
- `<meta name="description">` and the `og:*` / `twitter:*` `site_name` / `title` / `description` / `image:alt` (`index.html:31–51`)
- Screen-reader `<h1 class="visually-hidden">` → `STRL-Ideate` (`index.html:204`)

**`excalidraw-app/vite.config.mts`** — PWA manifest (`STRL: branding` marker, line 229):
- `short_name`, `name` → `STRL-Ideate`; `description` rewritten (`vite.config.mts:230–233`)

**Deliberately left as upstream** (functional, not user-visible) so future merges are easier: `excalidraw-theme` localStorage key (`app_constants.ts:43`), `window.name = "_excalidraw"` (`index.html:153`), asset/font paths, the manifest `id: "excalidraw"` (`vite.config.mts:257`), and build tokens.

### 4.2 SEO / collaboration de-branding (`90dc3980`)

- `index.html`: dropped the word "collaborative" (local-first single-user); removed `og:url` / `twitter:url` / `<link rel="canonical">` / `twitter:site` (no public STRL domain/handle yet); pointed `og:image` / `twitter:image` at a **local** `/og-image.png` instead of `https://excalidraw.com/og-image-3.png`.
- `vite.config.mts`: removed the Sitemap plugin (no public deployment) and the PWA `screenshots[]` array (those `/screenshots/*.png` assets were never shipped, 404, and one referenced the stripped collab feature).
- i18n strings (see §4.6).

### 4.3 Generated visual identity (`bcf9539b`)

The brand mark is a **"spark of an idea" sparkle**: a large 8-point white star + a small secondary sparkle, on an **indigo `#4f46e5`** rounded tile. Produced **programmatically (ImageMagick) — no external/licensed art.**

> **Important for maintainers:** the ImageMagick *commands* were **not committed** — only described in the `bcf9539b` message. What *is* version-controlled is the **vector source of truth: `public/favicon.svg`** (the full mark). All raster assets are rasterizations of that SVG.

**The wordmark/welcome logo — `packages/excalidraw/components/ExcalidrawLogo.tsx`** (LIBRARY file):
- Rewritten from the upstream multi-hundred-char Excalidraw glyph path to two simple paths: the sparkle (`fill="currentColor"`, `viewBox="0 0 40 40"`) + a small secondary sparkle at 0.9 opacity (`ExcalidrawLogo.tsx:7–20`).
- `LogoText` renders the literal text "STRL-Ideate" as an SVG `<text>` element in `Assistant, system-ui...` 46 px/700 (`ExcalidrawLogo.tsx:22–39`).
- **Monochrome via `currentColor`** so it adapts to light/dark exactly like upstream. It **keeps the `.ExcalidrawLogo-icon` / `.ExcalidrawLogo-text` class names** so `ExcalidrawLogo.scss` sizing (the `is-xs`/`is-small`/`is-normal`/`is-large` variants) is unchanged — `.scss` was NOT edited. Rendered only by the welcome screen.
- A snapshot was refreshed: `packages/excalidraw/components/__snapshots__/MobileMenu.test.tsx.snap`.

**Favicons / PWA icons (repo-root `public/`)** — all regenerated as the STRL mark:
- `favicon.svg` — canonical vector source (256×256, `rx=56` tile, `#4f46e5` fill, two white sparkle paths)
- `favicon.ico` — multi-resolution **16/32/48/64** (verified via `identify`), sRGB
- `favicon-16x16.png`, `favicon-32x32.png`
- `apple-touch-icon.png` (180×180)
- `android-chrome-192x192.png`, `android-chrome-512x512.png`
- full-bleed maskable `maskable_icon_x192.png`, `maskable_icon_x512.png`
- `index.html` gained `<link rel="icon" type="image/svg+xml" href="/favicon.svg">` (`index.html:126`)

**Desktop app icon — `desktop/assets/icon.png`** (512×512): electron-builder derives the Windows `.ico` and macOS `.icns` from this one PNG. **Confirmed byte-identical** to `public/android-chrome-512x512.png` (same MD5 `18164ae0…`).

**Social preview — `public/og-image.png`** (1200×630, sRGB, newly added): mark + wordmark + tagline. `index.html` already points `og:image`/`twitter:image` at `/og-image.png` (set in `90dc3980`).

#### Regeneration recipe (no script is committed; `public/favicon.svg` is the source of truth)

```bash
# from repo root; requires imagemagick with rsvg/SVG support
cd public
for s in 16 32 192 512; do
  magick -background none favicon.svg -resize ${s}x${s} \
    $( [ $s = 192 -o $s = 512 ] && echo android-chrome-${s}x${s}.png \
       || echo favicon-${s}x${s}.png )
done
magick -background none favicon.svg -resize 180x180 apple-touch-icon.png
# multi-res .ico (16/32/48/64)
magick -background none favicon.svg \
  \( -clone 0 -resize 16x16 \) \( -clone 0 -resize 32x32 \) \
  \( -clone 0 -resize 48x48 \) \( -clone 0 -resize 64x64 \) \
  -delete 0 favicon.ico
# maskable = full-bleed (no transparent margin); render the tile edge-to-edge
magick -background "#4f46e5" favicon.svg -resize 192x192 maskable_icon_x192.png
magick -background "#4f46e5" favicon.svg -resize 512x512 maskable_icon_x512.png
# desktop icon is identical to the 512 chrome icon
cp android-chrome-512x512.png ../desktop/assets/icon.png
```

Notes: this environment's `magick` may be the legacy ImageMagick-6 `convert`/`identify` binaries. The committed PNGs are 16-bit sRGB. The `og-image.png` (1200×630) was **composited** separately (mark + wordmark + tagline) and is **not** a pure resize — recreate it by compositing the SVG mark onto a 1200×630 canvas with the wordmark text. **If the mark design changes, edit `favicon.svg` AND the two `<path d=…>` values in `ExcalidrawLogo.tsx` to keep them in sync** (they are independent copies of the same geometry).

### 4.4 Dark mode as default (`657e18de`)

Three places must agree, all keyed off the **same** `excalidraw-theme` localStorage key (`app_constants.ts:43`):

1. **Early-paint script in `index.html`** (runs before React, prevents white flash): `return theme || "light"` → `return theme || "dark"` (`index.html:82`, `STRL: dark mode is the default`).
2. **React hook `excalidraw-app/useHandleAppTheme.ts`**: initial `appTheme` falls back to `THEME.DARK` instead of `THEME.LIGHT` (`useHandleAppTheme.ts:18`), and the initial `editorTheme` is `THEME.DARK` (`useHandleAppTheme.ts:21`). Both carry `// STRL: dark mode is the default`.
3. `<meta name="theme-color" content="#121212">` already matched the dark background upstream (`index.html:13`) — **unchanged**, just confirmed correct.

Existing stored preferences and the Alt+Shift+D toggle are unaffected — the `|| THEME.DARK` only fires when the key is absent.

### 4.5 One-time dark migration for existing visitors (`fd1e89a5`)

The dark default in §4.4 only applied to users with **no** stored key. Returning visitors who had stored `excalidraw-theme=light` (or `system`) kept their old theme. A one-time migration was added to the **early-paint `getTheme()`** in `index.html` (`index.html:66–73`):

```js
var STRL_THEME_MIGRATION_KEY = "strl-theme-dark-default-v1";
if (!window.localStorage.getItem(STRL_THEME_MIGRATION_KEY)) {
  window.localStorage.setItem(STRL_THEME_MIGRATION_KEY, "1");
  window.localStorage.setItem("excalidraw-theme", "dark");
}
```

- Guarded by the **`strl-theme-dark-default-v1`** flag so it flips the stored theme to dark **exactly once**.
- After migration, the user can switch back to light and that choice **persists** (the flag is already set).
- Runs in the pre-React script (no flash). Verified headless: fresh profile → dark; profile seeded with "light" → migrated to dark on next load.
- **Maintainer note:** to force a second org-wide migration in the future, bump the flag to `…-v2`.

### 4.6 i18n visible-string rebrand (`90dc3980`, LIBRARY file)

`packages/excalidraw/locales/en.json` — only **visible** strings, leaving JSON keys (and call sites) untouched:
- `labels.addWatermark` → `Add "Made with STRL-Ideate"` (`en.json:70`)
- `labels.madeWithExcalidraw` → `Made with STRL-Ideate` (`en.json:105`)
- `labels.excalidrawLib` → `STRL-Ideate Library` (`en.json:135`)
- `buttons.installPWA` → `Install STRL-Ideate locally (PWA)` (`en.json:177`)
- `errors.invalidSceneUrl` → "…doesn't contain valid STRL-Ideate JSON data." (`en.json:277`)

Mermaid-dialog strings were intentionally **left as "Excalidraw"** (that dialog isn't reachable in the app). Other locale files were not touched; non-English users still see "Excalidraw" in these spots until translations sync from upstream.

### 4.7 Removed social / community links

All chosen because every link pointed at excalidraw.com / community properties.

- **Command palette (`excalidraw-app/App.tsx`, `90dc3980`):** deleted the GitHub / X / Discord / YouTube `customCommandPaletteItems` and their icon imports (`GithubIcon`, `XBrandIcon`, `DiscordIcon`, `youtubeIcon`). Replaced with `// STRL:` markers.
- **Help dialog (`packages/excalidraw/components/HelpDialog.tsx`, `90dc3980`, LIBRARY file):** removed the entire `<Header />` external-links bar (Documentation → docs.excalidraw.com, Blog → plus.excalidraw.com/blog, GitHub, YouTube) and the now-unused `ExternalLinkIcon`/`GithubIcon`/`youtubeIcon` imports. The dialog now shows **only** the keyboard-shortcuts reference (STRL comment at `:18`).
- **Main menu Socials (`excalidraw-app/components/AppMainMenu.tsx`, `08d5c3d0`):** removed `<MainMenu.DefaultItems.Socials />` and the preceding `<MainMenu.Separator />`. Same commit gates `LoadScene`/`SaveToActiveFile` on `!window.strlDesktop` for the desktop document model (`AppMainMenu.tsx:18–32`).
- **Encrypted footer shield (`504f36e5`):** `excalidraw-app/components/EncryptedIcon.tsx` was **deleted** and its use removed from `AppFooter.tsx`. The icon advertised "end-to-end encrypted" and linked to `plus.excalidraw.com/blog/end-to-end-encryption` — inaccurate now that collaboration is stripped and the app is local-only.

### 4.8 What to watch on upstream merges

- **Highest risk:** `ExcalidrawLogo.tsx`, `HelpDialog.tsx`, and `en.json` are in `packages/excalidraw/` and change often upstream. The `MobileMenu.test.tsx.snap` snapshot is coupled to the logo SVG — re-run snapshot update after a merge.
- **The two theme defaults must stay in sync:** the early-paint `index.html` fallback and the `useHandleAppTheme.ts` state initializer. If upstream rewrites either, re-apply the `|| "dark"` / `THEME.DARK` change to both.
- **The migration is one-shot** and self-contained in `index.html`; low-risk but easy to accidentally drop if `getTheme()` is replaced wholesale during a merge.
- **No generation script exists** — `favicon.svg` is the single vector source of truth; treat it as canonical and regenerate from it.

---

## 5. Export feature (PNG/SVG/PDF) & shared pipeline

Upstream exposes export only through the **image-export dialog** (`⌘⇧E`), which offers save-to-disk, copy-to-clipboard, and the **Excalidraw+ cloud export** + **shareable-link export** (both backend-dependent). STRL adds a **first-class, always-visible "Export ▾" button** on the canvas top-right and **removes the cloud/shareable-link sinks** because this is a local-first build with no backend.

The export logic was deliberately extracted into a standalone module (`excalidraw-app/components/strlExport.ts`) so the **same code path feeds three surfaces**:

1. **Web**: the on-canvas `Export ▾` dropdown → browser download (`triggerDownload`).
2. **Desktop**: the native **File ▸ Export ▸ {PNG/SVG/PDF}** menu → native Save dialog (`desktop.saveFile` over IPC).
3. The library's own image-export dialog still handles `.png`/`.svg`/`.excalidraw` save-to-disk for parity, but the STRL formats — notably **PDF** — only exist in the STRL pipeline.

Two commits define this area:
- **`d8d84c9c`** — introduced the button, the SCSS, the `strlExport.ts` helpers, the `renderTopRightUI` rewiring, the image-export dialog trimming, and the `jspdf` dependency.
- **`76063b85`** — collapsed per-format `if (png) … else if (svg) … else (pdf)` branching that had been duplicated in **both** the web button and the desktop hook into a single dispatcher, `sceneToExportBytes(scene, format)`.

> Note: `d8d84c9c`'s diff to `App.tsx` shows the export button living *alongside* gated collab UI inside `renderTopRightUI`. That collab scaffolding was **later removed** by the collab-strip `1f9d9e45`; the current `App.tsx:614–624` `renderTopRightUI` renders **only** `<StrlExportButton>` (`:621`).

### 5.1 The shared pipeline — `excalidraw-app/components/strlExport.ts`

Pure, UI-agnostic, the single source of truth for "scene → bytes":

- **`StrlScene` type** (`:13–18`) — snapshot bundle: `elements`, `appState`, `files`, plus a `name`.
- **`resolveScene(api)`** (`:21–35`) — pulls the live scene off the `ExcalidrawImperativeAPI`. Returns `null` (and fires a `"Nothing to export"` toast) when the canvas is empty; otherwise defaults the name via `api.getName() || "strl-ideate"`.
- **`sceneToPngBlob(scene)`** (`:37–43`) — wraps the library's `exportToBlob({ …, mimeType: "image/png" })`.
- **`sceneToSvgString(scene)`** (`:45–52`) — wraps `exportToSvg(...)` then `XMLSerializer().serializeToString(svg)`.
- **`sceneToPdfBytes(scene)`** (`:54–71`) — the only non-trivial one. Renders the scene to a `<canvas>` via `exportToCanvas`, grabs a PNG data URL, then **rasterises** it into a single-page PDF using **jsPDF**: orientation/format derived from canvas dims (`landscape` when `width >= height`), `unit: "px"`, `format: [width, height]`, `hotfixes: ["px_scaling"]`, returns `new Uint8Array(pdf.output("arraybuffer"))`. **PDF is raster, not vector** — it embeds a PNG, so text is not selectable.
- **`StrlExportFormat`** (`:73`) — `"png" | "svg" | "pdf"`.
- **`sceneToExportBytes(scene, format)`** (`:80–106`) — **the single dispatch point** (added in `76063b85`). Returns `{ data: string | Uint8Array; extension; mimeType }`. PNG → `Uint8Array` (`image/png`); SVG → `string` (`image/svg+xml`); PDF → `Uint8Array` (`application/pdf`). Both sinks call this; adding/fixing a format is now a one-place change.
- **`triggerDownload(data, filename, mimeType)`** (`:109–126`) — the **web sink**: wraps non-`Blob` data in a `Blob`, creates an object URL, clicks a synthetic `<a download>`, revokes the URL. `76063b85` records a deliberate choice to **keep this hand-rolled download** rather than the library's `browser-fs-access` `fileSave`: that helper's MIME table has no `"pdf"` key, so `fileSave({ extension: "pdf" })` wouldn't typecheck.

### 5.2 Web surface — `StrlExportButton.tsx` + `.scss`

`excalidraw-app/components/StrlExportButton.tsx` (added `d8d84c9c`, simplified `76063b85`) is a self-contained dropdown:
- Local `open`/`busy`/`containerRef` state; an outside-`mousedown` listener closes the menu (`:25–39`).
- `exportAs(format)` (`:41–68`) guards re-entrancy with `busy`, calls `resolveScene`, then the one-liner `const { data, extension, mimeType } = await sceneToExportBytes(scene, format); triggerDownload(data, ${scene.name}.${extension}, mimeType)`. Failures surface as a 3 s `setToast` plus a `console.error`. Before `76063b85` this body held the triplicated per-format branches.
- Trigger label toggles `"Export ▾"` / `"Exporting…"`; menu offers **PNG image / SVG vector / PDF document** (`:82–94`).

`StrlExportButton.scss` styles it entirely off **Excalidraw theme CSS variables** (`--island-bg-color`, `--text-primary-color`, `--default-border-color`, `--button-hover-bg`, `--shadow-island`, with hard-coded fallbacks) so it adapts to light/dark with no extra logic.

### 5.3 Wiring in `App.tsx`
- Import at `App.tsx:70`: `import { StrlExportButton } from "./components/StrlExportButton";`.
- `renderTopRightUI` (`App.tsx:614–624`) returns `null` on mobile or before the API is ready, else renders just `<StrlExportButton excalidrawAPI={excalidrawAPI} />` inside `.excalidraw-ui-top-right`.
- **Image-export dialog trimming** (`App.tsx:598–607`) — `UIOptions.canvasActions.export` reduced to `{ saveFileToDisk: true }` (`:604`). `d8d84c9c` removed the `onExportToBackend` handler and the `renderCustomUI` that mounted `<ExportToExcalidrawPlus>`; the whole upsell/cloud stack was later removed by `93c2969b`.

### 5.4 Desktop surface — same pipeline via IPC

- **`excalidraw-app/useDesktopIntegration.ts:87–94`** — `exportScene(format)` calls `resolveScene`, then `const { data, extension } = await sceneToExportBytes(scene, format); await desktop.saveFile({ data, suggestedName: scene.name, extension })`. Before `76063b85` this held the same triplicated branching — the motivation for the de-dup. The hook is invoked from `App.tsx:222`; `handleMenu` (`:96–120`) maps `export-png`/`export-svg`/`export-pdf` to `exportScene(...)`.
- **`desktop/src/main.ts:356–361`** — the native **File ▸ Export** submenu (`PNG image`/`SVG vector`/`PDF document`) calls `sendMenu("export-png" | "export-svg" | "export-pdf")`, delivered over `strl:menu`.
- **`desktop/src/main.ts:636–684`** — the `strl:save-file` handler writes bytes. Exports (`extension !== "excalidraw"`) always go through a native `dialog.showSaveDialog`; only `.excalidraw` scene saves can write in place to `activeFilePath`. String payloads (SVG) written as-is; `Uint8Array` payloads (PNG/PDF) wrapped in `Buffer.from(...)`.
- Bridge types: `StrlMenuAction` and the `saveFile` signature in **`excalidraw-app/strl-desktop.d.ts:3–9,20–30`**, mirrored in **`desktop/src/preload.ts:10–12,32,75`**.

### 5.5 The jsPDF dependency
- Declared as an **exact pin** in `excalidraw-app/package.json:32` — `"jspdf": "4.2.1"` (verified, no caret).
- Lockfile entry in `pnpm-lock.yaml` (`sha512-YyAXyvnmjTbR…`).
- **Supply-chain posture:** `d8d84c9c`'s message records jspdf was installed `--ignore-scripts` and vetted by Aikido Safe Chain. Under pnpm this stays enforced: `package.json`'s `pnpm.onlyBuiltDependencies` lists **only** `esbuild` and `electron`, so **jspdf's lifecycle/install scripts are not allowed to run**.

### 5.6 Maintenance / merge-risk notes
- All export code lives in the **low-merge-risk** `excalidraw-app/` and `desktop/` workspaces — **no `packages/*` edits**. The pipeline only *calls* library exports (`exportToBlob`/`exportToSvg`/`exportToCanvas`/`serializeAsJSON`), tracking the public API.
- The single conflict-prone touch point on merges is **`App.tsx`**: both `renderTopRightUI` and `UIOptions.canvasActions.export` are upstream-owned blocks STRL rewrote.
- **To add a new export format:** extend `StrlExportFormat` + the `sceneToExportBytes` switch in `strlExport.ts`, then add the menu/button entries. Both sinks pick it up automatically.

---

## 6. Desktop app (Electron)

The biggest net-new STRL subsystem: an additive `desktop/` pnpm workspace that wraps the **already-built** `excalidraw-app` SPA in an Electron shell, served over a custom privileged `app://` protocol, with a real desktop document model (active file, dirty tracking, Save vs Save-As, recents, autosave) layered on top of the unmodified editor library. It is **local-first** — zero network calls, all fonts bundled, strict CSP.

The whole subsystem is gated so the **web build is unaffected**: renderer code is guarded on `window.strlDesktop` (injected only by the Electron preload), and the build-time forks are gated on `VITE_APP_DESKTOP` / `--mode desktop`.

**Where it lives / merge-risk:**
- `desktop/` — **NEW** workspace, 100 % STRL, near-zero merge risk. Added to `pnpm-workspace.yaml` (`- "desktop"`).
- `excalidraw-app/useDesktopIntegration.ts`, `strl-desktop.d.ts`, `components/strlExport.ts` — **NEW** STRL files in the app workspace.
- `excalidraw-app/App.tsx`, `components/AppMainMenu.tsx`, `components/AppWelcomeScreen.tsx`, `index.html`, `vite.config.mts`, `package.json` — small **guarded STRL edits** to existing app files (low risk).
- `packages/excalidraw/fonts/ExcalidrawFontFace.ts`, `vite-env.d.ts`, `scripts/woff2/woff2-vite-plugins.js` — **library edits** for desktop-local fonts (**HIGHER merge risk**; the web path is verified unchanged).

Commit lineage: `8cb6b0d9` (Phases 0–2: shell + native integration), `a3cabc8c` (Linux packaging + ship-clean `--mode desktop`), `b3d91766` (strict CSP + fully-local fonts), `08d5c3d0` (document model), `c91641bc` (document-model review fixes #1–#10), `ee0001cd` (path-traversal hardening), `f31357f4` (win/mac packaging + CI matrix), `0e7f89e4` (win portable), `03ff90be` (re-enable asar + react-vendor chunk), `14187b79` (stream `app://` via `net.fetch`), `76063b85` (export de-dup).

### 6.1 The `app://` custom protocol

`desktop/src/main.ts:112–122` registers `app` as a **privileged scheme** *before* `app.whenReady()` (Electron requirement):

```js
protocol.registerSchemesAsPrivileged([{ scheme: "app",
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
```

`standard`+`secure` give https-like origin semantics (the SPA keeps absolute `/` asset paths and a real `window.origin`); `supportFetchAPI`/`stream` enable fetch + streaming.

The handler (`registerAppProtocol`, `main.ts:132–180`) is registered at `app.whenReady()` (`main.ts:770`). The window loads `app://-/index.html` (`main.ts:215`; `-` is a throwaway host). Behavior:
- **Path decode + traversal guard** (`main.ts:134–152`): `decodeURIComponent(pathname)`, resolve inside `BUILD_DIR`, reject via `path.relative(BUILD_DIR, resolved)` — anything escaping yields `..`, a `..${sep}` prefix, or an absolute path → `403 Forbidden`. This **replaced** an earlier unsafe `resolved.startsWith(BUILD_DIR)` prefix check (which matched sibling dirs like `<BUILD_DIR>-evil` and was separator/case-fragile on Windows) in `f31357f4`. Verified to block `../etc/passwd`, `../../etc/passwd`, `../renderer-evil`.
- **SPA fallback** (`main.ts:154–159`): if the resolved path isn't a real file and is extension-less, serve `index.html`; else serve the requested (likely 404) path. Makes client-side routing / deep links work.
- **Streaming via `net.fetch`** (`main.ts:163`): `net.fetch(pathToFileURL(target))` — **asar-aware** (serves from `app.asar` when packaged, off disk in dev), streams the body, sets `content-type` automatically. History: `8cb6b0d9` used net.fetch → `03ff90be` switched to `fs.readFileSync` + explicit MIME map when re-enabling asar (wrongly believing net.fetch wasn't asar-aware) → `14187b79` reverted to net.fetch after confirming it *is* asar-aware (the readFileSync version was copying the ~1.9 MB main bundle synchronously per request despite `stream:true`).
- **CSP on the document only** (`main.ts:167–178`): sub-resources pass straight through; **only `index.html`** gets the `Content-Security-Policy` header injected (clone headers, `set("Content-Security-Policy", …)`, reuse the streamed body — never re-buffered). Sub-resources inherit the policy from the document.
- `BUILD_DIR` (`main.ts:55–57`) is `__dirname/../renderer` when packaged, else `excalidraw-app/build` in dev.

**Navigation hardening** (`main.ts:806–822`, `web-contents-created`): `setWindowOpenHandler` opens `http(s)` links in the external browser (`shell.openExternal`) and denies all in-app window opens; `will-navigate` is blocked unless the URL is `app://` (prod) or the `DEV_URL` (dev).

### 6.2 Content-Security-Policy (`main.ts:35–49`)

Strict, `self`-only — there are no remote origins because the desktop build bundles fonts locally:

```
default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none';
script-src 'self' 'wasm-unsafe-eval'
  'sha256-iPtxE0n242JUcLKPr7D09tSIF4FKNSy5jqkeySXxfDY='
  'sha256-mXvmZWZG6iAZBw0OliHQaJOSMPc9DbQZJaxywImBlQo='
  'sha256-Kxm9zQ99NqYtDuNSdByEfyFAYVPAqWdmNFx5axumk1w=';
style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:;
connect-src 'self' data: blob:; worker-src 'self' blob:; media-src 'self' blob:; manifest-src 'self'
```

- `'wasm-unsafe-eval'` is for pica / image-blob-reduce WASM image resize.
- `style-src 'unsafe-inline'` because Excalidraw applies inline styles heavily.
- The **three sha256 inline-script hashes** cover the three inline `<script>`s in the **built** desktop renderer `index.html` (see the verified table in §7.1). Dev (Vite) load path is **not** CSP-wrapped.

### 6.3 Packaging — `asar:true`

`electron-builder.yml:11` `asar: true`. Packs `dist/` (compiled main+preload) + `renderer/` into a single `app.asar` (~22 MB). No `asarUnpack` needed because the `app://` handler reads via `net.fetch`/`fs` which are asar-aware. History: `8cb6b0d9`/`a3cabc8c` shipped `asar:false`; `03ff90be` flipped it back to `true` (far fewer files; clears electron-builder's "asar disabled — strongly not recommended" warning).

### 6.4 The document model

Main (`main.ts`) owns the document; the renderer holds the authoritative dirty bit.
- **`activeFilePath`** (`main.ts:409`) — the open scene file (null = fresh/Untitled). Set via `setActiveFile` (`main.ts:490–497`) only after a confirmed open or a successful save — never speculatively, so a failed open can't make the next Save clobber a good file.
- **Window title** (`updateTitle`, `main.ts:468–476`): `${isDirty ? "● " : ""}${name} — STRL-Ideate`, where `name` = basename without `.excalidraw`, or `Untitled`. Main owns the title and blocks the page from overriding it via `page-title-updated` → `event.preventDefault()` (`main.ts:220–222`).
- **True Save vs Save-As** (`strl:save-file` handler, `main.ts:636–696`): a scene `Save` writes **in place with no dialog** *only* when it's a scene, `!saveAs`, there's an `activeFilePath`, **and that file still exists on disk** (`fs.existsSync`); otherwise it falls through to the native Save dialog. Save-As / first-save / any export always prompt. Only scene saves call `setActiveFile`.
- **Recents** (`main.ts:436–520`): persisted to `userData/recent-files.json`, max 10, newest-first, dedup by resolved path. Drives the native "Open Recent" submenu and is broadcast to the renderer (`strl:recent-files`) to populate the welcome-screen quick-open list (`AppWelcomeScreen.tsx:58–67`, top 5). `strl:open-recent` only honors paths already in main's recents list (`main.ts:718–725`).
- **Unsaved-changes prompt** (`promptSaveBeforeClose`, `main.ts:522–538`): native Save / Don't Save / Cancel dialog, fired on window close and on New.
- **20 s autosave** (`main.ts:779–790`): every 20 s, if `rendererReady && isDirty && activeFilePath && fs.existsSync(activeFilePath)`, silently `sendMenu("save")`. Untitled scenes are skipped (no path → dialog), and a vanished active file is skipped (don't resurrect a deleted file from a background timer).
- **Window-state persistence** (`main.ts:72–107`): dependency-free `userData/window-state.json` (bounds + maximized).

### 6.5 Renderer-ready + confirmOpened handshake (launch-open race fix)

The original bug (`08d5c3d0`): the launch / file-association open was sent at `did-finish-load`, **before** the renderer registered its open handler, so the scene loaded empty — and an in-place Save would then overwrite the file with nothing. Fix:
- The renderer registers its IPC handlers in `useDesktopIntegration`, **then** calls `desktop.ready()` → `strl:renderer-ready` (`useDesktopIntegration.ts:157–159`).
- Main buffers any pre-ready open in `pendingOpenPath` (`openFilePath`, `main.ts:592–599`) and flushes it on `strl:renderer-ready` (`flushPendingOpen`, `main.ts:625–631`, `706–710`). `did-finish-load` deliberately does **not** flush (`main.ts:270–275`).
- After loading, the renderer calls `desktop.confirmOpened(file.path)` → `strl:opened`, and **only then** does main adopt it as the active document (`main.ts:729–733`). The confirm fires right after `updateScene` (the commit point), **before** `addFiles`/`markSaved` (`useDesktopIntegration.ts:130–138`), so a later failure can't leave main pointing at the previous file (finding #2, `c91641bc`).

### 6.6 Token-correlated `requestSaveScene` round-trip (close / New)

A `close` handler can't `await` before deciding, so the close flow (`main.ts:234–263`) always `preventDefault()`s, then resolves asynchronously: query the renderer's authoritative dirty flag → if dirty, `promptSaveBeforeClose()` → on "Save", `await requestSaveScene(false)` and only close if it actually wrote. `closeInProgress` guards Cmd+W mashing; `allowClose` lets the real close through once decided. `doNew` (`main.ts:553–565`) uses the same guard.

`requestSaveScene` (`main.ts:421–434`) is a **token-correlated round-trip**: `++saveToken`, register `ipcMain.once("strl:save-done:${token}")`, send `strl:save-and-report {token, saveAs}`. The renderer's `onSaveAndReport` handler (`useDesktopIntegration.ts:154–156`) runs `saveScene` and replies `reportSaveDone(token, {ok})`. This **replaced** a fragile `pendingAfterSave` flag handshake (findings #1/#10, `c91641bc`) — now the `strl:save-file` handler is side-effect-free, and an export or autosave landing mid-close can't trigger a stray close/new.

### 6.7 Dirty tracking (`useDesktopIntegration.ts:24–60`)

Subscribes to `excalidrawAPI.onIncrement` and acts **only on `type === "durable"`** increments (real edits), ignoring ephemeral ones (pointer/selection/scroll) — so it doesn't recompute the scene version on every mouse move (findings #4/#8, `c91641bc`). The baseline is computed over `getSceneElementsIncludingDeleted()` — the *same* element set an increment reflects — so a scene that merely *contains* a deleted element isn't perpetually dirty. The first durable increment seeds `lastSavedVersion` (autoload) rather than marking dirty.

`reportDirty` writes `window.__strlIsDirty` **synchronously** (the authoritative flag main's close guard reads via `executeJavaScript`, `main.ts:543–550`) and only sends `strl:set-dirty` on a *change* (debounce). `main`'s own `isDirty` is a fallback mirror used only if the renderer is unreachable mid-teardown. `markSaved` re-baselines on New / open / successful save; `saveScene` snapshots the baseline **before** the async save dialog so edits during the dialog aren't counted as saved.

### 6.8 Fonts-local-for-desktop (no phone-home)

Driven by `VITE_APP_DESKTOP=true` (`.env.desktop`) and `--mode desktop`. Three forks (all gated so the web path is unchanged):
1. `scripts/woff2/woff2-vite-plugins.js` — for `isDesktop` (`mode==="desktop"`): rewrites `fonts.css` to a single local `@font-face` (`src: url(/Assistant-Regular.woff2); font-weight: 400 700` — only `Assistant-Regular` ships; the browser synthesizes 500/600/700); injects `window.EXCALIDRAW_ASSET_PATH = window.origin` into `index.html` (no CDN preloads). The web build keeps the DigitalOcean CDN `@font-face`s + esm.sh fallback + cross-origin preloads.
2. `excalidraw-app/index.html:99–104` — the Google-fonts `preconnect`s are wrapped in an EJS `<% if VITE_APP_DESKTOP != 'true' %>`, so the desktop build emits no cross-origin preconnects.
3. `packages/excalidraw/fonts/ExcalidrawFontFace.ts` (LIBRARY edit) — `ASSETS_FALLBACK_URL` (`:14–21`) folds to `""` when `import.meta.env.VITE_APP_DESKTOP === "true"`, so esbuild **drops the `https://esm.sh/...` string from the bundle entirely**; and `createUrls` (`:176–178`) never appends the remote esm.sh fallback URL on desktop. `packages/excalidraw/vite-env.d.ts` declares `VITE_APP_DESKTOP`.

Result (verified in `b3d91766`): the desktop bundle has zero external refs (esm.sh / digitalocean / google / firebase all absent), and the packaged AppImage loads Excalifont + Assistant locally with no CSP violations.

### 6.9 Packaging targets & how to build

Targets (`electron-builder.yml`): **Linux** AppImage + deb (`linux:` block); **Windows** nsis installer + portable .exe (`win:`); **macOS** dmg x64+arm64 (`mac:`). `appId: com.strl.ideate`, `productName: STRL-Ideate`. `.excalidraw` `fileAssociations` → Windows ProgID/extension via NSIS, macOS `CFBundleDocumentTypes`, Linux `.desktop` MimeType; OS then launches with the file path (argv on win/linux, `open-file` event on mac), handled in main.ts (`takeFileFromArgv` + `app.on("open-file")` + single-instance).

Build commands (`desktop/package.json`, run from `desktop/`):
- `pnpm dist:linux` / `dist:win` / `dist:mac` — each runs `prepackage` (`build:main` = `tsc`; `build:renderer` = `pnpm -C ../excalidraw-app build:desktop` then copies `excalidraw-app/build` → `desktop/renderer`) then `electron-builder --<os>`.
- `build:desktop` (`excalidraw-app/package.json:42`) = `cross-env VITE_APP_DISABLE_PWA=true vite build --mode desktop`.
- Dev: `pnpm start` (build main + `electron .`, loads packaged renderer over `app://`) or `pnpm start:dev` (sets `STRL_DESKTOP_DEV_URL=http://localhost:3000`, loads the live Vite dev server + opens DevTools).
- Output → `desktop/dist-installers`.

**Cross-build constraints:** Linux can build linux. Windows builds need a `windows-latest` runner (cross-build on Linux needs wine for rcedit icon/version stamping). macOS dmg can only be built on macOS (`hdiutil`/`dmgbuild`). CI (`.github/workflows/desktop-build.yml`) is a **manual-dispatch** (`workflow_dispatch`) matrix over ubuntu/windows/macos producing installer **artifacts only** (`permissions: contents: read`, no publish/release). corepack pins pnpm 10.34.1 **before** setup-node; Node 22; `pnpm install --frozen-lockfile` (electron's postinstall runs via `pnpm.onlyBuiltDependencies`, no rebuild step); per-OS electron-builder binary cache; SHA-256 sidecars emitted per installer; actions are SHA-pinned.

macOS entitlements (`assets/entitlements.mac.plist`): minimal hardened-runtime set — `allow-jit`, `allow-unsigned-executable-memory`, `disable-library-validation` (for Electron/V8). **Deliberately NO `app-sandbox`** — sandboxing would break the native open/save dialogs for local `.excalidraw` files. Lives in `assets/` (buildResources) because the repo gitignores `build/`.

### 6.10 Path-traversal hardening (two layers)
- The `app://` handler guard (§6.1, `f31357f4`).
- The file-open guard (`ee0001cd`, `main.ts:601–609`): Snyk SAST flagged CWE-23 (OS/CLI path → `readFileSync`). `openFilePath` now requires a `.excalidraw` extension (lowercased), requires a regular file, and caps size at 50 MB (`MAX_SCENE_BYTES`) before reading.

### 6.11 Renderer integration points (web stays unaffected)
- `App.tsx:222` — `useDesktopIntegration(excalidrawAPI)` (no-op on web; guarded on `window.strlDesktop`).
- `AppMainMenu.tsx:21–25` — hides the library's browser-FS `LoadScene` / `SaveToActiveFile` menu items on desktop (native File menu owns Ctrl+O/Ctrl+S), guarded on `!isDesktop`; also dropped `<MainMenu.DefaultItems.Socials />` (`:32`).
- `AppWelcomeScreen.tsx` — recent-files quick-open on the start screen.
- `vite.config.mts:153–157` — `VitePWA({ disable: process.env.VITE_APP_DISABLE_PWA === "true" })` so the desktop build ships no service worker. **Note this reads `process.env`, not the loaded env vars** — that's why `build:desktop` passes `cross-env VITE_APP_DISABLE_PWA=true` on the CLI in addition to it being in `.env.desktop`.

### 6.12 Smoke-test harness

`STRL_SMOKE=1` (`main.ts:278–301`) polls up to 20× (500 ms) for the editor to mount, captures console errors, prints `{ title, hasEditor, dark, scripts }`, then quits. Expected pass: `{"hasEditor":true,"dark":true}`. Used under xvfb in verification and catches CSP/font/inline-script-hash regressions.

---

## 7. Security, supply-chain & CI

The STRL fork's security posture: the strict desktop CSP, the "no phone-home" local-first hardening, path-traversal defenses, the two-layer supply-chain policy (pre-install + post-install), and the two CI workflows. All of it is gated so the **web build is left byte-for-byte upstream-equivalent** and all STRL behavior keys off `VITE_APP_DESKTOP` / `--mode desktop` / Electron-main code that does not exist upstream.

Relevant commits: `b3d91766` (CSP + local fonts), `ee0001cd` (path-traversal hardening), `90dc3980` (debrand / neutralize web SEO / drop external links), `504f36e5` (drop misleading E2E shield), `36e9d541` (supply-chain CI), `e993f64d` (yarn→pnpm + emptied backend env).

### 7.1 The three inline-script sha256 hashes — VERIFIED

The CSP (`desktop/src/main.ts:35–49`, full policy in §6.2) is injected **only onto the HTML document** served over `app://` (`main.ts:171–178`); sub-resources stream through and inherit it (`main.ts:167–170`). The dev path (Vite via `STRL_DESKTOP_DEV_URL`) is untouched.

The three hashes correspond to the three inline `<script>` blocks in the **built** (vite-transformed, minified) desktop renderer `index.html`, **NOT** the source `excalidraw-app/index.html`. Recomputing sha256(script body)→base64 against `desktop/renderer/index.html` matches all three exactly:

| CSP slot | hash | inline script |
|---|---|---|
| 1 | `iPtxE0n242JUcLKPr7D09tSIF4FKNSy5jqkeySXxfDY=` | dark-mode early-paint (`try { setTheme(getTheme()) }`) — source `excalidraw-app/index.html:55–90` |
| 2 | `mXvmZWZG6iAZBw0OliHQaJOSMPc9DbQZJaxywImBlQo=` | local asset-path (`window.EXCALIDRAW_ASSET_PATH = window.origin`) — **injected by the woff2 desktop branch**, `scripts/woff2/woff2-vite-plugins.js:67–74` |
| 3 | `Kxm9zQ99NqYtDuNSdByEfyFAYVPAqWdmNFx5axumk1w=` | `window.name = "_excalidraw"` — source `excalidraw-app/index.html:151–154` |

**MAINTENANCE GOTCHA (load-bearing):** these hashes are over the **post-build minified** bodies, so they will silently drift if anyone (a) edits those three inline scripts, (b) changes the woff2 desktop-font injection text, or (c) changes the minifier. The **source-file hashes do NOT match the CSP.** To recompute, build the desktop renderer and hash the inline `<script>` bodies of `desktop/renderer/index.html` (base64 of sha256). The `main.ts:34` comment points at this. The safety net is the `STRL_SMOKE=1` probe (§6.12), which asserts `dark:true`/`hasEditor:true`; a hash mismatch blocks the inline scripts and fails the editor mount.

### 7.2 Renderer / app:// hardening (defense in depth around the CSP)
- `BrowserWindow` webPreferences (`main.ts:198–204`): `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `spellcheck: false`, dedicated `preload.js`.
- `app://` scheme registered as `standard` + `secure` (`main.ts:112–122`).
- Navigation lock-down (`main.ts:806–822`): `setWindowOpenHandler` denies all in-app window opens and shunts `http(s)` to the OS browser; `will-navigate` blocked unless target is `app://` (or the dev URL in dev).
- `preload.ts` exposes only a minimal typed `strlDesktop` API over `contextBridge` — no Node internals leak.

### 7.3 No phone-home / local-first posture

Covered mechanically in §6.8. The CSP surfaced two outbound calls the desktop build was making on launch (font CDN + esm.sh fallback); both are compiled out for desktop via the woff2 plugin branch, the `ExcalidrawFontFace.ts` fold-to-`""`, and the EJS-gated preconnects.

The ship-clean env (`a3cabc8c`, `e993f64d`): `.env.desktop` (**at repo root**) sets `VITE_APP_DESKTOP=true`, plus `VITE_APP_DISABLE_PWA=true`, `VITE_APP_ENABLE_TRACKING=false`, and **every** backend identifier left empty (`VITE_APP_BACKEND_V2_*`, `_WS_SERVER_URL`, `_FIREBASE_CONFIG`, `_AI_BACKEND`, `_LIBRARY_*`, `_PLUS_*`). `.env.production` / `.env.development` are similarly emptied so even the web/dev builds carry no excalidraw.com backend identifiers.

#### Env files — what each empties

Env files live at **repo root** (Vite `envDir: "../"` in `vite.config.mts:24`, `loadEnv(mode, "../")` at `:14`). There are **three**:

| File | `mode` | Distinguishing settings |
|---|---|---|
| `.env.production` | `production` | PWA stays ON; `VITE_APP_ENABLE_TRACKING=false` |
| `.env.development` | `development` | `VITE_APP_PORT=3001`, `FAST_REFRESH=false`, eslint ON, PWA off |
| `.env.desktop` | `production` (`MODE=production`) | `VITE_APP_DISABLE_PWA=true`, **`VITE_APP_DESKTOP=true`** |

**What every variant deliberately empties** (so no excalidraw.com backend identifier is baked into any build): `VITE_APP_BACKEND_V2_GET_URL`, `VITE_APP_BACKEND_V2_POST_URL`, `VITE_APP_WS_SERVER_URL`, `VITE_APP_FIREBASE_CONFIG`, `VITE_APP_AI_BACKEND`, `VITE_APP_LIBRARY_URL`, `VITE_APP_LIBRARY_BACKEND`, `VITE_APP_PLUS_LP`, `VITE_APP_PLUS_APP`, `VITE_APP_PLUS_EXPORT_PUBLIC_KEY`. All empty; `VITE_APP_ENABLE_TRACKING=false` everywhere.

#### Neutralized web SEO / external surface (`90dc3980`, `504f36e5`)
- `vercel.json`: removed `Access-Control-Allow-Origin: https://excalidraw.com` (two occurrences), the `/webex/*` and `vscode.excalidraw.com` redirects, and `installCommand` yarn → `pnpm install --frozen-lockfile`.
- `excalidraw-app/vite.config.mts`: removed the **Sitemap** plugin (`:137`) and the PWA **screenshots[]** (`:286–287`); SW disabled for desktop via `VITE_APP_DISABLE_PWA` (`:153–157`); sourcemaps off (`:131–132`).
- `excalidraw-app/index.html`: dropped "collaborative" wording; removed `og:url`/`twitter:url`/canonical/`twitter:site`; repointed og/twitter image to local `/og-image.png`; the SimpleAnalytics loader (`:208–246`) is EJS-gated on `VITE_APP_ENABLE_TRACKING == 'true'`, so desktop omits it entirely; removed the Excalidraw+ auto-redirect.
- External links removed: command-palette GitHub/X/Discord/YouTube items + icons in `excalidraw-app/App.tsx`; the Documentation/Blog/GitHub/YouTube links bar in `packages/excalidraw/components/HelpDialog.tsx` (LIBRARY edit, `:18`); the "Learn More" Help-menu item in `desktop/src/main.ts:398`.
- `504f36e5`: deleted `excalidraw-app/components/EncryptedIcon.tsx` and its use in `AppFooter.tsx`.

### 7.4 Path-traversal hardening (`ee0001cd`)

Two enforcement points in `desktop/src/main.ts`:

**(a) `app://` request handler (`main.ts:132–180`).** Resolves the requested path inside `BUILD_DIR` and rejects traversal **using `path.relative`, not `startsWith`** (`:144–152`). The comment (`:139–143`) explains why a prefix check is unsafe (`startsWith(BUILD_DIR)` also matches sibling dirs like `<BUILD_DIR>-evil`, separator/case-fragile on Windows). Anything escaping yields a `..`-prefixed or absolute path → `403 Forbidden`. Assets streamed via `net.fetch(pathToFileURL(...))` (asar-aware; refined in `14187b79`).

**(b) File-open path (`openFilePath`, `main.ts:592–623`).** Snyk SAST flagged CWE-23: an OS/CLI-supplied path flowed into `readFileSync` unsanitized. Hardening (`:600–609`): require a `.excalidraw` extension (case-insensitive), `fs.statSync` must report a **regular file**, size capped at `MAX_SCENE_BYTES = 50MB` (`:590`); otherwise returns silently. Commit records "Re-scan: 0 issues." Recent-file opens are additionally constrained — `strl:open-recent` only honors paths already in main's recents list (`main.ts:718–725`).

### 7.5 Supply-chain policy (pre-install + post-install)

Two-layer model (from the standing STRL policy; both layers required):

**Layer 1 — PRE-INSTALL (block malware before lifecycle scripts run), enforced locally:**
- **Aikido Safe Chain** (v1.5.2, global, active) wraps npm/yarn/pnpm/npx as shell functions, checking each package against Aikido Intel in real time (blocks known-malicious / typosquat / too-new). Verified blocking live.
- Never a bare install; hardened form `pnpm install --frozen-lockfile --ignore-scripts`. pnpm blocks build scripts by default unless allowlisted in `package.json` → `pnpm.onlyBuiltDependencies`, kept minimal: **`esbuild` and `electron` only** (`package.json:91–94`). Every other package (e.g. `jspdf`) installs script-free.
- **`.npmrc` cooldown:** `minimum-release-age=1440` (24 h). Also `save-exact=true`, `node-linker=hoisted` (Electron/electron-builder need a flat tree; excalidraw-app uses `vite` as a phantom dep), no custom/unknown registries.

**Layer 2 — POST-INSTALL (catch known vulns + code issues):**
- SCA: `pnpm audit` + Snyk SCA. SAST: Snyk Code. Snyk **org = `syntheros`** (org id `95a58957-6a13-44d0-87da-a32a62e002cd`) — the only org with the Snyk Code (SAST) add-on; the personal org silently skips SAST.
- **Monorepo gotcha:** `snyk test` on the full hoisted root 400s ("request too large"); scan **per-workspace** (`--file=excalidraw-app/package.json` / `desktop/package.json`). Build artifacts (`build/`, `dist/`, `dist-installers/`, `renderer/`) excluded from SAST to avoid duplicate findings.
- Known residual `pnpm audit` highs are accepted as build-tooling only (vite-plugin-html, sass) + `lodash-es` via mermaid — cleared on upstream sync.

### 7.6 CI workflows

#### `.github/workflows/desktop-build.yml` — installer build matrix
- Trigger: `workflow_dispatch` only (tag-push trigger present but commented). `permissions: contents: read`.
- Matrix: ubuntu→`dist:linux` (AppImage+deb), windows→`dist:win` (NSIS+portable .exe), macos→`dist:mac` (dmg x64+arm64). `fail-fast: false`, 45-min timeout.
- corepack pins **pnpm@10.34.1** *before* setup-node (so `cache: pnpm` resolves), **Node 22**. All third-party actions are **SHA-pinned** (checkout/setup-node/cache/upload-artifact pinned to full commit SHAs with `# v4` comments).
- Install is `pnpm install --frozen-lockfile`; `electron` postinstall runs here via the `onlyBuiltDependencies` allowlist (no rebuild step).
- **SHA-256 sidecars** (`:107–114`): after each build, a cross-platform `node` one-liner emits a `<file>.sha256` next to every `.AppImage/.deb/.exe/.dmg`, uploaded with the installers (`:122–127`). `bash` shell unifies the loop across win/mac/linux (Git-Bash on Windows).
- **NO publish, NO GitHub release, NO auto-update** — electron-updater is intentionally absent and a `publish:` block must not be added (header comment `:8–10`). Builds are **UNSIGNED**: `CSC_IDENTITY_AUTO_DISCOVERY: "false"` (`:46–47`) forces a clean unsigned build; signing/notarization are HELD with the exact secret names documented inline (`:96–99`).

#### `.github/workflows/security-scan.yml` — post-install scanning in CI
- Triggers: dispatch, push to `master`/`feat/desktop-app`, all PRs, and weekly cron `0 6 * * 1`. `permissions: contents: read`.
- **`audit` job:** `pnpm audit --prod --audit-level=high` — always runs, **no secrets**, `continue-on-error: true` (informational).
- **`snyk` job:** Snyk SCA (`snyk test --all-projects`), Snyk Code SAST (`snyk code test`), and `snyk monitor`, all `--org=syntheros --severity-threshold=high` + `continue-on-error`. **Gated on `SNYK_TOKEN`**: the secret is mapped into `env.SNYK_TOKEN` (`:54–56`) specifically so step-level `if: ${{ env.SNYK_TOKEN != '' }}` conditions can reference it (secrets can't be used directly in `if:`); when the token is absent every Snyk step is skipped and a "Notice (no token)" step prints how to enable it. Findings **report, do not gate**. A comment (`:90–92`) records the monorepo-root 400 workaround (scan per-workspace).

This pairs the post-install half (CI) with the pre-install half (Aikido Safe Chain, local dev).

---

## 8. Master file index

Every customized/added file across all areas. **Type:** `added-strl` (net-new STRL file) · `app-edit` (`excalidraw-app/`, low merge risk) · `library-edit` (`packages/*` or shared `scripts/*`, higher merge risk) · `config-edit` (root/build config). **Merge-risk** is the practical conflict likelihood on an upstream sync.

### Root config & tooling

| Path | What STRL changed | Type | Merge-risk |
|---|---|---|---|
| `.npmrc` | pnpm config: `node-linker=hoisted`, `link-workspace-packages=true`, `strict-peer-dependencies=false`, `minimum-release-age=1440`, `save-exact` | config-edit | Low |
| `pnpm-workspace.yaml` | New workspace manifest: `excalidraw-app`, `desktop`, `packages/*` (replaces yarn workspaces; adds `desktop/`, drops `examples/*`) | added-strl | Low |
| `package.json` | `packageManager pnpm@10.34.1`; scripts yarn→pnpm; `pnpm` block (`vite-plugin-html>vite` + `strip-ansi` overrides, `onlyBuiltDependencies: [esbuild, electron]`); removed `@types/socket.io-client` + `examples/*` workspaces; renamed `strl-ideate-monorepo` | config-edit | Medium |
| `pnpm-lock.yaml` | Added; replaces deleted `yarn.lock`; jspdf@4.2.1 subtree | added-strl | Medium |
| `.env.production` | Empties all backend identifiers; tracking off; PWA stays on | config-edit | Low |
| `.env.development` | Empties backend identifiers; `VITE_APP_PORT=3001`; tracking off | config-edit | Low |
| `.env.desktop` | NEW (repo root): `MODE=production`, empties backends, `VITE_APP_DISABLE_PWA=true`, `VITE_APP_DESKTOP=true`, tracking off | added-strl | Low |
| `vercel.json` | Stripped `Access-Control-Allow-Origin: excalidraw.com` (×2), `/webex/*` + `vscode.excalidraw.com` redirects; `installCommand` yarn → `pnpm --frozen-lockfile` | config-edit | Low |
| `CLAUDE.md` | STALE: still documents yarn commands + Yarn workspaces; should reference pnpm | config-edit | Low |

### `excalidraw-app/` (the SPA)

| Path | What STRL changed | Type | Merge-risk |
|---|---|---|---|
| `excalidraw-app/App.tsx` | Local-first rewrite (`initializeScene` localStorage + `#url=` only; local-only `loadImages`; removed all collab state/effects/handlers/render + community command-palette items); `#6` hashchange image fix (`:333`); mounts `StrlExportButton` in `renderTopRightUI` (`:614–624`); trims `UIOptions.canvasActions.export` to `{saveFileToDisk:true}` (`:604`); calls `useDesktopIntegration` (`:222`) | app-edit | **High** |
| `excalidraw-app/index.tsx` | Removed `import "../excalidraw-app/sentry"` side-effect import | app-edit | Low |
| `excalidraw-app/index.html` | STRL-Ideate title/meta/og/twitter; dark-mode early-paint default + one-time `strl-theme-dark-default-v1` migration; SVG favicon link; removed canonical/og-url/collab wording; local `/og-image.png`; desktop-gated Google-fonts preconnects (`:99–104`); analytics loader EJS-gated (`:208–246`); removed Excalidraw+ auto-redirect (`:108`) | app-edit | Medium |
| `excalidraw-app/vite.config.mts` | STRL-Ideate PWA manifest; env-gated `VitePWA` disable (`:153–157`); `react-vendor` manualChunk; sourcemap off (`:131–132`); removed Sitemap plugin (`:137`) + PWA `screenshots[]` (`:286–287`) | app-edit | Medium |
| `excalidraw-app/package.json` | Renamed `strl-ideate-app`; scripts yarn→pnpm; added `build:desktop` (`vite build --mode desktop`, `:42`); removed `firebase`/`socket.io-client`/`@excalidraw/random-username`; added `jspdf@4.2.1` (`:32`) | config-edit | Medium |
| `excalidraw-app/useHandleAppTheme.ts` | Initial `appTheme` + `editorTheme` fall back to `THEME.DARK` (dark default, `:18`,`:21`) | app-edit | Medium |
| `excalidraw-app/components/TopErrorBoundary.tsx` | Removed `@sentry/browser`; logs via `console.error`; bug link retargeted to `vader-syntheros-0x127` fork; dropped `sentryEventId` + `trackedToSentry` paragraph | app-edit | Low |
| `excalidraw-app/components/AppMainMenu.tsx` | Dropped live-collab entry + `onCollabDialogOpen`/`isCollaborating`/`isCollabEnabled` props; removed `Socials` + separator; gated `LoadScene`/`SaveToActiveFile` on `!window.strlDesktop` (`:18–32`) | app-edit | Medium |
| `excalidraw-app/components/AppWelcomeScreen.tsx` | Dropped collab center-menu item + props + Plus heading/Sign-up; added desktop recent-files quick-open (`getRecentFiles`/`onRecentFiles`/`openRecent`, `:58–67`), guarded on `window.strlDesktop` | app-edit | Medium |
| `excalidraw-app/components/AppFooter.tsx` | Removed Plus account check (`93c2969b`) then `EncryptedIcon`/E2E shield entirely (`504f36e5`); now only dev visual-debugger toggle | app-edit | Low |
| `excalidraw-app/components/strlExport.ts` | NEW shared scene→bytes pipeline (`resolveScene`, `sceneToPng/Svg/Pdf`, `sceneToExportBytes` dispatcher, `triggerDownload`); PDF via jsPDF raster | added-strl | Low |
| `excalidraw-app/components/StrlExportButton.tsx` | NEW on-canvas Export dropdown (PNG/SVG/PDF) → `sceneToExportBytes` + `triggerDownload` | added-strl | Low |
| `excalidraw-app/components/StrlExportButton.scss` | NEW styles themed off Excalidraw CSS variables (light/dark) with fallbacks | added-strl | Low |
| `excalidraw-app/useDesktopIntegration.ts` | NEW guarded renderer hook: dirty tracking (`onIncrement` durable + `getSceneElementsIncludingDeleted`), save/export, open w/ `confirmOpened`, save-and-report round-trip, `ready()` handshake; no-op on web | added-strl | Low |
| `excalidraw-app/strl-desktop.d.ts` | NEW renderer-side types for `window.strlDesktop` + `window.__strlIsDirty` (incl. `StrlMenuAction`, `saveFile` signature) | added-strl | Low |
| `excalidraw-app/app_constants.ts` | Removed `COOKIES.AUTH_STATE_COOKIE` + `isExcalidrawPlusSignedUser`; `FIREBASE_STORAGE_PREFIXES`/`ROOM_ID_BYTES` now orphaned dead code (kept) | app-edit | Low |
| `excalidraw-app/vite-env.d.ts` | Dropped `PLUS_*` env type declarations | app-edit | Low |

### `excalidraw-app/` deletions (gone at HEAD)

| Path | What STRL changed | Type | Merge-risk |
|---|---|---|---|
| `excalidraw-app/collab/Collab.tsx` · `Portal.tsx` · `CollabError.{tsx,scss}` | Deleted — entire real-time collab engine | app-edit | High (on collab upstream changes) |
| `excalidraw-app/share/ShareDialog.{tsx,scss}` · `QRCode.tsx` · `qrcode.chunk.ts` | Deleted — shareable-link / room-invite UI | app-edit | Medium |
| `excalidraw-app/data/firebase.ts` | Deleted — Firebase scene + image storage | app-edit | Medium |
| `excalidraw-app/data/index.ts` | Deleted — backend export/import + collab-link helpers | app-edit | Medium |
| `excalidraw-app/tests/collab.test.tsx` | Deleted | app-edit | Low |
| `excalidraw-app/components/AI.tsx` | Deleted — text-to-diagram AI dialog wiring | app-edit | Medium |
| `excalidraw-app/sentry.ts` | Deleted — Sentry init | app-edit | Low |
| `excalidraw-app/ExcalidrawPlusIframeExport.tsx` | Deleted — Excalidraw+ iframe export | app-edit | Low |
| `excalidraw-app/components/ExportToExcalidrawPlus.tsx` | Deleted — cloud export action | app-edit | Low |
| `excalidraw-app/components/ExcalidrawPlusPromoBanner.tsx` | Deleted — top-right Plus promo | app-edit | Low |
| `excalidraw-app/components/AppSidebar.{tsx,scss}` | Deleted — Plus comments/presentation promos | app-edit | Low |
| `excalidraw-app/components/EncryptedIcon.tsx` | Deleted — advertised misleading E2E + `plus.excalidraw.com` link (`504f36e5`) | app-edit | Low |

### `packages/*` (the library — HIGHER merge risk)

| Path | What STRL changed | Type | Merge-risk |
|---|---|---|---|
| `packages/excalidraw/components/ExcalidrawLogo.tsx` | Replaced Excalidraw glyph with STRL sparkle mark + "STRL-Ideate" wordmark (monochrome `currentColor`); kept `.ExcalidrawLogo-icon/-text` classes | library-edit | **High** |
| `packages/excalidraw/components/HelpDialog.tsx` | Deleted the external-links `Header` (Docs/Blog/GitHub/YouTube) + unused icon imports; dialog now only shows shortcuts (`:18`) | library-edit | **High** |
| `packages/excalidraw/locales/en.json` | Rebranded 5 visible strings (watermark ×2, library, installPWA, invalidSceneUrl) | library-edit | **High** |
| `packages/excalidraw/components/__snapshots__/MobileMenu.test.tsx.snap` | Refreshed for the new welcome-screen logo SVG | library-edit | **High** |
| `packages/excalidraw/fonts/ExcalidrawFontFace.ts` | `ASSETS_FALLBACK_URL` folds to `""` when `VITE_APP_DESKTOP` (esm.sh dropped from bundle, `:11–21`); `createUrls` skips remote fallback (`:176–178`) | library-edit | **High** |
| `packages/excalidraw/vite-env.d.ts` | Declared `VITE_APP_DESKTOP` (and `VITE_APP_DISABLE_SENTRY`) env-var types | library-edit | Medium |
| `scripts/woff2/woff2-vite-plugins.js` | Added `isDesktop` (`mode==="desktop"`) branch: one local `@font-face` (no DO CDN), injects `EXCALIDRAW_ASSET_PATH=window.origin`, no cross-origin preloads; web path unchanged | library-edit | **High** |

### `desktop/` (NEW Electron workspace — zero merge risk)

| Path | What STRL changed | Type | Merge-risk |
|---|---|---|---|
| `desktop/src/main.ts` | Electron main: `app://` privileged protocol (streaming `net.fetch`, `path.relative` traversal guard, SPA fallback, CSP-on-document), window/state, native menu, document model (activeFilePath/dirty/recents/title/autosave/Save-vs-Save-As), close/new save round-trip, full `strl:*` IPC, single-instance, navigation hardening, `.excalidraw`+regular-file+50 MB file-open guard | added-strl | Zero |
| `desktop/src/preload.ts` | `contextBridge` typed `window.strlDesktop` API over every `strl:*` channel; `contextIsolation`+`sandbox` on; no Node internals leak | added-strl | Zero |
| `desktop/electron-builder.yml` | Packaging: `appId com.strl.ideate`, `asar:true`, `fileAssociations(.excalidraw)`, linux AppImage+deb, win nsis+portable, mac dmg x64/arm64 hardenedRuntime; signing/notarize HELD | added-strl | Zero |
| `desktop/assets/entitlements.mac.plist` | Minimal hardened-runtime entitlements (`allow-jit`/`unsigned-exec-mem`/`disable-library-validation`); NO `app-sandbox` so native file dialogs work | added-strl | Zero |
| `desktop/assets/icon.png` | STRL mark (512×512); electron-builder derives `.ico`/`.icns`; byte-identical to `android-chrome-512x512.png` | added-strl | Zero |
| `desktop/package.json` | Electron 42.3.0 + electron-builder 26.8.1; `build:main`/`build:renderer`/`prepackage`/`dist:linux|win|mac`/`start`/`start:dev`; name `strl-ideate-desktop`; de-leaked description | added-strl | Zero |
| `desktop/tsconfig.json` | Separate `tsc` config for main/preload (`module node16`, ES2022, strict, `types:[node]`, no DOM) — NOT covered by root typecheck | added-strl | Zero |
| `desktop/renderer/index.html` | Built desktop renderer; its 3 minified inline scripts are the source of the verified CSP hashes (build artifact) | added-strl | Zero |

### Brand assets (repo-root `public/`)

| Path | What STRL changed | Type | Merge-risk |
|---|---|---|---|
| `public/favicon.svg` | Canonical STRL sparkle vector (256×256, `#4f46e5` tile, white sparkles) — **source of truth** for all raster brand assets | added-strl | Low |
| `public/favicon.ico` | Regenerated STRL mark, multi-res 16/32/48/64 | added-strl | Low |
| `public/favicon-16x16.png` · `favicon-32x32.png` | Regenerated STRL mark | added-strl | Low |
| `public/apple-touch-icon.png` | Regenerated STRL mark (180×180) | added-strl | Low |
| `public/android-chrome-192x192.png` · `android-chrome-512x512.png` | Regenerated STRL mark (512 is byte-identical to `desktop/assets/icon.png`) | added-strl | Low |
| `public/maskable_icon_x192.png` · `maskable_icon_x512.png` | Regenerated full-bleed maskable STRL mark | added-strl | Low |
| `public/og-image.png` | New 1200×630 social-preview (mark + wordmark + tagline) | added-strl | Low |

### CI workflows (NEW)

| Path | What STRL changed | Type | Merge-risk |
|---|---|---|---|
| `.github/workflows/desktop-build.yml` | Manual-dispatch matrix (ubuntu/windows/macos) → unsigned installer artifacts + SHA-256 sidecars; corepack pnpm 10.34.1 + Node 22; SHA-pinned actions; NO publish/release/auto-update | added-strl | Zero |
| `.github/workflows/security-scan.yml` | `pnpm audit` (always, no secrets) + Snyk SCA/Code/monitor (org `syntheros`) gated on `SNYK_TOKEN` via env-mapping; report-not-gate | added-strl | Zero |

### Deleted directories

| Path | What STRL changed | Type | Merge-risk |
|---|---|---|---|
| `dev-docs/` | Deleted entire Docusaurus dev-docs site | config-edit | Low |
| `firebase-project/` | Deleted Firebase project config | config-edit | Low |
| `examples/` | Deleted from git (CVE/audit noise) + dropped from workspaces; stray untracked copies may remain in the working tree | config-edit | Low |

---

## 9. Desktop IPC contract

Every `strl:*` channel. The preload (`desktop/src/preload.ts`) exposes all of these as the typed `window.strlDesktop` API via `contextBridge.exposeInMainWorld`; `contextIsolation`+`sandbox` stay on. Renderer-side types are duplicated in `excalidraw-app/strl-desktop.d.ts` (the `Window.strlDesktop?` global) since the app can't import from the desktop workspace.

| Channel | Mechanism | Direction | Payload | Purpose |
|---|---|---|---|---|
| `strl:menu` | `webContents.send` / `onMenu` | main → renderer | `MenuAction` (`new`/`save`/`save-as`/`export-png`/`export-svg`/`export-pdf`) | native File-menu action (also autosave → `"save"`) |
| `strl:open-file` | send / `onOpenFile` | main → renderer | `{ name, contents, path }` | deliver a `.excalidraw` to load (CLI / file-assoc / Open…/recent) |
| `strl:renderer-ready` | `ipcRenderer.send` | renderer → main | — | renderer mounted; flush buffered opens + seed recents |
| `strl:opened` | send / `confirmOpened` | renderer → main | `path: string` | renderer confirmed load → adopt as active document |
| `strl:save-file` | `invoke`/`handle` | renderer → main | `{ data, suggestedName, extension, saveAs? }` → `{ ok, canceled?, filePath?, error? }` | write a scene/export to disk (in-place or dialog) |
| `strl:set-dirty` | send | renderer → main | `dirty: boolean` | drive title `●` marker (fallback mirror) |
| `strl:save-and-report` | send / `onSaveAndReport` | main → renderer | `{ token, saveAs }` | ask renderer to save and report back (close/new) |
| `strl:save-done:${token}` | dynamic `once` / `reportSaveDone` | renderer → main | `{ ok: boolean }` | token-correlated reply resolving `requestSaveScene` |
| `strl:get-recent` | `invoke`/`handle` | renderer → main | → `string[]` | fetch recent-files list (welcome screen) |
| `strl:recent-files` | send / `onRecentFiles` | main → renderer | `string[]` | push recent-files updates |
| `strl:open-recent` | send / `openRecent` | renderer → main | `filePath: string` | open a file (only if in main's recents) |

Plus the **synchronous (non-IPC)** `window.__strlIsDirty` flag the close guard reads via `executeJavaScript` (`main.ts:543–550`).

---

## 10. Build & run quick-reference

### Web (root + `excalidraw-app/`)

| Command (root) | Delegates to | Effect |
|---|---|---|
| `pnpm start` | `excalidraw-app` `start` → `vite` | dev server (port from `VITE_APP_PORT`; **defaults to :3001** via `.env.development`) |
| `pnpm build` | `build:app` + `build:version` | production web build into `excalidraw-app/build` (PWA ON) |
| `pnpm build:app` | `cross-env VITE_APP_GIT_SHA=… VITE_APP_ENABLE_TRACKING=true vite build` | standard web build |
| `pnpm build:app:docker` | `cross-env VITE_APP_DISABLE_SENTRY=true vite build` | docker variant |
| `pnpm build:packages` | builds each `@excalidraw/*` ESM in order | needed before publishing; **still shells out to `yarn gen:types`** |
| `pnpm build:preview` | `vite preview` on :5000 | build + preview |
| `pnpm start:production` | `http-server build` on :5001 | serve the prod build |
| `pnpm test:typecheck` | root `tsc` | typechecks `packages` + `excalidraw-app` **only** (NOT `desktop/`) |
| `pnpm test:update` | `vitest --update --watch=false` | run all tests + update snapshots |
| `pnpm fix` | prettier + eslint `--fix` | auto-fix formatting/lint |

### Desktop (`desktop/`) — run from `desktop/`

| Command | What it does |
|---|---|
| `pnpm build:main` | `tsc -p tsconfig.json` — compiles `src/main.ts` + `src/preload.ts` to `dist/` (module `node16`, target ES2022) |
| `pnpm build:renderer` | `pnpm -C ../excalidraw-app build:desktop`, then `rm -rf renderer` and copy `excalidraw-app/build` → `desktop/renderer` |
| `pnpm prepackage` | `build:main` + `build:renderer` |
| `pnpm start` | `build:main && electron .` — runs against the **prebuilt** `excalidraw-app/build` over `app://` |
| `pnpm start:dev` | `cross-env STRL_DESKTOP_DEV_URL=http://localhost:3000 electron .` — points at the live Vite dev server (+ DevTools) |
| `pnpm dist:linux` / `dist:win` / `dist:mac` | `prepackage` + `electron-builder --<os>` → installers in `desktop/dist-installers` |

`excalidraw-app/package.json:42` `build:desktop` = `cross-env VITE_APP_DISABLE_PWA=true vite build --mode desktop` — the only command that produces the desktop renderer.

### Per-platform packaging constraints

| Target | Runner | Notes |
|---|---|---|
| Linux AppImage + deb | `ubuntu-latest` | native |
| Windows NSIS + portable .exe | `windows-latest` | cross-build on Linux needs wine for rcedit |
| macOS dmg (x64 + arm64) | `macos-latest` | only buildable on macOS (`hdiutil`/`dmgbuild`) |

### Gotchas (read before building/typechecking)

1. **Dual-vite typecheck trap.** Root `pnpm test:typecheck` covers only `packages` + `excalidraw-app`; **`desktop/` is NOT covered.** A type error in `desktop/src/*.ts` passes root typecheck and only surfaces on `pnpm -C desktop build:main`. The two tsconfigs use incompatible module systems (root `ESNext`/DOM vs desktop `node16`/node) — **typecheck desktop separately**; don't fold it into the root program.
2. **esbuild/electron rebuild after install.** Both run their postinstall only because they're in `pnpm.onlyBuiltDependencies`. If a tree was installed before that allowlist existed or the native binary/arch is stale, builds fail with a host/binary mismatch — fix with `pnpm rebuild esbuild` (or `pnpm install` again).
3. **`ELECTRON_RUN_AS_NODE`.** On clean CI no workaround is needed. On a **local dev host** where it's exported, `electron .` launches Electron as plain Node (no window). Locally prefix with `env -u ELECTRON_RUN_AS_NODE pnpm start`.
4. **Dev-server port mismatch (3000 vs 3001).** `desktop start:dev` hardcodes `:3000` but `.env.development` sets `VITE_APP_PORT=3001`, so `pnpm start` serves on **:3001** → blank desktop window. Either `VITE_APP_PORT=3000 pnpm start` or set `STRL_DESKTOP_DEV_URL=http://localhost:3001`.
5. **Stale `yarn` in package build scripts.** `packages/*/package.json` `build:esm` still calls `yarn gen:types`; if yarn is uninstalled the package ESM build's type-gen step fails.
6. **CLAUDE.md commands are stale** (documents yarn / Yarn workspaces) — use the `pnpm` equivalents.

---

## 11. Held / deferred items

| Item | State | How to enable |
|---|---|---|
| **Code signing** | HELD — builds are valid **unsigned** installers/dmg; `CSC_IDENTITY_AUTO_DISCOVERY: "false"` in CI | provide `CSC_*` env (cert) — env-only, no YAML change |
| **macOS notarization** | HELD — `notarize: false` (`electron-builder.yml`) | flip to `{ teamId: … }` + `APPLE_*` env |
| **Auto-update** | Intentionally absent — `electron-updater` not installed; CI has **no** `publish:` block (do not add one) | out of scope for the local-first product |
| **Windows arm64** | Commented out in `win.target` | uncomment + add a runner |
| **Crisp `icon.ico` / `.icns`** | Single `assets/icon.png` auto-converted | supply explicit per-resolution `.ico`/`.icns` |
| **`gen:types` on pnpm** | `build:esm` still shells `yarn gen:types` | migrate to `pnpm gen:types` |
| **Dead consts cleanup** | `FIREBASE_STORAGE_PREFIXES` / `ROOM_ID_BYTES` orphaned in `app_constants.ts` | safe to delete (keep `LOCAL_STORAGE_COLLAB`, still live) |
| **PDF vector export** | PDF is **raster** (jsPDF embeds a PNG; text not selectable) | a vector path would need a different exporter |
| **Stale `CLAUDE.md`** | documents yarn / Yarn workspaces | update to pnpm |
| **Non-English rebrand** | only `en.json` rebranded; other locales still say "Excalidraw" | sync translations from upstream |

---

## 12. Maintenance playbook

### 12.1 Upstream sync

1. **Harden first.** Ensure Aikido Safe Chain is active; never bare-install. Use `pnpm install --frozen-lockfile --ignore-scripts` (only `esbuild`/`electron` are allowed build scripts).
2. `git fetch upstream`.
3. `git checkout upstream-sync && git reset --hard upstream/master` to stage upstream's latest.
4. Create a topic branch off `master` and merge/rebase `upstream-sync` into it. Conflicts will concentrate in: `excalidraw-app/App.tsx` (`renderTopRightUI`, `UIOptions.canvasActions.export`, collab paths — always resolve toward the STRL local-first version) and the **library** files (`ExcalidrawLogo.tsx`, `HelpDialog.tsx`, `en.json`, `MobileMenu.test.tsx.snap`, `ExcalidrawFontFace.ts`, `vite-env.d.ts`, `scripts/woff2/woff2-vite-plugins.js`). Every STRL hunk is `// STRL:`-marked.
5. **Re-apply the two theme defaults if `index.html`'s `getTheme()` or `useHandleAppTheme.ts` were rewritten** (`|| "dark"` / `THEME.DARK`), and confirm the one-time migration block survived.
6. **Gate:** `pnpm test:typecheck` → `pnpm -C desktop build:main` (desktop is not in the root typecheck) → `pnpm build:packages` (esbuild needs `gen:types`) → `pnpm test:update`. If the logo SVG changed, the `MobileMenu.test.tsx.snap` will need updating.
7. **Verify the desktop bundle still has no remote refs** and the CSP inline-script hashes still match (§12.3) — `STRL_SMOKE=1` desktop run should print `{"hasEditor":true,"dark":true}`.
8. **Post-install scan** per-workspace with Snyk (`--org=syntheros`, `--file=excalidraw-app/package.json` and `--file=desktop/package.json`; the full root 400s) + `pnpm audit`.
9. PR the topic branch into `master`.

### 12.2 Regenerate brand assets

`public/favicon.svg` is the single vector source of truth; **no generation script is committed.** Use the ImageMagick recipe in §4.3 to rasterize all favicons/PWA icons + the desktop icon. The `og-image.png` (1200×630) is composited separately (mark + wordmark + tagline), not a pure resize. **If the mark design changes, edit BOTH `favicon.svg` AND the two `<path d=…>` values in `packages/excalidraw/components/ExcalidrawLogo.tsx`** (independent copies of the same geometry), then refresh the `MobileMenu.test.tsx.snap` snapshot.

### 12.3 Recompute the desktop CSP inline-script hashes

The three `sha256-…` hashes in `desktop/src/main.ts:35–49` are over the **post-build minified** inline `<script>` bodies of `desktop/renderer/index.html` — **not** the source. They drift if you edit the three inline scripts (dark-mode early-paint, `EXCALIDRAW_ASSET_PATH`, `window.name`), change the woff2 desktop-font injection, or change the minifier. To recompute:

1. Build the desktop renderer: `pnpm -C excalidraw-app build:desktop` and copy to `desktop/renderer` (or `pnpm -C desktop build:renderer`).
2. For each inline `<script>` body in `desktop/renderer/index.html`, compute `base64(sha256(body))`.
3. Replace the three `'sha256-…'` tokens in `main.ts`.
4. Run `STRL_SMOKE=1` desktop; a mismatch blocks the inline scripts and fails the editor mount (`{"hasEditor":false}` or `dark:false`).

### 12.4 Add an export format

1. Extend `StrlExportFormat` (`excalidraw-app/components/strlExport.ts:73`) and add a `case` to the `sceneToExportBytes` switch (`:80–106`) returning `{ data, extension, mimeType }`.
2. Add a `sceneToXxx(scene)` helper if non-trivial (model it on `sceneToPdfBytes`).
3. Add the menu entry to `StrlExportButton.tsx` (`:82–94`) — the web sink picks it up automatically.
4. Add the desktop menu item: a `sendMenu("export-xxx")` entry in `desktop/src/main.ts:356–361`, the `StrlMenuAction` union in `excalidraw-app/strl-desktop.d.ts` + `desktop/src/preload.ts`, and a `handleMenu` case in `useDesktopIntegration.ts:96–120`.

### 12.5 Add an IPC channel

1. **Main side** (`desktop/src/main.ts`): `ipcMain.handle("strl:foo", …)` (request/response) or `webContents.send("strl:foo", …)` (push); decide direction.
2. **Preload** (`desktop/src/preload.ts`): expose a typed method on the `strlDesktop` object via `contextBridge` (`ipcRenderer.invoke`/`send`/`on` as appropriate). Keep the surface minimal — no Node internals.
3. **Renderer types** (`excalidraw-app/strl-desktop.d.ts`): add the method to the `Window.strlDesktop?` interface (the app can't import from the desktop workspace, so types are duplicated).
4. **Renderer consumer** (`excalidraw-app/useDesktopIntegration.ts`): register the handler **before** `desktop.ready()` so it's live when main flushes buffered events.
5. Update the **IPC contract table** in §9 of this doc.
