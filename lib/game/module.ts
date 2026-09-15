import type { z } from "zod";

/**
 * The contract every game on the shelf implements (ADR-0005).
 *
 * A module is **pure**: no DB, no I/O, RNG injected. The platform owns the
 * lobby, the lock, persistence, chat, bots' pacing and the win record; a
 * gameModule owns nothing but its own rules. That split is what lets a new game
 * ship without touching lobby UI (ADR-0004).
 *
 * State lives in `GameSession.state` (Json) and is re-validated on every
 * read via `parseState` — malformed state fails closed rather than crashing
 * a table.
 */

/**
 * Everything impure a transition is allowed to touch (ADR-0005 Amendment 1).
 *
 * Modules have no clock and no RNG of their own — a module that reaches for
 * `Math.random()` or `Date.now()` is not testable and silently breaks seeded
 * simulation. The server action supplies both; tests supply a seeded `random`
 * and a fixed `now`, which is what makes "same seed, same result" an
 * enforceable contract.
 */
export type MoveContext = {
  random: () => number;
  /** Epoch ms. Deadlines on pending decisions are measured against this. */
  now: number;
  /**
   * The seats a connected human holds at this transition (ADR-0005
   * Amendment 2). Everyone else is a CPU — a bot seat, or a seat whose human
   * has left. Absent means every seat is a CPU, which is what seeded
   * simulations and tests pass.
   *
   * A game only needs this when CPUs must act *off* their own turn (Empire
   * Wars' auction proxies), or to avoid playing a timed-out human as a CPU.
   * Games that need neither ignore it.
   */
  humans?: readonly string[];
};

/** One rules transition. Same shape as a game's own internal result type. */
export type Transition<TState> =
  | { ok: true; state: TState }
  | { ok: false; error: string };

/** A row of the final standings, in finishing order (winner first). */
export type Standing = {
  /** LobbyMember id. */
  memberId: string;
  /** Whatever the game scores on: "3 cards left", "$12,400 empire". */
  detail?: string;
  /** Quit or knocked out — rendered muted, and never counts as "standing". */
  eliminated?: boolean;
};

export type GameModule<TState, TView, TMove> = {
  /** Matches the catalog entry id and `GameSession.gameType`. */
  id: string;

  /** Validates a move arriving from a client. Never trust the wire. */
  moveSchema: z.ZodType<TMove>;

  /** Re-validate state read back from the DB; null means unusable. */
  parseState(raw: unknown): TState | null;

  /** Opening position for these seats, in seat order. */
  deal(memberIds: string[], ctx: MoveContext): TState;

  /**
   * What one seat is allowed to know. Hidden information (hands, deck
   * order, secret objectives) must never cross this boundary — pages send
   * clients the view, never the state.
   *
   * Deliberately has no `MoveContext`: it is a pure read, and a countdown is
   * derived client-side from a deadline carried in the view, not from a
   * server timestamp baked in at render.
   */
  viewFor(state: TState, memberId: string | null): TView;

  /** Run one move for one seat. Validates turn and ownership itself. */
  apply(
    state: TState,
    memberId: string,
    move: TMove,
    ctx: MoveContext
  ): Transition<TState>;

  /** Leave the game but keep the lobby seat (ADR-0004). */
  quit(state: TState, memberId: string, ctx: MoveContext): Transition<TState>;

  /**
   * The move a CPU seat would make now, or null if it has nothing to do.
   * Called for real bots and for seats whose human walked away.
   */
  botMove(state: TState, memberId: string, ctx: MoveContext): TMove | null;

  /** Whose turn it is; null when the game is over. */
  currentMemberId(state: TState): string | null;

  /** Set once someone has won; null while the game runs. */
  winnerId(state: TState): string | null;

  /** Finishing order. The platform decorates these with names and avatars. */
  standings(state: TState): Standing[];

  /**
   * Has the seat on the clock run out of time? Optional.
   *
   * A game with a turn clock returns true once the deadline passes, which
   * lets the platform play on for a human who walked away. Games without one
   * omit it and nothing changes — a seat then simply waits forever, which is
   * correct for a game where waiting costs nobody anything.
   *
   * Judged against the **server's** `now`, never a client's.
   */
  turnExpired?(state: TState, now: number): boolean;
};

/**
 * A module with its type parameters erased, so the server can hold a table
 * of differently-typed games. Produced only by `eraseModule`.
 */
export type ErasedGameModule = {
  id: string;
  parseState(raw: unknown): unknown | null;
  deal(memberIds: string[], ctx: MoveContext): unknown;
  viewFor(state: unknown, memberId: string | null): unknown;
  parseMove(raw: unknown): { ok: true; move: unknown } | { ok: false; error: string };
  apply(
    state: unknown,
    memberId: string,
    move: unknown,
    ctx: MoveContext
  ): Transition<unknown>;
  quit(state: unknown, memberId: string, ctx: MoveContext): Transition<unknown>;
  botMove(state: unknown, memberId: string, ctx: MoveContext): unknown | null;
  currentMemberId(state: unknown): string | null;
  winnerId(state: unknown): string | null;
  standings(state: unknown): Standing[];
  turnExpired(state: unknown, now: number): boolean;
};

/**
 * Erase a module's types for storage in the registry.
 *
 * The casts below are the one place the type system is taken on trust, and
 * they hold because of a single invariant the callers must keep: **state
 * and moves handed to a module always came from that same module** —
 * `state` from its own `parseState`, `move` from its own `parseMove`. The
 * registry is keyed by `GameSession.gameType`, which is also what produced
 * the row, so a mismatch would mean a game id changed under a live session.
 */
export function eraseModule<TState, TView, TMove>(
  gameModule: GameModule<TState, TView, TMove>
): ErasedGameModule {
  const asState = (state: unknown) => state as TState;
  return {
    id: gameModule.id,
    parseState: (raw) => gameModule.parseState(raw),
    deal: (memberIds, ctx) => gameModule.deal(memberIds, ctx),
    viewFor: (state, memberId) => gameModule.viewFor(asState(state), memberId),
    parseMove: (raw) => {
      const parsed = gameModule.moveSchema.safeParse(raw);
      return parsed.success
        ? { ok: true, move: parsed.data }
        : { ok: false, error: "That isn't a move you can make" };
    },
    apply: (state, memberId, move, ctx) =>
      gameModule.apply(asState(state), memberId, move as TMove, ctx),
    quit: (state, memberId, ctx) =>
      gameModule.quit(asState(state), memberId, ctx),
    botMove: (state, memberId, ctx) =>
      gameModule.botMove(asState(state), memberId, ctx),
    currentMemberId: (state) => gameModule.currentMemberId(asState(state)),
    winnerId: (state) => gameModule.winnerId(asState(state)),
    standings: (state) => gameModule.standings(asState(state)),
    turnExpired: (state, now) =>
      gameModule.turnExpired?.(asState(state), now) ?? false,
  };
}
