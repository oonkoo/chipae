# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

This project runs **Next.js 16** (App Router) — newer than most training data. The bundled docs at `node_modules/next/dist/docs/` are the source of truth for Next.js APIs; App Router docs live under `01-app/`. Check them before using framework APIs you aren't certain about. Notably: middleware is now `proxy.ts` at the repo root, not `middleware.ts`.

## Commands

```bash
npm run dev        # dev server at http://localhost:3000
npm run build      # prisma generate && next build
npm run lint       # eslint (flat config, eslint.config.mjs)
npm run typecheck  # tsc --noEmit
npm test           # vitest run (tests/ — pure logic only, no DB needed)
npm run test:watch # vitest watch
npm run db:dev     # local Prisma Postgres server (offline dev) — keep running
npm run db:push    # sync schema to the DB in DATABASE_URL (local dev only)
npm run db:migrate # create/apply migrations
npm run db:cloud -- migrate deploy   # run any prisma command against CLOUD_DATABASE_URL
npm run db:studio  # Prisma Studio
```

Single test file / single case:

```bash
npx vitest run tests/nuno-rules.test.ts
npx vitest run -t "reverse with two players"
```

CI (`.github/workflows/ci.yml`) runs `prisma generate` → `lint` → `typecheck` → `test` on every push to main and every PR.

To add UI components, use the shadcn CLI: `npx shadcn add <component>`.

## What this is

**Chipae** — a social game platform ("game night, anywhere"): sign in, add friends, open a **lobby** (persistent group with a join code), and start a **game** from a catalog. First and only game: **Nuno**, an UNO-clone. See `design/art-direction.md` for the product's voice and visual identity, `design/gdd/nuno-core.md` for the game rules spec.

## Architecture

Path alias `@/*` → repo root. React 19, TypeScript strict.

### Request path and auth

Kinde handles identity (`app/api/auth/[kindeAuth]/route.ts`). `proxy.ts` is an **optimistic gate only** — real enforcement is `lib/auth.ts` → `lib/user.ts`:

- `getCurrentUser()` — requires a Kinde session, upserts the local `User` mirror (keyed by `kindeId`).
- `getOnboardedUser()` — the above **plus** a completed profile (username set); redirects to `/onboarding`. Every protected page and server action calls this, never `proxy.ts`'s guarantee.

Routes: `app/(platform)/*` sits under the app shell layout (left nav + top bar + right crew rail) and gates on `getOnboardedUser()`. `app/page.tsx` is the public landing page, `app/onboarding/` is outside the shell.

### Data layer — Prisma 7

`lib/db.ts` exports the single `db` client (cached on `globalThis` for hot reload).

- Client generates to `lib/generated/prisma` (**gitignored** — run `npx prisma generate` after clone).
- Prisma 7 requires a **driver adapter**: `@prisma/adapter-pg` over a direct TCP `postgres://` URL. A `prisma+postgres://` API URL works for CLI migrations only and throws at runtime.
- `prisma migrate dev` fails (P1017) against the local `prisma dev` server — use `db:push` locally. Migrations are the source of truth for the cloud DB; apply with `npm run db:cloud -- migrate deploy` (that script exists because shell-level `DATABASE_URL=...` never sees `.env`; it must use the **direct**, non-pooled host — poolers break DDL and advisory locks).
- Post-cutoff details live in `.claude/skills/prisma-upgrade-v7`.

Schema notes worth knowing before touching `prisma/schema.prisma`: `Friendship` is one row per relationship and its unique constraint **cannot** stop a reverse duplicate — check both directions before insert. `LobbyMessage.sessionId` null = lounge chat, set = that game's chat (deleted when the game ends). `GameWin` is the only record that outlives a game and freezes its own lineup JSON, because lobbies and seats get deleted.

### Realtime — ADR-0001

Pusher Channels behind `lib/realtime/`. Non-negotiable rules:

- **Only** `lib/realtime/server.ts` may import `pusher`; **only** `lib/realtime/client.ts` may import `pusher-js`. Feature code imports the abstraction.
- **Postgres is the sole authority.** Events are *hints* — receivers revalidate from the server rather than trusting payloads.
- Events are published **server-side only, after the DB write commits**. A failed publish never fails the mutation. Missing Pusher env vars degrade to plain refresh, not a crash.
- All payloads are zod-validated on both ends (`lib/realtime/events.ts`); one Pusher event name, discriminated by `type`.
- Channels (`lib/realtime/channels.ts`): `presence-online`, `private-user-<id>`, `presence-lobby-<id>`; authorized in `app/api/pusher/auth/route.ts`.

### Server actions

`lib/actions/*.ts` (`"use server"`) are the only write path. The established pattern, follow it:

1. `getOnboardedUser()` for identity, then `rateLimit()` from `lib/rate-limit.ts` (in-memory, per warm instance — swap for Redis before multi-instance scale).
2. zod-parse every input.
3. Mutate inside `db.$transaction`, taking a Postgres advisory lock via `acquireTxLock(tx, lockKeys.…)` (`lib/locks.ts`) for any check-then-write no unique constraint can cover: one active lobby per user (`seat:`), lobby membership/host changes (`lobby:`), friendship pairs (`pair:`). **Lock order: `seat:` before `lobby:`**; `pair:` is never combined. Use `$executeRaw` — `pg_advisory_xact_lock()` returns `void`, which the pg adapter cannot deserialize from a `$queryRaw`.
4. Publish the realtime hint, then `revalidatePath` every surface that renders the changed data (a mutation usually touches the lobby route *and* `/dashboard` *and* sometimes the shell layout — see `refreshLobby()` / `refreshGame()`).
5. Return `{ ok: true } | { ok: false; error: string }` — form-post actions redirect with `?error=…` instead.

### Games — ADR-0003 / ADR-0004

The lobby is the persistent group; games are interchangeable activities started inside it. Adding a game means: a `lib/game/catalog.ts` entry + a rules module + a dealer branch — **not** new lobby UI.

- **Pure rules** in `lib/game/<game>/rules.ts`: no DB, no I/O, RNG injected, fully unit-testable. Tuning values live in `lib/game/data/<game>.ts`, never inline in logic (`NUNO_CONFIG`, `LOBBY_LIMITS`).
- **Hidden information**: full state (hands, deck order) lives only in `GameSession.state` (Json, zod-validated on read). Pages send clients `viewFor(state, viewerMemberId)` — own hand, opponents' *counts*, top card, public counters. A client never receives another hand or the deck.
- **Server authority**: every move is a server action in `lib/actions/games.ts` running one rules transition inside the lobby lock (`runTransition`). Clients ask; the server validates turn, ownership, playability.
- **Bots without a server clock** (serverless — nothing ticks): a client observing a CPU turn schedules `advanceBot` after 1–3 s; the lock plus a whose-turn check make duplicate calls no-ops. A seat whose human left is played as a bot so the table can't stall.
- **End-of-game contract is centralized** in `lib/game/session.ts` `persistGameState()` — finish/abandon detection, game-chat wipe, lobby reopen, ready reset, and the `GameWin` row all happen there. Every mutation path (moves, quits, lobby leaves) goes through it.
- Assets per game: `public/games/<id>/` — square `logo` 512×512 PNG transparent, wide `cover` 1280×800 (16:10). A missing cover degrades to a plain card color.

### `lib/` layering

| Kind | Files | Rule |
|---|---|---|
| Pure logic | `*-rules.ts`, `lib/game/**/rules.ts`, `lib/validation.ts`, `lib/notification-text.ts` | No DB, no `server-only` — this is what `tests/` covers |
| Server data access | `lib/lobbies.ts`, `lib/friends.ts`, `lib/notifications.ts`, `lib/locks.ts`, `lib/game/session.ts`, `lib/realtime/server.ts` | Start with `import "server-only"` |
| Mutations | `lib/actions/*.ts` | `"use server"`, pattern above |

Tests (`tests/*.test.ts`, vitest) only exercise the pure layer — they must stay DB-free.

## Styling and UI

**Tailwind CSS v4, CSS-first.** There is no `tailwind.config.*`; all theme configuration lives in `app/globals.css` via `@theme inline`. Design tokens are CSS variables in `:root` / `.dark` (oklch), mapped to Tailwind tokens (`bg-primary`, `rounded-4xl`, …). Change theming by editing the CSS variables, not by adding a Tailwind config.

**Dark is the shipped theme** — `app/layout.tsx` hardcodes `class="dark"` on `<html>`. The `.dark` variant is declared via `@custom-variant`; light-mode tokens exist but nothing toggles them.

**Fonts** (`app/layout.tsx`): Nunito Sans → `--font-sans` (body/UI), **Lilita One → `--font-display`, exposed as Tailwind `font-heading`** (display/headings only, never body), Geist Mono → `--font-geist-mono` / `font-mono` (join codes, stats).

**Components — shadcn on Base UI, not Radix.** `components.json` uses the `base-maia` style: primitives come from `@base-ui/react` (see `components/ui/button.tsx`, `dialog.tsx`), and globals import `shadcn/tailwind.css`. Icons are Remix Icon (`@remixicon/react`), not lucide. New components follow: `cva` variants + `cn()` from `lib/utils.ts` + `data-slot` attributes. Files are kebab-case, exporting PascalCase components.

Layout: `components/shell/` is the app chrome (sidebar, right rail, lobby quick panel), `components/game/` is game-surface UI (cards, flight animation, game-over modal — kept game-agnostic where possible), `components/ui/` is the primitive layer.

## Local dev gotchas

These cost real debugging time and are not discoverable from the code alone:

- The local `prisma dev` server resets connections beyond ~7 concurrent. `lib/db.ts` caps the pool (`DATABASE_POOL_MAX`, default 5 local) and retires sockets fast; changing it needs a **dev-server restart** (the client is cached on `globalThis`).
- An aborted RSC render (fast navigation, `router.refresh()`) can leave a pooled socket protocol-desynced → `08P01 bind message supplies N parameters…` on every reuse. Same after a `db push`. Restart the dev server.
- If the local DB wedges (all connections ECONNRESET), restart `npm run db:dev` then the app — data survives in `%LOCALAPPDATA%\prisma-dev-nodejs`.
- Editing a React hook in an open game page corrupts it via Fast Refresh ("useEffect dep array changed size") and stalls bots — reload the page after such edits.
- `.next/dev/types/validator.ts` can be corrupted by a mid-write race; touch any app file to regenerate before trusting typecheck failures there.
- The `cz-shortcut-listen` hydration warning on `<body>` is a browser extension, not an app bug.

## Where decisions live

- `docs/architecture/adr-000X-*.md` — binding technical decisions (0001 realtime, 0002 superseded, 0003 Nuno, 0004 platform shape). Every new system gets an ADR.
- `design/gdd/` — game design docs (8 required sections, see `design/CLAUDE.md`); `design/art-direction.md` — palette, motif, typography, voice.
- `production/session-state/active.md` — running session handoff: what was just built, what's verified live, what isn't. **Read it first after a compaction, crash, or `/clear`.**

---

# Game Studio — Agent Architecture

This repo includes [Claude Code Game Studios](https://github.com/Donchitos/Claude-Code-Game-Studios): game development managed through coordinated Claude Code subagents (`.claude/agents/`), 73 workflow skills (`.claude/skills/`), validation hooks, and path-scoped rules. Type `/` to see the skills; run `/help` for the skill catalog.

## Technology Stack

- **Engine**: Web browser — Next.js 16 + React 19 (this repo). No Godot/Unity/Unreal.
- **Language**: TypeScript (strict)
- **Rendering**: DOM/CSS (cards and board are styled elements, not canvas). Record any change in `.claude/docs/technical-preferences.md`.
- **Version Control**: Git with trunk-based development

> **Engine specialists**: The `.claude/agents/` set includes Godot, Unity, and Unreal specialists from the template. They are **not applicable** to this web project — do not invoke them, and ignore `docs/engine-reference/{godot,unity,unreal}/`. Use the general programming agents (gameplay-programmer, ui-programmer, engine-programmer, etc.) with the web stack above.

## Directory Mapping (web project)

The studio docs and skills reference a generic layout. In this repo it maps as:

| Template path | This repo |
|---|---|
| `src/` (game code) | `lib/game/` (rules — engine-agnostic, data-driven), `components/game/` (game UI), `app/` (routes) |
| `assets/` | `public/` |
| `tests/` | `tests/` |
| `design/`, `docs/`, `production/`, `prototypes/` | same paths at repo root |

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

## Coding Standards

@.claude/docs/coding-standards.md

## Context Management

@.claude/docs/context-management.md
