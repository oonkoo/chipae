import { describe, expect, it } from "vitest";
import type { MoveContext } from "@/lib/game/module";
import {
  AUCTION,
  CARDS,
  DUNGEON_TILE,
  EMPIRE_WARS_CONFIG,
  MONUMENT_LEVEL,
  SETUP,
  type Deck,
} from "@/lib/game/data/empire-wars";
import { dealGame, netWorth, type EmpireState } from "@/lib/game/empire-wars/rules";
import {
  applyMove,
  applyQuit,
  empireMoveSchema,
  turnHasExpired,
  type EmpireMove,
} from "@/lib/game/empire-wars/turn";
import { chooseBotMove, cpuAcceptsTrade } from "@/lib/game/empire-wars/bot";
import { viewFor } from "@/lib/game/empire-wars/view";
import { empireWarsModule } from "@/lib/game/empire-wars/module";

// Empire Wars v3 — every move, tile, card and money path, through the real
// transition with scripted dice (design/gdd/empire-wars-core.md > Acceptance
// Criteria). Scenarios are built by hand so each one tests exactly one rule.
//
// City tiles used here: Ottoman 1 Edirne · 2 Bursa · 3 Istanbul;
// Mongol 9 Tabriz · 10 Sarai · 11 Karakorum; Ming 13 Guangzhou · 14 Nanjing ·
// 15 Beijing; Mughal 17 Lahore · 18 Delhi · 19 Agra; France 21 Marseille ·
// 22 Lyon · 23 Paris; Bengal 29 Sonargaon · 30 Dhaka · 31 Murshidabad.

const NOW = 1_760_000_000_000;

/** A random() that replays these values in order, then 0. */
function scripted(values: number[] = [], opts: { now?: number; humans?: string[] } = {}): MoveContext {
  let i = 0;
  return { random: () => values[i++] ?? 0, now: opts.now ?? NOW, humans: opts.humans };
}
/** The random() value that makes a die show `face`. */
const die = (face: number) => (face - 1) / 6 + 0.01;
/** The random() value that draws this card from its deck. */
function card(deck: Deck, id: string): number {
  const index = CARDS[deck].findIndex((c) => c.id === id);
  if (index < 0) throw new Error(`no card ${id}`);
  return (index + 0.5) / CARDS[deck].length;
}
const roll = (d1: number, d2: number, ...then: number[]) => [die(d1), die(d2), ...then];

function setup(seats: string[], edit?: (s: EmpireState) => void): EmpireState {
  const s = structuredClone(dealGame(seats, NOW));
  edit?.(s);
  return s;
}
const player = (s: EmpireState, id: string) => s.players.find((p) => p.id === id)!;
const city = (s: EmpireState, tile: number) => s.cities[cityIndex(tile)];
function cityIndex(tile: number): number {
  // Tiles 1–3, 5–7, … map onto 0–23, skipping the special tile every 4th.
  return tile - Math.floor(tile / 4) - 1;
}
function give(s: EmpireState, tiles: number[], ownerId: string, level = 0) {
  for (const t of tiles) Object.assign(city(s, t), { ownerId, level });
}
function place(s: EmpireState, id: string, tile: number, cash?: number) {
  const p = player(s, id);
  p.tile = tile;
  if (cash !== undefined) p.cash = cash;
}
const turnOf = (s: EmpireState) => s.players[s.currentIndex].id;

function play(s: EmpireState, memberId: string, move: EmpireMove, ctx = scripted()) {
  const result = applyMove(s, memberId, move, ctx);
  if (!result.ok) throw new Error(`move rejected: ${result.error}`);
  return result.state;
}
function reject(s: EmpireState, memberId: string, move: EmpireMove, ctx = scripted()) {
  const result = applyMove(s, memberId, move, ctx);
  expect(result.ok).toBe(false);
  return result.ok ? "" : result.error;
}
/** Roll, then end the turn if it lands in the manage step. */
function rollAndEnd(s: EmpireState, id: string, values: number[], ctx?: { humans?: string[] }) {
  const next = play(s, id, { kind: "roll" }, scripted(values, ctx));
  return next.phase === "manage" ? play(next, id, { kind: "endTurn" }) : next;
}

// ─── Moving and the turn's shape ─────────────────────────────────────────────

describe("a turn", () => {
  it("moves by the dice, pays 200 once for passing the Silk Road, then waits in manage", () => {
    const s = setup(["a", "b"], (x) => place(x, "a", 30));
    const next = play(s, "a", { kind: "roll" }, scripted(roll(2, 2)));
    // 30 + 4 → 2 (Bursa), passing the Silk Road.
    expect(player(next, "a").tile).toBe(2);
    expect(player(next, "a").cash).toBe(1700);
    expect(next.phase).toBe("answer");
  });

  it("lands in manage when nothing is asked, and only End turn passes the turn", () => {
    const s = setup(["a", "b"], (x) => place(x, "a", 26));
    const landed = play(s, "a", { kind: "roll" }, scripted(roll(3, 3)));
    expect(landed.phase).toBe("manage");
    expect(turnOf(landed)).toBe("a");
    const ended = play(landed, "a", { kind: "endTurn" });
    expect(turnOf(ended)).toBe("b");
    expect(ended.phase).toBe("roll");
  });

  it("refuses moves out of phase, and moves from a seat that isn't on the clock", () => {
    const s = setup(["a", "b"]);
    reject(s, "a", { kind: "endTurn" });
    reject(s, "b", { kind: "roll" });
    const asked = play(s, "a", { kind: "roll" }, scripted(roll(1, 1)));
    reject(asked, "a", { kind: "roll" });
    reject(asked, "a", { kind: "endTurn" });
    reject(asked, "a", { kind: "buy", tile: 3 });
  });

  it("leaves the state untouched when it refuses", () => {
    const s = setup(["a", "b"]);
    const copy = structuredClone(s);
    applyMove(s, "b", { kind: "roll" }, scripted(roll(3, 3)));
    expect(s).toEqual(copy);
  });
});

// ─── Buying and auctions ─────────────────────────────────────────────────────

describe("buying", () => {
  it("buys at the empire's price and moves to manage", () => {
    const asked = play(setup(["a", "b"]), "a", { kind: "roll" }, scripted(roll(1, 1)));
    expect(asked.question).toEqual({ kind: "buy", tile: 2 });
    const bought = play(asked, "a", { kind: "buy", tile: 2 });
    expect(city(bought, 2).ownerId).toBe("a");
    expect(player(bought, "a").cash).toBe(1400);
    expect(bought.phase).toBe("manage");
  });

  it("sends a passed city to auction", () => {
    const asked = play(setup(["a", "b"]), "a", { kind: "roll" }, scripted(roll(1, 1)));
    const passed = play(asked, "a", { kind: "decline", tile: 2 }, scripted([], { humans: ["a", "b"] }));
    expect(passed.phase).toBe("auction");
    expect(passed.auction).toMatchObject({ tile: 2, sellerId: null, highBid: 0 });
  });

  it("sends an unaffordable city straight to auction", () => {
    const s = setup(["a", "b"], (x) => place(x, "a", 0, 50));
    const next = play(s, "a", { kind: "roll" }, scripted(roll(1, 1), { humans: ["a", "b"] }));
    expect(next.phase).toBe("auction");
  });
});

describe("auctions", () => {
  /** a passes on Bursa (tile 2, price 100); humans are whoever is listed. */
  function auctionFor(humans: string[], seats = ["a", "b", "c"], edit?: (s: EmpireState) => void) {
    const asked = play(setup(seats, edit), "a", { kind: "roll" }, scripted(roll(1, 1)));
    return play(asked, "a", { kind: "decline", tile: 2 }, scripted([], { humans }));
  }

  it("settles the moment it opens when no human is taking part", () => {
    const done = auctionFor([]);
    expect(done.phase).toBe("manage");
    expect(done.auction).toBeNull();
    // Two CPUs with the same ceiling (100): the first seat after a wins it, at 100.
    expect(city(done, 2).ownerId).toBe("b");
    expect(player(done, "b").cash).toBe(1400);
  });

  it("stays open while a human can bid, with CPUs already bidding as proxies", () => {
    const open = auctionFor(["a"]);
    expect(open.phase).toBe("auction");
    // b and c both cap at 100 → b leads at 100.
    expect(open.auction).toMatchObject({ highBid: 100, highBidderId: "b" });
    expect(open.turnExpiresAt).toBe(NOW + AUCTION.openMs);
  });

  it("answers a human bid with the CPUs' minimum lead, in the same move", () => {
    // b holds Edirne and Istanbul: Bursa completes the Ottoman Empire, ceiling 150.
    // c's ceiling is the price, 100 — so b opens at c's ceiling + a step.
    const open = auctionFor(["a"], ["a", "b", "c"], (x) => give(x, [1, 3], "b"));
    expect(open.auction).toMatchObject({ highBid: 110, highBidderId: "b" });
    const humans = scripted([], { humans: ["a"] });
    const bid = play(open, "a", { kind: "bid", id: open.auction!.id, amount: 120 }, humans);
    expect(bid.auction).toMatchObject({ highBid: 130, highBidderId: "b" });
    // Past every CPU's ceiling, with no other human to answer: nobody can
    // beat 160, so it closes on the spot rather than run out a countdown.
    const outbid = play(bid, "a", { kind: "bid", id: bid.auction!.id, amount: 160 }, humans);
    expect(outbid.auction).toBeNull();
    expect(city(outbid, 2).ownerId).toBe("a");
    expect(player(outbid, "a").cash).toBe(1500 - 160);
  });

  it("enforces the step, the bidder's coins, the seller and the leader", () => {
    const open = auctionFor(["a", "b", "c"]);
    const id = open.auction!.id;
    const humans = { humans: ["a", "b", "c"] };
    reject(open, "a", { kind: "bid", id, amount: 5 }, scripted([], humans));
    reject(open, "a", { kind: "bid", id, amount: 99_999 }, scripted([], humans));
    reject(open, "a", { kind: "bid", id: id + 1, amount: 50 }, scripted([], humans));
    const led = play(open, "a", { kind: "bid", id, amount: 50 }, scripted([], humans));
    reject(led, "a", { kind: "bid", id, amount: 60 }, scripted([], humans));
    reject(led, "b", { kind: "bid", id, amount: 55 }, scripted([], humans));
  });

  it("tops the countdown up to 6 s on each bid, never past 40 s", () => {
    const open = auctionFor(["a", "b"], ["a", "b"]);
    const id = open.auction!.id;
    const late = NOW + 10_000;
    const bid = play(open, "b", { kind: "bid", id, amount: 50 }, scripted([], { now: late, humans: ["a", "b"] }));
    expect(bid.auction!.endsAt).toBe(late + AUCTION.extendMs);
    const veryLate = NOW + AUCTION.maxMs - 1_000;
    const capped = play(
      { ...bid, auction: { ...bid.auction!, endsAt: veryLate + 500 } },
      "a",
      { kind: "bid", id, amount: 60 },
      scripted([], { now: veryLate, humans: ["a", "b"] })
    );
    expect(capped.auction!.endsAt).toBe(NOW + AUCTION.maxMs);
  });

  it("refuses to close early, then gives the city to the highest bidder", () => {
    const open = auctionFor(["a", "b"], ["a", "b"]);
    const id = open.auction!.id;
    const bid = play(open, "b", { kind: "bid", id, amount: 70 }, scripted([], { humans: ["a", "b"] }));
    reject(bid, "a", { kind: "closeAuction" }, scripted([], { now: NOW + 1_000 }));
    const closed = play(bid, "a", { kind: "closeAuction" }, scripted([], { now: bid.auction!.endsAt }));
    expect(city(closed, 2).ownerId).toBe("b");
    expect(player(closed, "b").cash).toBe(1430);
    expect(closed.phase).toBe("manage");
    expect(turnOf(closed)).toBe("a");
  });

  it("leaves a city nobody bid on free", () => {
    const open = auctionFor(["a", "b", "c"]);
    const closed = play(open, "a", { kind: "closeAuction" }, scripted([], { now: open.auction!.endsAt }));
    expect(city(closed, 2).ownerId).toBeNull();
  });

  it("pays the seller when a player auctions their own city from the Market", () => {
    const s = setup(["a", "b"], (x) => {
      give(x, [21], "a");
      place(x, "a", 26);
    });
    const managing = play(s, "a", { kind: "roll" }, scripted(roll(3, 3)));
    const done = play(managing, "a", { kind: "auctionCity", tile: 21 }, scripted([], { humans: ["a"] }));
    // It opens at half the price — what the bank would pay. b, the only
    // bidder and a CPU, takes it at that opening bid.
    expect(city(done, 21).ownerId).toBe("b");
    expect(player(done, "a").cash).toBe(1700 + 150);
    expect(player(done, "b").cash).toBe(1500 - 150);
  });
});

// ─── Tribute ─────────────────────────────────────────────────────────────────

describe("tribute", () => {
  it("is paid automatically — base, doubled for a whole empire, soaring with houses", () => {
    const land = (level: number, whole: boolean) => {
      const s = setup(["a", "b"], (x) => {
        give(x, whole ? [1, 2, 3] : [2], "b", 0);
        city(x, 2).level = level;
      });
      return play(s, "a", { kind: "roll" }, scripted(roll(1, 1)));
    };
    expect(player(land(0, false), "a").cash).toBe(1490);
    expect(player(land(0, true), "a").cash).toBe(1480);
    expect(player(land(2, true), "a").cash).toBe(1350);
    expect(player(land(MONUMENT_LEVEL, true), "a").cash).toBe(750);
  });

  it("is still paid to an owner in the Dungeon", () => {
    const s = setup(["a", "b"], (x) => {
      give(x, [2], "b");
      place(x, "b", DUNGEON_TILE);
      player(x, "b").inJail = true;
    });
    const next = play(s, "a", { kind: "roll" }, scripted(roll(1, 1)));
    expect(player(next, "b").cash).toBe(1510);
  });
});

// ─── Building and selling ────────────────────────────────────────────────────

describe("building and selling", () => {
  /** a owns all of France and lands on its own Lyon — no payday — to manage. */
  function managingFrance(level = 0, cash = 1500) {
    const s = setup(["a", "b"], (x) => {
      give(x, [21, 22, 23], "a", level);
      place(x, "a", 20, cash);
    });
    return play(s, "a", { kind: "roll" }, scripted(roll(1, 1)));
  }

  it("builds a house for half the price, only on a whole empire", () => {
    const built = play(managingFrance(), "a", { kind: "build", tile: 23 });
    expect(city(built, 23).level).toBe(1);
    expect(player(built, "a").cash).toBe(1500 - 150);

    const half = setup(["a", "b"], (x) => {
      give(x, [21, 22], "a");
      place(x, "a", 26);
    });
    reject(play(half, "a", { kind: "roll" }, scripted(roll(3, 3))), "a", { kind: "build", tile: 22 });
  });

  it("raises one monument per empire, on a city with 4 houses", () => {
    const four = managingFrance(4);
    const tower = play(four, "a", { kind: "build", tile: 23 });
    expect(city(tower, 23).level).toBe(MONUMENT_LEVEL);
    reject(tower, "a", { kind: "build", tile: 21 });
  });

  it("sells a building for half its cost", () => {
    const sold = play(managingFrance(2), "a", { kind: "sellBuilding", tile: 22 });
    expect(city(sold, 22).level).toBe(1);
    expect(player(sold, "a").cash).toBe(1500 + 75);
  });

  it("sells a city for half its price, but only once its empire is bare", () => {
    reject(managingFrance(1), "a", { kind: "sellCity", tile: 21 });
    const sold = play(managingFrance(0), "a", { kind: "sellCity", tile: 21 });
    expect(city(sold, 21).ownerId).toBeNull();
    expect(player(sold, "a").cash).toBe(1500 + 150);
  });

  it("refuses a build the owner can't afford", () => {
    reject(managingFrance(0, 100), "a", { kind: "build", tile: 21 });
  });
});

// ─── The Market ──────────────────────────────────────────────────────────────

describe("trading", () => {
  /** a holds Marseille and Lyon; b holds Paris and Sarai. a is in manage. */
  function market(edit?: (s: EmpireState) => void) {
    const s = setup(["a", "b", "c"], (x) => {
      give(x, [21, 22], "a");
      give(x, [23, 10], "b");
      place(x, "a", 26);
      edit?.(x);
    });
    return play(s, "a", { kind: "roll" }, scripted(roll(3, 3)));
  }
  const offer = (coins = 150): EmpireMove => ({
    kind: "offerTrade",
    to: "b",
    give: { tiles: [], coins },
    get: { tiles: [23], coins: 0 },
  });

  it("hands the clock to the recipient; only they may answer", () => {
    const offered = play(market(), "a", offer());
    expect(offered.phase).toBe("trade");
    expect(empireWarsModule.currentMemberId(offered)).toBe("b");
    reject(offered, "a", { kind: "answerTrade", id: offered.trade!.id, accept: true });
    reject(offered, "c", { kind: "answerTrade", id: offered.trade!.id, accept: true });
    reject(offered, "a", { kind: "endTurn" });
  });

  it("moves exactly the named cities and coins on Accept", () => {
    const offered = play(market(), "a", offer(150));
    const done = play(offered, "b", { kind: "answerTrade", id: offered.trade!.id, accept: true });
    expect(city(done, 23).ownerId).toBe("a");
    expect(city(done, 10).ownerId).toBe("b");
    expect(player(done, "a").cash).toBe(1700 - 150);
    expect(player(done, "b").cash).toBe(1500 + 150);
    expect(done.phase).toBe("manage");
    expect(turnOf(done)).toBe("a");
  });

  it("moves nothing on Decline", () => {
    const offered = play(market(), "a", offer());
    const done = play(offered, "b", { kind: "answerTrade", id: offered.trade!.id, accept: false });
    expect(city(done, 23).ownerId).toBe("b");
    expect(player(done, "a").cash).toBe(1700);
  });

  it("rejects a stale answer naming another offer", () => {
    const offered = play(market(), "a", offer());
    reject(offered, "b", { kind: "answerTrade", id: offered.trade!.id + 1, accept: true });
  });

  it("rejects cities from built empires, coins beyond a side's holding, empty and self trades", () => {
    const m = market((x) => give(x, [13, 14, 15], "b", 1));
    reject(m, "a", { kind: "offerTrade", to: "b", give: { tiles: [], coins: 100 }, get: { tiles: [13], coins: 0 } });
    reject(m, "a", { kind: "offerTrade", to: "b", give: { tiles: [], coins: 99_999 }, get: { tiles: [23], coins: 0 } });
    reject(m, "a", { kind: "offerTrade", to: "b", give: { tiles: [], coins: 0 }, get: { tiles: [], coins: 0 } });
    reject(m, "a", { kind: "offerTrade", to: "a", give: { tiles: [21], coins: 0 }, get: { tiles: [], coins: 0 } });
    reject(m, "a", { kind: "offerTrade", to: "b", give: { tiles: [], coins: 10 }, get: { tiles: [31], coins: 0 } });
  });

  it("allows two offers a turn and refuses a third", () => {
    let s = market();
    for (let i = 0; i < 2; i++) {
      s = play(s, "a", offer());
      s = play(s, "b", { kind: "answerTrade", id: s.trade!.id, accept: false });
    }
    reject(s, "a", offer());
  });
});

// ─── Can't pay ───────────────────────────────────────────────────────────────

describe("forced sales and bankruptcy", () => {
  /** a lands on b's Beijing with 2 houses (Ming whole): 22 × 15 = 330 tribute. */
  function owes(cash: number, edit?: (s: EmpireState) => void) {
    return setup(["a", "b", "c"], (x) => {
      give(x, [13, 14, 15], "b", 0);
      city(x, 15).level = 2;
      place(x, "a", 12, cash);
      edit?.(x);
    });
  }

  it("sells buildings first, from the most-built city, then cities cheapest first", () => {
    const s = owes(0, (x) => {
      give(x, [1, 2, 3], "a", 1); // Ottoman: three houses, 25 each at sale
      city(x, 3).level = 2;
    });
    const next = play(s, "a", { kind: "roll" }, scripted(roll(1, 2)));
    // 25 × 4 houses = 100, then Edirne/Bursa/Istanbul at 50 each = 250 > 330? no:
    // 100 + 150 = 250 < 330 → bankrupt after selling everything.
    expect(player(next, "a").status).toBe("bankrupt");
    const sales = next.events.filter((e) => e.kind === "sold-building" || e.kind === "sold-city");
    expect(sales.map((e) => e.kind)).toEqual([
      "sold-building",
      "sold-building",
      "sold-building",
      "sold-building",
      "sold-city",
      "sold-city",
      "sold-city",
    ]);
  });

  it("stops selling the moment the debt is covered", () => {
    const s = owes(300, (x) => give(x, [1, 2], "a"));
    const next = play(s, "a", { kind: "roll" }, scripted(roll(1, 2)));
    // 300 + 50 (Edirne) = 350 ≥ 330; Bursa stays.
    expect(city(next, 1).ownerId).toBeNull();
    expect(city(next, 2).ownerId).toBe("a");
    expect(player(next, "a")).toMatchObject({ status: "in", cash: 20 });
  });

  it("ends the turn of a player who goes bankrupt, and never gives them another", () => {
    const next = play(owes(10), "a", { kind: "roll" }, scripted(roll(1, 2)));
    expect(player(next, "a").status).toBe("bankrupt");
    expect(turnOf(next)).toBe("b");
    expect(player(next, "b").cash).toBe(1510);
  });
});

// ─── The cards ───────────────────────────────────────────────────────────────

describe("Fortune and Royal Decree", () => {
  /** a stands on the Dungeon tile (visiting) and rolls onto 12 (Fortune) or 4 via 0? */
  function draw(deck: Deck, id: string, edit?: (s: EmpireState) => void) {
    const s = setup(["a", "b", "c"], (x) => {
      // Fortune at 12 (from 8, roll 4); Royal Decree at 20 (from 16, roll 4).
      place(x, "a", deck === "fortune" ? DUNGEON_TILE : 16);
      edit?.(x);
    });
    return play(s, "a", { kind: "roll" }, scripted(roll(2, 2, card(deck, id)), { humans: ["a"] }));
  }
  const cash = (s: EmpireState, id = "a") => player(s, id).cash;

  const CASES: Record<Deck, Record<string, () => void>> = {
    fortune: {
      "silk-caravan": () => expect(cash(draw("fortune", "silk-caravan"))).toBe(1650),
      spices: () => expect(cash(draw("fortune", "spices"))).toBe(1600),
      ambassador: () => expect(cash(draw("fortune", "ambassador"))).toBe(1575),
      shipwreck: () => {
        const s = draw("fortune", "shipwreck");
        expect([cash(s), s.treasury]).toEqual([1400, 100]);
      },
      bandits: () => expect(draw("fortune", "bandits").treasury).toBe(50),
      treason: () => expect(player(draw("fortune", "treason"), "a")).toMatchObject({ tile: DUNGEON_TILE, inJail: true }),
      "silk-road-home": () => {
        const s = draw("fortune", "silk-road-home");
        expect([player(s, "a").tile, cash(s)]).toEqual([0, 1700]);
      },
      "forced-march": () => {
        const s = draw("fortune", "forced-march");
        expect(player(s, "a").tile).toBe(15);
        expect(s.question).toEqual({ kind: "buy", tile: 15 });
      },
      "master-builders": () => {
        const s = draw("fortune", "master-builders", (x) => give(x, [1, 2, 3], "a", 1));
        expect(city(s, 1).level).toBe(2);
        expect(cash(draw("fortune", "master-builders"))).toBe(1600);
      },
      plague: () => {
        const s = draw("fortune", "plague", (x) => {
          give(x, [1, 2, 3], "a", 2);
          city(x, 3).level = MONUMENT_LEVEL;
        });
        // 2 + 2 houses × 25 + 1 monument × 100 = 200
        expect(s.treasury).toBe(200);
      },
    },
    "royal-decree": {
      vassals: () => {
        const s = draw("royal-decree", "vassals");
        expect([cash(s), cash(s, "b"), cash(s, "c")]).toEqual([1550, 1475, 1475]);
      },
      "lost-treasure": () => expect(cash(draw("royal-decree", "lost-treasure"))).toBe(1700),
      inheritance: () => expect(cash(draw("royal-decree", "inheritance"))).toBe(1600),
      harvest: () => expect(cash(draw("royal-decree", "harvest"))).toBe(1550),
      scholar: () => expect(cash(draw("royal-decree", "scholar"))).toBe(1575),
      coronation: () => expect(draw("royal-decree", "coronation").treasury).toBe(100),
      census: () => {
        const s = draw("royal-decree", "census", (x) => give(x, [1, 2, 21], "a"));
        expect(s.treasury).toBe(30);
      },
      banquet: () => {
        const s = draw("royal-decree", "banquet");
        expect([cash(s), cash(s, "b"), cash(s, "c")]).toEqual([1460, 1520, 1520]);
      },
      banished: () => expect(player(draw("royal-decree", "banished"), "a").inJail).toBe(true),
      summoned: () => {
        const s = draw("royal-decree", "summoned");
        expect([player(s, "a").tile, cash(s)]).toEqual([0, 1700]);
      },
    },
  };

  for (const deck of ["fortune", "royal-decree"] as const) {
    it(`has a test for every ${deck} card`, () => {
      expect(Object.keys(CASES[deck]).sort()).toEqual(CARDS[deck].map((c) => c.id).sort());
    });
    for (const { id, name } of CARDS[deck]) {
      it(`${deck}: does exactly what "${name}" says`, () => CASES[deck][id]());
    }
  }
});

// ─── Winning and leaving ─────────────────────────────────────────────────────

describe("winning", () => {
  it("ends the match at the end of a turn when someone reaches the target", () => {
    const s = setup(["a", "b"], (x) => place(x, "a", 26, x.target! - 150));
    const next = rollAndEnd(s, "a", roll(3, 3));
    expect(next.winnerId).toBe("a");
    expect(next.endedBy).toBe("target");
    expect(next.turnExpiresAt).toBeNull();
  });

  it("gives it to the richest after the last round, breaking ties on cities", () => {
    const s = setup(["a", "b"], (x) => {
      x.round = x.roundLimit!;
      x.currentIndex = 1;
      give(x, [1], "b");
      player(x, "b").cash = 1400;
      place(x, "b", 22);
    });
    const next = rollAndEnd(s, "b", roll(1, 1));
    expect(netWorth(next, "a")).toBe(netWorth(next, "b"));
    expect(next.winnerId).toBe("b");
    expect(next.endedBy).toBe("rounds");
  });

  it("with no target, no fortune ends it — only the round limit", () => {
    const s = setup(["a", "b"], (x) => {
      x.target = null;
      place(x, "a", 26, 50_000);
    });
    const next = rollAndEnd(s, "a", roll(3, 3));
    expect(next.winnerId).toBeNull();
    expect(turnOf(next)).toBe("b");
  });

  it("with no round limit, plays on past round 100 while the target is out of reach", () => {
    const s = setup(["a", "b"], (x) => {
      x.roundLimit = null;
      x.round = 150;
      x.currentIndex = 1;
      place(x, "b", 26);
    });
    const next = rollAndEnd(s, "b", roll(3, 3));
    expect(next.winnerId).toBeNull();
    expect(next.round).toBe(151);
  });

  it("with no target and no round limit, the safety net ends it — the richest wins", () => {
    const s = setup(["a", "b"], (x) => {
      x.target = null;
      x.roundLimit = null;
      x.round = SETUP.safetyRounds;
      x.currentIndex = 1;
      player(x, "a").cash = 9000;
      place(x, "b", 26);
    });
    const next = rollAndEnd(s, "b", roll(3, 3));
    expect(next.winnerId).toBe("a");
    expect(next.endedBy).toBe("rounds");
  });
});

// ─── Match setup ─────────────────────────────────────────────────────────────

describe("match setup", () => {
  /** A table that opens on setup, and a context in which these seats are human. */
  function choosing(seats: string[], humans: string[]) {
    return structuredClone(dealGame(seats, NOW, { humans }));
  }
  const as = (humans: string[], values: number[] = [], now = NOW) => scripted(values, { humans, now });
  const pick = (target: number | null, rounds: number | null): EmpireMove => ({ kind: "pickSetup", target, rounds });
  const settledOf = (s: EmpireState) => s.events.findLast((e) => e.kind === "settled");

  it("refuses every other move until the settings are decided", () => {
    const s = choosing(["a", "b"], ["a", "b"]);
    expect(reject(s, "a", { kind: "roll" }, as(["a", "b"]))).toBe("Choose the match settings first");
    expect(reject(s, "a", { kind: "endTurn" }, as(["a", "b"]))).toBe("Choose the match settings first");
  });

  it("waits for every human, then plays what they agreed on — no toss", () => {
    const humans = ["a", "b"];
    const s = choosing(["a", "b", "cpu"], humans);
    const one = play(s, "a", pick(3000, 30), as(humans));
    expect(one.phase).toBe("setup");
    expect(viewFor(one, "b").setup?.waitingOn).toEqual(["b"]);

    // A random() that would throw if the toss were used.
    const noToss: MoveContext = { now: NOW, humans, random: () => { throw new Error("tossed"); } };
    const both = play(one, "b", pick(3000, 30), noToss);
    expect(both).toMatchObject({ phase: "roll", setup: null, target: 3000, roundLimit: 30 });
    expect(settledOf(both)).toMatchObject({ settledBy: "agreed", memberId: "a", target: 3000, rounds: 30 });
    expect(turnOf(both)).toBe("a");
    expect(both.turnExpiresAt).toBe(NOW + EMPIRE_WARS_CONFIG.turnWindowMs);
  });

  it("tosses between the pickers when they disagree, each with an equal chance", () => {
    const humans = ["a", "b"];
    const one = play(choosing(["a", "b"], humans), "b", pick(10000, null), as(humans));
    // Picks are tossed in seat order: a low draw lands on a, a high one on b.
    const aWins = play(one, "a", pick(3000, 30), as(humans, [0.1]));
    const bWins = play(one, "a", pick(3000, 30), as(humans, [0.9]));
    expect(aWins).toMatchObject({ target: 3000, roundLimit: 30 });
    expect(bWins).toMatchObject({ target: 10000, roundLimit: null });
    expect(settledOf(aWins)).toMatchObject({ settledBy: "toss", memberId: "a" });
    expect(settledOf(bWins)).toMatchObject({ settledBy: "toss", memberId: "b" });
    expect(settledOf(bWins)?.kind === "settled" && settledOf(bWins)?.picks.map((p) => p.memberId)).toEqual(["a", "b"]);
  });

  it("makes a lone human's pick the table's — the CPUs follow it", () => {
    const s = choosing(["a", "cpu1", "cpu2"], ["a"]);
    const next = play(s, "a", pick(null, 100), as(["a"]));
    expect(next).toMatchObject({ phase: "roll", target: null, roundLimit: 100 });
    expect(settledOf(next)).toMatchObject({ settledBy: "agreed", memberId: "a" });
  });

  it("lets a human change their pick until the settings are decided", () => {
    const humans = ["a", "b"];
    const first = play(choosing(["a", "b"], humans), "a", pick(3000, 30), as(humans));
    const changed = play(first, "a", pick(5000, 50), as(humans));
    expect(changed.setup?.picks).toEqual([{ memberId: "a", target: 5000, rounds: 50 }]);
  });

  it("never takes a pick from a CPU", () => {
    const s = choosing(["a", "cpu"], ["a"]);
    expect(reject(s, "cpu", pick(3000, 30), as(["a"]))).toBe("CPUs play by the table's choice");
  });

  it("only accepts settings that are on offer", () => {
    const parse = (target: unknown, rounds: unknown) =>
      empireMoveSchema.safeParse({ kind: "pickSetup", target, rounds }).success;
    expect(parse(4000, 30)).toBe(false);
    expect(parse(5000, 45)).toBe(false);
    expect(parse(null, null)).toBe(true);
    expect(parse(10000, 100)).toBe(true);
  });

  it("closes on the clock: the picks made so far decide it", () => {
    const humans = ["a", "b"];
    const s = play(choosing(["a", "b"], humans), "a", pick(10000, 100), as(humans));
    const deadline = s.setup!.expiresAt;
    expect(reject(s, "a", { kind: "closeSetup" }, as(humans, [], deadline - 1))).toBe("Players are still choosing");
    const closed = play(s, "a", { kind: "closeSetup" }, as(humans, [], deadline));
    expect(closed).toMatchObject({ phase: "roll", target: 10000, roundLimit: 100 });
  });

  it("plays the standard match when nobody picks in time", () => {
    const s = choosing(["a", "b"], ["a", "b"]);
    const closed = play(s, "b", { kind: "closeSetup" }, as(["a", "b"], [], s.setup!.expiresAt));
    expect(closed).toMatchObject({ target: SETUP.defaults.target, roundLimit: SETUP.defaults.rounds });
    expect(settledOf(closed)).toMatchObject({ settledBy: "default" });
  });

  it("doesn't wait for a human who has left the lobby", () => {
    const s = choosing(["a", "b"], ["a", "b"]);
    // b's seat is no longer held by a connected human.
    const next = play(s, "a", pick(3000, 50), as(["a"]));
    expect(next).toMatchObject({ phase: "roll", target: 3000, roundLimit: 50 });
  });

  it("when a human walks away mid-setup, drops their pick and hands the first turn on", () => {
    const humans = ["a", "b"];
    const s = play(choosing(["a", "b", "c"], humans), "b", pick(3000, 30), as(humans));
    const result = applyQuit(s, "a", as(humans));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state).toMatchObject({ phase: "roll", target: 3000, roundLimit: 30 });
    expect(turnOf(result.state)).toBe("b");
  });

  it("ends it on the spot if a walk-away leaves one player", () => {
    const result = applyQuit(choosing(["a", "b"], ["a", "b"]), "a", as(["a", "b"]));
    expect(result.ok && result.state.winnerId).toBe("b");
  });

  it("has the CPU driver close setup only once it's due", () => {
    const humans = ["a"];
    const s = choosing(["a", "cpu"], humans);
    expect(chooseBotMove(s, "a", as(humans))).toBeNull();
    expect(chooseBotMove(s, "cpu", as(humans))).toBeNull();
    expect(chooseBotMove(s, "a", as(humans, [], s.setup!.expiresAt))).toEqual({ kind: "closeSetup" });
  });

  it("shows everyone the choices and the picks, with nobody on the clock", () => {
    const humans = ["a", "b"];
    const s = play(choosing(["a", "b", "cpu"], humans), "a", pick(null, 50), as(humans));
    const view = viewFor(s, "b");
    expect(view.setup).toMatchObject({
      humans,
      picks: [{ memberId: "a", target: null, rounds: 50 }],
      waitingOn: ["b"],
      defaults: SETUP.defaults,
    });
    expect(view.setup?.targets).toEqual(SETUP.targets);
    expect([view.onClockId, view.currentMemberId]).toEqual([null, null]);
    expect(view.you?.onClock).toBe(false);
  });

  it("deals a table with humans into setup through the module, and times it out on the server's clock", () => {
    const s = empireWarsModule.deal(["a", "cpu"], { random: () => 0, now: NOW, humans: ["a"] });
    expect(s.phase).toBe("setup");
    expect(empireWarsModule.currentMemberId(s)).toBe("a");
    expect(empireWarsModule.turnExpired!(s, NOW + SETUP.windowMs - 1)).toBe(false);
    expect(empireWarsModule.turnExpired!(s, NOW + SETUP.windowMs)).toBe(true);
  });
});

describe("quitting", () => {
  it("returns the quitter's cities and buildings to the bank and passes their turn", () => {
    const result = applyQuit(setup(["a", "b", "c"], (x) => give(x, [1, 2, 3], "a", 2)), "a", scripted());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(player(result.state, "a").status).toBe("quit");
    expect(city(result.state, 1)).toMatchObject({ ownerId: null, level: 0 });
    expect(turnOf(result.state)).toBe("b");
  });

  it("calls off a trade the quitter was part of", () => {
    const s = setup(["a", "b", "c"], (x) => {
      give(x, [23], "b");
      place(x, "a", 26);
    });
    const managing = play(s, "a", { kind: "roll" }, scripted(roll(3, 3)));
    const offered = play(managing, "a", { kind: "offerTrade", to: "b", give: { tiles: [], coins: 100 }, get: { tiles: [23], coins: 0 } });
    const result = applyQuit(offered, "b", scripted());
    expect(result.ok && result.state.trade).toBeNull();
    expect(result.ok && result.state.phase).toBe("manage");
  });

  it("makes the last player standing the winner", () => {
    const result = applyQuit(setup(["a", "b"]), "a", scripted());
    expect(result.ok && result.state.winnerId).toBe("b");
  });
});

describe("standings", () => {
  it("ranks the players still in by net worth, then the bankrupt (latest first), then quitters", () => {
    const s = setup(["a", "b", "c", "d"], (x) => {
      player(x, "a").cash = 3900;
      Object.assign(player(x, "c"), { status: "bankrupt", cash: 0, outRound: 12, outOrder: 1 });
      Object.assign(player(x, "d"), { status: "quit", outOrder: 2 });
      x.outCount = 2;
      x.winnerId = "a";
      x.endedBy = "target";
    });
    expect(empireWarsModule.standings(s)).toEqual([
      { memberId: "a", detail: "3,900 net worth", eliminated: false },
      { memberId: "b", detail: "1,500 net worth", eliminated: false },
      { memberId: "c", detail: "Bankrupt · round 12", eliminated: true },
      { memberId: "d", detail: "Walked away", eliminated: true },
    ]);
  });
});

// ─── Clocks and CPUs ─────────────────────────────────────────────────────────

describe("clocks", () => {
  it("expires only once the window has passed on the server's clock", () => {
    const s = setup(["a", "b"]);
    const deadline = NOW + EMPIRE_WARS_CONFIG.turnWindowMs;
    expect(turnHasExpired(s, deadline - 1)).toBe(false);
    expect(turnHasExpired(s, deadline)).toBe(true);
  });

  it("gives the manage step 60 s, since building a trade takes longer than a roll", () => {
    const s = setup(["a", "b"], (x) => place(x, "a", 26));
    const managing = play(s, "a", { kind: "roll" }, scripted(roll(3, 3)));
    expect(managing.phase).toBe("manage");
    expect(managing.turnExpiresAt).toBe(NOW + EMPIRE_WARS_CONFIG.manageWindowMs);
  });

  it("gives a trade's recipient its own 20 s", () => {
    const s = setup(["a", "b"], (x) => {
      give(x, [23], "b");
      place(x, "a", 26);
    });
    const managing = play(s, "a", { kind: "roll" }, scripted(roll(3, 3)));
    const offered = play(managing, "a", { kind: "offerTrade", to: "b", give: { tiles: [], coins: 100 }, get: { tiles: [23], coins: 0 } });
    expect(offered.turnExpiresAt).toBe(NOW + EMPIRE_WARS_CONFIG.tradeWindowMs);
  });
});

describe("the CPU", () => {
  const cpu = (s: EmpireState, id: string, humans: string[] = []) =>
    chooseBotMove(s, id, scripted([], { humans }));

  it("only ends the turn for a timed-out human in the manage step — never spends for them", () => {
    const s = setup(["a", "b"], (x) => {
      give(x, [21, 22, 23], "a");
      place(x, "a", 26);
    });
    const managing = play(s, "a", { kind: "roll" }, scripted(roll(3, 3)));
    expect(cpu(managing, "a", ["a"])).toEqual({ kind: "endTurn" });
    // All of France is bare and one price: the first in board order.
    expect(cpu(managing, "a", [])).toEqual({ kind: "build", tile: 21 });
  });

  it("declines a trade for a timed-out human, and judges one on value as a CPU", () => {
    const s = setup(["a", "b"], (x) => {
      give(x, [21, 22], "a");
      give(x, [23], "b");
      place(x, "a", 26);
    });
    const managing = play(s, "a", { kind: "roll" }, scripted(roll(3, 3)));
    const cheap = play(managing, "a", { kind: "offerTrade", to: "b", give: { tiles: [], coins: 400 }, get: { tiles: [23], coins: 0 } });
    // Paris completes France for a: the CPU wants 2.5 × 300 = 750.
    expect(cpuAcceptsTrade(cheap, cheap.trade!)).toBe(false);
    expect(cpu(cheap, "b", ["b"])).toEqual({ kind: "answerTrade", id: cheap.trade!.id, accept: false });
    const fair = { ...cheap, trade: { ...cheap.trade!, give: { tiles: [], coins: 750 } } };
    expect(cpuAcceptsTrade(fair, fair.trade)).toBe(true);
  });

  it("offers coins for the last city of an empire it's two-thirds through", () => {
    const s = setup(["a", "b"], (x) => {
      give(x, [21, 22], "a");
      give(x, [23], "b");
      place(x, "a", 26, 2000);
      x.round = 2;
    });
    const managing = play(s, "a", { kind: "roll" }, scripted(roll(3, 3)));
    expect(cpu(managing, "a")).toEqual({
      kind: "offerTrade",
      to: "b",
      give: { tiles: [], coins: 750 },
      get: { tiles: [23], coins: 0 },
    });
  });

  it("closes an auction only once its deadline has passed", () => {
    const asked = play(setup(["a", "b"]), "a", { kind: "roll" }, scripted(roll(1, 1)));
    const open = play(asked, "a", { kind: "decline", tile: 2 }, scripted([], { humans: ["b"] }));
    expect(chooseBotMove(open, "a", scripted([], { now: NOW }))).toBeNull();
    expect(chooseBotMove(open, "a", scripted([], { now: open.auction!.endsAt }))).toEqual({ kind: "closeAuction" });
  });
});

// ─── The view and invariants ─────────────────────────────────────────────────

describe("the view", () => {
  it("differs between seats only in the `you` block", () => {
    const s = play(setup(["a", "b", "c"]), "a", { kind: "roll" }, scripted(roll(1, 1)));
    const { you: youA, ...restA } = viewFor(s, "a");
    const { you: youB, ...restB } = viewFor(s, "b");
    expect(restA).toEqual(restB);
    expect(youA).toEqual({ memberId: "a", yourTurn: true, onClock: true });
    expect(youB).toEqual({ memberId: "b", yourTurn: false, onClock: false });
    expect(viewFor(s, null).you).toBeNull();
  });

  it("puts the live tribute and the whole ladder on every city", () => {
    const s = setup(["a", "b"], (x) => give(x, [21, 22, 23], "b", 1));
    const paris = viewFor(s, "a").cities.find((c) => c.id === "paris")!;
    expect(paris.tribute).toBe(150);
    expect(paris.tributeTable).toEqual({ bare: 30, whole: 60, houses: [150, 450, 1200, 1650], monument: 2250 });
    expect(paris.canBuild).toBe(true);
  });
});

describe("invariants", () => {
  it("bumps the version on every applied move", () => {
    const asked = play(setup(["a", "b"]), "a", { kind: "roll" }, scripted(roll(1, 1)));
    const bought = play(asked, "a", { kind: "buy", tile: 2 });
    expect([asked.version, bought.version]).toEqual([1, 2]);
  });

  it("keeps a crowded 6-seat late game under 12 KB", () => {
    const s = setup(["s1", "s2", "s3", "s4", "s5", "s6"], (x) => {
      x.cities.forEach((c, i) => Object.assign(c, { ownerId: `s${(i % 6) + 1}`, level: 4 }));
      x.round = 28;
    });
    expect(JSON.stringify(viewFor(s, "s1")).length).toBeLessThan(20_000);
    expect(JSON.stringify(s).length).toBeLessThan(12_000);
  });
});
