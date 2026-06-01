# CLAUDE.md

> **STRL-Ideate fork.** This repo is a downstream, local-first fork of Excalidraw rebranded as STRL-Ideate (collaboration/AI/backend stripped, + an Electron desktop app). **Every divergence from upstream is documented in [docs/STRL-CUSTOMIZATIONS.md](docs/STRL-CUSTOMIZATIONS.md)** — read it before editing or syncing upstream. Customizations are marked in code with `// STRL:`.

## Supply-chain gate (READ FIRST — non-negotiable)

This project enforces a strict supply-chain gate. **Before any `pnpm install`, build, or run — every time, not only when deps change — run Snyk SCA + Code (org `syntheros`) and use the hardened install path.** Full details: [docs/STRL-CUSTOMIZATIONS.md §7](docs/STRL-CUSTOMIZATIONS.md).

- **Provenance**: registry must be `https://registry.npmjs.org/`; Aikido Safe Chain wraps pnpm/npm (verify `type pnpm` is a shell function, not the bare binary).
- **Install**: plain **`pnpm install`** run top-level so Safe Chain vets every package. `.npmrc` `minimum-release-age=1440` blocks versions <24 h old (pin only older); `onlyBuiltDependencies=[esbuild,electron]` gates lifecycle scripts. **Never** `--ignore-scripts`, and never a bare install that bypasses the Safe Chain wrapper.
- **Re-verify after every dep change**: typecheck → node smokes → vitest → app build → (web CSP: headless-chrome check) → AppImage + boot smoke + CDP 7/7. `.snyk` holds documented, time-boxed acceptances.

## Project Structure

A **pnpm 10 workspace** monorepo (migrated from yarn 1):

- **`packages/excalidraw/`** — main React component library (mostly upstream; lint-ignored as upstream-owned)
- **`packages/strl-authoring/`**, **`packages/strl-mcp-server/`** — STRL-only AI authoring engine + MCP server
- **`excalidraw-app/`** — the local-first web app (collab/backend stripped, STRL-branded, self-hosted fonts)
- **`desktop/`** — STRL-only Electron desktop app (`app://` protocol, strict CSP, document model)
- **`packages/`** — core: `@excalidraw/common`, `@excalidraw/element`, `@excalidraw/math`, `@excalidraw/utils`

## Development Workflow

1. **Package Development**: Work in `packages/*` for editor features
2. **App Development**: Work in `excalidraw-app/` for the web app; `desktop/` for the Electron shell
3. **Testing**: Run `pnpm test:update` before committing (snapshots); typecheck `desktop/` separately (`pnpm -C desktop build:main`)
4. **Type Safety**: Use `pnpm test:typecheck` to verify TypeScript

## Development Commands

```bash
pnpm test:typecheck         # TypeScript type checking (tsc)
pnpm test:update            # Run all tests (with snapshot updates)
pnpm test:code              # ESLint 9 flat config (eslint.config.mjs), --max-warnings=0
pnpm test:other             # Prettier formatting check
pnpm fix                    # Auto-fix formatting + lint
pnpm build                  # Build the web app (excalidraw-app)
pnpm -C desktop dist:linux  # Build the desktop AppImage + deb
```

## Architecture Notes

### Package System

- Uses **pnpm 10 workspaces** (`node-linker=hoisted`, exact-pinned, supply-chain-hardened)
- Internal packages use path aliases (see `vitest.config.mts`)
- Build system uses esbuild for packages, Vite (vite 8 / Rolldown) for the app
- TypeScript throughout with strict configuration
- Lint: **ESLint 9 flat config** (`eslint.config.mjs`), scoped to STRL-owned code; upstream `packages/excalidraw|element|common|math|utils|fractional-indexing` are lint-ignored (they carry their own inline directives)
