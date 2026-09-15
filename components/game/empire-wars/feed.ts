import { CARDS, MONUMENT_LEVEL } from "@/lib/game/data/empire-wars";
import { cityAt, specialAt, type TurnEvent } from "@/lib/game/empire-wars/rules";

// One plain sentence per thing that happened (GDD > UI: "every automatic
// event gets one line"). Presentation only — the events themselves come from
// the rules. Sentences are past tense on purpose so they read the same with
// a name or with "You" as the subject.

export type FeedNames = {
  /** "You" for the viewer, otherwise the player's name — a sentence's subject. */
  who: (memberId: string) => string;
  /** "you" for the viewer — the same, mid-sentence ("tribute to you"). */
  whom: (memberId: string) => string;
  /** The net worth that wins; null = no target. */
  target: number | null;
};

export function coins(amount: number): string {
  return `${amount.toLocaleString("en-US")} coins`;
}

// ─── Match settings, in words ────────────────────────────────────────────────
// One place for how a setting reads, so the picker, the toss, the header and
// the feed never describe the same match two ways.

/** A target chip: "3K", "10K", "Unlimited". */
export function targetLabel(target: number | null): string {
  if (target === null) return "Unlimited";
  return target % 1000 === 0 ? `${target / 1000}K` : target.toLocaleString("en-US");
}

/** A round-limit chip: "30", "Unlimited". */
export function roundsLabel(rounds: number | null): string {
  return rounds === null ? "Unlimited" : String(rounds);
}

/** The whole match in a phrase: "first to 5,000 net worth · 50 rounds". */
export function settingsLine(target: number | null, rounds: number | null): string {
  if (target !== null) {
    return `first to ${target.toLocaleString("en-US")} net worth · ${rounds === null ? "no round limit" : `${rounds} rounds`}`;
  }
  return rounds === null ? "last empire standing" : `richest after ${rounds} rounds`;
}

export function tileName(tile: number): string {
  return cityAt(tile)?.name ?? specialAt(tile)?.name ?? `tile ${tile}`;
}

/** "a house", "a 3rd house", or the monument's own name. */
function levelName(tile: number, level: number): string {
  if (level === MONUMENT_LEVEL) return cityAt(tile)?.monument ?? "the monument";
  return level === 1 ? "a house" : `a ${["", "", "2nd", "3rd", "4th"][level]} house`;
}

function tradeLine(tiles: number[], amount: number): string {
  const parts = [...tiles.map(tileName)];
  if (amount > 0) parts.push(coins(amount));
  return parts.length ? parts.join(" + ") : "nothing";
}

export function describeEvent(event: TurnEvent, names: FeedNames): string {
  const who = names.who(event.memberId);
  switch (event.kind) {
    case "payday":
      return `${who} passed the Silk Road: +${coins(event.amount)}`;
    case "buy":
      return `${who} bought ${tileName(event.tile)} for ${coins(event.amount)}`;
    case "pass":
      return `${who} passed on ${tileName(event.tile)} — to auction`;
    case "cant-afford":
      return `${who} couldn't afford ${tileName(event.tile)} — to auction`;
    case "tribute":
      return `${who} paid ${coins(event.amount)} tribute to ${names.whom(event.ownerId)}`;
    case "treasury":
      return event.amount > 0
        ? `${who} took the Royal Treasury: ${coins(event.amount)}`
        : `${who} found the Royal Treasury empty`;
    case "card": {
      // The deck's id stays `fortune` (saved games carry it); players see Bonanza.
      const deck = event.deck === "fortune" ? "Bonanza" : "Royal Decree";
      const card = CARDS[event.deck].find((c) => c.id === event.cardId);
      return `${deck}: ${card?.name ?? "a card"}`;
    }
    case "collect":
      return `${who} collected ${coins(event.amount)}`;
    case "chip-in":
      return `${who} paid ${coins(event.amount)} to ${names.whom(event.toId)}`;
    case "pay-treasury":
      return `${who} paid ${coins(event.amount)} to the treasury`;
    case "jailed":
      return `${who} went to the Dungeon`;
    case "jail-skip":
      return `${who} sat out a turn in the Dungeon`;
    case "build":
      return event.amount > 0
        ? `${who} built ${levelName(event.tile, event.level)} on ${tileName(event.tile)}`
        : `${tileName(event.tile)} got ${levelName(event.tile, event.level)}, free`;
    case "sold-building":
      return `${who} sold a building on ${tileName(event.tile)} for ${coins(event.amount)}`;
    case "sold-city":
      return `${who} sold ${tileName(event.tile)} to the bank for ${coins(event.amount)}`;
    case "auction-open":
      return event.sellerId
        ? `${who} put ${tileName(event.tile)} up for auction`
        : `${tileName(event.tile)} is up for auction`;
    case "bid":
      return `${who} bid ${coins(event.amount)} for ${tileName(event.tile)}`;
    case "auction-won":
      return `${who} won ${tileName(event.tile)} for ${coins(event.amount)}`;
    case "auction-unsold":
      return `Nobody bought ${tileName(event.tile)}`;
    case "trade-offered":
      return `${who} made ${names.whom(event.toId)} an offer`;
    case "trade-accepted":
      return `${who} traded ${tradeLine(event.give.tiles, event.give.coins)} for ${names.whom(event.toId) === "you" ? "your" : `${names.whom(event.toId)}'s`} ${tradeLine(event.get.tiles, event.get.coins)}`;
    case "trade-declined":
      return `${names.who(event.toId)} turned down ${names.whom(event.memberId) === "you" ? "your" : `${names.whom(event.memberId)}'s`} offer`;
    case "bankrupt":
      return `${who} went bankrupt and is out`;
    case "quit":
      return `${who} walked away`;
    case "won":
      return event.endedBy === "target" && names.target !== null
        ? `${who} reached ${coins(names.target)} and won`
        : event.endedBy === "rounds"
          ? `${who} won: richest after the last round`
          : `${who} won: last one standing`;
    case "settled": {
      const line = settingsLine(event.target, event.rounds);
      if (event.settledBy === "toss") return `${who} won the toss: ${line}`;
      if (event.settledBy === "default") return `Standard match: ${line}`;
      return event.picks.length > 1 ? `Everyone agreed: ${line}` : `${who} set the match: ${line}`;
    }
  }
}

/** Where money comes from and goes to, for the animation. */
export type MoneyFlow = { from: string; to: string; amount: number };

/**
 * Anchors are `seat:<memberId>`, `tile:<n>`, `pot` (the treasury) and `bank`
 * (the middle of the table). A trade can move coins both ways, so one event
 * can mean more than one flow.
 */
export function moneyFlowsOf(event: TurnEvent): MoneyFlow[] {
  const seat = (id: string) => `seat:${id}`;
  switch (event.kind) {
    case "payday":
      return [{ from: "tile:0", to: seat(event.memberId), amount: event.amount }];
    case "buy":
      return [{ from: seat(event.memberId), to: `tile:${event.tile}`, amount: event.amount }];
    case "build":
      return event.amount > 0
        ? [{ from: seat(event.memberId), to: `tile:${event.tile}`, amount: event.amount }]
        : [];
    case "tribute":
      return event.amount > 0
        ? [{ from: seat(event.memberId), to: seat(event.ownerId), amount: event.amount }]
        : [];
    case "pay-treasury":
      return event.amount > 0 ? [{ from: seat(event.memberId), to: "pot", amount: event.amount }] : [];
    case "treasury":
      return event.amount > 0 ? [{ from: "pot", to: seat(event.memberId), amount: event.amount }] : [];
    case "collect":
      return [{ from: "bank", to: seat(event.memberId), amount: event.amount }];
    case "chip-in":
      return event.amount > 0
        ? [{ from: seat(event.memberId), to: seat(event.toId), amount: event.amount }]
        : [];
    case "sold-building":
    case "sold-city":
      return [{ from: `tile:${event.tile}`, to: seat(event.memberId), amount: event.amount }];
    case "auction-won":
      return [
        {
          from: seat(event.memberId),
          to: event.sellerId ? seat(event.sellerId) : `tile:${event.tile}`,
          amount: event.amount,
        },
      ];
    case "trade-accepted": {
      const flows: MoneyFlow[] = [];
      if (event.give.coins > 0) {
        flows.push({ from: seat(event.memberId), to: seat(event.toId), amount: event.give.coins });
      }
      if (event.get.coins > 0) {
        flows.push({ from: seat(event.toId), to: seat(event.memberId), amount: event.get.coins });
      }
      return flows;
    }
    default:
      return [];
  }
}
