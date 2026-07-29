# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

This project runs **Next.js 16** (App Router) — newer than most training data. The bundled docs at `node_modules/next/dist/docs/` are the source of truth for Next.js APIs; App Router docs live under `01-app/`. Check them before using framework APIs you aren't certain about.

## Commands

```bash
npm run dev        # dev server at http://localhost:3000
npm run build      # production build
npm run lint       # eslint (flat config, eslint.config.mjs)
npm run typecheck  # tsc --noEmit
npm test           # vitest run (tests/ — pure logic only, no DB needed)
npm run db:dev     # local Prisma Postgres server (offline dev)
npm run db:push    # sync schema to the DB in DATABASE_URL (local dev)
npm run db:migrate # create/apply migrations (use against cloud DB)
npm run db:studio  # Prisma Studio
```

To add UI components, use the shadcn CLI: `npx shadcn add <component>`.

**Prisma 7 gotchas** (post-cutoff — see `.claude/skills/prisma-upgrade-v7`): client generates to `lib/generated/prisma` (gitignored — run `npx prisma generate` after clone); runtime needs a driver adapter (`lib/db.ts`, pg over direct TCP); the `prisma+postgres://` API URL works for CLI migrations only. `prisma migrate dev` fails (P1017) against the local `prisma dev` server — use `db:push` locally; migrations are the source of truth for the cloud DB.

## Architecture

Minimal Next.js App Router app (`app/` directory), React 19, TypeScript strict mode, path alias `@/*` → repo root.

**Styling — Tailwind CSS v4, CSS-first.** There is no `tailwind.config.*`; all theme configuration lives in `app/globals.css` via `@theme inline`. Design tokens are CSS variables in `:root` / `.dark` (oklch colors), mapped to Tailwind color/radius/font tokens (`bg-primary`, `rounded-lg`, etc.). Dark mode is the `.dark` class (`@custom-variant dark`). Change theming by editing the CSS variables, not by adding a Tailwind config.

**UI components — shadcn on Base UI, not Radix.** `components.json` uses the `base-maia` style: primitives come from `@base-ui/react` (see `components/ui/button.tsx`), and global styles import `shadcn/tailwind.css`. Icons are Remix Icon (`@remixicon/react`), not lucide. When writing new components, follow the existing pattern: `cva` variants + the `cn()` helper from `lib/utils.ts` + `data-slot` attributes.

**Fonts.** `app/layout.tsx` loads Nunito Sans as `--font-sans` (the default sans/heading font) and Geist Mono as `--font-geist-mono`; Geist Sans is loaded but not the default.

---

# Game Studio — Agent Architecture

This repo includes [Claude Code Game Studios](https://github.com/Donchitos/Claude-Code-Game-Studios): game development managed through coordinated Claude Code subagents (`.claude/agents/`), 73 workflow skills (`.claude/skills/`), validation hooks, and path-scoped rules. Type `/` to see the skills; run `/start` for guided onboarding or `/help` for the skill catalog.

## Technology Stack

- **Engine**: Web browser — Next.js 16 + React 19 (this repo). No Godot/Unity/Unreal.
- **Language**: TypeScript (strict)
- **Rendering**: Choose per game — Canvas 2D, WebGL/WebGPU (e.g. Three.js/PixiJS/Phaser), or DOM/CSS for UI-driven games. Record the decision in `.claude/docs/technical-preferences.md`.
- **Version Control**: Git with trunk-based development

> **Engine specialists**: The `.claude/agents/` set includes Godot, Unity, and Unreal specialists from the template. They are **not applicable** to this web project — do not invoke them. Use the general programming agents (gameplay-programmer, ui-programmer, engine-programmer, etc.) with the web stack above.

## Directory Mapping (web project)

The studio docs and skills reference a generic layout. In this repo it maps as:

| Template path | This repo |
|---|---|
| `src/` (game code) | `lib/game/` (game logic — engine-agnostic, data-driven), `components/game/` (React/canvas components), `app/` (routes) |
| `assets/` | `public/` |
| `tests/` | `tests/` |
| `design/`, `docs/`, `production/`, `prototypes/` | same paths at repo root |

Gameplay values must be data-driven (config/JSON in `lib/game/data/`), never hardcoded. New systems get an ADR in `docs/architecture/`.

## Project Structure

@.claude/docs/directory-structure.md

## Technical Preferences

@.claude/docs/technical-preferences.md

## Coordination Rules

@.claude/docs/coordination-rules.md

## Collaboration Protocol

**User-driven collaboration, not autonomous execution.**
Every task follows: **Question -> Options -> Decision -> Draft -> Approval**

- Agents MUST ask "May I write this to [filepath]?" before using Write/Edit tools
- Agents MUST show drafts or summaries before requesting approval
- Multi-file changes require explicit approval for the full changeset
- No commits without user instruction

See `docs/COLLABORATIVE-DESIGN-PRINCIPLE.md` for full protocol and examples.

> **First session?** If the project has no game concept yet, run `/start` to begin the guided onboarding flow.

## Coding Standards

@.claude/docs/coding-standards.md

## Context Management

@.claude/docs/context-management.md
