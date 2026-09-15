# Empire Wars — Bot

> **Status**: Implemented (v1)
> **Last Updated**: 2026-08-04
> **Parent**: `design/gdd/empire-wars-core.md`
> **Implementation**: `lib/game/empire-wars/bot.ts`, weights in
> `lib/game/data/empire-wars.ts` (`BOT`)

## Overview

The Empire Wars CPU. It exists because a 30–45 minute match **will** have empty
seats: ADR-0004 plays a departed human's seat as a bot with their empire
intact, and hosts fill open seats with CPUs before dealing. The bot is
therefore v1 scope, not a nice-to-have — a table with an unanswerable decision
deadlocks for everyone.

It is a **utility heuristic**, not a search. Every threshold lives in `BOT`, so
tuning never touches logic.

## Player Fantasy

A competent, unremarkable rival. It should buy sensibly, defend itself, take a
fight it can win, and occasionally cost you a tile — but never feel like it is
reading your hand or playing a different game to you. The bot's job is to keep
the table moving and lose gracefully, not to be a boss fight.

Pacing matches Nuno's: a **1–3 second** pause before acting, so a CPU turn
reads as somebody thinking rather than a machine resolving.

## The contract

**A bot must be able to answer every pending decision.** This is the hard
requirement, and it is what makes the design tractable: with auctions cut in
review there are only **two** decision kinds, both with exactly one named
answerer.

| Decision | Bot answer |
|---|---|
| `protection` | Refuse when pool crew exceeds the tile's defence by `BOT_FIGHT_MARGIN`; otherwise pay |
| `truce` | Accept from a **stronger** player (Empire Value > bot's by `BOT_STRONGER_MARGIN`); otherwise decline |

Everything else is a choice the bot makes on its own turn and can always skip.

## Decision order

Urgency, not preference. The first applicable rule wins.

1. **Answer anything pending** — always first, whoever's turn it is.
2. **Jail** — pay bail if cash ≥ `BOT_BAIL_CASH_MULTIPLE` × bail; else serve.
3. **Roll**, if the turn has not started.
4. **Settle the tile** you landed on (buy or decline) — once, guarded by
   `state.tileDone`.
5. **Spend the action die** (Gun / Handshake / Car), or skip it.
6. **Build** — launder, bribe, buy Respect for Kingpin, turf war, upgrade,
   recruit.
7. **End turn.**

## Heuristics

| Decision | Rule |
|---|---|
| Buy a tile | Buy if it completes a district, or assessed value ≥ `BOT_BUY_THRESHOLD`, and cash after purchase ≥ `BOT_CASH_FLOOR` |
| Decline | Anything it will not buy — which marks the tile down for whoever lands next |
| Take Dirty income | While Heat ≤ `BOT_DIRTY_HEAT_CAP` |
| Launder | Everything, once Heat ≥ `BOT_LAUNDER_HEAT` |
| Bribe | At Heat ≥ `BOT_BRIBE_HEAT` with cash to spare, standing at City Hall |
| Buy Respect | Only to close out Kingpin's Respect requirement |
| Upgrade | Cheapest next level first; recruit when a garrison is what is missing |
| Recruit | Keep pool crew ≥ `BOT_POOL_CREW_FLOOR` |
| Enforcer | Only above Respect `BOT_ENFORCER_MIN_RESPECT` with spare cash |
| **Gun** | Strike the *strongest* seat it beats on crew by the margin; never a truce partner |
| **Handshake** | Offer a truce to the strongest player without one |
| **Car** | Use it only to land on a tile it would actually buy |
| **Turf war** | Only when it beats the defence by the margin **and** the tile completes a district or is a landmark |
| **Break a truce** | **Never in v1** |

### Two definitions the heuristics depend on

- **Assessed value** = `price + (completes a district ? BOT_DISTRICT_BONUS_WEIGHT : 0) + level × 50`
- **Stronger player** = Empire Value exceeds the bot's by more than
  `BOT_STRONGER_MARGIN` (15%)

## Why the bot never betrays

A bot that broke truces on a threshold would read as arbitrary — the human on
the other side has no way to see the number that flipped, so it feels like the
game cheated rather than like a rival chose. Betrayal is a social move and the
drama belongs to humans. A bot that keeps its word is also a *stable* thing to
play against, which matters when it is standing in for someone who left.

Revisit only if playtests show human players never risk a truce because the
CPUs make them worthless.

## Formulas

The bot performs no arithmetic the rules do not already own. It reads
`empireValue`, `attackStrength`, `tileDefence`, `currentPrice` and
`nextLevelCost` from the rules layer and compares them against `BOT` weights.
There is deliberately no separate bot maths to drift out of sync.

## Edge cases

- **No legal move** → `endTurn`. A bot never stalls the table.
- **Not the bot's turn and nothing pending** → returns `null`; the caller does
  nothing.
- **A pending decision belonging to someone else** → returns `null`, so a bot
  never answers on another seat's behalf.
- **Gun with nobody in range** → skips the die rather than erroring.
- **Cannot afford anything in Build** → ends the turn.
- **Game already won** → returns `null`.

## Tuning knobs

All in `lib/game/data/empire-wars.ts` under `BOT`:
`buyThreshold` · `cashFloor` · `fightMargin` · `launderHeat` · `dirtyHeatCap` ·
`bribeHeat` · `strongerMargin` · `districtBonusWeight` · `poolCrewFloor` ·
`enforcerMinRespect` · `bailCashMultiple`, plus `botDelayMsMin/Max` in
`EMPIRE_WARS_CONFIG`.

**Most likely to need moving after a playtest**: `cashFloor` (a bot that hoards
never builds; one that spends to zero goes broke on the first fee) and
`fightMargin` (it decides how often the table sees a fight at all).

## Acceptance criteria

- [x] **GIVEN** any state where a decision is pending for a bot seat, **WHEN**
      the bot is asked for a move, **THEN** it returns a legal answer.
      *(covered by the platform contract test, all registered modules)*
- [x] **GIVEN** a full table of bots, **WHEN** a match is simulated from a
      fixed seed, **THEN** it reaches a winner inside `ROUND_LIMIT` with no
      rejected moves. *(`tests/game-module.test.ts`,
      `tests/empire-wars-turn.test.ts`)*
- [x] **GIVEN** the same seed twice, **WHEN** two matches are played out,
      **THEN** the final states are identical. *(replay determinism test)*
- [x] **GIVEN** a bot is offered a truce by a weaker player, **WHEN** it
      answers, **THEN** it declines. *(verified live: "Truce declined")*
- [ ] **GIVEN** a human plays a full match against bots, **WHEN** it ends,
      **THEN** the bots read as competent rather than random. *(playtest —
      subjective, ADVISORY)*

## Open questions

- Should the bot ever *decline* a tile it can afford in order to bank cash for
  a landmark? Currently it buys anything over threshold it can afford.
- `BOT_DIRTY_HEAT_CAP` of 3 means bots stop taking Dirty Money the moment they
  are Watched. That is safe but probably too timid — a human would keep earning
  and launder at the Safehouse. Worth measuring.
- Bots never use the Airport. It is the only tile whose action they ignore.
