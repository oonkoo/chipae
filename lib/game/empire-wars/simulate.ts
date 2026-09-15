import type { MoveContext } from "@/lib/game/module";
import { EMPIRES, MONUMENT_LEVEL, SETUP } from "@/lib/game/data/empire-wars";
import {
  currentPlayer,
  dealGame,
  leaderOf,
  ownsWholeEmpire,
  playersIn,
  type EmpireState,
  type EndedBy,
  type MatchSettings,
} from "@/lib/game/empire-wars/rules";
import { applyMove } from "@/lib/game/empire-wars/turn";
import { chooseBotMove } from "@/lib/game/empire-wars/bot";

// Seeded all-CPU matches, played through the real transitions. This is how
// the GDD's "Measured match shape" is calibrated, and how
// tests/empire-wars-sim.test.ts holds the implementation to it. Pure and
// deterministic: the same seed always plays the same match.
//
// With no `ctx.humans`, every seat is a CPU — so there's no setup to choose
// (the match plays the settings it's given), auctions settle the instant they
// open, and trades are answered by CPU logic.

/** What a table plays when nobody chooses (GDD > Match setup). */
export const DEFAULT_SETTINGS: MatchSettings = {
  target: SETUP.defaults.target,
  rounds: SETUP.defaults.rounds,
};

/** mulberry32 — a small, fast, well-distributed seeded generator. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type MatchReport = {
  seats: number;
  seed: number;
  settings: MatchSettings;
  winnerId: string | null;
  endedBy: EndedBy | null;
  /** The round the match ended in. */
  lastRound: number;
  /** Turns taken, counting a jailed seat's skipped turn. */
  turns: number;
  /** Turns that asked the landing question. */
  questions: number;
  /** Most moves one seat made in a single turn (roll, answer, builds, trades, end). */
  maxMovesInATurn: number;
  /** CPU moves the rules refused. Anything but 0 is a bug. */
  rejected: number;
  bankruptcies: number;
  firstBankruptRound: number | null;
  leaderAtRound10: string | null;
  /** Empires held whole by one player when the match ended. */
  wholeEmpiresAtEnd: number;
  /** Did any city reach its monument during the match? */
  monumentBuilt: boolean;
  builds: number;
  auctions: number;
  auctionsWon: number;
  tradesOffered: number;
  tradesAccepted: number;
};

/**
 * Safety net against a rules bug. A 30-round match is a few hundred moves,
 * and even a match that runs to `SETUP.safetyRounds` at six seats stays well
 * under this. A match that hits it ends with no winner, and `summarize`
 * counts it.
 */
const MOVE_GUARD = 50_000;

export function playMatch(seats: number, seed: number, settings: MatchSettings = DEFAULT_SETTINGS): MatchReport {
  const ctx: MoveContext = { random: seededRandom(seed), now: 0 };
  const ids = Array.from({ length: seats }, (_, i) => `seat-${i + 1}`);
  let state: EmpireState = dealGame(ids, ctx.now, { settings });

  const report: MatchReport = {
    seats,
    seed,
    settings,
    winnerId: null,
    endedBy: null,
    lastRound: 1,
    turns: 0,
    questions: 0,
    maxMovesInATurn: 0,
    rejected: 0,
    bankruptcies: 0,
    firstBankruptRound: null,
    leaderAtRound10: null,
    wholeEmpiresAtEnd: 0,
    monumentBuilt: false,
    builds: 0,
    auctions: 0,
    auctionsWon: 0,
    tradesOffered: 0,
    tradesAccepted: 0,
  };
  let movesThisTurn = 0;

  for (let guard = 0; guard < MOVE_GUARD && !state.winnerId; guard++) {
    // Whoever the table waits on: the turn's owner, or a trade's recipient.
    const seatId =
      state.phase === "trade" && state.trade ? state.trade.toId : currentPlayer(state)?.id;
    if (!seatId) break;
    const move = chooseBotMove(state, seatId, ctx);
    if (!move) break;
    const result = applyMove(state, seatId, move, ctx);
    if (!result.ok) {
      report.rejected++;
      break;
    }
    const next = result.state;

    if (move.kind === "roll") {
      report.turns++;
      movesThisTurn = 1;
      if (next.phase === "answer") report.questions++;
    } else if (move.kind !== "answerTrade") {
      movesThisTurn++;
    }
    report.maxMovesInATurn = Math.max(report.maxMovesInATurn, movesThisTurn);

    for (const e of next.events) {
      if (e.seq !== next.version) continue;
      if (e.kind === "jail-skip") report.turns++;
      if (e.kind === "build") report.builds++;
      if (e.kind === "build" && e.level === MONUMENT_LEVEL) report.monumentBuilt = true;
      if (e.kind === "auction-open") report.auctions++;
      if (e.kind === "auction-won") report.auctionsWon++;
      if (e.kind === "trade-offered") report.tradesOffered++;
      if (e.kind === "trade-accepted") report.tradesAccepted++;
    }

    // Compared seat by seat rather than read from the feed, which is bounded
    // and could in principle drop an event from a very busy move.
    for (const player of next.players) {
      const before = state.players.find((p) => p.id === player.id);
      if (player.status === "bankrupt" && before?.status !== "bankrupt") {
        report.bankruptcies++;
        report.firstBankruptRound ??= player.outRound;
      }
    }

    if (report.leaderAtRound10 === null && next.round > 10 && !next.winnerId) {
      report.leaderAtRound10 = leaderOf(next, playersIn(next)).id;
    }
    state = next;
  }

  report.winnerId = state.winnerId;
  report.endedBy = state.endedBy;
  report.lastRound = state.round;
  report.wholeEmpiresAtEnd = EMPIRES.filter((e) =>
    state.players.some((p) => p.status === "in" && ownsWholeEmpire(state, p.id, e.id))
  ).length;
  return report;
}

export type CalibrationSummary = {
  seats: number;
  matches: number;
  settings: MatchSettings;
  /** Matches that hit the move guard without a winner. Anything but 0 is a finding. */
  unfinished: number;
  endedOnRounds: number;
  endedLastStanding: number;
  /** The round by which 90% of matches had ended. */
  p90LastRound: number;
  maxLastRound: number;
  /** Fractions of matches, 0–1. */
  endedOnTarget: number;
  anyBankruptcy: number;
  bankruptBeforeRound12: number;
  /** Of matches that reached round 11, how often the round-10 leader won. */
  roundTenLeaderWins: number;
  medianLastRound: number;
  averageTurns: number;
  /** Share of turns that asked the landing question. */
  questionRate: number;
  maxMovesInATurn: number;
  rejected: number;
  averageWholeEmpires: number;
  monumentRate: number;
  averageBuilds: number;
  averageAuctions: number;
  averageTradesAccepted: number;
};

/** Play `matches` seeded matches at one table size and summarise them. */
export function summarize(
  seats: number,
  matches: number,
  firstSeed = 1,
  settings: MatchSettings = DEFAULT_SETTINGS
): CalibrationSummary {
  const reports = Array.from({ length: matches }, (_, i) => playMatch(seats, firstSeed + i, settings));
  const share = (test: (r: MatchReport) => boolean) => reports.filter(test).length / matches;
  const mean = (pick: (r: MatchReport) => number) =>
    reports.reduce((total, r) => total + pick(r), 0) / matches;
  const rounds = reports.map((r) => r.lastRound).sort((a, b) => a - b);
  const withLeader = reports.filter((r) => r.leaderAtRound10 !== null);
  const totalTurns = reports.reduce((total, r) => total + r.turns, 0);

  return {
    seats,
    matches,
    settings,
    unfinished: reports.filter((r) => r.winnerId === null).length,
    endedOnRounds: share((r) => r.endedBy === "rounds"),
    endedLastStanding: share((r) => r.endedBy === "last-standing"),
    p90LastRound: rounds[Math.min(rounds.length - 1, Math.floor(rounds.length * 0.9))],
    maxLastRound: rounds[rounds.length - 1],
    endedOnTarget: share((r) => r.endedBy === "target"),
    anyBankruptcy: share((r) => r.bankruptcies > 0),
    bankruptBeforeRound12: share((r) => r.firstBankruptRound !== null && r.firstBankruptRound < 12),
    roundTenLeaderWins: withLeader.length
      ? withLeader.filter((r) => r.leaderAtRound10 === r.winnerId).length / withLeader.length
      : 0,
    medianLastRound: rounds[Math.floor(rounds.length / 2)],
    averageTurns: totalTurns / matches,
    questionRate: totalTurns ? reports.reduce((total, r) => total + r.questions, 0) / totalTurns : 0,
    maxMovesInATurn: Math.max(...reports.map((r) => r.maxMovesInATurn)),
    rejected: reports.reduce((total, r) => total + r.rejected, 0),
    averageWholeEmpires: mean((r) => r.wholeEmpiresAtEnd),
    monumentRate: share((r) => r.monumentBuilt),
    averageBuilds: mean((r) => r.builds),
    averageAuctions: mean((r) => r.auctions),
    averageTradesAccepted: mean((r) => r.tradesAccepted),
  };
}
