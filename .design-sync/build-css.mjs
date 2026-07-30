/**
 * Builds the design-sync `cssEntry` and the `tokens/` payload.
 *
 * app/globals.css is Tailwind v4 *source* (`@import "tailwindcss"`), not a
 * stylesheet — shipping it raw leaves every preview card unstyled. This
 * compiles it, then prepends the --font-* bindings next/font supplies at
 * runtime in the app but that nothing defines in a static bundle.
 *
 * It also extracts the raw token blocks (:root / .dark) into a standalone
 * tokens stylesheet. Those values already reach designs inside the compiled
 * CSS; the separate file exists so the palette is legible as a palette in
 * Claude Design instead of buried in 2.8k lines of utilities. Extracted
 * rather than hand-copied so it cannot drift from globals.css.
 *
 *   node .design-sync/build-css.mjs
 *
 * Outputs (gitignored): .design-sync/.cache/chipae.css
 *                       .design-sync/.cache/tokens/chipae-tokens.css
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const SOURCE = "app/globals.css";
const TAILWIND_OUT = ".design-sync/.cache/tailwind.css";
const CSS_ENTRY = ".design-sync/.cache/chipae.css";
const TOKENS_OUT = ".design-sync/.cache/tokens/chipae-tokens.css";

mkdirSync(".design-sync/.cache/tokens", { recursive: true });

execFileSync(
  "npx",
  ["--yes", "@tailwindcss/cli@4", "-i", SOURCE, "-o", TAILWIND_OUT],
  { stdio: "inherit", shell: true }
);

const fontVars = readFileSync(".design-sync/fonts/font-vars.css", "utf8");
const compiled = readFileSync(TAILWIND_OUT, "utf8");
writeFileSync(CSS_ENTRY, `${fontVars}\n${compiled}`);
console.log(`wrote ${CSS_ENTRY} (${fontVars.length + compiled.length} bytes)`);

// Top-level :root / .dark blocks only — never @theme inline (those are
// Tailwind mappings, not tokens) and never @layer (nested braces).
const source = readFileSync(SOURCE, "utf8");
const blocks = source.match(/^(?::root|\.dark)\s*\{[^}]*\}/gm) ?? [];
if (!blocks.length) {
  throw new Error(`no :root/.dark token blocks found in ${SOURCE}`);
}
writeFileSync(
  TOKENS_OUT,
  [
    "/* Chipae design tokens — extracted from app/globals.css by",
    " * .design-sync/build-css.mjs. Do not hand-edit: change globals.css",
    " * and re-run. Dark is the shipped theme; :root holds the light",
    " * variant plus the theme-independent game art palette. */",
    "",
    fontVars.trim(),
    "",
    ...blocks,
    "",
  ].join("\n")
);
console.log(`wrote ${TOKENS_OUT} (${blocks.length} token blocks)`);
