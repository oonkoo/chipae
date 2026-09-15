# ADR-0005: Games behind a module interface

**Status:** Accepted
**Date:** 2026-08-04
**Extends:** ADR-0004 (lobby as group, games as a catalog) — this ADR
delivers the dealer registry that ADR-0004 said would "become worthwhile at
2–3 games".

## Summary

Every game implements one interface (`lib/game/module.ts`). The platform
resolves a game by `GameSession.gameType` through a registry and never
mentions a specific game again. Nuno is the first implementation; adding a
game touches its own files plus two registry lines.

## Context

ADR-0004 claimed adding a game was "a catalog entry + rules module + dealer
branch". Building the second game (Empire Wars) showed that was optimistic —
five platform surfaces were hard-typed to Nuno:

- `startGame` branched on `game.id !== NUNO_CONFIG.gameType` to deal.
- `runTransition` typed its callback as `NunoState → PlayResult`.
- `persistGameState` took `state: NunoState`, and `buildLineup` reached into
  `state.placements` and `player.hand` to build the win record.
- The game route imported `parseState`/`viewFor` from `nuno/rules` directly.
- `GameScreen` and `LobbyRoom` took `NunoView` props and rendered `NunoBoard`
  by name; `GameScreen` also rebuilt the standings from the Nuno view, a
  second copy of logic that already lived in `session.ts`.

A second game would have duplicated all five rather than reused them.

## Decision

- **One interface**, `GameModule<TState, TView, TMove>`: `moveSchema`,
  `parseState`, `deal`, `viewFor`, `apply`, `quit`, `botMove`,
  `currentMemberId`, `winnerId`, `standings`. Modules stay **pure** — no DB,
  no I/O, RNG injected — so they remain unit-testable per the `lib/` layering
  rule.
- **`Standing[]` is the platform's only view of game outcome**: an ordered
  list of `{ memberId, detail?, eliminated? }`. `detail` is free text the
  game owns ("3 cards left", "$12,400 empire"), which is what lets the shared
  `GameOverModal`, the lobby's last-hand ribbon, and the `GameWin` lineup all
  work for any game. Identity (name, avatar) is attached by
  `decorateStandings` in `session.ts`, never by a game.
- **Type erasure at the registry boundary.** `eraseModule` converts a
  concretely-typed module into `ErasedGameModule` operating on `unknown`.
  The casts inside it are the one place types are taken on trust; they hold
  because state and moves handed to a module always originate from that same
  module (`parseState` / `parseMove`), and the registry is keyed by the same
  `gameType` that produced the row.
- **One move action.** `submitMove(lobbyId, move)` replaces the per-verb
  actions (`playCard`, `drawCard`, `passTurn`, `callNuno`). The module
  zod-parses the move before it reaches state, keeping the "zod-parse every
  input" rule intact while the move's shape stays the game's business.
- **Two registries, keyed alike**: `lib/game/registry.ts` (server: rules) and
  `components/game/boards.tsx` (client: surfaces). `lib/game/catalog.ts`
  remains the *player-facing* shelf and may list a game before its module
  ships — `startGame` fails closed with "That game isn't ready yet".
- **Boards live in `components/game/<id>/`**, not in route folders. Nuno's
  board moved from `app/(platform)/lobby/[id]/nuno-board.tsx` to
  `components/game/nuno/board.tsx`.
- **A contract test** (`tests/game-module.test.ts`) runs `describe.each` over
  every registered module: state round-trips through Json, views are strictly
  smaller than state (hidden information never leaks), a bot never proposes a
  move its own rules reject, and bots can drive a game to a finish without
  stalling. A new game is covered the moment it enters the registry.

## Consequences

### Positive

- Adding a game is: rules module + module adapter + board + two registry
  entries + catalog entry. No platform file changes.
- Standings logic exists once. `GameScreen` no longer rebuilds it from a
  game-specific view.
- The contract test makes "half-implemented interface" a build failure rather
  than a runtime surprise.
- Nuno's rules (`lib/game/nuno/rules.ts`) were not touched, so its 62 existing
  tests still cover the real implementation.

### Negative / accepted

- `ErasedGameModule` trades static typing for a runtime-keyed table. The
  casts are contained in `eraseModule` and documented there.
- Boards receive `view: unknown` and narrow it themselves — one unchecked
  cast per board, in `components/game/boards.tsx`.
- `botMove` returning a move the module then rejects is possible in principle;
  the contract test is what keeps it honest.
- The interface assumes **turn-based play with one seat on the clock**. A game
  needing simultaneous decisions (Empire Wars' auctions and pay-or-fight
  windows) must model them inside its own state as a pending-decision phase
  with a deadline, since serverless gives no server clock — the same
  constraint that produced client-driven `advanceBot`.

## Amendment 1 — `apply` takes a context (2026-08-04)

**Status:** Accepted and **implemented** (2026-08-04).

`apply(state, memberId, move)` as shipped has no RNG and no clock. Authoring
`design/gdd/empire-wars-core.md` established that both are required:

- Dice rolls, event draws and mission deals all happen inside `apply`. Without
  injected RNG they fall through to `Math.random()`, which breaks the "RNG
  injected, fully unit-testable" rule this ADR asserts and makes a
  Monte-Carlo combat test impossible.
- Timed decisions (auctions, pay-or-fight) store an `expiresAt`. A pure module
  has no clock, and a client-supplied timestamp is not trustworthy.

**Amended signature:**

```ts
export type MoveContext = { random: () => number; now: number };

deal(memberIds: string[], ctx: MoveContext): TState;
apply(state: TState, memberId: string, move: TMove, ctx: MoveContext): Transition<TState>;
quit(state: TState, memberId: string, ctx: MoveContext): Transition<TState>;
botMove(state: TState, memberId: string, ctx: MoveContext): TMove | null;
```

Every **transition** takes the context — including `quit`, which for a game
with timed decisions has to settle whatever was pending when the player left.
`viewFor` deliberately does **not**: it is a pure read, and a countdown is
derived client-side from a deadline carried in the view rather than from a
server timestamp baked in at render.

`moveContext()` in `lib/actions/games.ts` is the only place `Math.random` and
`Date.now()` enter the game layer. It is stamped **once per transition**, so
every rule inside one move agrees on "now".

**This closed a latent defect in Nuno.** `applyDraw` accepts an optional
`random` for reshuffling the discard pile, but `lib/game/nuno/module.ts` called
it without one — so the reshuffle ran on `Math.random()` inside a supposedly
pure transition. No test forced a reshuffle, so nothing caught it.

`tests/game-module.test.ts` now covers this two ways:

- **Per-module, generic**: `deal` twice from one seed must match, and a whole
  bot-played game replayed from one seed must produce an identical final state.
  Any reach for `Math.random()`/`Date.now()` anywhere in a transition breaks
  this, whichever game hides it.
- **Nuno-specific regression**: a state with a drained deck is drawn from twice
  under the same seed and must produce identical results. Verified to **fail**
  against the pre-amendment adapter and pass after.

## ADR Dependencies

- ADR-0001 (realtime hints — `game-changed` is still published per mutation).
- ADR-0003 (Nuno rules, unchanged by this ADR).
- ADR-0004 (lobby/catalog shape this implements).

## Engine Compatibility

Web (Next.js 16 / React 19); no engine runtime. Modules are plain TypeScript
and run identically in tests and on the server.

## GDD Requirements Addressed

Platform-level, no single GDD. Unblocks `design/gdd/empire-wars-core.md`
(game #2) without further platform work.

## Amendment 2 — the context says which seats are human (2026-09-10)

**Status:** Accepted and **implemented** (2026-09-10).

`MoveContext` gains an optional field:

```ts
export type MoveContext = {
  random: () => number;
  now: number;
  humans?: readonly string[]; // seats a connected human holds, this transition
};
```

`runTransition` in `lib/actions/games.ts` fills it from the lobby's members on
every transition: members that are not bots and still have a user. A seat
whose human has left has no member row, so it is not in the list — it is played
as a CPU, which is what ADR-0004 already promises.

**Why it's needed.** Until now the platform moved a CPU only when it was on the
clock (`advanceBot` → `botMove` for `currentMemberId`), and a module could not
tell a CPU seat from a human one. Empire Wars v3 needs both:

- **CPUs acting off their own turn.** In a live auction every seat may bid at
  once. CPUs bid as *proxies* — the module answers a human's bid with the CPU's
  minimum lead inside the same transition — which it can only do if it knows
  which seats are CPUs.
- **Not playing a timed-out human as a CPU.** `advanceBot` plays a move for a
  human whose turn clock ran out, via the same `botMove`. For a game whose
  turn includes optional spending (build, trade), the fallback for a human
  must be "end the turn", never "spend their coins like a CPU would".

**Absent means every seat is a CPU.** That is exactly what seeded simulations
and the platform contract tests want, so none of them change. Nuno ignores the
field.

This also resolves the tension this ADR flagged at the start: "simultaneous
decisions (auctions…) must live inside a game's own state as a pending phase
with a deadline". They still do — Amendment 2 only tells the game who is
human.

**Addendum (2026-09-11): `deal` gets it too.** `startGame` now passes the same
list in the `ctx` it hands to `deal` — the signature was already
`deal(memberIds, ctx: MoveContext)`, so the interface doesn't change. Empire
Wars uses it to open a match with humans on a *setup* phase, where every human
picks the match's target and round limit before the first roll (a toss
settles a disagreement; CPUs never pick). That phase is exactly the pattern
above: a pending decision inside the game's own state, with a deadline, and
`currentMemberId` pointing at a real seat so `advanceBot` can close it when the
clock runs out. A table of CPUs — every simulation, the contract tests — deals
without `humans` and skips setup. Nuno ignores the field here as well.

