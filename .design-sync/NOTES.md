# design-sync notes — Chipae

Project: **Chipae Design System** — https://claude.ai/design/p/c202f37f-133f-4159-b9a7-40763a784c07

## The big one: this repo is an app, not a component library

`package.json` is `private: true` with no `main`/`module`/`exports`, and
`npm run build` is `prisma generate && next build` — it emits `.next/`, not a
package entry. There is **no `dist/` and no library build command**, and adding
one is not planned. Consequences:

- **Never set `buildCmd`.** There is nothing to build before the converter.
- The converter runs with an explicit `--entry ./.design-sync/entry.tsx`.
- `exportedNames()` finds **0** PascalCase exports (no `.d.ts` tree), so the
  component list comes *entirely* from `cfg.componentSrcMap`. Adding a
  component to the sync means adding it there **and** to `entry.tsx`.
  Without a componentSrcMap entry a component silently does not appear.

### Why `entry.tsx` exists (do not delete it)

Synth-entry mode does `export * from` every file under the source root. For
Chipae that pulls in `components/shell/*`, `notification-bell`,
`friend-action-button` and `presence-*`, which import `"use server"` actions
and `server-only` — the browser IIFE would drag in Prisma, `pg` and the Pusher
client and fail to bundle. `entry.tsx` re-exports only the browser-safe
surface. Everything it exports is the real shipped component; nothing is
reimplemented.

### `cfg.srcDir` must stay `"components"`

The source-root heuristic takes the first of `src/` | `lib/` | `components/`.
Chipae has `lib/` (server code: db, actions, realtime, game rules) **and**
`components/`, so without the override it picks `lib/` and enriches nothing.

## Build inputs that must be regenerated

Run **before** every converter run:

```sh
node .design-sync/build-css.mjs
```

`app/globals.css` is Tailwind v4 *source* (`@import "tailwindcss"`), not a
stylesheet — shipping it raw leaves every card unstyled. The script compiles it
and prepends `.design-sync/fonts/font-vars.css`.

**Why the font vars matter:** compiled Tailwind emits `--font-sans:
var(--font-sans)` and nothing ever defines the right-hand side — in the app
`next/font` injects it on `<html>` at runtime. Without the prepended bindings,
all three families silently fall back and Lilita One (the display face)
disappears.

Full converter sequence:

```sh
node .design-sync/build-css.mjs
node .ds-sync/package-build.mjs --config .design-sync/config.json \
  --node-modules ./node_modules --entry ./.design-sync/entry.tsx --out ./ds-bundle
node .ds-sync/package-validate.mjs ./ds-bundle --no-render-check
```

## Fonts are vendored on purpose

The app loads Nunito Sans / Lilita One / Geist Mono via `next/font/google`, so
the repo ships no font files. `.design-sync/fonts/` holds the matching
OFL-licensed **latin** subsets from fontsource (65 KB total), wired through
`cfg.extraFonts`. To refresh:

```sh
cd .ds-sync && npm i @fontsource-variable/nunito-sans @fontsource/lilita-one @fontsource-variable/geist-mono
cp .ds-sync/node_modules/@fontsource-variable/nunito-sans/files/nunito-sans-latin-wght-normal.woff2 \
   .ds-sync/node_modules/@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2 \
   .ds-sync/node_modules/@fontsource/lilita-one/files/lilita-one-latin-400-normal.woff2 \
   .design-sync/fonts/
```

Family names in `fonts.css` are declared to match the `--font-*` bindings
(`"Nunito Sans"`, not fontsource's `"Nunito Sans Variable"`).

## `ChipaeTheme` — the provider, and why it touches the document root

Dark is the only theme Chipae ships (`app/layout.tsx` hardcodes
`class="dark"` on `<html>`). `ChipaeTheme` renders a `.dark` surface **and**
adds `dark` to `document.documentElement`. That second part is not optional:
`Dialog` and `Popover` render through a Base UI Portal attached to
`document.body`, outside the React tree, so a wrapper-only class leaves every
overlay in the light palette. Verified live — both render dark.

## Config decisions that look odd but are deliberate

- **`docsDir: ".design-sync/docs"`** (an empty dir). Auto-detection picked
  `docs/`, which matched `Input` against
  `docs/engine-reference/{godot,unity,unreal}/modules/input.md` — Godot
  input-handling docs bound to the `Input` component (`[DOCS_AMBIGUOUS]`, 3
  slug matches). Pointing at an empty dir yields 0 matches, so every component
  gets a `.prompt.md` synthesized from its JSDoc + `.d.ts`, which is accurate.
  If real per-component docs are ever written, put them there.
- **`guidelinesGlob: ["design/art-direction.md"]`**. The default globs shipped
  `docs/CLAUDE.md`, `docs/COLLABORATIVE-DESIGN-PRINCIPLE.md` and
  `docs/WORKFLOW-GUIDE.md` — internal Claude Code process docs, one of which
  points its reader at Godot engine reference. Those are actively misleading
  as "design guidelines". `art-direction.md` is the real one.
- **No `tokensGlob`**, so `tokens/` ships empty. `copyTokens` returns early
  unless `tokensPkg` is set and resolvable under `node_modules` — it is built
  for a sibling npm tokens package, which Chipae doesn't have. Tokens still
  reach designs inline via `_ds_bundle.css` in the `styles.css` closure
  (validate: `195 defined, 97 referenced`, no `[TOKENS_MISSING]`), and the
  vocabulary is enumerated in `conventions.md`. `build-css.mjs` still writes
  `.design-sync/.cache/tokens/chipae-tokens.css` as a human-readable palette.
- **`Dialog` / `Popover` pinned to `cardMode: "single"`** with viewports.
  Both portal and position `fixed`, so in a grid cell they escape.

## Verification status for the 2026-07-30 run — READ THIS

**Playwright was declined** (~200 MB), so:

- validate ran with `--no-render-check` → `[RENDER_SKIPPED]`, and there is **no
  `.render-check.json`**.
- `package-capture.mjs` cannot run, so **no grades exist** in
  `.design-sync/.cache/review/`. The `resync.mjs` verdict reports
  `stages.capture.ok: false` (exit 2) and `ok: false` for that reason alone —
  build, diff and validate all exited 0.
- `DesignSync report_validate` was **not called**; with no render check there
  are no honest counts to report.
- All 11 components were instead verified **manually**, by rendering each
  `<Name>.html` in Chrome via MCP and inspecting it. Every cell was styled,
  complete and plausible. Fonts, dark theme, seat colours, the Nuno deck and
  both overlays confirmed rendering correctly.

A future sync that installs playwright will re-verify everything from scratch,
which is correct — there is no grade state to carry forward.

## Known render warns

- `[RENDER_SKIPPED]` on every run while playwright is absent. Expected, not new.

## Re-sync risks

- **`entry.tsx` and `componentSrcMap` drift.** They are hand-maintained and
  duplicated. Rename or move a component and the sync breaks or silently drops
  it, with no error beyond a lower component count. Check `components: N`
  against the 11 expected.
- **`build-css.mjs` regex.** Token extraction matches top-level `:root` /
  `.dark` blocks with `[^}]*`, which assumes no nested braces in those blocks.
  Adding a nested at-rule inside them breaks extraction (it throws if it finds
  nothing, so it fails loudly, not silently).
- **Tailwind CLI is fetched at build time** (`npx @tailwindcss/cli@4`) —
  network-dependent, and a v4 minor bump could change output. Pinned to the v4
  major only.
- **The `"chipae"` import specifier in previews** resolves through the
  converter's alias to `--entry`. If that aliasing changes, all 11 previews
  fail to compile and every component drops to a floor card.
- **`npm ci` was not re-run** this session; `node_modules` was already present
  and the full test suite passed against it.
- **Server-coupled components are permanently out of scope** unless they are
  refactored to take data as props: all `shell/*`, `notification-bell`,
  `friend-action-button`, `presence-beacon`, `presence-dot`. `game-cover`,
  `notification-row` and `game-over-modal` are excluded only because they
  import `next/image` / `next/link`; those are plausible additions if someone
  wants to shim the Next primitives.
- **`FlightLayer`** (`components/game/card-flight.tsx`) is deliberately not
  exported — it is ref-driven animation machinery with nothing to render
  statically, not a design-system component.
