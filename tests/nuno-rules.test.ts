import { describe, expect, it } from "vitest";
import { NUNO_CONFIG } from "@/lib/game/data/nuno";
import {
  applyDraw,
  applyPass,
  applyPlay,
  applyQuit,
  applyUnoCall,
  buildDeck,
  chooseBotMove,
  currentPlayer,
  dealGame,
  isPlayable,
  parseState,
  playableCardIds,
  topCard,
  viewFor,
  type NunoCard,
  type NunoState,
} from "@/lib/game/nuno/rules";

const rng = () => 0; // deterministic: shuffle is identity-ish, picks index 0

function card(partial: Partial<NunoCard> & Pick<NunoCard, "id">): NunoCard {
  return { color: "red", type: "number", value: 5, ...partial };
}

/** Hand-built two/three player states for precise scenarios. */
function makeState(overrides: Partial<NunoState> = {}): NunoState {
  return {
    gameType: "nuno",
    players: [
      { id: "a", hand: [card({ id: "a1", color: "red", value: 3 })], hasUno: false, eliminated: false },
      { id: "b", hand: [card({ id: "b1", color: "blue", value: 7 })], hasUno: false, eliminated: false },
    ],
    deck: [
      card({ id: "d1", color: "green", value: 1 }),
      card({ id: "d2", color: "yellow", value: 2 }),
      card({ id: "d3", color: "green", value: 9 }),
      card({ id: "d4", color: "yellow", value: 8 }),
      card({ id: "d5", color: "blue", value: 4 }),
      card({ id: "d6", color: "red", value: 6 }),
    ],
    discard: [card({ id: "t1", color: "red", value: 5 })],
    activeColor: "red",
    currentIndex: 0,
    direction: 1,
    drawnCardId: null,
    pendingUnoMemberId: null,
    winnerId: null,
    placements: null,
    turnCount: 0,
    ...overrides,
  };
}

describe("buildDeck", () => {
  it("has exactly 108 cards with the standard composition", () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(108);
    const count = (fn: (c: NunoCard) => boolean) => deck.filter(fn).length;
    expect(count((c) => c.type === "number")).toBe(76);
    expect(count((c) => c.type === "number" && c.value === 0)).toBe(4);
    expect(count((c) => c.type === "skip")).toBe(8);
    expect(count((c) => c.type === "reverse")).toBe(8);
    expect(count((c) => c.type === "draw2")).toBe(8);
    expect(count((c) => c.type === "wild")).toBe(4);
    expect(count((c) => c.type === "wild4")).toBe(4);
    expect(new Set(deck.map((c) => c.id)).size).toBe(108);
  });
});

describe("dealGame", () => {
  it("deals 7 cards each and flips a number card", () => {
    const state = dealGame(["a", "b", "c"], Math.random);
    for (const p of state.players) {
      expect(p.hand).toHaveLength(NUNO_CONFIG.handSize);
    }
    expect(topCard(state).type).toBe("number");
    expect(state.activeColor).toBe(topCard(state).color);
    const total =
      state.deck.length +
      state.discard.length +
      state.players.reduce((n, p) => n + p.hand.length, 0);
    expect(total).toBe(108);
  });
});

describe("isPlayable", () => {
  const top = card({ id: "t", color: "red", value: 5 });
  it("matches on color", () => {
    expect(isPlayable(card({ id: "x", color: "red", value: 9 }), top, "red")).toBe(true);
  });
  it("matches on number across colors", () => {
    expect(isPlayable(card({ id: "x", color: "blue", value: 5 }), top, "red")).toBe(true);
  });
  it("rejects wrong color and number", () => {
    expect(isPlayable(card({ id: "x", color: "blue", value: 9 }), top, "red")).toBe(false);
  });
  it("always allows wilds", () => {
    expect(
      isPlayable({ id: "w", color: "wild", type: "wild4" }, top, "red")
    ).toBe(true);
  });
  it("matches action type across colors", () => {
    const skipTop: NunoCard = { id: "s", color: "red", type: "skip" };
    expect(
      isPlayable({ id: "s2", color: "blue", type: "skip" }, skipTop, "red")
    ).toBe(true);
  });
  it("respects the active color after a wild", () => {
    const wildTop: NunoCard = { id: "w", color: "wild", type: "wild" };
    expect(isPlayable(card({ id: "x", color: "blue", value: 2 }), wildTop, "blue")).toBe(true);
    expect(isPlayable(card({ id: "x", color: "red", value: 2 }), wildTop, "blue")).toBe(false);
  });
});

describe("applyPlay basics", () => {
  it("moves the card to the pile and advances the turn", () => {
    const state = makeState({
      players: [
        { id: "a", hand: [card({ id: "a1", color: "red", value: 3 }), card({ id: "a2", color: "blue", value: 1 })], hasUno: false, eliminated: false },
        { id: "b", hand: [card({ id: "b1" })], hasUno: false, eliminated: false },
      ],
    });
    const result = applyPlay(state, "a", "a1", {}, rng);
    if (!result.ok) throw new Error(result.error);
    expect(topCard(result.state).id).toBe("a1");
    expect(result.state.activeColor).toBe("red");
    expect(currentPlayer(result.state).id).toBe("b");
  });

  it("rejects playing out of turn", () => {
    const result = applyPlay(makeState(), "b", "b1", {}, rng);
    expect(result.ok).toBe(false);
  });

  it("rejects a non-matching card", () => {
    const state = makeState({
      players: [
        { id: "a", hand: [card({ id: "a1", color: "blue", value: 9 }), card({ id: "a2", color: "blue", value: 1 })], hasUno: false, eliminated: false },
        { id: "b", hand: [card({ id: "b1" })], hasUno: false, eliminated: false },
      ],
    });
    expect(applyPlay(state, "a", "a1", {}, rng).ok).toBe(false);
  });

  it("requires a color for wilds and applies it", () => {
    const state = makeState({
      players: [
        { id: "a", hand: [{ id: "w1", color: "wild", type: "wild" }, card({ id: "a2" })], hasUno: false, eliminated: false },
        { id: "b", hand: [card({ id: "b1" })], hasUno: false, eliminated: false },
      ],
    });
    expect(applyPlay(state, "a", "w1", {}, rng).ok).toBe(false);
    const result = applyPlay(state, "a", "w1", { chosenColor: "green" }, rng);
    if (!result.ok) throw new Error(result.error);
    expect(result.state.activeColor).toBe("green");
  });
});

describe("action cards", () => {
  const threeHands = () => [
    { id: "a", hand: [{ id: "act", color: "red", type: "skip" } as NunoCard, card({ id: "a2" })], hasUno: false, eliminated: false },
    { id: "b", hand: [card({ id: "b1" })], hasUno: false, eliminated: false },
    { id: "c", hand: [card({ id: "c1" })], hasUno: false, eliminated: false },
  ];

  it("skip jumps the next player", () => {
    const state = makeState({ players: threeHands() });
    const result = applyPlay(state, "a", "act", {}, rng);
    if (!result.ok) throw new Error(result.error);
    expect(currentPlayer(result.state).id).toBe("c");
  });

  it("reverse flips direction in 3+ player games", () => {
    const players = threeHands();
    players[0].hand[0] = { id: "act", color: "red", type: "reverse" };
    const state = makeState({ players });
    const result = applyPlay(state, "a", "act", {}, rng);
    if (!result.ok) throw new Error(result.error);
    expect(result.state.direction).toBe(-1);
    expect(currentPlayer(result.state).id).toBe("c"); // backwards from a
  });

  it("reverse acts like skip with two players", () => {
    const state = makeState({
      players: [
        { id: "a", hand: [{ id: "act", color: "red", type: "reverse" } as NunoCard, card({ id: "a2" })], hasUno: false, eliminated: false },
        { id: "b", hand: [card({ id: "b1" })], hasUno: false, eliminated: false },
      ],
    });
    const result = applyPlay(state, "a", "act", {}, rng);
    if (!result.ok) throw new Error(result.error);
    expect(currentPlayer(result.state).id).toBe("a");
  });

  it("draw2 makes the next player draw two and lose the turn", () => {
    const players = threeHands();
    players[0].hand[0] = { id: "act", color: "red", type: "draw2" };
    const state = makeState({ players });
    const result = applyPlay(state, "a", "act", {}, rng);
    if (!result.ok) throw new Error(result.error);
    expect(result.state.players[1].hand).toHaveLength(3);
    expect(currentPlayer(result.state).id).toBe("c");
  });

  it("wild4 draws four, sets color, and skips", () => {
    const players = threeHands();
    players[0].hand[0] = { id: "act", color: "wild", type: "wild4" };
    const state = makeState({ players });
    const result = applyPlay(state, "a", "act", { chosenColor: "yellow" }, rng);
    if (!result.ok) throw new Error(result.error);
    expect(result.state.players[1].hand).toHaveLength(5);
    expect(result.state.activeColor).toBe("yellow");
    expect(currentPlayer(result.state).id).toBe("c");
  });
});

describe("drawing", () => {
  it("keeps the turn when the drawn card is playable", () => {
    const state = makeState({
      deck: [card({ id: "d-red", color: "red", value: 9 })],
      players: [
        { id: "a", hand: [card({ id: "a1", color: "blue", value: 9 }), card({ id: "a2", color: "blue", value: 2 })], hasUno: false, eliminated: false },
        { id: "b", hand: [card({ id: "b1" })], hasUno: false, eliminated: false },
      ],
    });
    const result = applyDraw(state, "a", rng);
    if (!result.ok) throw new Error(result.error);
    expect(result.state.drawnCardId).toBe("d-red");
    expect(currentPlayer(result.state).id).toBe("a");
    // only the drawn card is playable now
    expect(playableCardIds(result.state, "a")).toEqual(["d-red"]);
    // and it can be passed instead
    const passed = applyPass(result.state, "a");
    if (!passed.ok) throw new Error(passed.error);
    expect(currentPlayer(passed.state).id).toBe("b");
  });

  it("ends the turn when the drawn card is unplayable", () => {
    const state = makeState({
      deck: [card({ id: "d-blue", color: "blue", value: 9 })],
    });
    const result = applyDraw(state, "a", rng);
    if (!result.ok) throw new Error(result.error);
    expect(currentPlayer(result.state).id).toBe("b");
    expect(result.state.drawnCardId).toBeNull();
  });

  it("reshuffles the discard when the deck is empty", () => {
    const state = makeState({
      deck: [],
      discard: [
        card({ id: "old1", color: "blue", value: 9 }),
        card({ id: "t1", color: "red", value: 5 }),
      ],
    });
    const result = applyDraw(state, "a", rng);
    if (!result.ok) throw new Error(result.error);
    const a = result.state.players[0];
    expect(a.hand.some((c) => c.id === "old1")).toBe(true);
    expect(result.state.discard.map((c) => c.id)).toEqual(["t1"]);
  });

  it("passes the turn when no cards exist anywhere to draw", () => {
    const state = makeState({ deck: [], discard: [card({ id: "t1" })] });
    const result = applyDraw(state, "a", rng);
    if (!result.ok) throw new Error(result.error);
    expect(currentPlayer(result.state).id).toBe("b");
  });

  it("refuses pass before drawing", () => {
    expect(applyPass(makeState(), "a").ok).toBe(false);
  });
});

describe("Nuno call and penalty", () => {
  it("declaring with the play avoids the pending window", () => {
    const state = makeState({
      players: [
        { id: "a", hand: [card({ id: "a1", color: "red", value: 3 }), card({ id: "a2", color: "blue", value: 1 })], hasUno: false, eliminated: false },
        { id: "b", hand: [card({ id: "b1" })], hasUno: false, eliminated: false },
      ],
    });
    const result = applyPlay(state, "a", "a1", { declareUno: true }, rng);
    if (!result.ok) throw new Error(result.error);
    expect(result.state.players[0].hasUno).toBe(true);
    expect(result.state.pendingUnoMemberId).toBeNull();
  });

  it("forgetting opens the window; calling closes it", () => {
    const state = makeState({
      players: [
        { id: "a", hand: [card({ id: "a1", color: "red", value: 3 }), card({ id: "a2", color: "blue", value: 1 })], hasUno: false, eliminated: false },
        { id: "b", hand: [card({ id: "b1" })], hasUno: false, eliminated: false },
      ],
    });
    const played = applyPlay(state, "a", "a1", {}, rng);
    if (!played.ok) throw new Error(played.error);
    expect(played.state.pendingUnoMemberId).toBe("a");
    const called = applyUnoCall(played.state, "a");
    if (!called.ok) throw new Error(called.error);
    expect(called.state.players[0].hasUno).toBe(true);
    expect(called.state.pendingUnoMemberId).toBeNull();
  });

  it("penalizes two cards when another player acts first", () => {
    const state = makeState({
      currentIndex: 1,
      pendingUnoMemberId: "a",
      players: [
        { id: "a", hand: [card({ id: "a1" })], hasUno: false, eliminated: false },
        { id: "b", hand: [card({ id: "b1", color: "red", value: 7 }), card({ id: "b2", color: "blue", value: 1 })], hasUno: false, eliminated: false },
      ],
    });
    const result = applyPlay(state, "b", "b1", {}, rng);
    if (!result.ok) throw new Error(result.error);
    expect(result.state.players[0].hand).toHaveLength(
      1 + NUNO_CONFIG.unoPenaltyCards
    );
    // a's window is settled; b just played down to one card, so the
    // window now belongs to b.
    expect(result.state.pendingUnoMemberId).toBe("b");
  });

  it("rejects calling Nuno with more than one card", () => {
    const state = makeState({
      players: [
        { id: "a", hand: [card({ id: "a1" })], hasUno: false, eliminated: false },
        { id: "b", hand: [card({ id: "b1" }), card({ id: "b2" })], hasUno: false, eliminated: false },
      ],
    });
    expect(applyUnoCall(state, "b").ok).toBe(false);
  });
});

describe("winning", () => {
  it("ends the round and ranks placements by cards left", () => {
    const state = makeState({
      players: [
        { id: "a", hand: [card({ id: "a1", color: "red", value: 3 })], hasUno: true, eliminated: false },
        { id: "b", hand: [card({ id: "b1" }), card({ id: "b2" })], hasUno: false, eliminated: false },
        { id: "c", hand: [card({ id: "c1" })], hasUno: false, eliminated: false },
      ],
    });
    const result = applyPlay(state, "a", "a1", {}, rng);
    if (!result.ok) throw new Error(result.error);
    expect(result.state.winnerId).toBe("a");
    expect(result.state.placements).toEqual([
      { memberId: "a", cardsLeft: 0 },
      { memberId: "c", cardsLeft: 1 },
      { memberId: "b", cardsLeft: 2 },
    ]);
    // no further moves accepted
    expect(applyDraw(result.state, "b", rng).ok).toBe(false);
  });
});

describe("bot", () => {
  it("prefers number cards, then actions, then wilds", () => {
    const state = makeState({
      players: [
        {
          id: "a",
          hand: [
            { id: "w1", color: "wild", type: "wild" },
            { id: "s1", color: "red", type: "skip" },
            card({ id: "n1", color: "red", value: 8 }),
          ],
          hasUno: false,
          eliminated: false,
        },
        { id: "b", hand: [card({ id: "b1" })], hasUno: false, eliminated: false },
      ],
    });
    expect(chooseBotMove(state, rng)).toMatchObject({ kind: "play", cardId: "n1" });

    state.players[0].hand = state.players[0].hand.filter((c) => c.id !== "n1");
    expect(chooseBotMove(state, rng)).toMatchObject({ kind: "play", cardId: "s1" });

    state.players[0].hand = state.players[0].hand.filter((c) => c.id !== "s1");
    const wildMove = chooseBotMove(state, rng);
    expect(wildMove).toMatchObject({ kind: "play", cardId: "w1" });
    if (wildMove.kind === "play") expect(wildMove.chosenColor).toBeDefined();
  });

  it("draws when nothing is playable", () => {
    const state = makeState({
      players: [
        { id: "a", hand: [card({ id: "a1", color: "blue", value: 9 })], hasUno: false, eliminated: false },
        { id: "b", hand: [card({ id: "b1" })], hasUno: false, eliminated: false },
      ],
    });
    expect(chooseBotMove(state, rng)).toEqual({ kind: "draw" });
  });
});

describe("winning with an action card", () => {
  // Regression: the win used to return before the card's effect ran, so a
  // finishing +2/+4 let the next player off without drawing.
  it("still makes the next player draw when +2 wins the hand", () => {
    // Arrange: a is one card from out, holding a red draw2.
    const state = makeState({
      players: [
        { id: "a", hand: [card({ id: "a1", color: "red", type: "draw2" })], hasUno: true, eliminated: false },
        { id: "b", hand: [card({ id: "b1" }), card({ id: "b2" })], hasUno: false, eliminated: false },
        { id: "c", hand: [card({ id: "c1" })], hasUno: false, eliminated: false },
      ],
    });

    // Act
    const result = applyPlay(state, "a", "a1", {}, rng);
    if (!result.ok) throw new Error(result.error);

    // Assert
    expect(result.state.winnerId).toBe("a");
    expect(result.state.players[1].hand).toHaveLength(
      2 + NUNO_CONFIG.draw2Count
    );
  });

  it("still makes the next player draw four when +4 wins the hand", () => {
    // Arrange
    const state = makeState({
      players: [
        { id: "a", hand: [{ id: "a1", color: "wild", type: "wild4" } as NunoCard], hasUno: true, eliminated: false },
        { id: "b", hand: [card({ id: "b1" })], hasUno: false, eliminated: false },
        { id: "c", hand: [card({ id: "c1" })], hasUno: false, eliminated: false },
      ],
    });

    // Act
    const result = applyPlay(state, "a", "a1", { chosenColor: "blue" }, rng);
    if (!result.ok) throw new Error(result.error);

    // Assert
    expect(result.state.winnerId).toBe("a");
    expect(result.state.players[1].hand).toHaveLength(
      1 + NUNO_CONFIG.wild4DrawCount
    );
    expect(result.state.activeColor).toBe("blue");
  });
});

describe("quitting", () => {
  const threeSeats = () => [
    { id: "a", hand: [card({ id: "a1", color: "red", value: 3 }), card({ id: "a2" })], hasUno: false, eliminated: false },
    { id: "b", hand: [card({ id: "b1", color: "blue", value: 7 })], hasUno: false, eliminated: false },
    { id: "c", hand: [card({ id: "c1", color: "red", value: 9 })], hasUno: false, eliminated: false },
  ];

  it("eliminates the seat, folds cards under the deck, and skips it", () => {
    const state = makeState({ players: threeSeats() });
    const quit = applyQuit(state, "b");
    if (!quit.ok) throw new Error(quit.error);
    expect(quit.state.players[1].eliminated).toBe(true);
    expect(quit.state.players[1].hand).toHaveLength(0);
    expect(quit.state.deck[0].id).toBe("b1"); // folded under the deck
    // a's number play now rotates past b straight to c
    const played = applyPlay(quit.state, "a", "a1", {}, rng);
    if (!played.ok) throw new Error(played.error);
    expect(currentPlayer(played.state).id).toBe("c");
  });

  it("advances the turn when the current player quits", () => {
    const state = makeState({ players: threeSeats() });
    const quit = applyQuit(state, "a");
    if (!quit.ok) throw new Error(quit.error);
    expect(currentPlayer(quit.state).id).toBe("b");
  });

  it("last player standing wins by default", () => {
    const state = makeState({ players: threeSeats() });
    const first = applyQuit(state, "b");
    if (!first.ok) throw new Error(first.error);
    const second = applyQuit(first.state, "a");
    if (!second.ok) throw new Error(second.error);
    expect(second.state.winnerId).toBe("c");
    expect(second.state.placements?.[0]).toEqual({
      memberId: "c",
      cardsLeft: 0,
    });
    expect(
      second.state.placements?.slice(1).every((p) => p.eliminated)
    ).toBe(true);
  });

  it("rejects quitting twice", () => {
    const state = makeState({ players: threeSeats() });
    const quit = applyQuit(state, "b");
    if (!quit.ok) throw new Error(quit.error);
    expect(applyQuit(quit.state, "b").ok).toBe(false);
  });
});

describe("viewFor", () => {
  it("hides everyone else's hands and the deck", () => {
    const state = makeState();
    const view = viewFor(state, "a");
    expect(view.yourHand.map((c) => c.id)).toEqual(["a1"]);
    expect(view.players).toEqual([
      { memberId: "a", cardCount: 1, hasUno: false, eliminated: false },
      { memberId: "b", cardCount: 1, hasUno: false, eliminated: false },
    ]);
    expect(view.deckCount).toBe(6);
    expect(JSON.stringify(view)).not.toContain('"b1"');
  });
});

describe("parseState", () => {
  it("round-trips through JSON", () => {
    const state = dealGame(["a", "b"], Math.random);
    expect(parseState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it("rejects malformed state", () => {
    expect(parseState(null)).toBeNull();
    expect(parseState({ gameType: "nuno" })).toBeNull();
  });
});
