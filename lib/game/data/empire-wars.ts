// Tuning knobs and board content for Empire Wars v3
// (design/gdd/empire-wars-core.md). Gameplay values live here, never inline in
// logic code.
//
// Every number is transcribed from the GDD's Detailed Rules, Formulas and
// Tuning Knobs, and the match-shaping ones are calibrated by simulation
// (tests/empire-wars-sim.test.ts holds the shape the GDD publishes). If a value
// here and the GDD ever disagree, fix one of them in the same change.

// ─── Match shape ─────────────────────────────────────────────────────────────

export const EMPIRE_WARS_CONFIG = {
  gameType: "empire-wars",
  minPlayers: 2,
  maxPlayers: 6,

  startingCash: 1500,
  /** Paid for passing or landing on the Silk Road. */
  payday: 200,

  /**
   * How long a human seat has to make each move before the table plays on.
   * A timed-out human only ever has their turn ended for them — never spent
   * for them (GDD > Clocks). CPU seats ignore this; they act on botDelayMs.
   */
  turnWindowMs: 30_000,
  /**
   * The manage step gets longer: building a trade in the Market takes more
   * than 30 seconds (found live — the clock ended a turn mid-offer).
   */
  manageWindowMs: 60_000,
  /** How long the recipient of a trade has to answer. No answer = decline. */
  tradeWindowMs: 20_000,
  /** Spread clients add before asking the server to act on a deadline. */
  turnJitterMaxMs: 2_000,

  /** Client-side CPU pacing, matching Nuno's casual feel. */
  botDelayMsMin: 1_000,
  botDelayMsMax: 3_000,
} as const;

// ─── Match setup ─────────────────────────────────────────────────────────────

/**
 * What the table chooses before the first roll (GDD > Match setup). Every
 * human picks one of each; if their picks differ, a toss decides whose are
 * played. `null` is Unlimited: no net-worth target, or no round limit — and
 * with both unlimited, the match ends only when one empire is left standing.
 */
export const SETUP = {
  /** "Assets": the net worth that wins. */
  targets: [3000, 5000, 10000, null],
  /** Rounds before the richest wins. */
  rounds: [30, 50, 100, null],
  /**
   * What the table plays when nobody picks — every seat a CPU, or every human
   * timed out — and what the picker starts on.
   */
  defaults: { target: 5000, rounds: 50 },
  /** How long the humans have to pick. */
  windowMs: 30_000,
  /**
   * With no target and no round limit, a table where nobody can knock anyone
   * out would never end — 5% of 6-seat CPU matches in the calibration ran
   * past 17,000 rounds. Such a match stops here and the richest wins. Matches
   * that can end, do: 90% are over by round 60–100.
   */
  safetyRounds: 200,
} as const;

export type SetupTarget = (typeof SETUP.targets)[number];
export type SetupRounds = (typeof SETUP.rounds)[number];

// ─── Money ───────────────────────────────────────────────────────────────────

export const TRIBUTE = {
  /** Base tribute as a fraction of the city's price. */
  baseRate: 0.1,
  /** Multiplier on base when the owner holds the whole empire, unbuilt. */
  wholeEmpire: 2,
  /** Multiplier on base by level: 1–4 houses, then the monument. */
  builtMult: [5, 15, 40, 55, 75],
} as const;

/** Houses a city can hold before its empire's monument. */
export const MAX_HOUSES = 4;
/** The monument's level — one above the last house. */
export const MONUMENT_LEVEL = MAX_HOUSES + 1;

/** Every build — each house, and the monument — costs this share of price. */
export const BUILD_COST_RATE = 0.5;
/** A forced or voluntary sale returns this share of what was paid. */
export const SALE_RATE = 0.5;

// ─── The Market ──────────────────────────────────────────────────────────────

export const MARKET = {
  /** Trade offers one player may make in one turn. */
  tradeOffersPerTurn: 2,
} as const;

export const AUCTION = {
  /** The smallest opening bid, and the smallest raise. */
  minBid: 10,
  step: 10,
  /** The quick raises the table offers. */
  raises: [10, 50, 100],
  /** Countdown when an auction opens. */
  openMs: 12_000,
  /** Every bid tops the countdown back up to at least this. */
  extendMs: 6_000,
  /** No auction runs longer than this from its opening. */
  maxMs: 40_000,
} as const;

// ─── CPU ─────────────────────────────────────────────────────────────────────

export const BOT = {
  /** A CPU buys or builds only if it would still hold this much. */
  reserve: 150,
  /** A CPU never bids itself below this. */
  auctionFloor: 50,
  /** Auction ceiling multipliers: completes an empire / gives two of three. */
  auctionCompleteMult: 1.5,
  auctionPairMult: 1.2,
  /** Builds a CPU makes in one turn, at most. */
  maxBuildsPerTurn: 3,
  /**
   * A CPU offers this multiple of the missing city's price — the same premium
   * it demands before handing an empire over, or CPUs never trade with each
   * other and empires never form (measured: 0.9 whole empires per 4-seat
   * match at 2×, 2.4 at 2.5×).
   */
  tradeOfferMult: 2.5,
  /** A CPU makes an offer only every this many rounds, so it doesn't nag. */
  tradeEveryRounds: 2,
  /** A CPU accepts if it gets at least this multiple of what it gives… */
  tradeAcceptMult: 1.2,
  /** …or, if the trade hands the proposer a whole empire, this × its price. */
  monopolyPremium: 2.5,
  /** A swap that completes an empire for the CPU too: this multiple is fine. */
  swapAcceptMult: 0.8,
} as const;

// ─── The board ───────────────────────────────────────────────────────────────

export const BOARD_SIZE = 32;
export const START_TILE = 0;
export const DUNGEON_TILE = 8;

export type EmpireId =
  | "ottoman"
  | "rome"
  | "mongol"
  | "ming"
  | "mughal"
  | "france"
  | "britain"
  | "bengal";

/**
 * Eight empires, cheapest to richest clockwise from the Silk Road, in even
 * 40-coin steps. Every price is a multiple of 20, which keeps every formula in
 * whole coins with no rounding rule anywhere. The order is gameplay tiers
 * only — not a ranking of history.
 */
export const EMPIRES: Array<{
  id: EmpireId;
  name: string;
  price: number;
  /** The one monument the empire can raise (GDD > Building). */
  monument: string;
}> = [
  { id: "ottoman", name: "Ottoman Empire", price: 100, monument: "Topkapı Palace" },
  { id: "rome", name: "Rome", price: 140, monument: "The Colosseum" },
  { id: "mongol", name: "Mongol Empire", price: 180, monument: "The Genghis Khan Statue" },
  { id: "ming", name: "Ming China", price: 220, monument: "The Forbidden City" },
  { id: "mughal", name: "Mughal Empire", price: 260, monument: "The Taj Mahal" },
  { id: "france", name: "France", price: 300, monument: "The Eiffel Tower" },
  { id: "britain", name: "Britain", price: 340, monument: "Big Ben" },
  { id: "bengal", name: "Bengal", price: 380, monument: "Hazarduari Palace" },
];

/** The 24 cities, in board order. `tile` is the index on the ring. */
export const CITIES: Array<{ id: string; name: string; empire: EmpireId; tile: number }> = [
  { id: "edirne", name: "Edirne", empire: "ottoman", tile: 1 },
  { id: "bursa", name: "Bursa", empire: "ottoman", tile: 2 },
  { id: "istanbul", name: "Istanbul", empire: "ottoman", tile: 3 },

  { id: "pompeii", name: "Pompeii", empire: "rome", tile: 5 },
  { id: "ravenna", name: "Ravenna", empire: "rome", tile: 6 },
  { id: "rome", name: "Rome", empire: "rome", tile: 7 },

  { id: "tabriz", name: "Tabriz", empire: "mongol", tile: 9 },
  { id: "sarai", name: "Sarai", empire: "mongol", tile: 10 },
  { id: "karakorum", name: "Karakorum", empire: "mongol", tile: 11 },

  { id: "guangzhou", name: "Guangzhou", empire: "ming", tile: 13 },
  { id: "nanjing", name: "Nanjing", empire: "ming", tile: 14 },
  { id: "beijing", name: "Beijing", empire: "ming", tile: 15 },

  { id: "lahore", name: "Lahore", empire: "mughal", tile: 17 },
  { id: "delhi", name: "Delhi", empire: "mughal", tile: 18 },
  { id: "agra", name: "Agra", empire: "mughal", tile: 19 },

  { id: "marseille", name: "Marseille", empire: "france", tile: 21 },
  { id: "lyon", name: "Lyon", empire: "france", tile: 22 },
  { id: "paris", name: "Paris", empire: "france", tile: 23 },

  { id: "liverpool", name: "Liverpool", empire: "britain", tile: 25 },
  { id: "manchester", name: "Manchester", empire: "britain", tile: 26 },
  { id: "london", name: "London", empire: "britain", tile: 27 },

  { id: "sonargaon", name: "Sonargaon", empire: "bengal", tile: 29 },
  { id: "dhaka", name: "Dhaka", empire: "bengal", tile: 30 },
  { id: "murshidabad", name: "Murshidabad", empire: "bengal", tile: 31 },
];

export type SpecialKind =
  | "silk-road"
  | "royal-decree"
  | "dungeon"
  | "fortune"
  | "treasury"
  | "treason";

/** The eight special tiles. Corners sit at 0, 8, 16 and 24. */
export const SPECIAL_TILES: Array<{ tile: number; kind: SpecialKind; name: string }> = [
  { tile: 0, kind: "silk-road", name: "Silk Road" },
  { tile: 4, kind: "royal-decree", name: "Royal Decree" },
  { tile: 8, kind: "dungeon", name: "The Dungeon" },
  { tile: 12, kind: "fortune", name: "Fortune" },
  { tile: 16, kind: "treasury", name: "Royal Treasury" },
  { tile: 20, kind: "royal-decree", name: "Royal Decree" },
  { tile: 24, kind: "treason", name: "Treason!" },
  { tile: 28, kind: "fortune", name: "Fortune" },
];

// ─── The cards ───────────────────────────────────────────────────────────────

export type CardEffect =
  | { kind: "collect"; amount: number }
  | { kind: "collectFromEach"; amount: number }
  | { kind: "payEach"; amount: number }
  | { kind: "payTreasury"; amount: number }
  | { kind: "payTreasuryPerCity"; amount: number }
  | { kind: "payTreasuryPerBuilding"; house: number; monument: number }
  | { kind: "dungeon" }
  | { kind: "toStart" }
  | { kind: "forward"; steps: number }
  | { kind: "freeBuild"; fallback: number };

export type Deck = "fortune" | "royal-decree";

export type Card = { id: string; name: string; effect: CardEffect };

/**
 * Two decks of ten. Each draw picks one at random — the same card can come up
 * twice, because there is no deck order to track (and so nothing hidden to
 * leak). Every card resolves immediately; none asks a question.
 */
export const CARDS: Record<Deck, Card[]> = {
  fortune: [
    { id: "silk-caravan", name: "A silk caravan arrives", effect: { kind: "collect", amount: 150 } },
    { id: "spices", name: "Spices from the East", effect: { kind: "collect", amount: 100 } },
    { id: "ambassador", name: "An ambassador's gift", effect: { kind: "collect", amount: 75 } },
    { id: "shipwreck", name: "Shipwreck", effect: { kind: "payTreasury", amount: 100 } },
    { id: "bandits", name: "Bandits on the road", effect: { kind: "payTreasury", amount: 50 } },
    { id: "treason", name: "Treason!", effect: { kind: "dungeon" } },
    { id: "silk-road-home", name: "Take the Silk Road home", effect: { kind: "toStart" } },
    { id: "forced-march", name: "Forced march", effect: { kind: "forward", steps: 3 } },
    { id: "master-builders", name: "Master builders", effect: { kind: "freeBuild", fallback: 100 } },
    {
      id: "plague",
      name: "Plague",
      effect: { kind: "payTreasuryPerBuilding", house: 25, monument: 100 },
    },
  ],
  "royal-decree": [
    { id: "vassals", name: "Vassals pay tribute", effect: { kind: "collectFromEach", amount: 25 } },
    { id: "lost-treasure", name: "A lost treasure", effect: { kind: "collect", amount: 200 } },
    { id: "inheritance", name: "An inheritance", effect: { kind: "collect", amount: 100 } },
    { id: "harvest", name: "A bountiful harvest", effect: { kind: "collect", amount: 50 } },
    { id: "scholar", name: "A scholar's grant", effect: { kind: "collect", amount: 75 } },
    { id: "coronation", name: "Coronation feast", effect: { kind: "payTreasury", amount: 100 } },
    { id: "census", name: "The royal census", effect: { kind: "payTreasuryPerCity", amount: 10 } },
    { id: "banquet", name: "You host a banquet", effect: { kind: "payEach", amount: 20 } },
    { id: "banished", name: "Banished!", effect: { kind: "dungeon" } },
    { id: "summoned", name: "Summoned to court", effect: { kind: "toStart" } },
  ],
};
