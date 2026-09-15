import { z } from "zod";
import type { MoveContext, Transition } from "@/lib/game/module";
import {
  AUCTION,
  BOARD_SIZE,
  BOT,
  CARDS,
  CITIES,
  DUNGEON_TILE,
  EMPIRE_WARS_CONFIG,
  MARKET,
  MONUMENT_LEVEL,
  SETUP,
  START_TILE,
  type Deck,
} from "@/lib/game/data/empire-wars";
import {
  EVENT_FEED_SIZE,
  buildCost,
  buildingSalePrice,
  canBuildOn,
  cityAt,
  cityByIndex,
  citySalePrice,
  citiesOwned,
  heldOf,
  isBare,
  leaderOf,
  netWorth,
  playersIn,
  setupRoundsSchema,
  setupTargetSchema,
  specialAt,
  tributeOf,
  type EmpirePlayer,
  type EmpireState,
  type EndedBy,
  type SettledBy,
  type TradeSide,
  type TurnEvent,
} from "@/lib/game/empire-wars/rules";

// Empire Wars v3 — the turn (design/gdd/empire-wars-core.md > A turn).
//
//   [setup, once] → roll → at most one landing question → [auction] → manage → End turn
//
// Setup opens a match with humans in it: each human picks a target and a
// round limit, and a toss settles it if they disagree (GDD > Match setup).
//
// `state.phase` says which of those the table is in. Two phases hand the
// clock to someone other than the player whose turn it is: a trade (only the
// recipient may answer) and an auction (anyone may bid). Both carry a
// deadline judged on the server's clock, and a safe default when it passes.

const tile = z.number().int().min(0).max(BOARD_SIZE - 1);
const side = z.object({
  tiles: z.array(tile).max(CITIES.length),
  coins: z.number().int().min(0).max(10_000_000),
});

/**
 * The whole move schema. Answers name what they answer — the tile, the
 * auction id, the offer id — so a click that arrives after the table moved
 * on can never land on something newer.
 */
export const empireMoveSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("pickSetup"), target: setupTargetSchema, rounds: setupRoundsSchema }),
  z.object({ kind: z.literal("closeSetup") }),
  z.object({ kind: z.literal("roll") }),
  z.object({ kind: z.literal("buy"), tile }),
  z.object({ kind: z.literal("decline"), tile }),
  z.object({ kind: z.literal("bid"), id: z.number().int().min(0), amount: z.number().int().min(1) }),
  z.object({ kind: z.literal("closeAuction") }),
  z.object({ kind: z.literal("build"), tile }),
  z.object({ kind: z.literal("sellBuilding"), tile }),
  z.object({ kind: z.literal("sellCity"), tile }),
  z.object({ kind: z.literal("auctionCity"), tile }),
  z.object({ kind: z.literal("offerTrade"), to: z.string().min(1), give: side, get: side }),
  z.object({ kind: z.literal("answerTrade"), id: z.number().int().min(0), accept: z.boolean() }),
  z.object({ kind: z.literal("endTurn") }),
]);
export type EmpireMove = z.infer<typeof empireMoveSchema>;

type EmpireTransition = Transition<EmpireState>;

function fail(error: string): EmpireTransition {
  return { ok: false, error };
}

// ─── Drafts ──────────────────────────────────────────────────────────────────
// A move works on a private copy of the state and mutates it freely; the
// caller's state is never touched, so a rejected move leaves nothing behind.

type Draft = { s: EmpireState; seq: number; ctx: MoveContext };
/** `Omit` that keeps a union a union, so each event kind keeps its own fields. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type EventBody = DistributiveOmit<TurnEvent, "seq">;

function draftOf(state: EmpireState, ctx: MoveContext): Draft {
  return {
    s: {
      ...state,
      players: state.players.map((p) => ({ ...p })),
      cities: state.cities.map((c) => ({ ...c })),
      question: state.question ? { ...state.question } : null,
      auction: state.auction ? { ...state.auction } : null,
      trade: state.trade
        ? {
            ...state.trade,
            give: { ...state.trade.give, tiles: [...state.trade.give.tiles] },
            get: { ...state.trade.get, tiles: [...state.trade.get.tiles] },
          }
        : null,
      setup: state.setup
        ? {
            ...state.setup,
            humans: [...state.setup.humans],
            picks: state.setup.picks.map((p) => ({ ...p })),
          }
        : null,
      lastRoll: state.lastRoll ? { ...state.lastRoll } : null,
      // Events are never edited after they're recorded; a shallow copy will do.
      events: [...state.events],
    },
    seq: state.version + 1,
    ctx,
  };
}

function emit(d: Draft, body: EventBody) {
  d.s.events.push({ ...body, seq: d.seq } as TurnEvent);
}

/** Stamp a finished move: new version, the right deadline, a trimmed feed. */
function finish(d: Draft): EmpireTransition {
  const s = d.s;
  s.version = d.seq;
  s.turnExpiresAt = s.winnerId
    ? null
    : s.phase === "setup" && s.setup
      ? s.setup.expiresAt
      : s.phase === "auction" && s.auction
        ? s.auction.endsAt
        : s.phase === "trade" && s.trade
          ? s.trade.expiresAt
          : d.ctx.now +
            (s.phase === "manage" ? EMPIRE_WARS_CONFIG.manageWindowMs : EMPIRE_WARS_CONFIG.turnWindowMs);
  if (s.events.length > EVENT_FEED_SIZE) s.events = s.events.slice(-EVENT_FEED_SIZE);
  return { ok: true, state: s };
}

function playerById(d: Draft, id: string): EmpirePlayer {
  const player = d.s.players.find((p) => p.id === id);
  if (!player) throw new Error(`No player ${id}`);
  return player;
}

function current(d: Draft): EmpirePlayer {
  return d.s.players[d.s.currentIndex];
}

/** A seat no connected human holds. Absent `humans` means every seat is a CPU. */
function isCpu(ctx: MoveContext, memberId: string): boolean {
  return !(ctx.humans?.includes(memberId) ?? false);
}

// ─── Money ───────────────────────────────────────────────────────────────────

function credit(d: Draft, creditorId: string | null, amount: number) {
  if (creditorId === null) d.s.treasury += amount;
  else playerById(d, creditorId).cash += amount;
}

/**
 * The bank sells for a debtor: buildings first, one level at a time from the
 * most-built city; then cities, cheapest first — each at half — until the
 * debt is covered or there's nothing left. Nothing is asked, which is what
 * lets a debt land on someone else's turn.
 */
function raiseCash(d: Draft, debtor: EmpirePlayer, amount: number) {
  while (debtor.cash < amount) {
    let mostBuilt = -1;
    for (let i = 0; i < d.s.cities.length; i++) {
      const slot = d.s.cities[i];
      if (slot.ownerId !== debtor.id || slot.level === 0) continue;
      // Strict `>` keeps the first in board order on a tie.
      if (mostBuilt < 0 || slot.level > d.s.cities[mostBuilt].level) mostBuilt = i;
    }
    if (mostBuilt >= 0) {
      const slot = d.s.cities[mostBuilt];
      const def = cityByIndex(mostBuilt);
      const proceeds = buildingSalePrice(def.price);
      slot.level -= 1;
      debtor.cash += proceeds;
      emit(d, { kind: "sold-building", memberId: debtor.id, tile: def.tile, level: slot.level, amount: proceeds, forced: true });
      continue;
    }

    let cheapest = -1;
    for (let i = 0; i < d.s.cities.length; i++) {
      if (d.s.cities[i].ownerId !== debtor.id) continue;
      if (cheapest < 0 || cityByIndex(i).price < cityByIndex(cheapest).price) cheapest = i;
    }
    if (cheapest < 0) return;
    const def = cityByIndex(cheapest);
    const proceeds = citySalePrice(def.price);
    d.s.cities[cheapest].ownerId = null;
    debtor.cash += proceeds;
    emit(d, { kind: "sold-city", memberId: debtor.id, tile: def.tile, amount: proceeds, forced: true });
  }
}

/**
 * Settle a debt, selling up first if needed. `record` describes the payment
 * with what was actually paid. If even selling everything can't cover it, the
 * creditor gets what there is and the debtor is out.
 */
function settle(
  d: Draft,
  debtor: EmpirePlayer,
  amount: number,
  creditorId: string | null,
  record: (paid: number) => EventBody
) {
  raiseCash(d, debtor, amount);
  const paid = Math.min(debtor.cash, amount);
  debtor.cash -= paid;
  credit(d, creditorId, paid);
  emit(d, record(paid));
  if (paid < amount) goBankrupt(d, debtor, creditorId);
}

function goBankrupt(d: Draft, debtor: EmpirePlayer, creditorId: string | null) {
  debtor.status = "bankrupt";
  debtor.inJail = false;
  debtor.outRound = d.s.round;
  d.s.outCount += 1;
  debtor.outOrder = d.s.outCount;
  emit(d, { kind: "bankrupt", memberId: debtor.id, creditorId });
}

// ─── Moving ──────────────────────────────────────────────────────────────────

function rollDie(random: () => number): number {
  return Math.min(6, 1 + Math.floor(random() * 6));
}

function payday(d: Draft, player: EmpirePlayer) {
  player.cash += EMPIRE_WARS_CONFIG.payday;
  emit(d, { kind: "payday", memberId: player.id, amount: EMPIRE_WARS_CONFIG.payday });
}

/** Step clockwise. Passing or landing on the Silk Road pays once. */
function stepForward(d: Draft, player: EmpirePlayer, steps: number) {
  const next = player.tile + steps;
  if (next >= BOARD_SIZE) payday(d, player);
  player.tile = next % BOARD_SIZE;
}

/** Straight to the Dungeon — it never passes the Silk Road. */
function sendToDungeon(d: Draft, player: EmpirePlayer) {
  player.tile = DUNGEON_TILE;
  player.inJail = true;
  emit(d, { kind: "jailed", memberId: player.id });
}

// ─── Landing ─────────────────────────────────────────────────────────────────

/** Deepest a card may chain into another landing. Forced march is the only one. */
const MAX_CHAIN = 2;

function resolveTile(d: Draft, player: EmpirePlayer, depth: number) {
  const city = cityAt(player.tile);
  if (city) {
    resolveCity(d, player, city.index);
    return;
  }
  switch (specialAt(player.tile)?.kind) {
    case "royal-decree":
      drawCard(d, player, "royal-decree", depth);
      return;
    case "fortune":
      drawCard(d, player, "fortune", depth);
      return;
    case "treasury": {
      const amount = d.s.treasury;
      player.cash += amount;
      d.s.treasury = 0;
      emit(d, { kind: "treasury", memberId: player.id, amount });
      return;
    }
    case "treason":
      sendToDungeon(d, player);
      return;
    default:
      // The Silk Road paid on the way in; the Dungeon tile is just visiting.
      return;
  }
}

function resolveCity(d: Draft, player: EmpirePlayer, index: number) {
  const slot = d.s.cities[index];
  const def = cityByIndex(index);

  if (slot.ownerId === null) {
    if (player.cash >= def.price) {
      d.s.question = { kind: "buy", tile: def.tile };
      d.s.phase = "answer";
    } else {
      emit(d, { kind: "cant-afford", memberId: player.id, tile: def.tile });
      openAuction(d, index, null, player.id);
    }
    return;
  }
  if (slot.ownerId === player.id) return;

  const ownerId = slot.ownerId;
  settle(d, player, tributeOf(d.s, index) ?? 0, ownerId, (paid) => ({
    kind: "tribute",
    memberId: player.id,
    ownerId,
    tile: def.tile,
    amount: paid,
  }));
}

function drawCard(d: Draft, player: EmpirePlayer, deck: Deck, depth: number) {
  const cards = CARDS[deck];
  const card = cards[Math.min(cards.length - 1, Math.floor(d.ctx.random() * cards.length))];
  emit(d, { kind: "card", memberId: player.id, deck, cardId: card.id });

  const effect = card.effect;
  switch (effect.kind) {
    case "collect":
      player.cash += effect.amount;
      emit(d, { kind: "collect", memberId: player.id, amount: effect.amount });
      return;

    case "collectFromEach":
      // Seat order, starting after the drawer. A player this breaks goes
      // bankrupt here and now — nobody is asked anything.
      for (const other of othersAfter(d, player)) {
        settle(d, other, effect.amount, player.id, (paid) => ({
          kind: "chip-in",
          memberId: other.id,
          toId: player.id,
          amount: paid,
        }));
      }
      return;

    case "payEach":
      for (const other of othersAfter(d, player)) {
        if (player.status !== "in") return;
        settle(d, player, effect.amount, other.id, (paid) => ({
          kind: "chip-in",
          memberId: player.id,
          toId: other.id,
          amount: paid,
        }));
      }
      return;

    case "payTreasury":
      payTreasury(d, player, effect.amount);
      return;

    case "payTreasuryPerCity":
      payTreasury(d, player, effect.amount * citiesOwned(d.s, player.id));
      return;

    case "payTreasuryPerBuilding": {
      let houses = 0;
      let monuments = 0;
      for (const slot of d.s.cities) {
        if (slot.ownerId !== player.id) continue;
        if (slot.level === MONUMENT_LEVEL) monuments += 1;
        else houses += slot.level;
      }
      payTreasury(d, player, houses * effect.house + monuments * effect.monument);
      return;
    }

    case "dungeon":
      sendToDungeon(d, player);
      return;

    case "toStart":
      player.tile = START_TILE;
      // Arriving at the Silk Road *is* the payday — once, not twice.
      payday(d, player);
      if (d.s.lastRoll) d.s.lastRoll.to = START_TILE;
      return;

    case "forward":
      stepForward(d, player, effect.steps);
      if (d.s.lastRoll) d.s.lastRoll.to = player.tile;
      if (depth < MAX_CHAIN) resolveTile(d, player, depth + 1);
      return;

    case "freeBuild": {
      // The least-built city you can build on; cheapest, then board order.
      let pick = -1;
      for (let i = 0; i < d.s.cities.length; i++) {
        if (!canBuildOn(d.s, player.id, i)) continue;
        if (
          pick < 0 ||
          d.s.cities[i].level < d.s.cities[pick].level ||
          (d.s.cities[i].level === d.s.cities[pick].level &&
            cityByIndex(i).price < cityByIndex(pick).price)
        ) {
          pick = i;
        }
      }
      if (pick < 0) {
        player.cash += effect.fallback;
        emit(d, { kind: "collect", memberId: player.id, amount: effect.fallback });
        return;
      }
      d.s.cities[pick].level += 1;
      emit(d, { kind: "build", memberId: player.id, tile: cityByIndex(pick).tile, level: d.s.cities[pick].level, amount: 0 });
      return;
    }
  }
}

function payTreasury(d: Draft, player: EmpirePlayer, amount: number) {
  if (amount <= 0) return;
  settle(d, player, amount, null, (paid) => ({ kind: "pay-treasury", memberId: player.id, amount: paid }));
}

/** Everyone else still in, in seat order starting after this player. */
function othersAfter(d: Draft, player: EmpirePlayer): EmpirePlayer[] {
  const n = d.s.players.length;
  const start = d.s.players.indexOf(player);
  const others: EmpirePlayer[] = [];
  for (let offset = 1; offset < n; offset++) {
    const other = d.s.players[(start + offset) % n];
    if (other.status === "in") others.push(other);
  }
  return others;
}

// ─── Auctions ────────────────────────────────────────────────────────────────

/** Who may bid: everyone still in, except a player selling their own city. */
function bidders(d: Draft): EmpirePlayer[] {
  const sellerId = d.s.auction?.sellerId ?? null;
  return d.s.players.filter((p) => p.status === "in" && p.id !== sellerId);
}

function nextBid(a: { highBid: number; openingBid: number }): number {
  return a.highBid === 0 ? a.openingBid : a.highBid + AUCTION.step;
}

/**
 * What a CPU will pay at most: the price, more if the city completes an empire
 * or gives it two of three — never leaving itself under its floor.
 */
export function cpuCeiling(state: EmpireState, player: EmpirePlayer, tileIndex: number): number {
  const def = cityAt(tileIndex);
  if (!def) return 0;
  const held = heldOf(state, player.id, def.empire);
  const mult = held === 2 ? BOT.auctionCompleteMult : held === 1 ? BOT.auctionPairMult : 1;
  const ceiling = Math.floor((def.price * mult) / AUCTION.step) * AUCTION.step;
  return Math.max(0, Math.min(ceiling, player.cash - BOT.auctionFloor));
}

/**
 * The CPUs answer — as proxies, instantly. Run when an auction opens and after
 * every human bid: the CPU with the highest ceiling takes the lead at the
 * lowest price that beats both the standing bid and every other CPU's
 * ceiling (a second-price step, like an auction site's proxy bidding).
 */
function proxyBids(d: Draft) {
  const a = d.s.auction;
  if (!a) return;
  const required = nextBid(a);
  const n = d.s.players.length;
  const seatAfterCurrent = (p: EmpirePlayer) =>
    (d.s.players.indexOf(p) - d.s.currentIndex - 1 + n) % n;
  const cpus = bidders(d)
    .filter((p) => isCpu(d.ctx, p.id) && p.id !== a.highBidderId)
    .map((p) => ({ p, ceiling: cpuCeiling(d.s, p, a.tile) }))
    .filter((c) => c.ceiling >= required)
    .sort((x, y) => y.ceiling - x.ceiling || seatAfterCurrent(x.p) - seatAfterCurrent(y.p));
  if (cpus.length === 0) return;

  const [top, second] = cpus;
  const price = second
    ? Math.max(required, Math.min(top.ceiling, second.ceiling + AUCTION.step))
    : required;
  a.highBid = price;
  a.highBidderId = top.p.id;
  emit(d, { kind: "bid", memberId: top.p.id, tile: a.tile, amount: price });
}

/** Could any human still bid? If not, there's nobody to wait for. */
function humanCanBid(d: Draft): boolean {
  const a = d.s.auction;
  if (!a) return false;
  const required = nextBid(a);
  return bidders(d).some(
    (p) => !isCpu(d.ctx, p.id) && p.id !== a.highBidderId && p.cash >= required
  );
}

function openAuction(d: Draft, index: number, sellerId: string | null, triggeredBy: string) {
  const def = cityByIndex(index);
  d.s.auction = {
    id: d.seq,
    tile: def.tile,
    sellerId,
    openingBid: sellerId === null ? AUCTION.minBid : citySalePrice(def.price),
    highBid: 0,
    highBidderId: null,
    endsAt: d.ctx.now + AUCTION.openMs,
    hardEndAt: d.ctx.now + AUCTION.maxMs,
  };
  d.s.phase = "auction";
  emit(d, { kind: "auction-open", memberId: triggeredBy, tile: def.tile, sellerId });
  proxyBids(d);
  if (!humanCanBid(d)) closeAuction(d);
}

/** The highest bidder pays the seller (or the bank) and takes the city. */
function closeAuction(d: Draft) {
  const a = d.s.auction;
  if (!a) return;
  const def = cityAt(a.tile)!;
  const slot = d.s.cities[def.index];
  const winner = a.highBidderId ? playerById(d, a.highBidderId) : null;
  const stillForSale = a.sellerId === null ? slot.ownerId === null : slot.ownerId === a.sellerId;

  if (winner && winner.status === "in" && winner.cash >= a.highBid && stillForSale) {
    winner.cash -= a.highBid;
    // A player's sale pays them; a bank sale's coins simply leave the table.
    if (a.sellerId !== null) playerById(d, a.sellerId).cash += a.highBid;
    slot.ownerId = winner.id;
    slot.level = 0;
    emit(d, { kind: "auction-won", memberId: winner.id, tile: a.tile, amount: a.highBid, sellerId: a.sellerId });
  } else {
    emit(d, { kind: "auction-unsold", memberId: a.sellerId ?? current(d).id, tile: a.tile });
  }
  d.s.auction = null;
  d.s.phase = "manage";
}

// ─── The Market ──────────────────────────────────────────────────────────────

/**
 * Is this offer legal right now? Cities from built empires can't move, coins
 * can't exceed what a side holds, and something has to change hands.
 */
function tradeProblem(
  s: EmpireState,
  fromId: string,
  toId: string,
  give: TradeSide,
  get: TradeSide
): string | null {
  const from = s.players.find((p) => p.id === fromId);
  const to = s.players.find((p) => p.id === toId);
  if (!from || !to || to.status !== "in" || from.status !== "in") return "They're not in this match";
  if (fromId === toId) return "You can't trade with yourself";
  if (give.tiles.length + get.tiles.length === 0 && give.coins + get.coins === 0) {
    return "Put something on the table";
  }
  const all = [...give.tiles, ...get.tiles];
  if (new Set(all).size !== all.length) return "A city can only be named once";
  for (const [tiles, ownerId] of [[give.tiles, fromId], [get.tiles, toId]] as const) {
    for (const t of tiles) {
      const def = cityAt(t);
      if (!def || s.cities[def.index].ownerId !== ownerId) return "That city isn't theirs to trade";
      if (!isBare(s, def.index)) return "Sell the buildings in that empire first";
    }
  }
  if (give.coins > from.cash) return "You don't have that many coins";
  if (get.coins > to.cash) return "They don't have that many coins";
  return null;
}

function executeTrade(d: Draft, fromId: string, toId: string, give: TradeSide, get: TradeSide) {
  const from = playerById(d, fromId);
  const to = playerById(d, toId);
  for (const t of give.tiles) d.s.cities[cityAt(t)!.index].ownerId = toId;
  for (const t of get.tiles) d.s.cities[cityAt(t)!.index].ownerId = fromId;
  from.cash += get.coins - give.coins;
  to.cash += give.coins - get.coins;
}

// ─── Match setup ─────────────────────────────────────────────────────────────
// CPUs never pick: they play by whatever the humans choose. When the last
// human still in has picked, or the clock runs out, the settings are decided.

/**
 * The humans still in who haven't picked. Only seats that were human at the
 * deal pick; `humans` (who is connected now, when known) narrows that, so a
 * player who has left the lobby isn't waited for.
 */
export function setupWaitingOn(state: EmpireState, humans?: readonly string[]): string[] {
  const setup = state.setup;
  if (!setup) return [];
  return state.players
    .filter(
      (p) =>
        p.status === "in" &&
        setup.humans.includes(p.id) &&
        (humans === undefined || humans.includes(p.id)) &&
        !setup.picks.some((pick) => pick.memberId === p.id)
    )
    .map((p) => p.id);
}

/**
 * Decide the settings: one choice if every picker agreed, a toss among the
 * pickers if not, the defaults if nobody picked. Then the first seat still in
 * rolls.
 */
function settleSetup(d: Draft) {
  const s = d.s;
  if (!s.setup) return;
  const seatOf = (id: string) => s.players.findIndex((p) => p.id === id);
  // Seat order, so a given random number always lands on the same seat.
  const picks = s.setup.picks
    .filter((pick) => playerById(d, pick.memberId).status === "in")
    .sort((a, b) => seatOf(a.memberId) - seatOf(b.memberId));

  let settledBy: SettledBy = "default";
  let chosen = picks[0] ?? null;
  if (picks.length > 0) {
    const agreed = picks.every((p) => p.target === picks[0].target && p.rounds === picks[0].rounds);
    settledBy = agreed ? "agreed" : "toss";
    if (!agreed) chosen = picks[Math.min(picks.length - 1, Math.floor(d.ctx.random() * picks.length))];
  }
  const target = chosen ? chosen.target : SETUP.defaults.target;
  const rounds = chosen ? chosen.rounds : SETUP.defaults.rounds;

  s.target = target;
  s.roundLimit = rounds;
  s.setup = null;
  s.phase = "roll";
  // Seat 1 may have walked away while the table was choosing.
  const first = s.players.findIndex((p) => p.status === "in");
  if (first >= 0) s.currentIndex = first;
  emit(d, {
    kind: "settled",
    memberId: chosen?.memberId ?? s.players[s.currentIndex].id,
    target,
    rounds,
    settledBy,
    picks,
  });
}

// ─── Ending a turn ───────────────────────────────────────────────────────────

function declareWinner(d: Draft, winner: EmpirePlayer, endedBy: EndedBy) {
  d.s.winnerId = winner.id;
  d.s.endedBy = endedBy;
  d.s.setup = null;
  d.s.question = null;
  d.s.auction = null;
  d.s.trade = null;
  emit(d, { kind: "won", memberId: winner.id, endedBy });
}

/**
 * Last one standing, or anyone at the target (the richest of them). Checked
 * at the end of every turn, so a player pushed over the line by someone
 * else's tribute wins when that turn ends.
 */
function checkForWinner(d: Draft): boolean {
  const alive = playersIn(d.s);
  if (alive.length === 1) {
    declareWinner(d, alive[0], "last-standing");
    return true;
  }
  if (alive.length === 0) return true;
  const target = d.s.target;
  // No target (Unlimited): only the round limit or the last one standing ends it.
  const atTarget = target === null ? [] : alive.filter((p) => netWorth(d.s, p.id) >= target);
  if (atTarget.length > 0) {
    declareWinner(d, leaderOf(d.s, atTarget), "target");
    return true;
  }
  return false;
}

/**
 * Hand the clock to the next seat still in. A jailed seat's turn is spent
 * sitting it out — it counts toward the round. Wrapping past the first seat
 * starts a new round; wrapping past the last round ends the match.
 */
function passTurn(d: Draft) {
  const s = d.s;
  const n = s.players.length;
  let index = s.currentIndex;
  let round = s.round;
  // Unlimited rounds still stop somewhere when there's no target either —
  // otherwise a table nobody can be knocked out of never ends.
  const limit = s.roundLimit ?? (s.target === null ? SETUP.safetyRounds : null);
  // Bounded: each jailed seat is skipped at most once before it's released.
  for (let step = 0; step <= n * 2; step++) {
    index = (index + 1) % n;
    if (index === 0) round += 1;
    if (limit !== null && round > limit) {
      declareWinner(d, leaderOf(s, playersIn(s)), "rounds");
      return;
    }
    const player = s.players[index];
    if (player.status !== "in") continue;
    if (player.inJail) {
      player.inJail = false;
      emit(d, { kind: "jail-skip", memberId: player.id });
      continue;
    }
    s.currentIndex = index;
    s.round = round;
    return;
  }
}

function endTurn(d: Draft) {
  d.s.question = null;
  d.s.auction = null;
  d.s.trade = null;
  d.s.phase = "roll";
  d.s.tradesThisTurn = 0;
  d.s.buildsThisTurn = 0;
  if (checkForWinner(d)) return;
  passTurn(d);
}

/** After a landing: manage, unless the landing broke the player. */
function afterLanding(d: Draft, player: EmpirePlayer) {
  if (player.status !== "in") {
    endTurn(d);
    return;
  }
  if (d.s.phase === "roll") d.s.phase = "manage";
}

// ─── Moves ───────────────────────────────────────────────────────────────────

const WAIT: Record<string, string> = {
  setup: "Choose the match settings first",
  roll: "Roll first",
  answer: "Answer the question on the table first",
  auction: "Wait for the auction to close",
  trade: "Wait for the trade to be answered",
  manage: "Finish your turn first",
};

/** Run one move. Most belong to the player on the clock; bids and trade answers don't. */
export function applyMove(
  state: EmpireState,
  memberId: string,
  move: EmpireMove,
  ctx: MoveContext
): EmpireTransition {
  if (state.winnerId) return fail("This match is over");
  const mover = state.players.find((p) => p.id === memberId);
  if (!mover || mover.status !== "in") return fail("You're not in this match");
  const d = draftOf(state, ctx);

  // ── Match setup: every human picks at once ──────────────────────────────
  if (move.kind === "pickSetup") {
    const setup = d.s.setup;
    if (state.phase !== "setup" || !setup) return fail("The match has already started");
    if (!setup.humans.includes(memberId)) return fail("CPUs play by the table's choice");
    // A later pick replaces an earlier one, until the settings are decided.
    setup.picks = setup.picks.filter((p) => p.memberId !== memberId);
    setup.picks.push({ memberId, target: move.target, rounds: move.rounds });
    if (setupWaitingOn(d.s, ctx.humans).length === 0) settleSetup(d);
    return finish(d);
  }

  if (move.kind === "closeSetup") {
    const setup = d.s.setup;
    if (state.phase !== "setup" || !setup) return fail("The match has already started");
    if (ctx.now < setup.expiresAt && setupWaitingOn(d.s, ctx.humans).length > 0) {
      return fail("Players are still choosing");
    }
    settleSetup(d);
    return finish(d);
  }

  if (state.phase === "setup") return fail(WAIT.setup);

  // ── Anyone's moves ──────────────────────────────────────────────────────
  if (move.kind === "bid") {
    const a = d.s.auction;
    if (state.phase !== "auction" || !a || a.id !== move.id) return fail("That auction has closed");
    if (ctx.now >= a.endsAt) return fail("That auction has closed");
    if (memberId === a.sellerId) return fail("You can't bid on your own city");
    if (memberId === a.highBidderId) return fail("You're already the highest bidder");
    if (move.amount < nextBid(a)) return fail(`Bid at least ${nextBid(a)}`);
    if (move.amount > mover.cash) return fail("You don't have that many coins");
    a.highBid = move.amount;
    a.highBidderId = memberId;
    a.endsAt = Math.min(a.hardEndAt, Math.max(a.endsAt, ctx.now + AUCTION.extendMs));
    emit(d, { kind: "bid", memberId, tile: a.tile, amount: move.amount });
    proxyBids(d);
    if (!humanCanBid(d)) closeAuction(d);
    return finish(d);
  }

  if (move.kind === "closeAuction") {
    const a = d.s.auction;
    if (state.phase !== "auction" || !a) return fail("There's no auction running");
    if (ctx.now < a.endsAt) return fail("The auction is still open");
    closeAuction(d);
    return finish(d);
  }

  if (move.kind === "answerTrade") {
    const t = d.s.trade;
    if (state.phase !== "trade" || !t || t.id !== move.id) return fail("That offer is no longer open");
    if (memberId !== t.toId) return fail("That offer isn't yours to answer");
    const accepted = move.accept && tradeProblem(d.s, t.fromId, t.toId, t.give, t.get) === null;
    if (accepted) {
      executeTrade(d, t.fromId, t.toId, t.give, t.get);
      emit(d, { kind: "trade-accepted", memberId: t.fromId, toId: t.toId, give: t.give, get: t.get });
    } else {
      emit(d, { kind: "trade-declined", memberId: t.fromId, toId: t.toId });
    }
    d.s.trade = null;
    d.s.phase = "manage";
    return finish(d);
  }

  // ── The player on the clock ─────────────────────────────────────────────
  const player = current(d);
  if (player.id !== memberId) return fail("It's not your turn");

  if (move.kind === "roll") {
    if (state.phase !== "roll") return fail(WAIT[state.phase]);
    const d1 = rollDie(ctx.random);
    const d2 = rollDie(ctx.random);
    const from = player.tile;
    stepForward(d, player, d1 + d2);
    d.s.lastRoll = { memberId, d1, d2, from, to: player.tile, seq: d.seq };
    resolveTile(d, player, 0);
    afterLanding(d, player);
    return finish(d);
  }

  if (move.kind === "buy" || move.kind === "decline") {
    const q = state.question;
    if (state.phase !== "answer" || !q) return fail(WAIT[state.phase]);
    if (q.tile !== move.tile) return fail("That question has already been answered");
    const def = cityAt(move.tile)!;
    d.s.question = null;
    if (move.kind === "buy") {
      if (player.cash < def.price) return fail("You can't afford that");
      player.cash -= def.price;
      d.s.cities[def.index].ownerId = player.id;
      emit(d, { kind: "buy", memberId, tile: def.tile, amount: def.price });
      d.s.phase = "manage";
    } else {
      emit(d, { kind: "pass", memberId, tile: def.tile });
      openAuction(d, def.index, null, memberId);
    }
    return finish(d);
  }

  if (state.phase !== "manage") return fail(WAIT[state.phase]);

  switch (move.kind) {
    case "build": {
      const def = cityAt(move.tile);
      if (!def || !canBuildOn(d.s, memberId, def.index)) {
        return fail("You need the whole empire, and the next level has to be legal");
      }
      const cost = buildCost(def.price);
      if (player.cash < cost) return fail("You can't afford that");
      player.cash -= cost;
      d.s.cities[def.index].level += 1;
      d.s.buildsThisTurn += 1;
      emit(d, { kind: "build", memberId, tile: def.tile, level: d.s.cities[def.index].level, amount: cost });
      return finish(d);
    }

    case "sellBuilding": {
      const def = cityAt(move.tile);
      const slot = def ? d.s.cities[def.index] : null;
      if (!def || !slot || slot.ownerId !== memberId || slot.level === 0) {
        return fail("There's nothing built there to sell");
      }
      const proceeds = buildingSalePrice(def.price);
      slot.level -= 1;
      player.cash += proceeds;
      emit(d, { kind: "sold-building", memberId, tile: def.tile, level: slot.level, amount: proceeds, forced: false });
      return finish(d);
    }

    case "sellCity": {
      const def = cityAt(move.tile);
      if (!def || d.s.cities[def.index].ownerId !== memberId) return fail("That city isn't yours");
      if (!isBare(d.s, def.index)) return fail("Sell the buildings in that empire first");
      const proceeds = citySalePrice(def.price);
      d.s.cities[def.index].ownerId = null;
      player.cash += proceeds;
      emit(d, { kind: "sold-city", memberId, tile: def.tile, amount: proceeds, forced: false });
      return finish(d);
    }

    case "auctionCity": {
      const def = cityAt(move.tile);
      if (!def || d.s.cities[def.index].ownerId !== memberId) return fail("That city isn't yours");
      if (!isBare(d.s, def.index)) return fail("Sell the buildings in that empire first");
      openAuction(d, def.index, memberId, memberId);
      return finish(d);
    }

    case "offerTrade": {
      if (d.s.tradesThisTurn >= MARKET.tradeOffersPerTurn) {
        return fail(`You can make ${MARKET.tradeOffersPerTurn} offers a turn`);
      }
      const problem = tradeProblem(d.s, memberId, move.to, move.give, move.get);
      if (problem) return fail(problem);
      d.s.trade = {
        id: d.seq,
        fromId: memberId,
        toId: move.to,
        give: { tiles: [...move.give.tiles], coins: move.give.coins },
        get: { tiles: [...move.get.tiles], coins: move.get.coins },
        expiresAt: ctx.now + EMPIRE_WARS_CONFIG.tradeWindowMs,
      };
      d.s.phase = "trade";
      d.s.tradesThisTurn += 1;
      emit(d, { kind: "trade-offered", memberId, toId: move.to });
      return finish(d);
    }

    case "endTurn":
      endTurn(d);
      return finish(d);

    default:
      return fail(WAIT[state.phase]);
  }
}

/**
 * Leave the match (ADR-0004). The quitter's cities and buildings go back to
 * the bank; an auction or trade they were part of is called off; if it was
 * their turn, the turn passes.
 */
export function applyQuit(
  state: EmpireState,
  memberId: string,
  ctx: MoveContext
): EmpireTransition {
  if (state.winnerId) return fail("This match is over");
  const leaving = state.players.find((p) => p.id === memberId);
  if (!leaving) return fail("You're not in this match");
  if (leaving.status !== "in") return fail("You're already out of this match");

  const d = draftOf(state, ctx);
  const player = playerById(d, memberId);
  player.status = "quit";
  player.inJail = false;
  d.s.outCount += 1;
  player.outOrder = d.s.outCount;
  for (const slot of d.s.cities) {
    if (slot.ownerId === memberId) {
      slot.ownerId = null;
      slot.level = 0;
    }
  }
  emit(d, { kind: "quit", memberId });

  // Walking away while the table chooses: their pick goes, and if everyone
  // left has picked, the settings are decided now.
  if (d.s.phase === "setup" && d.s.setup) {
    d.s.setup.picks = d.s.setup.picks.filter((p) => p.memberId !== memberId);
    if (current(d).id === memberId) {
      const next = d.s.players.findIndex((p) => p.status === "in");
      if (next >= 0) d.s.currentIndex = next;
    }
    if (!checkForWinner(d) && setupWaitingOn(d.s, ctx.humans).length === 0) settleSetup(d);
    return finish(d);
  }

  const t = d.s.trade;
  if (t && (t.fromId === memberId || t.toId === memberId)) {
    emit(d, { kind: "trade-declined", memberId: t.fromId, toId: t.toId });
    d.s.trade = null;
    d.s.phase = "manage";
  }
  const a = d.s.auction;
  if (a && (a.sellerId === memberId || a.highBidderId === memberId)) {
    emit(d, { kind: "auction-unsold", memberId, tile: a.tile });
    d.s.auction = null;
    d.s.phase = "manage";
  }

  if (current(d).id === memberId) endTurn(d);
  else checkForWinner(d);
  return finish(d);
}

/** Has whoever is on the clock run out of time? Judged on the server's clock. */
export function turnHasExpired(state: EmpireState, now: number): boolean {
  if (state.winnerId) return false;
  if (state.turnExpiresAt === null) return false;
  return now >= state.turnExpiresAt;
}
