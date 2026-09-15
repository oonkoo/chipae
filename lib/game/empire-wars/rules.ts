import { z } from "zod";
import {
  BOARD_SIZE,
  BUILD_COST_RATE,
  CITIES,
  EMPIRES,
  EMPIRE_WARS_CONFIG,
  MAX_HOUSES,
  MONUMENT_LEVEL,
  SALE_RATE,
  SETUP,
  SPECIAL_TILES,
  START_TILE,
  TRIBUTE,
  type EmpireId,
  type SpecialKind,
} from "@/lib/game/data/empire-wars";

// Empire Wars v3 — the state, the board lookups and every formula
// (design/gdd/empire-wars-core.md). Pure: no DB, no I/O, no clock, no RNG.
// The transitions that change state live in turn.ts and are built from these.

/**
 * The rules a state was written under. v1 had no marker, v2 wrote 2 and v3
 * before match setup wrote 3, so all of them fail `parseState` and the
 * platform retires them instead of misreading them. Deliberately has no
 * `.default()` — that is the whole point of it.
 */
export const RULESET = 4;

/**
 * How many recent events the state carries, for the table's feed and the
 * money animations. A bounded window, never a log: every move rewrites the
 * whole state row, so anything that grows per turn eventually breaks it.
 */
export const EVENT_FEED_SIZE = 10;

// ─── Board lookups ───────────────────────────────────────────────────────────

export type CityDef = {
  id: string;
  name: string;
  empire: EmpireId;
  empireName: string;
  monument: string;
  tile: number;
  price: number;
  /** Position in `CITIES`, and so in `state.cities`. */
  index: number;
};

export type SpecialDef = { tile: number; kind: SpecialKind; name: string };

const CITY_DEFS: CityDef[] = CITIES.map((city, index) => {
  const empire = EMPIRES.find((e) => e.id === city.empire);
  if (!empire) throw new Error(`Unknown empire ${city.empire}`);
  return {
    ...city,
    empireName: empire.name,
    monument: empire.monument,
    price: empire.price,
    index,
  };
});
const CITY_BY_TILE = new Map(CITY_DEFS.map((c) => [c.tile, c]));
const SPECIAL_BY_TILE = new Map(SPECIAL_TILES.map((s) => [s.tile, s]));

export function cityAt(tile: number): CityDef | null {
  return CITY_BY_TILE.get(tile) ?? null;
}

export function cityByIndex(index: number): CityDef {
  return CITY_DEFS[index];
}

export function specialAt(tile: number): SpecialDef | null {
  return SPECIAL_BY_TILE.get(tile) ?? null;
}

/** An empire's three cities, in board order. */
export function citiesOf(empire: EmpireId): CityDef[] {
  return CITY_DEFS.filter((c) => c.empire === empire);
}

// ─── Formulas (GDD > Formulas) ───────────────────────────────────────────────
//
// With the published knobs every result is already whole coins, because every
// price is a multiple of 20. `Math.round` only absorbs floating-point noise —
// and keeps the numbers whole if a knob is ever retuned.

export function baseTribute(price: number): number {
  return Math.round(price * TRIBUTE.baseRate);
}

/**
 * What a visitor pays: base, doubled for a whole unbuilt empire, or the
 * built multiplier for 1–4 houses and the monument.
 */
export function tributeAt(price: number, level: number, wholeEmpire: boolean): number {
  const base = baseTribute(price);
  if (level <= 0) return wholeEmpire ? base * TRIBUTE.wholeEmpire : base;
  return base * TRIBUTE.builtMult[Math.min(level, MONUMENT_LEVEL) - 1];
}

/** Every build — each house, and the monument — costs half the price. */
export function buildCost(price: number): number {
  return Math.round(price * BUILD_COST_RATE);
}

/** A city is worth its price plus what its buildings cost. */
export function cityValue(price: number, level: number): number {
  return price + buildCost(price) * level;
}

/** What the bank pays for one building. */
export function buildingSalePrice(price: number): number {
  return Math.round(buildCost(price) * SALE_RATE);
}

/** What the bank pays for a bare city. */
export function citySalePrice(price: number): number {
  return Math.round(price * SALE_RATE);
}

// ─── State ───────────────────────────────────────────────────────────────────

const memberIdSchema = z.string().min(1);
const tileSchema = z.number().int().min(0).max(BOARD_SIZE - 1);
const coinsSchema = z.number().int().min(0);
const seqSchema = z.number().int().min(0);

export const endedBySchema = z.enum(["target", "last-standing", "rounds"]);
export type EndedBy = z.infer<typeof endedBySchema>;

export const phaseSchema = z.enum(["setup", "roll", "answer", "auction", "trade", "manage"]);
export type Phase = z.infer<typeof phaseSchema>;

// ─── Match setup (GDD > Match setup) ─────────────────────────────────────────

const onOffer = (options: readonly (number | null)[]) => (v: number | null) => options.includes(v);

/** A net-worth target on offer, or null for Unlimited. Never an arbitrary number. */
export const setupTargetSchema = z
  .number()
  .int()
  .positive()
  .nullable()
  .refine(onOffer(SETUP.targets), "That target isn't on offer");

/** A round limit on offer, or null for Unlimited. */
export const setupRoundsSchema = z
  .number()
  .int()
  .positive()
  .nullable()
  .refine(onOffer(SETUP.rounds), "That round limit isn't on offer");

/** One human's choice. */
export const setupPickSchema = z.object({
  memberId: memberIdSchema,
  target: setupTargetSchema,
  rounds: setupRoundsSchema,
});
export type SetupPick = z.infer<typeof setupPickSchema>;

/** What a match plays to. `null` is Unlimited. */
export type MatchSettings = { target: number | null; rounds: number | null };

/** How the settings were decided — a toss, everyone agreeing, or nobody picking. */
export const settledBySchema = z.enum(["toss", "agreed", "default"]);
export type SettledBy = z.infer<typeof settledBySchema>;

const setupSchema = z.object({
  /** The seats a human held at the deal: the only ones who pick. */
  humans: z.array(memberIdSchema).max(EMPIRE_WARS_CONFIG.maxPlayers),
  picks: z.array(setupPickSchema).max(EMPIRE_WARS_CONFIG.maxPlayers),
  /** When the table stops waiting, on the server's clock. */
  expiresAt: z.number().int(),
});
export type Setup = z.infer<typeof setupSchema>;

/** One side of a trade: the cities (by tile) and coins it hands over. */
export const tradeSideSchema = z.object({
  tiles: z.array(tileSchema).max(CITIES.length),
  coins: coinsSchema,
});
export type TradeSide = z.infer<typeof tradeSideSchema>;

const event = <K extends string, S extends z.ZodRawShape>(kind: K, shape: S) =>
  z.object({ kind: z.literal(kind), seq: seqSchema, memberId: memberIdSchema, ...shape });

/**
 * What just happened, for the feed and the money animations. Each carries the
 * `seq` (the state version) of the move that produced it, so a client can
 * tell which events are new since it last looked. `memberId` is always the
 * player the sentence is about.
 */
export const eventSchema = z.discriminatedUnion("kind", [
  event("payday", { amount: coinsSchema }),
  event("buy", { tile: tileSchema, amount: coinsSchema }),
  event("pass", { tile: tileSchema }),
  event("cant-afford", { tile: tileSchema }),
  event("tribute", { ownerId: memberIdSchema, tile: tileSchema, amount: coinsSchema }),
  event("treasury", { amount: coinsSchema }),
  event("card", { deck: z.enum(["fortune", "royal-decree"]), cardId: z.string() }),
  event("collect", { amount: coinsSchema }),
  event("chip-in", { toId: memberIdSchema, amount: coinsSchema }),
  event("pay-treasury", { amount: coinsSchema }),
  event("jailed", {}),
  event("jail-skip", {}),
  event("build", { tile: tileSchema, level: z.number().int().min(1).max(MONUMENT_LEVEL), amount: coinsSchema }),
  event("sold-building", { tile: tileSchema, level: z.number().int().min(0), amount: coinsSchema, forced: z.boolean() }),
  event("sold-city", { tile: tileSchema, amount: coinsSchema, forced: z.boolean() }),
  event("auction-open", { tile: tileSchema, sellerId: memberIdSchema.nullable() }),
  event("bid", { tile: tileSchema, amount: coinsSchema }),
  event("auction-won", { tile: tileSchema, amount: coinsSchema, sellerId: memberIdSchema.nullable() }),
  event("auction-unsold", { tile: tileSchema }),
  event("trade-offered", { toId: memberIdSchema }),
  event("trade-accepted", { toId: memberIdSchema, give: tradeSideSchema, get: tradeSideSchema }),
  event("trade-declined", { toId: memberIdSchema }),
  event("bankrupt", { creditorId: memberIdSchema.nullable() }),
  event("quit", {}),
  event("won", { endedBy: endedBySchema }),
  /**
   * The match settings are decided. `memberId` is whose picks are played —
   * the toss winner, or the first to pick when everyone agreed; on a default
   * it's simply the first seat.
   */
  event("settled", {
    target: z.number().int().positive().nullable(),
    rounds: z.number().int().positive().nullable(),
    settledBy: settledBySchema,
    picks: z.array(setupPickSchema).max(EMPIRE_WARS_CONFIG.maxPlayers),
  }),
]);
export type TurnEvent = z.infer<typeof eventSchema>;

const playerSchema = z.object({
  id: memberIdSchema,
  cash: coinsSchema,
  tile: tileSchema,
  /** Sent to the Dungeon: their next turn is skipped, then this clears. */
  inJail: z.boolean(),
  status: z.enum(["in", "bankrupt", "quit"]),
  /** The round they went bankrupt, for the standings line. */
  outRound: z.number().int().min(1).nullable(),
  /** 1, 2, 3… in the order seats left the match. Ranks the eliminated. */
  outOrder: z.number().int().min(1).nullable(),
});
export type EmpirePlayer = z.infer<typeof playerSchema>;

const citySchema = z.object({
  id: z.string(),
  ownerId: memberIdSchema.nullable(),
  /** 0 bare · 1–4 houses · 5 the empire's monument. */
  level: z.number().int().min(0).max(MONUMENT_LEVEL),
});

/** The landing question — the only answer a turn requires. */
const questionSchema = z.object({ kind: z.literal("buy"), tile: tileSchema });

const auctionSchema = z.object({
  /** The seq it opened at. Every bid names it, so a late click can't land on a newer auction. */
  id: seqSchema,
  tile: tileSchema,
  /** null: the bank is selling a city someone passed on. */
  sellerId: memberIdSchema.nullable(),
  /**
   * The least the first bid may be: 10 for a city the bank is selling, half
   * the price for a player's own — what the bank would have paid them.
   */
  openingBid: coinsSchema,
  highBid: coinsSchema,
  highBidderId: memberIdSchema.nullable(),
  /** When it closes, on the server's clock. */
  endsAt: z.number().int(),
  /** The latest it can ever close, however many bids. */
  hardEndAt: z.number().int(),
});
export type Auction = z.infer<typeof auctionSchema>;

const tradeSchema = z.object({
  /** The seq it was offered at. The answer names it, so a late click can't accept a newer offer. */
  id: seqSchema,
  fromId: memberIdSchema,
  toId: memberIdSchema,
  /** What the proposer hands over. */
  give: tradeSideSchema,
  /** What the proposer asks for. */
  get: tradeSideSchema,
  expiresAt: z.number().int(),
});
export type TradeOffer = z.infer<typeof tradeSchema>;

const lastRollSchema = z.object({
  memberId: memberIdSchema,
  d1: z.number().int().min(1).max(6),
  d2: z.number().int().min(1).max(6),
  from: tileSchema,
  /** Where the walk ends — after a Forced march or a trip home, not just the dice. */
  to: tileSchema,
  seq: seqSchema,
});

const stateSchema = z
  .object({
    ruleset: z.literal(RULESET),
    players: z
      .array(playerSchema)
      .min(EMPIRE_WARS_CONFIG.minPlayers)
      .max(EMPIRE_WARS_CONFIG.maxPlayers),
    cities: z.array(citySchema).length(CITIES.length),
    currentIndex: z.number().int().min(0),
    round: z.number().int().min(1),
    /** The net worth that wins; null = no target. Set by match setup. */
    target: z.number().int().positive().nullable(),
    /** The last round; null = no limit. Set by match setup. */
    roundLimit: z.number().int().positive().nullable(),
    /** The humans' picks, while the table is choosing its settings. */
    setup: setupSchema.nullable(),
    /** The Royal Treasury: card payments pile up here until someone lands on it. */
    treasury: coinsSchema,
    phase: phaseSchema,
    question: questionSchema.nullable(),
    auction: auctionSchema.nullable(),
    trade: tradeSchema.nullable(),
    /** Trade offers the player on the clock has made this turn. */
    tradesThisTurn: z.number().int().min(0),
    /** Builds made this turn — the CPU caps its own. */
    buildsThisTurn: z.number().int().min(0),
    lastRoll: lastRollSchema.nullable(),
    events: z.array(eventSchema).max(EVENT_FEED_SIZE),
    winnerId: memberIdSchema.nullable(),
    endedBy: endedBySchema.nullable(),
    /** How many seats have left, for `outOrder`. */
    outCount: z.number().int().min(0),
    /** Bumped on every applied move — the CPU driver's effect keys on it. */
    version: z.number().int().min(0),
    /** The deadline for whoever is on the clock now (server clock). */
    turnExpiresAt: z.number().int().nullable(),
  })
  .refine((s) => s.currentIndex < s.players.length, "turn pointer off the table")
  .refine(
    (s) => s.cities.every((c, i) => c.id === CITIES[i].id),
    "cities out of board order"
  );

export type EmpireState = z.infer<typeof stateSchema>;

/** Re-validate state read back from the DB. Anything unusable fails closed. */
export function parseState(raw: unknown): EmpireState | null {
  const parsed = stateSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export type DealOptions = {
  /**
   * Seats a connected human holds (ADR-0005 Amendment 2). With any, the match
   * opens on setup: the humans pick the settings before the first roll.
   */
  humans?: readonly string[];
  /** Skip setup and play these — for simulations and tests. */
  settings?: MatchSettings;
};

/**
 * The opening position: everyone on the Silk Road with 1,500 coins. A table
 * with humans starts in setup, carrying the default settings until they're
 * decided; a table of CPUs plays the defaults straight away.
 */
export function dealGame(memberIds: string[], now: number, options: DealOptions = {}): EmpireState {
  const humans = memberIds.filter((id) => options.humans?.includes(id));
  const choosing = !options.settings && humans.length > 0;
  const settings = options.settings ?? { target: SETUP.defaults.target, rounds: SETUP.defaults.rounds };
  return {
    ruleset: RULESET,
    players: memberIds.map((id) => ({
      id,
      cash: EMPIRE_WARS_CONFIG.startingCash,
      tile: START_TILE,
      inJail: false,
      status: "in",
      outRound: null,
      outOrder: null,
    })),
    cities: CITIES.map((c) => ({ id: c.id, ownerId: null, level: 0 })),
    currentIndex: 0,
    round: 1,
    target: settings.target,
    roundLimit: settings.rounds,
    setup: choosing ? { humans, picks: [], expiresAt: now + SETUP.windowMs } : null,
    treasury: 0,
    phase: choosing ? "setup" : "roll",
    question: null,
    auction: null,
    trade: null,
    tradesThisTurn: 0,
    buildsThisTurn: 0,
    lastRoll: null,
    events: [],
    winnerId: null,
    endedBy: null,
    outCount: 0,
    version: 0,
    // The clock starts at the deal, so a host who deals and walks away can't
    // freeze the table before anyone has moved.
    turnExpiresAt: now + (choosing ? SETUP.windowMs : EMPIRE_WARS_CONFIG.turnWindowMs),
  };
}

// ─── Reading the state ───────────────────────────────────────────────────────

export function currentPlayer(state: EmpireState): EmpirePlayer | null {
  return state.players[state.currentIndex] ?? null;
}

export function playersIn(state: EmpireState): EmpirePlayer[] {
  return state.players.filter((p) => p.status === "in");
}

/** How many of an empire's cities one owner holds. */
export function heldOf(state: EmpireState, ownerId: string, empire: EmpireId): number {
  return citiesOf(empire).filter((c) => state.cities[c.index].ownerId === ownerId).length;
}

export function ownsWholeEmpire(state: EmpireState, ownerId: string, empire: EmpireId): boolean {
  return heldOf(state, ownerId, empire) === 3;
}

/** Any house or monument anywhere in the empire. */
export function empireHasBuildings(state: EmpireState, empire: EmpireId): boolean {
  return citiesOf(empire).some((c) => state.cities[c.index].level > 0);
}

export function empireHasMonument(state: EmpireState, empire: EmpireId): boolean {
  return citiesOf(empire).some((c) => state.cities[c.index].level === MONUMENT_LEVEL);
}

/** What landing on this city costs a visitor right now; null while it's free. */
export function tributeOf(state: EmpireState, index: number): number | null {
  const slot = state.cities[index];
  if (!slot.ownerId) return null;
  const def = CITY_DEFS[index];
  return tributeAt(def.price, slot.level, ownsWholeEmpire(state, slot.ownerId, def.empire));
}

/**
 * Can this owner put one more level on this city right now? The whole empire,
 * 4 houses before the monument, and one monument per empire. Coins and whose
 * turn it is are the caller's business.
 */
export function canBuildOn(state: EmpireState, ownerId: string, index: number): boolean {
  const slot = state.cities[index];
  const def = CITY_DEFS[index];
  if (slot.ownerId !== ownerId || !ownsWholeEmpire(state, ownerId, def.empire)) return false;
  if (slot.level < MAX_HOUSES) return true;
  return slot.level === MAX_HOUSES && !empireHasMonument(state, def.empire);
}

/** A city can be sold or traded only while its empire has no buildings. */
export function isBare(state: EmpireState, index: number): boolean {
  return !empireHasBuildings(state, CITY_DEFS[index].empire);
}

export function citiesOwned(state: EmpireState, memberId: string): number {
  return state.cities.filter((c) => c.ownerId === memberId).length;
}

/** Coins plus the value of every city owned. The treasury is nobody's. */
export function netWorth(state: EmpireState, memberId: string): number {
  const player = state.players.find((p) => p.id === memberId);
  if (!player) return 0;
  let worth = player.cash;
  state.cities.forEach((slot, index) => {
    if (slot.ownerId === memberId) worth += cityValue(CITY_DEFS[index].price, slot.level);
  });
  return worth;
}

/**
 * The best of these players: highest net worth, then most cities, then
 * earliest seat (GDD > Winning — the tie-break everywhere).
 */
export function leaderOf(state: EmpireState, candidates: EmpirePlayer[]): EmpirePlayer {
  const seatOf = (p: EmpirePlayer) => state.players.findIndex((q) => q.id === p.id);
  return [...candidates].sort(
    (a, b) =>
      netWorth(state, b.id) - netWorth(state, a.id) ||
      citiesOwned(state, b.id) - citiesOwned(state, a.id) ||
      seatOf(a) - seatOf(b)
  )[0];
}

/**
 * Finishing order: players still in (winner first, then by the tie-break
 * order), then the bankrupt, most recent first, then those who quit.
 */
export function standingsOrder(state: EmpireState): string[] {
  const remaining = [...playersIn(state)];
  const ranked: EmpirePlayer[] = [];
  while (remaining.length) {
    const next =
      ranked.length === 0 && state.winnerId
        ? (remaining.find((p) => p.id === state.winnerId) ?? leaderOf(state, remaining))
        : leaderOf(state, remaining);
    ranked.push(next);
    remaining.splice(remaining.indexOf(next), 1);
  }
  const out = (status: EmpirePlayer["status"]) =>
    state.players
      .filter((p) => p.status === status)
      .sort((a, b) => (b.outOrder ?? 0) - (a.outOrder ?? 0));
  return [...ranked, ...out("bankrupt"), ...out("quit")].map((p) => p.id);
}
