import { describe, expect, it } from "vitest";
import { SETUP } from "@/lib/game/data/empire-wars";
import { playMatch, summarize } from "@/lib/game/empire-wars/simulate";

// Empire Wars v3 — the GDD's "Measured match shape" is a contract, not a hope
// (design/gdd/empire-wars-core.md > Acceptance Criteria > Calibration). It is
// measured on the standard match — the settings a table plays when nobody
// picks, and the ones the picker starts on.
//
// Every match here is seeded, so this suite is deterministic. A failure is a
// bug to investigate. The fix is never to widen a band until it passes: if a
// knob changes on purpose, the GDD's tables change in the same commit.

describe("calibration of the standard match at 4 seats (1,000 seeded matches)", () => {
  const four = summarize(4, 1000);

  it("ends on the net-worth target in at least 90% of matches", () => {
    expect(four.endedOnTarget).toBeGreaterThanOrEqual(0.9);
  });

  it("puts the median last round between 25 and 31", () => {
    expect(four.medianLastRound).toBeGreaterThanOrEqual(25);
    expect(four.medianLastRound).toBeLessThanOrEqual(31);
  });

  it("forms whole empires and raises monuments — the middle game exists", () => {
    expect(four.averageWholeEmpires).toBeGreaterThanOrEqual(1.8);
    expect(four.monumentRate).toBeGreaterThanOrEqual(0.8);
    expect(four.averageTradesAccepted).toBeGreaterThan(1.5);
  });

  it("almost never knocks anyone out before round 12", () => {
    expect(four.bankruptBeforeRound12).toBeLessThanOrEqual(0.02);
  });

  it("keeps the early leader beatable", () => {
    expect(four.roundTenLeaderWins).toBeLessThanOrEqual(0.45);
  });

  it("keeps a CPU turn short, and never proposes a move the rules reject", () => {
    expect(four.maxMovesInATurn).toBeLessThanOrEqual(7);
    expect(four.rejected).toBe(0);
    expect(four.unfinished).toBe(0);
  });
});

describe("calibration at 2 and 6 seats (500 seeded matches each)", () => {
  // GDD > Measured match shape: 60% at 2 seats, 95% at 6.
  it.each([
    [2, 0.6],
    [6, 0.95],
  ])("%i seats end on target within ±10 points of the GDD", (seats, published) => {
    const summary = summarize(seats, 500);
    expect(Math.abs(summary.endedOnTarget - published)).toBeLessThanOrEqual(0.1);
    expect(summary.rejected).toBe(0);
  });
});

describe("every setting a table can pick", () => {
  // GDD > Match setup: 16 combinations. Each must play to a winner inside its
  // own limits — Unlimited-and-Unlimited included, which is what the safety
  // net is for.
  const combos = SETUP.targets.flatMap((target) => SETUP.rounds.map((rounds) => ({ target, rounds })));

  it.each(combos)("target $target, rounds $rounds: 20 CPU matches at 4 seats all finish", (settings) => {
    const limit = settings.rounds ?? (settings.target === null ? SETUP.safetyRounds : Infinity);
    for (let seed = 1; seed <= 20; seed++) {
      const report = playMatch(4, seed, settings);
      expect(report.rejected).toBe(0);
      expect(report.winnerId).not.toBeNull();
      expect(report.lastRound).toBeLessThanOrEqual(limit);
      if (settings.target === null) expect(report.endedBy).not.toBe("target");
    }
  });
});

describe("a full table of CPUs", () => {
  it("reaches a winner within the round limit from a fixed seed, without a rejected move", () => {
    const report = playMatch(6, 20260910);
    expect(report.rejected).toBe(0);
    expect(report.winnerId).not.toBeNull();
    expect(report.lastRound).toBeLessThanOrEqual(SETUP.defaults.rounds);
  });

  it("plays the same match twice from the same seed", () => {
    expect(playMatch(4, 77)).toEqual(playMatch(4, 77));
  });
});
