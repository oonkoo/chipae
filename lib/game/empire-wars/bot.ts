import type { MoveContext } from "@/lib/game/module";
import { BOT, EMPIRES, type EmpireId } from "@/lib/game/data/empire-wars";
import {
  buildCost,
  canBuildOn,
  cityAt,
  cityByIndex,
  citiesOf,
  currentPlayer,
  heldOf,
  isBare,
  type EmpirePlayer,
  type EmpireState,
  type TradeOffer,
} from "@/lib/game/empire-wars/rules";
import { setupWaitingOn, type EmpireMove } from "@/lib/game/empire-wars/turn";

// The Empire Wars CPU (GDD > CPU players). Every threshold lives in `BOT`.
//
// It also plays a human whose clock ran out — but only conservatively: a
// timed-out human is never made to build, sell, trade or bid. In the manage
// step that means End turn; on a trade, Decline. `ctx.humans` (ADR-0005
// Amendment 2) is how it tells the two apart.
//
// CPUs don't bid at auctions through this function at all: they bid as
// proxies inside the rules (turn.ts), the moment a human bids.

/** The seat an empire's missing city sits with, if exactly one rival holds it. */
function missingFrom(state: EmpireState, me: string, empire: EmpireId): { tile: number; ownerId: string } | null {
  const cities = citiesOf(empire);
  if (heldOf(state, me, empire) !== 2) return null;
  const missing = cities.find((c) => state.cities[c.index].ownerId !== me);
  const ownerId = missing ? state.cities[missing.index].ownerId : null;
  if (!missing || !ownerId) return null;
  const owner = state.players.find((p) => p.id === ownerId);
  if (!owner || owner.status !== "in" || !isBare(state, missing.index)) return null;
  return { tile: missing.tile, ownerId };
}

/** Would these tiles, after the trade, hand `who` a whole empire they lacked? */
function completesFor(state: EmpireState, who: string, gains: number[], loses: number[]): number[] {
  const completing: number[] = [];
  for (const empire of EMPIRES) {
    const cities = citiesOf(empire.id);
    const before = heldOf(state, who, empire.id);
    const after = cities.filter((c) => {
      const owned = state.cities[c.index].ownerId === who;
      return (owned && !loses.includes(c.tile)) || gains.includes(c.tile);
    }).length;
    if (before < 3 && after === 3) {
      completing.push(...cities.filter((c) => gains.includes(c.tile)).map((c) => c.tile));
    }
  }
  return completing;
}

const priceOf = (tile: number) => cityAt(tile)?.price ?? 0;
const sum = (tiles: number[]) => tiles.reduce((total, t) => total + priceOf(t), 0);

/**
 * Would this CPU take this offer? Worth at least `tradeAcceptMult` of what it
 * gives — more if the trade hands the proposer a whole empire, less if it
 * completes one for the CPU too.
 */
export function cpuAcceptsTrade(state: EmpireState, offer: TradeOffer): boolean {
  const me = state.players.find((p) => p.id === offer.toId);
  if (!me || me.cash < offer.get.coins) return false;
  const valueIn = offer.give.coins + sum(offer.give.tiles);
  const valueOut = offer.get.coins + sum(offer.get.tiles);
  const mine = completesFor(state, offer.toId, offer.give.tiles, offer.get.tiles);
  if (mine.length > 0) return valueIn >= valueOut * BOT.swapAcceptMult;
  const theirs = completesFor(state, offer.fromId, offer.get.tiles, offer.give.tiles);
  const premium = theirs.length > 0 ? sum(theirs) * BOT.monopolyPremium : 0;
  return valueIn >= Math.max(valueOut * BOT.tradeAcceptMult, premium);
}

/** The one trade a CPU might make this turn: a swap if it can, else coins. */
function cpuTradeOffer(state: EmpireState, seat: EmpirePlayer): EmpireMove | null {
  const seatIndex = state.players.indexOf(seat);
  if (state.tradesThisTurn > 0) return null;
  if ((state.round + seatIndex) % BOT.tradeEveryRounds !== 0) return null;

  for (const empire of [...EMPIRES].reverse()) {
    const want = missingFrom(state, seat.id, empire.id);
    if (!want) continue;

    // A swap completes an empire for both of us.
    for (const theirs of EMPIRES) {
      if (theirs.id === empire.id) continue;
      const theirWant = missingFrom(state, want.ownerId, theirs.id);
      if (!theirWant || theirWant.ownerId !== seat.id) continue;
      const topUp = Math.max(0, priceOf(want.tile) - priceOf(theirWant.tile));
      if (seat.cash - topUp < BOT.reserve) continue;
      return {
        kind: "offerTrade",
        to: want.ownerId,
        give: { tiles: [theirWant.tile], coins: topUp },
        get: { tiles: [want.tile], coins: 0 },
      };
    }

    const coins = Math.round(priceOf(want.tile) * BOT.tradeOfferMult);
    if (seat.cash - coins >= BOT.reserve) {
      return {
        kind: "offerTrade",
        to: want.ownerId,
        give: { tiles: [], coins },
        get: { tiles: [want.tile], coins: 0 },
      };
    }
  }
  return null;
}

/** The next build, if the CPU wants one: least-built first, then the dearest. */
function cpuBuild(state: EmpireState, seat: EmpirePlayer): EmpireMove | null {
  if (state.buildsThisTurn >= BOT.maxBuildsPerTurn) return null;
  let pick = -1;
  for (let i = 0; i < state.cities.length; i++) {
    if (!canBuildOn(state, seat.id, i)) continue;
    if (seat.cash - buildCost(cityByIndex(i).price) < BOT.reserve) continue;
    if (
      pick < 0 ||
      state.cities[i].level < state.cities[pick].level ||
      (state.cities[i].level === state.cities[pick].level &&
        cityByIndex(i).price > cityByIndex(pick).price)
    ) {
      pick = i;
    }
  }
  return pick < 0 ? null : { kind: "build", tile: cityByIndex(pick).tile };
}

/** Would a CPU buy this free city? */
function cpuBuys(state: EmpireState, seat: EmpirePlayer, tile: number): boolean {
  const def = cityAt(tile);
  if (!def || seat.cash < def.price) return false;
  if (seat.cash - def.price >= BOT.reserve) return true;
  return heldOf(state, seat.id, def.empire) === 2;
}

export function chooseBotMove(
  state: EmpireState,
  memberId: string,
  ctx: MoveContext
): EmpireMove | null {
  if (state.winnerId) return null;
  const human = ctx.humans?.includes(memberId) ?? false;

  // CPUs never pick settings, and a timed-out human's pick isn't made for
  // them. All anyone does here is close the table's choosing once the humans
  // are done or the clock has run out.
  if (state.phase === "setup") {
    const setup = state.setup;
    if (!setup) return null;
    const done = ctx.now >= setup.expiresAt || setupWaitingOn(state, ctx.humans).length === 0;
    return done ? { kind: "closeSetup" } : null;
  }

  if (state.phase === "trade") {
    const offer = state.trade;
    if (!offer || offer.toId !== memberId) return null;
    return { kind: "answerTrade", id: offer.id, accept: !human && cpuAcceptsTrade(state, offer) };
  }

  const seat = currentPlayer(state);
  if (!seat || seat.id !== memberId || seat.status !== "in") return null;

  switch (state.phase) {
    case "auction":
      // CPUs bid as proxies inside the rules; this only closes it on time.
      return state.auction && ctx.now >= state.auction.endsAt ? { kind: "closeAuction" } : null;

    case "roll":
      return { kind: "roll" };

    case "answer": {
      const q = state.question;
      if (!q) return null;
      return cpuBuys(state, seat, q.tile)
        ? { kind: "buy", tile: q.tile }
        : { kind: "decline", tile: q.tile };
    }

    case "manage":
      if (human) return { kind: "endTurn" };
      return cpuBuild(state, seat) ?? cpuTradeOffer(state, seat) ?? { kind: "endTurn" };
  }
}
