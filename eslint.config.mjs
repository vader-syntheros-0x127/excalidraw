// STRL: ESLint 9 flat config — replaces the upstream eslintrc stack
// (.eslintrc.json + @excalidraw/eslint-config + eslint-config-react-app, all
// eslintrc-only and tied to @typescript-eslint v5, which cannot run on eslint 9).
// Built to PRESERVE the prior rule set (not add new "recommended" presets) so the
// migration doesn't flag previously-clean code. See docs/STRL-CUSTOMIZATIONS.md §7.4.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import importPlugin from "eslint-plugin-import";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  // ── global ignores (was .eslintignore) ───────────────────────────────────
  {
    ignores: [
      "**/node_modules/**",
      "**/build/**",
      "**/dist/**",
      "**/dev-dist/**",
      "**/coverage/**",
      "**/dist-installers/**",
      "desktop/renderer/**",
      "desktop/build/**",
      "packages/excalidraw/types/**",
      "examples/**/public/**",
      "public/workbox/**",
      "**/*.min.js",
      "**/vendor/**",
      // STRL: lint the code WE own. The upstream @excalidraw/* packages are
      // upstream's to lint (we didn't write them; they carry their own inline
      // eslint-disable directives); linting them here only produces noise.
      // Our own packages (strl-authoring, strl-mcp-server) are NOT excluded.
      "packages/excalidraw/**",
      "packages/element/**",
      "packages/common/**",
      "packages/math/**",
      "packages/utils/**",
      "packages/fractional-indexing/**",
    ],
  },

  // ── base: core recommended + TS parser (NOT the heavy TS recommended set) ──
  js.configs.recommended,

  {
    files: ["**/*.{js,mjs,cjs,jsx,ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
        ...globals.jest,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      react,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
      import: importPlugin,
    },
    settings: {
      react: { version: "detect" },
      "import/resolver": { node: { extensions: [".js", ".jsx", ".ts", ".tsx"] } },
    },
    rules: {
      // js.configs.recommended is stricter than the prior react-app base on a
      // handful of rules that don't fit this TS codebase — relax to match the
      // behavior the project linted under before (eslintrc + react-app):
      "no-redeclare": "off", // TS handles overloads / declaration merging
      "no-loss-of-precision": "off", // math/geometry uses precise long literals
      "no-prototype-builtins": "off",
      "no-async-promise-executor": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-irregular-whitespace": "off",
      "no-unsafe-finally": "off",
      "no-unsafe-optional-chaining": "off",
      "no-case-declarations": "off",
      "no-control-regex": "off",
      "no-constant-condition": ["error", { checkLoops: false }],

      // core handled by @typescript-eslint equivalents
      "no-unused-vars": "off",
      // match eslint-config-react-app's lenience (don't flag unused fn args / rest siblings)
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { args: "none", ignoreRestSiblings: true, caughtErrors: "none" },
      ],
      "no-undef": "off", // TS handles this; avoids false positives on TS globals

      // ── @excalidraw/eslint-config rule set (replicated) ──
      curly: "warn",
      "dot-notation": "warn",
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      "no-else-return": "warn",
      "no-lonely-if": "warn",
      "no-restricted-globals": "off",
      // (the upstream "no literal JSX text — use t()" i18n rule is OFF for the
      // fork: STRL-specific UI text is intentionally literal, not i18n-gated.)
      "no-restricted-syntax": "off",
      "no-unneeded-ternary": "warn",
      "no-unused-expressions": "warn",
      "no-useless-return": "warn",
      "no-var": "warn",
      "object-shorthand": "warn",
      "one-var": ["warn", "never"],
      "prefer-arrow-callback": "warn",
      "prefer-const": ["warn", { destructuring: "all" }],
      "prefer-template": "warn",

      // ── root .eslintrc.json rule set (replicated) ──
      "import/order": [
        "warn",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index", "object", "type"],
          pathGroups: [{ pattern: "@excalidraw/**", group: "external", position: "after" }],
          "newlines-between": "always-and-inside-groups",
          warnOnUnassignedImports: true,
        },
      ],
      "import/no-anonymous-default-export": "off",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", disallowTypeAnnotations: false, fixStyle: "separate-type-imports" },
      ],
      "no-restricted-imports": [
        "error",
        {
          name: "jotai",
          message:
            'Do not import from "jotai" directly. Use our app-specific modules ("editor-jotai" or "app-jotai").',
        },
      ],

      // ── react-app's load-bearing rules (replicated, not the whole preset) ──
      "react/jsx-no-target-blank": ["error", { allowReferrer: true }],
      "react/jsx-uses-vars": "warn",
      "react/jsx-uses-react": "off", // new JSX transform
      "react/react-in-jsx-scope": "off", // new JSX transform
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },

  // (upstream-package import-restriction overrides removed — packages/excalidraw,
  // element, common, math, utils, fractional-indexing are no longer linted here.)

  // ── node CLI / build / smoke scripts: console output is the whole point ──
  {
    files: ["**/*.mjs", "scripts/**/*.js", "*.config.{js,mjs,ts,cjs}", ".lintstagedrc.js"],
    rules: { "no-console": "off", "no-unused-expressions": "off" },
  },

  // ── prettier last: turn OFF eslint rules that conflict with prettier.
  // Formatting itself is checked by the separate `prettier` / `test:other`
  // tooling (not run through eslint) — so this doesn't force a prettier-3 bump.
  eslintConfigPrettier,
);
