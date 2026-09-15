import { z } from "zod";
import type { GameModule, Standing } from "@/lib/game/module";
import { NUNO_CONFIG } from "@/lib/game/data/nuno";
import {
  NUNO_COLORS,
  applyDraw,
  applyPass,
  applyPlay,
  applyQuit,
  applyUnoCall,
  chooseBotMove,
  currentPlayer,
  dealGame,
  parseState,
  viewFor,
  type NunoState,
  type NunoView,
} from "@/lib/game/nuno/rules";

// Nuno as a platform game module (ADR-0005). This file is an adapter and
// nothing more — every rule still lives in rules.ts, which stays free of
// platform concepts and is what tests/nuno-rules.test.ts exercises.

/** The wire format for a Nuno move. Clients send this; the server parses it. */
export const nunoMoveSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("play"),
    cardId: z.string().min(1).max(64),
    chosenColor: z.enum(NUNO_COLORS).optional(),
    declareUno: z.boolean().optional(),
  }),
  z.object({ kind: z.literal("draw") }),
  z.object({ kind: z.literal("pass") }),
  z.object({ kind: z.literal("callUno") }),
]);
export type NunoMove = z.infer<typeof nunoMoveSchema>;

/** Placements once the hand is over; live seats rank by cards left. */
function standings(state: NunoState): Standing[] {
  const order = state.placements
    ? state.placements.map((p) => p.memberId)
    : // Mid-hand (an abandoned game): fewest cards ranks highest, and
      // anyone who quit drops below everyone still holding cards.
      [...state.players]
        .sort((a, b) => {
          if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
          return a.hand.length - b.hand.length;
        })
        .map((p) => p.id);

  return order.map((memberId) => {
    const placement = state.placements?.find((p) => p.memberId === memberId);
    const seat = state.players.find((p) => p.id === memberId);
    const cardsLeft = placement?.cardsLeft ?? seat?.hand.length ?? 0;
    const eliminated = placement?.eliminated ?? seat?.eliminated ?? false;
    return {
      memberId,
      detail: eliminated
        ? "quit"
        : cardsLeft === 0
          ? "went out"
          : `${cardsLeft} ${cardsLeft === 1 ? "card" : "cards"} left`,
      eliminated,
    };
  });
}

export const nunoModule: GameModule<NunoState, NunoView, NunoMove> = {
  id: NUNO_CONFIG.gameType,
  moveSchema: nunoMoveSchema,
  parseState,
  deal: (memberIds, ctx) => dealGame(memberIds, ctx.random),
  viewFor,

  apply(state, memberId, move, ctx) {
    switch (move.kind) {
      case "play":
        return applyPlay(state, memberId, move.cardId, {
          chosenColor: move.chosenColor,
          declareUno: move.declareUno === true,
        });
      case "draw":
        // ctx.random is not optional here: an empty deck reshuffles the
        // discard pile mid-draw, and that shuffle must come from the
        // injected RNG or seeded replays diverge (ADR-0005 Amendment 1).
        return applyDraw(state, memberId, ctx.random);
      case "pass":
        return applyPass(state, memberId);
      case "callUno":
        return applyUnoCall(state, memberId);
    }
  },

  quit: (state, memberId) => applyQuit(state, memberId),

  botMove(state, memberId, ctx) {
    if (state.winnerId) return null;
    if (currentPlayer(state).id !== memberId) return null;
    const move = chooseBotMove(state, ctx.random);
    // Bots never forget to call it.
    return move.kind === "play" ? { ...move, declareUno: true } : move;
  },

  currentMemberId: (state) =>
    state.winnerId ? null : (currentPlayer(state)?.id ?? null),

  winnerId: (state) => state.winnerId,

  standings,
};
