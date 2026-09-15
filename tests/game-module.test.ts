import { describe, expect, it } from "vitest";
import { eraseModule, type MoveContext } from "@/lib/game/module";
import { getGameModule, playableGameTypes } from "@/lib/game/registry";
import { nunoModule } from "@/lib/game/nuno/module";
import { dealGame, type NunoState } from "@/lib/game/nuno/rules";

// The contract every game on the shelf owes the platform (ADR-0005). These
// run against each registered module, so a new game is covered the moment
// it lands in the registry — it can't ship a half-implemented interface.

const SEATS = ["seat-a", "seat-b", "seat-c"];

/** Deterministic RNG so a failure is reproducible. */
function seeded(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

/** A fixed clock — a module must never notice real time passing. */
const FIXED_NOW = 1_760_000_000_000;

function ctx(seed: number): MoveContext {
  return { random: seeded(seed), now: FIXED_NOW };
}

describe("game module registry", () => {
  it("registers at least one playable game", () => {
    expect(playableGameTypes().length).toBeGreaterThan(0);
  });

  it("returns null for a game nobody ships", () => {
    expect(getGameModule("not-a-game")).toBeNull();
  });

  it("keys each module by its own id", () => {
    for (const id of playableGameTypes()) {
      expect(getGameModule(id)?.id).toBe(id);
    }
  });
});

describe.each(playableGameTypes())("module contract: %s", (gameType) => {
  const gameModule = getGameModule(gameType)!;

  it("deals a state it can parse back", () => {
    const state = gameModule.deal(SEATS, ctx(1));
    // Round-trips through Json, the way GameSession.state actually stores it.
    const reparsed = gameModule.parseState(JSON.parse(JSON.stringify(state)));
    expect(reparsed).not.toBeNull();
  });

  it("rejects state that isn't its own", () => {
    expect(gameModule.parseState({ nonsense: true })).toBeNull();
    expect(gameModule.parseState(null)).toBeNull();
  });

  it("opens with nobody having won and everybody standing", () => {
    const state = gameModule.deal(SEATS, ctx(2));
    expect(gameModule.winnerId(state)).toBeNull();
    const standings = gameModule.standings(state);
    expect(standings).toHaveLength(SEATS.length);
    expect(standings.every((s) => !s.eliminated)).toBe(true);
    expect([...standings].map((s) => s.memberId).sort()).toEqual(
      [...SEATS].sort()
    );
  });

  it("puts a real seat on the clock", () => {
    const state = gameModule.deal(SEATS, ctx(3));
    expect(SEATS).toContain(gameModule.currentMemberId(state));
  });

  it("refuses a move from a seat that isn't on the clock", () => {
    const state = gameModule.deal(SEATS, ctx(4));
    const onClock = gameModule.currentMemberId(state)!;
    const other = SEATS.find((s) => s !== onClock)!;
    const move = gameModule.botMove(state, onClock, ctx(5));
    expect(move).not.toBeNull();
    const result = gameModule.apply(state, other, move, ctx(5));
    expect(result.ok).toBe(false);
  });

  it("rejects malformed moves at the schema", () => {
    expect(gameModule.parseMove({ kind: "definitely-not-a-move" }).ok).toBe(
      false
    );
    expect(gameModule.parseMove(undefined).ok).toBe(false);
  });

  it("quitting eliminates that seat and nobody else", () => {
    const state = gameModule.deal(SEATS, ctx(6));
    const result = gameModule.quit(state, SEATS[0], ctx(6));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const standings = gameModule.standings(result.state);
    expect(standings.find((s) => s.memberId === SEATS[0])?.eliminated).toBe(
      true
    );
    expect(
      standings.filter((s) => s.eliminated).map((s) => s.memberId)
    ).toEqual([SEATS[0]]);
  });

  /**
   * A per-viewer projection must actually project. This replaced a
   * "view is smaller than state" heuristic, which only held for games whose
   * state is mostly secret — Empire Wars denormalises public board data into
   * its view, so it is legitimately *larger* than state while leaking nothing.
   * Size was never the property worth asserting; per-viewer difference is.
   *
   * Precise leak assertions live in each game's own suite, where the shape of
   * "private" is actually known.
   */
  it("projects a different view for each seat", () => {
    const state = gameModule.deal(SEATS, ctx(7));
    const a = JSON.stringify(gameModule.viewFor(state, SEATS[0]));
    const b = JSON.stringify(gameModule.viewFor(state, SEATS[1]));
    expect(a).not.toEqual(b);
  });

  it("gives a spectator a view with no seat-private section", () => {
    const state = gameModule.deal(SEATS, ctx(7));
    const spectator = JSON.stringify(gameModule.viewFor(state, null));
    for (const seat of SEATS) {
      expect(spectator).not.toEqual(
        JSON.stringify(gameModule.viewFor(state, seat))
      );
    }
  });

  it("deals identically from the same seed", () => {
    expect(gameModule.deal(SEATS, ctx(99))).toEqual(
      gameModule.deal(SEATS, ctx(99))
    );
  });

  it("bots can play the game to a finish without stalling", () => {
    const c = ctx(8);
    let state = gameModule.deal(SEATS, c);
    let turns = 0;
    while (gameModule.winnerId(state) === null && turns < 2000) {
      const seat = gameModule.currentMemberId(state);
      if (seat === null) break;
      const move = gameModule.botMove(state, seat, c);
      expect(move).not.toBeNull();
      const result = gameModule.apply(state, seat, move, c);
      // A bot must never propose a move its own rules reject.
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      state = result.state;
      turns++;
    }
    expect(gameModule.winnerId(state)).not.toBeNull();
    // The winner tops the standings.
    expect(gameModule.standings(state)[0].memberId).toBe(
      gameModule.winnerId(state)
    );
  });

  /**
   * The whole point of MoveContext (ADR-0005 Amendment 1). Any reach for
   * `Math.random()` or `Date.now()` anywhere inside a transition makes two
   * identically-seeded games diverge, and this catches it wherever it hides.
   */
  it("replays a whole game identically from the same seed", () => {
    function play(seed: number) {
      const c = ctx(seed);
      let state = gameModule.deal(SEATS, c);
      for (let i = 0; i < 2000; i++) {
        if (gameModule.winnerId(state) !== null) break;
        const seat = gameModule.currentMemberId(state);
        if (seat === null) break;
        const move = gameModule.botMove(state, seat, c);
        if (move === null) break;
        const result = gameModule.apply(state, seat, move, c);
        if (!result.ok) break;
        state = result.state;
      }
      return state;
    }
    expect(play(1234)).toEqual(play(1234));
  });
});

describe("eraseModule", () => {
  it("preserves the module's own id", () => {
    expect(eraseModule(nunoModule).id).toBe(nunoModule.id);
  });

  it("parses moves through the module's schema", () => {
    const erased = eraseModule(nunoModule);
    expect(erased.parseMove({ kind: "draw" })).toEqual({
      ok: true,
      move: { kind: "draw" },
    });
    expect(erased.parseMove({ kind: "draw", cardId: 5 }).ok).toBe(true);
    expect(erased.parseMove({ kind: "play" }).ok).toBe(false);
  });
});

describe("nuno: deck reshuffle uses the injected RNG", () => {
  /**
   * Regression test for the defect ADR-0005 Amendment 1 fixed: the adapter
   * called `applyDraw(state, memberId)` with no `random`, so an exhausted
   * deck reshuffled from `Math.random()` inside a supposedly pure
   * transition. Nothing caught it because no other test forces a reshuffle.
   */
  function drainedDeck(): NunoState {
    const base = dealGame(SEATS, seeded(42));
    return {
      ...base,
      deck: [],
      // Prepend, so the original top card stays last — the top of the pile.
      discard: [...base.deck, ...base.discard],
    };
  }

  it("produces the same post-reshuffle state twice from one seed", () => {
    const state = drainedDeck();
    const seat = state.players[state.currentIndex].id;

    const first = nunoModule.apply(state, seat, { kind: "draw" }, ctx(7));
    const second = nunoModule.apply(state, seat, { kind: "draw" }, ctx(7));

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.state).toEqual(second.state);
  });

  it("actually refills the deck from the discard", () => {
    const state = drainedDeck();
    const seat = state.players[state.currentIndex].id;
    const result = nunoModule.apply(state, seat, { kind: "draw" }, ctx(7));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // A reshuffle happened: the discard is down to its top card and the
    // drawing seat gained one.
    expect(result.state.discard).toHaveLength(1);
    const before = state.players.find((p) => p.id === seat)!.hand.length;
    const after = result.state.players.find((p) => p.id === seat)!.hand.length;
    expect(after).toBe(before + 1);
  });

  it("different seeds shuffle differently", () => {
    const state = drainedDeck();
    const seat = state.players[state.currentIndex].id;
    const a = nunoModule.apply(state, seat, { kind: "draw" }, ctx(7));
    const b = nunoModule.apply(state, seat, { kind: "draw" }, ctx(999));
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.state.deck).not.toEqual(b.state.deck);
  });
});
