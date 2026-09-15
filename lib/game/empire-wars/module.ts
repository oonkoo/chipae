import type { GameModule, Standing } from "@/lib/game/module";
import { EMPIRE_WARS_CONFIG } from "@/lib/game/data/empire-wars";
import {
  currentPlayer,
  dealGame,
  netWorth,
  parseState,
  standingsOrder,
  type EmpireState,
} from "@/lib/game/empire-wars/rules";
import {
  applyMove,
  applyQuit,
  empireMoveSchema,
  turnHasExpired,
  type EmpireMove,
} from "@/lib/game/empire-wars/turn";
import { chooseBotMove } from "@/lib/game/empire-wars/bot";
import { viewFor, type EmpireView } from "@/lib/game/empire-wars/view";

// Empire Wars as a platform game module (ADR-0005). An adapter and nothing
// more — every rule lives in rules/turn, which stay free of platform concepts
// and are what the test suite exercises directly.

function coins(value: number): string {
  return value.toLocaleString("en-US");
}

function standings(state: EmpireState): Standing[] {
  return standingsOrder(state).map((memberId) => {
    const player = state.players.find((p) => p.id === memberId)!;
    if (player.status === "bankrupt") {
      return {
        memberId,
        detail: `Bankrupt · round ${player.outRound ?? state.round}`,
        eliminated: true,
      };
    }
    if (player.status === "quit") {
      return { memberId, detail: "Walked away", eliminated: true };
    }
    return {
      memberId,
      detail: `${coins(netWorth(state, memberId))} net worth`,
      eliminated: false,
    };
  });
}

export const empireWarsModule: GameModule<EmpireState, EmpireView, EmpireMove> = {
  id: EMPIRE_WARS_CONFIG.gameType,
  moveSchema: empireMoveSchema,
  parseState,

  // Turn order is seat order and the board starts empty — nothing to shuffle.
  // With humans seated the match opens on setup: they choose its settings
  // (ADR-0005 Amendment 2 — `ctx.humans` reaches `deal` too).
  deal: (memberIds, ctx) => dealGame(memberIds, ctx.now, { humans: ctx.humans }),

  viewFor,

  apply: (state, memberId, move, ctx) => applyMove(state, memberId, move, ctx),

  quit: (state, memberId, ctx) => applyQuit(state, memberId, ctx),

  botMove: (state, memberId, ctx) => chooseBotMove(state, memberId, ctx),

  /**
   * Whoever the table is waiting on. During a trade that's the recipient, not
   * the proposer — which is exactly what lets the platform drive a CPU's
   * answer, and time out a human's. During setup every human picks at once,
   * so it's the first seat still in: the one the platform asks to close the
   * choosing when the clock runs out.
   */
  currentMemberId: (state) => {
    if (state.winnerId) return null;
    if (state.phase === "trade" && state.trade) return state.trade.toId;
    return currentPlayer(state)?.id ?? null;
  },

  winnerId: (state) => state.winnerId,

  standings,

  turnExpired: (state, now) => turnHasExpired(state, now),
};
