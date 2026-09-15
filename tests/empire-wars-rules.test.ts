import { describe, expect, it } from "vitest";
import {
  BOARD_SIZE,
  CITIES,
  EMPIRES,
  EMPIRE_WARS_CONFIG,
  MONUMENT_LEVEL,
  SETUP,
  SPECIAL_TILES,
} from "@/lib/game/data/empire-wars";
import {
  buildCost,
  buildingSalePrice,
  canBuildOn,
  cityValue,
  citySalePrice,
  dealGame,
  netWorth,
  parseState,
  tributeAt,
  tributeOf,
  type EmpireState,
} from "@/lib/game/empire-wars/rules";

// Empire Wars v3 — the board, the formulas and the deal, checked against the
// tables the GDD publishes (design/gdd/empire-wars-core.md > Formulas). These
// numbers are the contract: a failure means code and document disagree.

const NOW = 1_760_000_000_000;

function dealt(seats = ["a", "b", "c", "d"]): EmpireState {
  return structuredClone(dealGame(seats, NOW));
}
const slot = (s: EmpireState, id: string) => s.cities.find((c) => c.id === id)!;
function own(s: EmpireState, ids: string[], ownerId: string, level = 0) {
  for (const id of ids) Object.assign(slot(s, id), { ownerId, level });
}

describe("the board", () => {
  it("has 32 tiles: 24 cities in 8 empires of 3, plus 8 specials", () => {
    expect(BOARD_SIZE).toBe(32);
    expect(CITIES).toHaveLength(24);
    expect(SPECIAL_TILES.map((s) => s.tile)).toEqual([0, 4, 8, 12, 16, 20, 24, 28]);
    const tiles = [...CITIES.map((c) => c.tile), ...SPECIAL_TILES.map((s) => s.tile)];
    expect(new Set(tiles).size).toBe(32);
    for (const empire of EMPIRES) {
      expect(CITIES.filter((c) => c.empire === empire.id)).toHaveLength(3);
    }
  });

  it("puts each empire on its documented tiles, cheapest to richest", () => {
    const tilesOf = (id: string) => CITIES.filter((c) => c.empire === id).map((c) => c.tile);
    expect(EMPIRES.map((e) => [e.id, e.price, tilesOf(e.id)])).toEqual([
      ["ottoman", 100, [1, 2, 3]],
      ["rome", 140, [5, 6, 7]],
      ["mongol", 180, [9, 10, 11]],
      ["ming", 220, [13, 14, 15]],
      ["mughal", 260, [17, 18, 19]],
      ["france", 300, [21, 22, 23]],
      ["britain", 340, [25, 26, 27]],
      ["bengal", 380, [29, 30, 31]],
    ]);
  });

  it("makes Bengal the richest empire: Sonargaon, Dhaka, Murshidabad", () => {
    expect(CITIES.filter((c) => c.empire === "bengal").map((c) => c.name)).toEqual([
      "Sonargaon",
      "Dhaka",
      "Murshidabad",
    ]);
    expect(EMPIRES.at(-1)?.monument).toBe("Hazarduari Palace");
  });

  it("never names a city twice, and gives every empire one monument", () => {
    expect(new Set(CITIES.map((c) => c.name)).size).toBe(24);
    expect(new Set(EMPIRES.map((e) => e.monument)).size).toBe(8);
  });

  it("keeps every price a multiple of 20, so no formula needs rounding", () => {
    for (const e of EMPIRES) expect(e.price % 20).toBe(0);
  });
});

describe("tribute", () => {
  /** GDD > Formulas: base 10% of price; ×2 whole; ×5/15/40/55 houses; ×75 monument. */
  const MULTS = [5, 15, 40, 55, 75];

  it("matches the formula for every empire, holding and level (8 × 7 cases)", () => {
    for (const { price } of EMPIRES) {
      const base = price / 10;
      expect(tributeAt(price, 0, false)).toBe(base);
      expect(tributeAt(price, 0, true)).toBe(base * 2);
      for (let level = 1; level <= MONUMENT_LEVEL; level++) {
        expect(tributeAt(price, level, true)).toBe(base * MULTS[level - 1]);
      }
    }
  });

  it("is always whole coins", () => {
    for (const { price } of EMPIRES)
      for (let level = 0; level <= MONUMENT_LEVEL; level++)
        for (const whole of [false, true])
          expect(Number.isInteger(tributeAt(price, level, whole))).toBe(true);
  });

  it("doubles for an owner holding the whole empire, read off the board", () => {
    const s = dealt();
    own(s, ["marseille", "lyon"], "a");
    expect(tributeOf(s, 16)).toBe(30);
    own(s, ["paris"], "a");
    expect(tributeOf(s, 16)).toBe(60);
  });

  it("tops out at 2,850 for Bengal's monument", () => {
    expect(tributeAt(380, MONUMENT_LEVEL, true)).toBe(2850);
  });
});

describe("building, value and sales", () => {
  it("charges half the price for every level, monument included", () => {
    expect(EMPIRES.map((e) => buildCost(e.price))).toEqual([50, 70, 90, 110, 130, 150, 170, 190]);
  });

  it("values a city at its price plus its buildings", () => {
    expect([0, 1, 4, 5].map((level) => cityValue(300, level))).toEqual([300, 450, 900, 1050]);
  });

  it("sells a building for half its cost and a bare city for half its price", () => {
    expect(buildingSalePrice(300)).toBe(75);
    expect(citySalePrice(300)).toBe(150);
  });

  it("lets you build only on a whole empire", () => {
    const s = dealt();
    own(s, ["marseille", "lyon"], "a");
    expect(canBuildOn(s, "a", 15)).toBe(false);
    own(s, ["paris"], "a");
    expect(canBuildOn(s, "a", 15)).toBe(true);
  });

  it("allows one monument per empire, and only on a city with 4 houses", () => {
    // City indexes: France is 15 Marseille · 16 Lyon · 17 Paris.
    const s = dealt();
    own(s, ["marseille", "lyon", "paris"], "a", 4);
    expect(canBuildOn(s, "a", 17)).toBe(true);
    slot(s, "paris").level = MONUMENT_LEVEL;
    expect(canBuildOn(s, "a", 17)).toBe(false);
    // France has its Eiffel Tower now: Marseille stops at 4 houses…
    expect(canBuildOn(s, "a", 15)).toBe(false);
    // …but can still build back up to them.
    slot(s, "marseille").level = 3;
    expect(canBuildOn(s, "a", 15)).toBe(true);
  });
});

describe("net worth", () => {
  it("is coins plus the value of every city, buildings included", () => {
    const s = dealt();
    s.players[0].cash = 900;
    own(s, ["edirne"], "a", 0); // 100
    own(s, ["paris"], "a", 2); // 300 + 2 × 150
    expect(netWorth(s, "a")).toBe(900 + 100 + 600);
  });

  it("doesn't count the treasury", () => {
    const s = { ...dealt(), treasury: 500 };
    expect(netWorth(s, "a")).toBe(EMPIRE_WARS_CONFIG.startingCash);
  });
});

describe("the deal", () => {
  it("seats everyone with 1,500 coins on the Silk Road, owning nothing", () => {
    const s = dealt();
    for (const p of s.players) {
      expect(p).toMatchObject({ cash: 1500, tile: 0, inJail: false, status: "in" });
    }
    expect(s.cities.every((c) => c.ownerId === null && c.level === 0)).toBe(true);
    expect(s).toMatchObject({ round: 1, currentIndex: 0, treasury: 0, phase: "roll" });
  });

  it("plays the standard settings from the first roll when every seat is a CPU", () => {
    const s = dealt();
    expect(s).toMatchObject({
      phase: "roll",
      setup: null,
      target: SETUP.defaults.target,
      roundLimit: SETUP.defaults.rounds,
    });
  });

  it("opens on setup when humans are seated, and only they pick", () => {
    const s = dealGame(["a", "b", "c"], NOW, { humans: ["a", "c", "not-seated"] });
    expect(s.phase).toBe("setup");
    expect(s.setup).toEqual({ humans: ["a", "c"], picks: [], expiresAt: NOW + SETUP.windowMs });
    expect(s.turnExpiresAt).toBe(NOW + SETUP.windowMs);
  });

  it("plays settings it's given without asking — Unlimited included", () => {
    const s = dealGame(["a", "b"], NOW, { humans: ["a"], settings: { target: null, rounds: null } });
    expect(s).toMatchObject({ phase: "roll", setup: null, target: null, roundLimit: null });
  });

  it("starts the first seat's clock at the deal", () => {
    expect(dealt().turnExpiresAt).toBe(NOW + EMPIRE_WARS_CONFIG.turnWindowMs);
  });
});

describe("parseState", () => {
  it("round-trips a dealt state through JSON", () => {
    const s = dealt();
    expect(parseState(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it("fails closed on a v2 state, so a match from before the re-theme is retired", () => {
    const v2 = { ...dealt(), ruleset: 2, territories: [], pot: 0 };
    expect(parseState(v2)).toBeNull();
  });

  it("fails closed on a v3 state from before match setup", () => {
    const v3: Record<string, unknown> = { ...dealt(), ruleset: 3 };
    delete v3.setup;
    delete v3.roundLimit;
    expect(parseState(v3)).toBeNull();
  });

  it("round-trips a table mid-setup, picks and all", () => {
    const s = structuredClone(dealGame(["a", "b"], NOW, { humans: ["a", "b"] }));
    s.setup!.picks.push({ memberId: "a", target: null, rounds: 100 });
    expect(parseState(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it("rejects a turn pointer off the end of the table", () => {
    expect(parseState({ ...dealt(), currentIndex: 9 })).toBeNull();
  });
});
