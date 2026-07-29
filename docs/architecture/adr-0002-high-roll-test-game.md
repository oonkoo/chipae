# ADR-0002: High Roll — infrastructure validation game

**Status:** Superseded by ADR-0003 (Nuno) — High Roll served its purpose and
was removed once the pipeline it validated carried the first real game.
**Date:** 2026-07-27

## Summary

Ship a deliberately trivial first game — High Roll: every seat rolls one
die, highest wins, ties split the pot — to exercise the platform's game
pipeline end to end (start gate → `IN_GAME` status → `GameSession` state →
realtime updates → finish → lobby reopens) before any real game is designed.

## Context

The platform has lobby/seat/ready/chat infrastructure and a placeholder
`GameSession` model, but nothing has ever driven the `OPEN → IN_GAME → OPEN`
lifecycle or written `GameSession.state`. Real games are still in design.
Building them on unproven plumbing risks debugging two layers at once.

## Decision

- **Rules are pure and data-driven**: `lib/game/high-roll/rules.ts` (no DB,
  no framework, unit-tested in `tests/high-roll-rules.test.ts`); tuning
  knobs in `lib/game/data/high-roll.ts` (die sides, min players). RNG is
  injected so tests stay deterministic.
- **Server-authoritative**: rolls happen only in server actions
  (`lib/actions/games.ts`), inside a transaction holding the lobby advisory
  lock. Clients ask to roll; they never send values.
- **State lives in `GameSession.state` (Json)**, validated on read with zod
  (`parseState`) — malformed state fails closed. Rolls are keyed by
  `LobbyMember.id`, which covers CPU seats; bots roll at deal time.
- **Realtime = hints (ADR-0001)**: a `game-changed` lobby event published
  after the Postgres write; clients refresh server data.
- **Lifecycle**: host deals (all seats ready, ≥ minPlayers) → `IN_GAME`;
  last roll closes the session (`endedAt`, winners recorded in state) and
  reopens the lobby; a closing lobby force-ends any open session.

## Consequences

### Positive

- Whole game lifecycle proven with minimal game logic to blame.
- Establishes the pattern real games should follow (pure rules + config +
  server actions + hint events + Json session state).

### Negative / accepted shortcuts

- A player leaving mid-round does not auto-complete the round; it completes
  on the next roll (member set is re-read per roll). Acceptable for a test
  game.
- No per-roll rate limit (one roll per seat is enforced by state).
- `GameSession.state` stays a loosely-typed Json column; a real game may
  want versioned state or a relation.

## ADR Dependencies

- Depends on ADR-0001 (realtime layer, DB-is-authority, events-after-write).

## Engine Compatibility

Web (Next.js 16 / React 19) — DOM-rendered UI in the lobby room; no canvas
or engine runtime needed at this scale.

## GDD Requirements Addressed

None — infrastructure validation only. High Roll is throwaway by design;
real games get their own GDDs and ADRs.
