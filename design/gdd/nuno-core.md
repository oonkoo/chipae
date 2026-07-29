# Nuno — Core Game

## Overview

Nuno is Chipae's first official game: a real-time multiplayer UNO-style
card game for 2–6 seats (humans, friends, public walk-ins, or CPU bots).
Players shed cards by matching the top of the discard pile on color,
number, or action; action cards disrupt turn order; the first player to
empty their hand wins the hand. The server is the sole authority — clients
only ever see their own hand plus public information.

## Player Fantasy

Game night at the table: quick reads, mean little plays ("+4, good luck"),
the panic of forgetting to yell "Nuno!", and the shared groan when the
direction flips. Casual, social, fast — a hand takes minutes, so "one more
hand" is always on the table.

## Detailed Rules

- **Seats**: 2–6. Host may fill empty seats with CPUs (one click) or add
  them individually. All seats must be ready before the host deals.
- **Deal**: 7 cards each from a shuffled 108-card deck; one number card is
  flipped to start the discard pile (action/wild flips go under the deck);
  the starting player is random; direction starts clockwise.
- **A card is playable** when it matches the active color, matches the top
  card's number (number cards), matches the top card's action type, or is
  a wild. Wilds are always playable and set the active color.
- **Turn**: play a playable card, or draw one card. A drawn playable card
  may be played immediately (only that card) or kept (pass); a drawn
  unplayable card ends the turn automatically.
- **Actions**: Skip skips the next player. Reverse flips direction (acts
  like Skip with 2 players). Draw Two: next player draws 2 and loses their
  turn. Wild: choose the active color. Wild Draw Four: choose color, next
  player draws 4 and loses their turn (playable any time, per spec — no
  challenge rule).
- **Nuno! call**: on reaching one card, a player must call "Nuno!" —
  either as part of the play or before any other player acts. Missing the
  window costs 2 penalty cards, applied automatically when the next action
  happens. Bots never forget.
- **Win**: first player to zero cards ends the hand immediately. The
  screen shows the winner and placement order (fewest cards left ranks
  higher; ties break by seat order). The lobby reopens; humans must ready
  up again for the next hand.
- **Empty deck**: the discard pile (minus its top card) reshuffles into
  the deck. If every card is in hands, a draw fizzles and the turn passes.

## Formulas

Deck composition (per color × 4 colors): 1×0 + 2×(1–9) = 19 numbers,
2 Skip, 2 Reverse, 2 Draw Two → 25 per color = 100; plus 4 Wild + 4 Wild
Draw Four = **108 cards**. Hand size **7**. Nuno penalty **2** cards. Draw
Two **2**, Wild Draw Four **4**. Bot pause **1–3 s** uniform.

## Edge Cases

- Deck exhausted mid-draw → reshuffle discard minus top; nothing anywhere
  to draw → the draw fizzles and the turn passes.
- Reverse with exactly 2 players acts as Skip (the player goes again).
- A player leaving mid-hand: their seat plays on as a bot (the game never
  stalls); if the last human leaves, the lobby folds and the session ends.
- Playing your last card while an opponent has an open Nuno window: the
  win ends the hand immediately — no penalty is applied after the win.
- Multiple clients driving the same bot turn: server lock + whose-turn
  check make duplicates no-ops.

## Dependencies

- Lobby system (seats, ready, host, bots, invites) — existing.
- Realtime layer (ADR-0001) — `game-changed` hint events; DB authoritative.
- GameSession Json state storage (ADR-0002 pattern, superseded by ADR-0003).

## Tuning Knobs

All in `lib/game/data/nuno.ts`: hand size, min/max players, penalty size,
draw counts, full deck composition, bot delay range.

## Acceptance Criteria

- [x] Deck builds exactly 108 cards with standard composition (unit test).
- [x] Deal: 7 per seat, number card up, random starter (unit test).
- [x] Playability matrix: color / number / action / wild / post-wild
      active color (unit tests).
- [x] Skip, Reverse (incl. 2-player), Draw Two, Wild, Wild Draw Four
      effects (unit tests).
- [x] Draw-then-play-or-pass; unplayable draw ends turn (unit tests).
- [x] Nuno declare / window / missed-call penalty (unit tests).
- [x] Win detection + placements (unit test).
- [x] Bot preference order number → action → wild; draws when stuck
      (unit tests).
- [x] Clients never receive other hands or the deck (view projection test).
- [x] Live hand playable end-to-end vs CPUs in the lobby room.
