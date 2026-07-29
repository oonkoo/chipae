import { z } from "zod";
import { NUNO_CONFIG } from "@/lib/game/data/nuno";

// Pure Nuno rules — no database, no framework, unit-testable. The server
// actions own persistence and authorization; everything about the game
// itself lives here. RNG is always injected so tests stay deterministic.
//
// State is keyed by LobbyMember id (covers humans and CPU seats). Hands and
// the deck are secret — this full state must never reach a client; the room
// page derives a per-viewer view (`viewFor`).

// ─── Cards ───────────────────────────────────────────────────────────────────

export const NUNO_COLORS = ["red", "blue", "green", "yellow"] as const;
export type NunoColor = (typeof NUNO_COLORS)[number];

const cardSchema = z.object({
  id: z.string(),
  color: z.enum([...NUNO_COLORS, "wild"]),
  type: z.enum(["number", "skip", "reverse", "draw2", "wild", "wild4"]),
  value: z.number().int().min(0).max(9).optional(),
});
export type NunoCard = z.infer<typeof cardSchema>;

const playerSchema = z.object({
  id: z.string(), // LobbyMember id
  hand: z.array(cardSchema),
  hasUno: z.boolean(),
  /** Quit the game — out of rotation, cards folded back under the deck. */
  eliminated: z.boolean().default(false),
});
export type NunoPlayer = z.infer<typeof playerSchema>;

const stateSchema = z.object({
  gameType: z.literal("nuno"),
  players: z.array(playerSchema), // seat order
  deck: z.array(cardSchema),
  discard: z.array(cardSchema), // last element is the top card
  activeColor: z.enum(NUNO_COLORS),
  currentIndex: z.number().int().min(0),
  direction: z.union([z.literal(1), z.literal(-1)]),
  /** Set while the current player has drawn and may play only that card. */
  drawnCardId: z.string().nullable(),
  /** Player sitting on one card who has not called "Nuno!" yet. */
  pendingUnoMemberId: z.string().nullable(),
  winnerId: z.string().nullable(),
  placements: z
    .array(
      z.object({
        memberId: z.string(),
        cardsLeft: z.number().int(),
        eliminated: z.boolean().optional(),
      })
    )
    .nullable(),
  turnCount: z.number().int(),
});
export type NunoState = z.infer<typeof stateSchema>;

/** Validate state read back from GameSession.state; malformed fails closed. */
export function parseState(raw: unknown): NunoState | null {
  const parsed = stateSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export type PlayResult =
  | { ok: true; state: NunoState }
  | { ok: false; error: string };

// ─── Deck ────────────────────────────────────────────────────────────────────

/** The full 108-card deck in a deterministic order (shuffle separately). */
export function buildDeck(): NunoCard[] {
  const d = NUNO_CONFIG.deck;
  const cards: NunoCard[] = [];
  for (const color of NUNO_COLORS) {
    for (let copy = 0; copy < d.zerosPerColor; copy++) {
      cards.push({ id: `${color}-0-${copy}`, color, type: "number", value: 0 });
    }
    for (let value = 1; value <= 9; value++) {
      for (let copy = 0; copy < d.copiesPerNumber; copy++) {
        cards.push({
          id: `${color}-${value}-${copy}`,
          color,
          type: "number",
          value,
        });
      }
    }
    for (let copy = 0; copy < d.skipsPerColor; copy++) {
      cards.push({ id: `${color}-skip-${copy}`, color, type: "skip" });
    }
    for (let copy = 0; copy < d.reversesPerColor; copy++) {
      cards.push({ id: `${color}-reverse-${copy}`, color, type: "reverse" });
    }
    for (let copy = 0; copy < d.draw2sPerColor; copy++) {
      cards.push({ id: `${color}-draw2-${copy}`, color, type: "draw2" });
    }
  }
  for (let copy = 0; copy < d.wilds; copy++) {
    cards.push({ id: `wild-${copy}`, color: "wild", type: "wild" });
  }
  for (let copy = 0; copy < d.wild4s; copy++) {
    cards.push({ id: `wild4-${copy}`, color: "wild", type: "wild4" });
  }
  return cards;
}

/** Fisher–Yates, immutably, with injected rng. */
export function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ─── Setup ───────────────────────────────────────────────────────────────────

/**
 * Shuffle, deal `handSize` to each seat, flip a starting number card
 * (action/wild flips go under the deck — keeps the opening simple), pick a
 * random starting player.
 */
export function dealGame(
  memberIds: string[],
  random: () => number = Math.random
): NunoState {
  let deck = shuffle(buildDeck(), random);

  const players: NunoPlayer[] = memberIds.map((id) => ({
    id,
    hand: [],
    hasUno: false,
    eliminated: false,
  }));
  for (let i = 0; i < NUNO_CONFIG.handSize; i++) {
    for (const player of players) {
      player.hand.push(deck.pop()!);
    }
  }

  // Flip until a number card starts the discard pile.
  const returned: NunoCard[] = [];
  let top = deck.pop()!;
  while (top.type !== "number") {
    returned.push(top);
    top = deck.pop()!;
  }
  deck = [...returned, ...deck]; // non-number flips go to the bottom

  return {
    gameType: "nuno",
    players,
    deck,
    discard: [top],
    activeColor: top.color as NunoColor,
    currentIndex: Math.floor(random() * players.length),
    direction: 1,
    drawnCardId: null,
    pendingUnoMemberId: null,
    winnerId: null,
    placements: null,
    turnCount: 0,
  };
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export function topCard(state: NunoState): NunoCard {
  return state.discard[state.discard.length - 1];
}

export function currentPlayer(state: NunoState): NunoPlayer {
  return state.players[state.currentIndex];
}

/** Spec matching rule: same color, same number, same action, or any wild. */
export function isPlayable(
  card: NunoCard,
  top: NunoCard,
  activeColor: NunoColor
): boolean {
  if (card.color === "wild") return true;
  if (card.color === activeColor) return true;
  if (card.type === "number" && top.type === "number") {
    return card.value === top.value;
  }
  return card.type !== "number" && card.type === top.type;
}

/** Ids the given player could legally play right now. */
export function playableCardIds(state: NunoState, memberId: string): string[] {
  const player = state.players.find((p) => p.id === memberId);
  if (!player || state.winnerId) return [];
  if (currentPlayer(state).id !== memberId) return [];
  const candidates = state.drawnCardId
    ? player.hand.filter((c) => c.id === state.drawnCardId)
    : player.hand;
  return candidates
    .filter((c) => isPlayable(c, topCard(state), state.activeColor))
    .map((c) => c.id);
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function clone(state: NunoState): NunoState {
  return structuredClone(state);
}

/** Move `count` cards to a player, reshuffling the discard when needed. */
function drawInto(
  state: NunoState,
  playerIndex: number,
  count: number,
  random: () => number
): NunoCard[] {
  const drawn: NunoCard[] = [];
  for (let i = 0; i < count; i++) {
    if (state.deck.length === 0 && state.discard.length > 1) {
      const top = state.discard.pop()!;
      state.deck = shuffle(state.discard, random);
      state.discard = [top];
    }
    const card = state.deck.pop();
    if (!card) break; // every card is in hands — draw fizzles
    state.players[playerIndex].hand.push(card);
    drawn.push(card);
  }
  const player = state.players[playerIndex];
  if (player.hand.length !== 1) player.hasUno = false;
  if (state.pendingUnoMemberId === player.id && player.hand.length !== 1) {
    state.pendingUnoMemberId = null;
  }
  return drawn;
}

/** The index `steps` active (non-eliminated) seats onward. */
function indexAfter(state: NunoState, from: number, steps: number): number {
  const n = state.players.length;
  let index = from;
  for (let step = 0; step < steps; step++) {
    do {
      index = (((index + state.direction) % n) + n) % n;
    } while (state.players[index].eliminated && index !== from);
  }
  return index;
}

/** End the acting player's turn, moving `steps` active seats onward. */
function advance(state: NunoState, steps: number) {
  state.currentIndex = indexAfter(state, state.currentIndex, steps);
  state.drawnCardId = null;
  state.turnCount += 1;
}

/**
 * A player sitting on one uncalled card is penalized the moment any OTHER
 * player acts — that closes the "before the next player's turn" window.
 */
function settleMissedUno(
  state: NunoState,
  actingMemberId: string,
  random: () => number
) {
  const pendingId = state.pendingUnoMemberId;
  if (!pendingId || pendingId === actingMemberId) return;
  const index = state.players.findIndex((p) => p.id === pendingId);
  if (index >= 0) {
    drawInto(state, index, NUNO_CONFIG.unoPenaltyCards, random);
  }
  state.pendingUnoMemberId = null;
}

function finish(state: NunoState, winnerId: string) {
  state.winnerId = winnerId;
  const others = state.players
    .map((p, seatIndex) => ({ p, seatIndex }))
    .filter(({ p }) => p.id !== winnerId && !p.eliminated)
    .sort(
      (a, b) =>
        a.p.hand.length - b.p.hand.length || a.seatIndex - b.seatIndex
    );
  const eliminated = state.players.filter(
    (p) => p.eliminated && p.id !== winnerId
  );
  state.placements = [
    { memberId: winnerId, cardsLeft: 0 },
    ...others.map(({ p }) => ({ memberId: p.id, cardsLeft: p.hand.length })),
    ...eliminated.map((p) => ({
      memberId: p.id,
      cardsLeft: 0,
      eliminated: true,
    })),
  ];
}

// ─── Moves ───────────────────────────────────────────────────────────────────

/**
 * Play a card from the current player's hand. Wilds require `chosenColor`.
 * After a draw, only the drawn card may be played. `declareUno` lets the
 * player call "Nuno!" in the same move that takes them to one card.
 */
export function applyPlay(
  state: NunoState,
  memberId: string,
  cardId: string,
  opts: { chosenColor?: NunoColor; declareUno?: boolean } = {},
  random: () => number = Math.random
): PlayResult {
  if (state.winnerId) return { ok: false, error: "The round is over" };
  if (currentPlayer(state).id !== memberId) {
    return { ok: false, error: "Not your turn" };
  }
  if (state.drawnCardId && cardId !== state.drawnCardId) {
    return { ok: false, error: "After drawing you may only play that card" };
  }

  const next = clone(state);
  const player = currentPlayer(next);
  const cardIndex = player.hand.findIndex((c) => c.id === cardId);
  if (cardIndex < 0) return { ok: false, error: "That card isn't in your hand" };
  const card = player.hand[cardIndex];

  if (!isPlayable(card, topCard(next), next.activeColor)) {
    return { ok: false, error: "That card doesn't match the pile" };
  }
  const isWild = card.color === "wild";
  if (isWild && !opts.chosenColor) {
    return { ok: false, error: "Pick a color for the wild" };
  }

  settleMissedUno(next, memberId, random);

  player.hand.splice(cardIndex, 1);
  next.discard.push(card);
  next.activeColor = isWild ? opts.chosenColor! : (card.color as NunoColor);

  // A card played as your last one still resolves: per the rulebook a
  // finishing +2/+4 makes the next player draw (it also keeps placement
  // counts honest). Win detection happens after the effect below.
  const won = player.hand.length === 0;

  if (!won) {
    if (player.hand.length === 1) {
      player.hasUno = opts.declareUno === true;
      next.pendingUnoMemberId = player.hasUno ? null : player.id;
    } else {
      player.hasUno = false;
      if (next.pendingUnoMemberId === player.id) next.pendingUnoMemberId = null;
    }
  } else {
    player.hasUno = false;
    if (next.pendingUnoMemberId === player.id) next.pendingUnoMemberId = null;
  }

  switch (card.type) {
    case "skip":
      advance(next, 2);
      break;
    case "reverse":
      next.direction = next.direction === 1 ? -1 : 1;
      // Two-handed: reverse acts like skip — the player goes again.
      advance(next, next.players.length === 2 ? 2 : 1);
      break;
    case "draw2": {
      const target = indexAfter(next, next.currentIndex, 1);
      drawInto(next, target, NUNO_CONFIG.draw2Count, random);
      advance(next, 2);
      break;
    }
    case "wild4": {
      const target = indexAfter(next, next.currentIndex, 1);
      drawInto(next, target, NUNO_CONFIG.wild4DrawCount, random);
      advance(next, 2);
      break;
    }
    default:
      advance(next, 1);
  }

  if (won) finish(next, memberId);
  return { ok: true, state: next };
}

/**
 * Draw one card. If it's playable the player keeps the turn and may play
 * exactly that card (or pass); otherwise the turn ends immediately.
 */
export function applyDraw(
  state: NunoState,
  memberId: string,
  random: () => number = Math.random
): PlayResult {
  if (state.winnerId) return { ok: false, error: "The round is over" };
  if (currentPlayer(state).id !== memberId) {
    return { ok: false, error: "Not your turn" };
  }
  if (state.drawnCardId) return { ok: false, error: "You already drew" };

  const next = clone(state);
  settleMissedUno(next, memberId, random);

  const [card] = drawInto(next, next.currentIndex, 1, random);
  if (!card) {
    advance(next, 1); // nothing left to draw anywhere — turn passes
    return { ok: true, state: next };
  }
  if (isPlayable(card, topCard(next), next.activeColor)) {
    next.drawnCardId = card.id;
  } else {
    advance(next, 1);
  }
  return { ok: true, state: next };
}

/** Keep the drawn playable card and end the turn instead of playing it. */
export function applyPass(state: NunoState, memberId: string): PlayResult {
  if (state.winnerId) return { ok: false, error: "The round is over" };
  if (currentPlayer(state).id !== memberId) {
    return { ok: false, error: "Not your turn" };
  }
  if (!state.drawnCardId) {
    return { ok: false, error: "Draw before passing" };
  }
  const next = clone(state);
  advance(next, 1);
  return { ok: true, state: next };
}

/**
 * Quit the game: the seat is eliminated from rotation, its cards fold back
 * under the deck, and if only one player is left standing they win by
 * default. The caller (server) decides whether a game with no humans left
 * should be abandoned entirely.
 */
export function applyQuit(state: NunoState, memberId: string): PlayResult {
  if (state.winnerId) return { ok: false, error: "The round is over" };
  const index = state.players.findIndex((p) => p.id === memberId);
  if (index < 0) return { ok: false, error: "You're not in this round" };
  if (state.players[index].eliminated) {
    return { ok: false, error: "You're already out" };
  }

  const next = clone(state);
  const player = next.players[index];
  next.deck = [...player.hand, ...next.deck]; // fold under the deck
  player.hand = [];
  player.hasUno = false;
  player.eliminated = true;
  if (next.pendingUnoMemberId === memberId) next.pendingUnoMemberId = null;

  const standing = next.players.filter((p) => !p.eliminated);
  if (standing.length === 1) {
    // currentIndex must point at an active seat before finishing.
    next.currentIndex = next.players.findIndex((p) => p.id === standing[0].id);
    next.drawnCardId = null;
    finish(next, standing[0].id);
    return { ok: true, state: next };
  }

  if (next.currentIndex === index) {
    advance(next, 1);
  }
  return { ok: true, state: next };
}

/** Call "Nuno!" while sitting on exactly one card. */
export function applyUnoCall(state: NunoState, memberId: string): PlayResult {
  if (state.winnerId) return { ok: false, error: "The round is over" };
  const next = clone(state);
  const player = next.players.find((p) => p.id === memberId);
  if (!player) return { ok: false, error: "You're not in this round" };
  if (player.hand.length !== 1) {
    return { ok: false, error: "Nuno! is for your last card" };
  }
  player.hasUno = true;
  if (next.pendingUnoMemberId === memberId) next.pendingUnoMemberId = null;
  return { ok: true, state: next };
}

// ─── Bot ─────────────────────────────────────────────────────────────────────

export type BotMove =
  | { kind: "play"; cardId: string; chosenColor?: NunoColor }
  | { kind: "draw" }
  | { kind: "pass" };

/** Most common color in hand — the casual wild-color pick. */
function favoriteColor(hand: NunoCard[], random: () => number): NunoColor {
  const counts = new Map<NunoColor, number>();
  for (const card of hand) {
    if (card.color !== "wild") {
      counts.set(card.color, (counts.get(card.color) ?? 0) + 1);
    }
  }
  let best: NunoColor | null = null;
  for (const color of NUNO_COLORS) {
    if ((counts.get(color) ?? 0) > (best ? counts.get(best)! : 0)) {
      best = color;
    }
  }
  return best ?? NUNO_COLORS[Math.floor(random() * NUNO_COLORS.length)];
}

/**
 * Casual-player bot per spec: prefer number cards, then colored actions,
 * then wilds; draw when stuck. After drawing a playable card, play it.
 */
export function chooseBotMove(
  state: NunoState,
  random: () => number = Math.random
): BotMove {
  const player = currentPlayer(state);
  const playableIds = playableCardIds(state, player.id);
  if (playableIds.length === 0) {
    return state.drawnCardId ? { kind: "pass" } : { kind: "draw" };
  }

  const playable = player.hand.filter((c) => playableIds.includes(c.id));
  const tiers: NunoCard[][] = [
    playable.filter((c) => c.type === "number"),
    playable.filter((c) => c.color !== "wild" && c.type !== "number"),
    playable.filter((c) => c.color === "wild"),
  ];
  const tier = tiers.find((t) => t.length > 0)!;
  const card = tier[Math.floor(random() * tier.length)];
  return {
    kind: "play",
    cardId: card.id,
    chosenColor:
      card.color === "wild" ? favoriteColor(player.hand, random) : undefined,
  };
}

// ─── Per-viewer projection ───────────────────────────────────────────────────

export type NunoView = {
  yourMemberId: string | null;
  yourHand: NunoCard[];
  yourPlayableCardIds: string[];
  /** True when the viewer drew this turn and may only play the drawn card. */
  youDrew: boolean;
  players: Array<{
    memberId: string;
    cardCount: number;
    hasUno: boolean;
    eliminated: boolean;
  }>;
  topCard: NunoCard;
  activeColor: NunoColor;
  currentMemberId: string;
  direction: 1 | -1;
  deckCount: number;
  pendingUnoMemberId: string | null;
  winnerId: string | null;
  placements: Array<{
    memberId: string;
    cardsLeft: number;
    eliminated?: boolean;
  }> | null;
  turnCount: number;
};

/** What one seat is allowed to know — hands and deck stay server-side. */
export function viewFor(state: NunoState, memberId: string | null): NunoView {
  const you = state.players.find((p) => p.id === memberId) ?? null;
  return {
    yourMemberId: you?.id ?? null,
    yourHand: you ? you.hand : [],
    yourPlayableCardIds: you ? playableCardIds(state, you.id) : [],
    youDrew:
      you !== null &&
      state.drawnCardId !== null &&
      currentPlayer(state).id === you.id,
    players: state.players.map((p) => ({
      memberId: p.id,
      cardCount: p.hand.length,
      hasUno: p.hasUno,
      eliminated: p.eliminated,
    })),
    topCard: topCard(state),
    activeColor: state.activeColor,
    currentMemberId: currentPlayer(state).id,
    direction: state.direction,
    deckCount: state.deck.length,
    pendingUnoMemberId: state.pendingUnoMemberId,
    winnerId: state.winnerId,
    placements: state.placements,
    turnCount: state.turnCount,
  };
}
