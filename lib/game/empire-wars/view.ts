import {
  AUCTION,
  MARKET,
  MAX_HOUSES,
  MONUMENT_LEVEL,
  SETUP,
  type EmpireId,
} from "@/lib/game/data/empire-wars";
import {
  buildCost,
  buildingSalePrice,
  canBuildOn,
  cityAt,
  cityByIndex,
  citySalePrice,
  citiesOwned,
  currentPlayer,
  empireHasMonument,
  heldOf,
  isBare,
  netWorth,
  ownsWholeEmpire,
  tributeAt,
  tributeOf,
  type EmpireState,
  type EndedBy,
  type MatchSettings,
  type Phase,
  type SetupPick,
  type TradeSide,
  type TurnEvent,
} from "@/lib/game/empire-wars/rules";
import { setupWaitingOn } from "@/lib/game/empire-wars/turn";

// What a seat is shown (ADR-0005 `viewFor`). In v3 everything is public —
// coins, net worth, cities, buildings, bids, trade offers — so the view is
// the state made readable: tribute pre-computed on every city so nobody ever
// does the sum (GDD > UI: "the tag is the rule"), and what the owner can do
// with each city spelled out so the board never offers an illegal button.
//
// The `you` block is the only per-seat part, which is exactly what the
// platform contract asks a projection to have.

export type SeatView = {
  memberId: string;
  cash: number;
  netWorth: number;
  tile: number;
  inJail: boolean;
  status: "in" | "bankrupt" | "quit";
  cities: number;
};

export type CityView = {
  id: string;
  name: string;
  tile: number;
  empire: EmpireId;
  empireName: string;
  monument: string;
  price: number;
  ownerId: string | null;
  /** 0 bare · 1–4 houses · 5 the monument. */
  level: number;
  /** What landing here costs right now; null while free. */
  tribute: number | null;
  /** The whole ladder: bare, whole empire, 1–4 houses, monument. */
  tributeTable: { bare: number; whole: number; houses: number[]; monument: number };
  /** Does the owner hold all three cities of this empire? */
  wholeEmpire: boolean;
  /** Does this city's empire already have its monument (on any city)? */
  empireHasMonument: boolean;
  buildCost: number;
  /** Legal for the owner right now, coins permitting (turn and phase aside). */
  canBuild: boolean;
  /** Bare empire: the city itself can be sold, traded or auctioned. */
  bare: boolean;
  buildingSalePrice: number;
  citySalePrice: number;
};

export type AuctionView = {
  id: number;
  tile: number;
  name: string;
  empireName: string;
  price: number;
  sellerId: string | null;
  highBid: number;
  highBidderId: string | null;
  /** The least the next bid may be. */
  nextBid: number;
  endsAt: number;
  raises: readonly number[];
};

/** The table choosing its settings (GDD > Match setup). Picks are public. */
export type SetupView = {
  expiresAt: number;
  /** What's on offer; null is Unlimited. */
  targets: readonly (number | null)[];
  rounds: readonly (number | null)[];
  /** What the picker starts on, and what plays if nobody picks. */
  defaults: MatchSettings;
  /** The seats that pick — humans at the deal. CPUs play by the result. */
  humans: string[];
  picks: SetupPick[];
  /** Humans still in who haven't picked yet. */
  waitingOn: string[];
};

export type TradeSideView = TradeSide & { names: string[] };

export type TradeView = {
  id: number;
  fromId: string;
  toId: string;
  give: TradeSideView;
  get: TradeSideView;
  expiresAt: number;
};

export type EmpireView = {
  round: number;
  /** The last round; null = no limit. */
  roundLimit: number | null;
  /** The net worth that wins; null = no target. */
  target: number | null;
  /** While the table is choosing its settings, before the first roll. */
  setup: SetupView | null;
  treasury: number;
  phase: Phase;
  /** Whose turn it is. */
  currentMemberId: string | null;
  /** Who must act right now — the turn's owner, or a trade's recipient. */
  onClockId: string | null;
  winnerId: string | null;
  endedBy: EndedBy | null;
  seats: SeatView[];
  cities: CityView[];
  question: {
    kind: "buy";
    tile: number;
    name: string;
    empireName: string;
    cost: number;
    /** Tribute here if bought; doubled if it completes the empire. */
    tributeAfter: number;
    completesEmpire: boolean;
  } | null;
  auction: AuctionView | null;
  trade: TradeView | null;
  tradesLeft: number;
  lastRoll: EmpireState["lastRoll"];
  events: TurnEvent[];
  /** Moves on every applied move — the CPU driver keys its effect on it. */
  version: number;
  turnExpiresAt: number | null;
  you: {
    memberId: string;
    /** It's your turn (the turn is yours, whatever phase it's in). */
    yourTurn: boolean;
    /** You're the one the table is waiting on right now. */
    onClock: boolean;
  } | null;
};

function sideView(side: TradeSide): TradeSideView {
  return { ...side, names: side.tiles.map((t) => cityAt(t)?.name ?? `tile ${t}`) };
}

export function viewFor(state: EmpireState, memberId: string | null): EmpireView {
  // While the table chooses, it's nobody's turn: every human picks at once.
  const choosing = state.phase === "setup";
  const turn = state.winnerId || choosing ? null : (currentPlayer(state)?.id ?? null);
  const onClockId = state.winnerId || choosing
    ? null
    : state.phase === "trade" && state.trade
      ? state.trade.toId
      : turn;
  const seated = memberId !== null && state.players.some((p) => p.id === memberId);
  const q = state.question;
  const qDef = q ? cityAt(q.tile) : null;
  const a = state.auction;
  const aDef = a ? cityAt(a.tile) : null;

  return {
    round: state.round,
    roundLimit: state.roundLimit,
    target: state.target,
    setup:
      choosing && state.setup
        ? {
            expiresAt: state.setup.expiresAt,
            targets: SETUP.targets,
            rounds: SETUP.rounds,
            defaults: { target: SETUP.defaults.target, rounds: SETUP.defaults.rounds },
            humans: state.setup.humans,
            picks: state.setup.picks,
            waitingOn: setupWaitingOn(state),
          }
        : null,
    treasury: state.treasury,
    phase: state.phase,
    currentMemberId: turn,
    onClockId,
    winnerId: state.winnerId,
    endedBy: state.endedBy,
    seats: state.players.map((p) => ({
      memberId: p.id,
      cash: p.cash,
      netWorth: netWorth(state, p.id),
      tile: p.tile,
      inJail: p.inJail,
      status: p.status,
      cities: citiesOwned(state, p.id),
    })),
    cities: state.cities.map((slot, index) => {
      const def = cityByIndex(index);
      const whole = slot.ownerId ? ownsWholeEmpire(state, slot.ownerId, def.empire) : false;
      const cost = buildCost(def.price);
      return {
        id: def.id,
        name: def.name,
        tile: def.tile,
        empire: def.empire,
        empireName: def.empireName,
        monument: def.monument,
        price: def.price,
        ownerId: slot.ownerId,
        level: slot.level,
        tribute: tributeOf(state, index),
        tributeTable: {
          bare: tributeAt(def.price, 0, false),
          whole: tributeAt(def.price, 0, true),
          houses: Array.from({ length: MAX_HOUSES }, (_, i) => tributeAt(def.price, i + 1, true)),
          monument: tributeAt(def.price, MONUMENT_LEVEL, true),
        },
        wholeEmpire: whole,
        empireHasMonument: empireHasMonument(state, def.empire),
        buildCost: cost,
        canBuild: slot.ownerId !== null && canBuildOn(state, slot.ownerId, index),
        bare: isBare(state, index),
        buildingSalePrice: buildingSalePrice(def.price),
        citySalePrice: citySalePrice(def.price),
      };
    }),
    question:
      q && qDef && turn
        ? {
            kind: "buy",
            tile: q.tile,
            name: qDef.name,
            empireName: qDef.empireName,
            cost: qDef.price,
            completesEmpire: heldOf(state, turn, qDef.empire) === 2,
            tributeAfter: tributeAt(qDef.price, 0, heldOf(state, turn, qDef.empire) === 2),
          }
        : null,
    auction:
      a && aDef
        ? {
            id: a.id,
            tile: a.tile,
            name: aDef.name,
            empireName: aDef.empireName,
            price: aDef.price,
            sellerId: a.sellerId,
            highBid: a.highBid,
            highBidderId: a.highBidderId,
            nextBid: a.highBid === 0 ? a.openingBid : a.highBid + AUCTION.step,
            endsAt: a.endsAt,
            raises: AUCTION.raises,
          }
        : null,
    trade: state.trade
      ? {
          id: state.trade.id,
          fromId: state.trade.fromId,
          toId: state.trade.toId,
          give: sideView(state.trade.give),
          get: sideView(state.trade.get),
          expiresAt: state.trade.expiresAt,
        }
      : null,
    tradesLeft: Math.max(0, MARKET.tradeOffersPerTurn - state.tradesThisTurn),
    lastRoll: state.lastRoll,
    events: state.events,
    version: state.version,
    turnExpiresAt: state.turnExpiresAt,
    you: seated
      ? { memberId: memberId!, yourTurn: turn === memberId, onClock: onClockId === memberId }
      : null,
  };
}
