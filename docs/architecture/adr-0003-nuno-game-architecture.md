# ADR-0003: Nuno game architecture

**Status:** Accepted
**Date:** 2026-07-27
**Supersedes:** ADR-0002 (High Roll test game — removed; its validated
pipeline pattern carries forward here)

## Summary

Nuno (design/gdd/nuno-core.md) is the first official game. It runs on the
pipeline High Roll proved — pure rules + data config + server actions +
Json session state + realtime hint events — with two additions demanded by
a real card game: **hidden information** (per-viewer state projection) and
**paced bot turns** (client-timer-driven, server-validated).

## Context

UNO-style play has secrets (hands, deck order) and bots that must feel like
casual players (1–3 s pauses). The platform is serverless Next.js — no
long-lived server process can tick bots — and ADR-0001 makes the DB the
sole authority with realtime events as hints only.

## Decision

- **Pure rules** in `lib/game/nuno/rules.ts` (deck build, deal, playability,
  every move transition, bot policy, view projection); tuning knobs in
  `lib/game/data/nuno.ts`. RNG injected everywhere; unit-tested in
  `tests/nuno-rules.test.ts`.
- **Hidden information**: the full `NunoState` (hands + deck) lives only in
  `GameSession.state`, zod-validated on read. The room page derives
  `viewFor(state, viewerMemberId)` server-side — a client receives its own
  hand, opponents' card *counts*, the top card, and public counters. No
  client ever holds another hand or the deck order.
- **Server authority**: all moves are server actions in
  `lib/actions/games.ts` (`startGame`, `playCard`, `drawCard`, `passTurn`,
  `callNuno`, `advanceBot`, `fillSeatsWithBots`), each a transaction under
  the lobby advisory lock. Clients ask; the server validates turn, card
  ownership, and playability.
- **Bot turns without a server clock**: when a client observes a CPU's
  turn, it schedules `advanceBot` after a random 1–3 s (config). Any seated
  member's client may fire it; the lock plus whose-turn check make
  duplicates and races no-ops. A seat whose human left mid-hand is played
  as a bot so the game cannot stall.
- **Nuno call enforcement**: reaching one card without declaring opens a
  pending window; the penalty (draw 2) is applied by the server when any
  other player's action lands. Declaring is possible within the play
  (`declareUno`) or via `callNuno` during the window.
- **Lifecycle**: `OPEN → IN_GAME → OPEN`; winning closes the session
  (placements recorded in state) and resets human ready flags so the next
  hand is deliberate. A folding lobby force-ends its session.

## Consequences

### Positive

- Cheat-resistant by construction: nothing secret ever reaches a client.
- Bots pace like humans with zero standing infrastructure.
- Rules are a pure module — portable to future variants (house rules,
  scoring across hands) and fully unit-testable.

### Negative / accepted

- Bot pacing depends on at least one connected client; an abandoned
  IN_GAME lobby with only bots simply pauses until someone returns or the
  lobby folds.
- `structuredClone` per move is O(state) — trivial at 108 cards.
- No Wild-Draw-Four challenge rule (spec explicitly allows any-time play).

## ADR Dependencies

- ADR-0001 (realtime hints, DB authority, events after write).
- ADR-0002 (superseded — pipeline pattern origin).

## Engine Compatibility

Web (Next.js 16 / React 19), DOM/CSS rendering — no canvas needed at this
scale. Card art is CSS; the Nuno logo lives at `public/games/nuno/`.

## GDD Requirements Addressed

`design/gdd/nuno-core.md` — all acceptance criteria covered by unit tests
plus a live end-to-end hand.
