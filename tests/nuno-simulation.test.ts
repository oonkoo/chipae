import { describe, expect, it } from "vitest";
import { NUNO_CONFIG } from "@/lib/game/data/nuno";
import {
  applyDraw,
  applyPass,
  applyPlay,
  chooseBotMove,
  currentPlayer,
  dealGame,
  topCard,
  type NunoState,
} from "@/lib/game/nuno/rules";

// Full-game simulation: drives complete hands with the bot policy and
// asserts the rulebook holds every single turn — card conservation, the
// draw penalties landing on the right seat, direction/skip behaviour, and
// termination. Guards against regressions no single-move test would catch.

/** Deterministic RNG so a failure is always reproducible. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function allCards(state: NunoState) {
  return [
    ...state.deck,
    ...state.discard,
    ...state.players.flatMap((p) => p.hand),
  ];
}

function handCounts(state: NunoState): Record<string, number> {
  return Object.fromEntries(state.players.map((p) => [p.id, p.hand.length]));
}

/** Index of the next active seat, mirroring the rules' own rotation. */
function nextActiveIndex(state: NunoState, from: number): number {
  const n = state.players.length;
  let i = from;
  do {
    i = (((i + state.direction) % n) + n) % n;
  } while (state.players[i].eliminated && i !== from);
  return i;
}

describe("nuno full-game simulation", () => {
  const seatCounts = [2, 3, 4, 6];

  for (const seats of seatCounts) {
    it(`plays ${seats}-seat hands to completion without breaking the rules`, () => {
      for (let game = 0; game < 25; game++) {
        const rng = seeded(seats * 1000 + game);
        const ids = Array.from({ length: seats }, (_, i) => `p${i}`);
        let state = dealGame(ids, rng);

        // Deal is sane.
        expect(allCards(state)).toHaveLength(108);
        for (const p of state.players) {
          expect(p.hand).toHaveLength(NUNO_CONFIG.handSize);
        }

        let turns = 0;
        while (!state.winnerId && turns < 4000) {
          turns++;
          const actor = currentPlayer(state);
          const before = handCounts(state);
          const beforeTop = topCard(state);
          const beforeDirection = state.direction;
          const beforeTargetIndex = nextActiveIndex(state, state.currentIndex);
          const targetId = state.players[beforeTargetIndex].id;

          const move = chooseBotMove(state, rng);
          const result =
            move.kind === "play"
              ? applyPlay(
                  state,
                  actor.id,
                  move.cardId,
                  { chosenColor: move.chosenColor, declareUno: true },
                  rng
                )
              : move.kind === "draw"
                ? applyDraw(state, actor.id, rng)
                : applyPass(state, actor.id);

          expect(result.ok, `move rejected: ${JSON.stringify(move)}`).toBe(
            true
          );
          if (!result.ok) return;
          const next = result.state;

          // ── Conservation: no card invented or lost, ever.
          const cards = allCards(next);
          expect(cards).toHaveLength(108);
          expect(new Set(cards.map((c) => c.id)).size).toBe(108);

          if (move.kind === "play") {
            const played = beforeTop; // for reference; new top is the played card
            expect(played).toBeDefined();
            const card = next.discard[next.discard.length - 1];

            // The actor shed exactly the card they played.
            expect(next.players.find((p) => p.id === actor.id)!.hand.length)
              .toBe(before[actor.id] - 1);

            // ── Draw penalties land on the next seat, exact amount.
            if (card.type === "draw2") {
              expect(
                handCounts(next)[targetId] - before[targetId],
                "+2 must give the next player exactly 2 cards"
              ).toBe(NUNO_CONFIG.draw2Count);
            }
            if (card.type === "wild4") {
              expect(
                handCounts(next)[targetId] - before[targetId],
                "+4 must give the next player exactly 4 cards"
              ).toBe(NUNO_CONFIG.wild4DrawCount);
            }
            // ── Penalised seat also loses their turn.
            if (
              (card.type === "draw2" ||
                card.type === "wild4" ||
                card.type === "skip") &&
              next.players.filter((p) => !p.eliminated).length > 2
            ) {
              expect(
                currentPlayer(next).id,
                "skipped seat must not be on turn"
              ).not.toBe(targetId);
            }
            // ── Reverse flips direction (3+ seats).
            if (card.type === "reverse" && state.players.length > 2) {
              expect(next.direction).toBe(beforeDirection === 1 ? -1 : 1);
            }
            // ── Wilds always set a concrete active colour.
            if (card.color === "wild") {
              expect(["red", "blue", "green", "yellow"]).toContain(
                next.activeColor
              );
            } else {
              expect(next.activeColor).toBe(card.color);
            }
          }

          if (move.kind === "draw") {
            const gained =
              handCounts(next)[actor.id] - before[actor.id];
            // Drew one, unless the deck and discard were both exhausted.
            expect(gained === 1 || gained === 0).toBe(true);
          }

          state = next;
        }

        expect(state.winnerId, "game should finish").not.toBeNull();
        const winner = state.players.find((p) => p.id === state.winnerId)!;
        expect(winner.hand).toHaveLength(0);
        expect(state.placements).not.toBeNull();
        expect(state.placements![0].memberId).toBe(state.winnerId);
      }
    });
  }
});
