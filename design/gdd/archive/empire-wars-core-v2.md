# Empire Wars — Core Game

> **Status**: In Design — **v2, a ground-up simplification** (2026-09-10)
> **Last Updated**: 2026-09-10
> **Supersedes**: v1 (2026-08-04) — archived at
> `design/gdd/archive/empire-wars-core-v1.md`, with its bot spec at
> `design/gdd/archive/empire-wars-bot-v1.md`
> **Governing ADRs**: ADR-0004 (lobby as group, games as catalog),
> ADR-0005 (game module interface, incl. Amendment 1 `ctx`)
>
> ⚠️ **The code in `lib/game/empire-wars/` still implements v1.** It is a
> rebuild, not an edit — see Dependencies → *Rebuild*.

## Why v2 exists

v1 shipped, played end to end, and nobody at the table understood it. It ran
~22 interlocking systems: three currencies, a four-band Heat meter, crew split
between pool and garrisons, dice-pool combat, turf wars, strikes, truces, six
bosses, secret missions, bribery, laundering, a six-face action die and a
two-way victory condition. A teaching layer (the coach, 2026-08-10) explained
every screen and did not fix it. The problem was never the explanation. There
was simply too much game. v1's own open question, *"can a first-time player be
taught this in three minutes?"*, came back no.

v2 keeps the name, the 1930s city, the board and the art, and swaps the rules
for a Monopoly-lite everyone has already played: **roll, move, buy, collect
rent, race to a number.**

| | v1 | v2 |
|---|---|---|
| Money | Cash, Dirty Money, Respect, plus a Heat meter | **Cash.** Net worth = cash + what your territories are worth |
| Dice | 2d6 plus a six-face action die | 2d6. Doubles mean nothing |
| Landing on a rival | Pay-or-fight standoff, crew, combat dice | **Rent is automatic** |
| Other players' turns | Truce offers, 20-second answer windows | **Nothing is ever decided on someone else's turn** |
| Extras | 6 bosses, 10 secret missions, 8 events, bribery, laundering | 10 *Street Luck* cards, all automatic |
| Property | 5 levels, garrisons, 8 district powers | ★ to ★★★, and rent grows with how much of a district you hold |
| Winning | Kingpin, or Empire Value after round 20 | **First to the net-worth target**, or richest after round 30 |
| Going broke | Broken, not bankrupt | **Bankrupt = out** |
| Hidden info | Cash, Dirty Money, missions | **Everything is public** |
| Questions per turn | Several: buy, pay-or-fight, the action die, then a whole build phase | **At most 1** |

Decided with the user on 2026-09-10: keep the crime-city theme; **no
takeovers** (a tile you buy is yours for the match); **bankrupt means out**.

## Overview

Empire Wars is Chipae's second game: a 1930s city-boss property game for 2–6
seats (friends, walk-ins or CPU bots) that plays in about ten minutes. Players
roll two dice around a 32-tile city, buy the territories they land on, and are
paid rent automatically whenever a rival lands on one of theirs. Landing on
your own territory lets you upgrade it, and owning more of a district makes
every tile you hold there charge more. The first player whose **net worth**
(cash plus the value of their territories) reaches the target at the top of
the screen wins. If nobody gets there in 30 rounds, the richest player wins.
Run out of money and you're out. Every turn is one roll and at most one yes/no
question, and nothing ever waits on another player's answer.

## The whole game in 60 seconds

This is the in-game **How to play** card, word for word. It is also the test
for every future rule: if a first-time player can't play without a rule, that
rule belongs on this card. If it doesn't fit on the card, it doesn't go in the
game.

> 1. **Roll and move.** Passing The Docks pays you $200.
> 2. **Land on an empty territory?** Buy it — or pass.
> 3. **Land on a rival's?** You pay them rent, automatically.
> 4. **Land on your own?** Upgrade it for bigger rent.
> 5. **Own more of a district, earn more.** Rent doubles with two tiles there,
>    triples with all three.
> 6. **First to $3,600 net worth wins** — that's your cash plus what your
>    territories are worth. Run out of money and you're out.

(The number in line 6 is the table's target — see Formulas.) Jail, the pot and
*Street Luck* aren't on the card. Each one explains itself in a single line
when it happens.

## Player Fantasy

You're a city boss in a hat, buying up the town one storefront at a time.

The pleasure is watching money come to you. A rival's roadster rolls onto your
Gin Joint, the rent flies across the board to your corner, and your number
ticks up. The sting is the reverse: you see the Casino Strip coming, you count
the tiles, and you land on the one with three stars.

The tension is the race. Everyone's cash and net worth is on screen and the
target sits at the top, so the whole table can see who's $300 from winning.
Every one of their rolls becomes a small event for everybody.

Someone who has never seen the game should pick it up in one round, and the
rules should never become the topic of conversation. The talk should be about
luck and grudges: *"no, no, not the Onyx Room."*

**Reference points**: Monopoly's buy-and-collect loop without its length,
trading or auctions, and the net-worth race of mobile property board games (the
reference screen this redesign was modelled on). Voice follows
`design/art-direction.md`: "game-night host, not esports announcer", glossy and
gold-lit, never grim.

## Detailed Rules

### Setup

- 2–6 seats. Turn order is seat order.
- Everyone starts with **$1,500**, on The Docks (tile 0), owning nothing.
- The **target net worth** is set at the deal from the seat count (Formulas)
  and shown on screen for the whole match.
- A **round** is one turn for every seat still in the match. A match lasts at
  most **30 rounds**.

### The board — 32 tiles

Same ring and names as v1. Corners at 0/8/16/24, with **24 territories** in
**8 districts** of 3 and **8 special tiles**.

| Tile | | Tile | |
|---|---|---|---|
| 0 | **The Docks** — start *(corner)* | 16 | **The Safehouse** *(corner)* |
| 1–3 | Old Town | 17–19 | Downtown |
| 4 | Police Checkpoint | 20 | Street Luck |
| 5–7 | Little Havana | 21–23 | Nightclub District |
| 8 | **County Jail** *(corner)* | 24 | **Busted!** *(corner)* |
| 9–11 | The Harbor | 25–27 | Casino Strip |
| 12 | Street Luck | 28 | Police Checkpoint |
| 13–15 | Industrial | 29–31 | Financial District |

Districts get pricier clockwise from The Docks, in even $40 steps. All three
territories in a district share **one price**, so the band colour and a single
number tell you what anything costs without reading the tile.

| District | Territories, in board order | Price |
|---|---|---|
| Old Town | Pawn Shop · Barber Shop · Tattoo Parlour | $100 |
| Little Havana | Cigar Lounge · Car Wash · Liquor Store | $140 |
| The Harbor | Fish Market · Boat Yard · Shipping Port | $180 |
| Industrial | Garage · Factory · Chop Shop | $220 |
| Downtown | Coffee House · Drug Lab · Money Laundry | $260 |
| Nightclub District | Jazz Cellar · Gin Joint · The Onyx Room | $300 |
| Casino Strip | Poker Room · Racetrack · The Golden Chip | $340 |
| Financial District | Accounting Office · Bail Bonds · First City Bank | $380 |

Territory ids are unchanged from v1 (`pawn-shop` … `first-city-bank`), so the
existing tile art still lands on the right squares.

### Special tiles

| Tile | What happens |
|---|---|
| **The Docks** (0) | Collect **$200** every time you pass or land on it |
| **Police Checkpoint** (4, 28) | Pay a **$100** fine into **the pot** |
| **Street Luck** (12, 20) | Draw a *Street Luck* card. It happens immediately |
| **County Jail** (8) | Just visiting — unless you were sent here |
| **The Safehouse** (16) | Take **everything in the pot** |
| **Busted!** (24) | Go straight to County Jail. You don't pass The Docks |

**The pot** sits in the middle of the board. It starts empty. Every fine, and
every card payment "into the pot", goes in, and the next player to land on The
Safehouse takes all of it. Money in the pot belongs to nobody and counts toward
nobody's net worth.

**Jail**: a player sent to County Jail (by *Busted!* or a card) **misses their
next turn**, then plays on from the Jail tile. That's all jail is: no bail, no
rolling to escape. A jailed player still owns their territories and still
collects rent.

### A turn

1. **Roll** two dice and move clockwise by the total. Doubles have no special
   effect.
2. **Pass The Docks?** Collect $200.
3. **Resolve the tile you land on:**

| You land on… | What happens | Your question |
|---|---|---|
| An **unowned** territory you can afford | It's for sale at its price | **Buy** or **Pass** |
| An unowned territory you **can't** afford | Nothing ("Can't afford — $300") | — |
| **Your own** territory, below ★★★, upgrade affordable | You may raise it one level | **Upgrade** or **Skip** |
| Your own territory at ★★★, or upgrade unaffordable | Nothing | — |
| A **rival's** territory | You pay them rent, automatically | — |
| A special tile | Its effect, automatically | — |

4. **The turn ends by itself.** It ends right after your answer, or at once if
   there was nothing to answer. There is no *End turn* button and no build
   phase.

Every turn is **one roll plus at most one yes/no**. That is the load-bearing
rule of v2, and no future rule may add a second question to a turn.

Passing on a territory has no other effect. It stays unowned, at the same
price, for whoever lands on it next. There is no auction and no mark-down.

### Rent

Rent is paid automatically, in full, the moment you land. It comes from three
things, all visible on the board:

- the district's **price**: base rent is 30% of it
- the tile's **level**: ★ ×1, ★★ ×2, ★★★ ×4
- how many tiles of that **district** the owner holds: ×1, ×2 or ×3

Each owned tile shows a **rent tag** with exactly what you'd pay right now, so
nobody ever does the sum.

**Why the district rule is "× tiles held" and not Monopoly's "complete the set,
double the rent"**: v2 has no trading and no takeovers, so a complete set is
rare. The calibration found only **0.05–0.4 complete districts at match end**,
which means a set-only bonus would almost never fire. Multiplying by tiles held makes
the *second* tile in a district an exciting buy, and still makes the third one
the best.

### Upgrades

Only by landing on your own territory: **one level per landing**, ★ → ★★ →
★★★. Each level costs half the district's price. Upgrades raise rent, and
their cost is added to the tile's value, so **upgrading never lowers your net
worth**. It turns cash into a tile that earns more.

### Net worth

**Net worth = cash + the value of every territory you own**, where a
territory's value is its price plus what its upgrades cost.

So buying and upgrading never change your net worth. Rent, paydays, fines, the
pot and *Street Luck* do. The target is measured against this number, and it
is shown beside every player's cash: *"$1,020 ($1,150)"*.

### Can't pay: forced sales and bankruptcy

When you owe money (rent, a fine, a card) and don't have enough cash:

1. **The bank sells your territories for you**, cheapest first, at **half
   their value**, one at a time, until you can pay. A sold territory returns to
   the bank unowned, at ★, at its normal price.
2. If you can pay after that, you pay and play on.
3. If everything is sold and you still can't pay, you're **bankrupt**. Whatever
   cash you have goes to whoever you owed (or into the pot), and **you're
   out**. Your seat takes no more turns. You stay at the table to watch and
   chat.

There are no mortgages, no voluntary sales and no trading. Nothing asks the
debtor a question, which is why this works identically when the debt lands on
someone else's turn (see *The boys chip in*).

### Street Luck

Each draw is one of these ten cards, picked at random. The same card can come
up twice in a row, because there's no deck to track. Every card resolves
immediately and none of them asks a question.

| # | Card | Effect |
|---|---|---|
| 1 | *Lucky night at the tables* | Collect $150 |
| 2 | *A tip pays off* | Collect $100 |
| 3 | *The boys chip in* | Collect $25 from every other player |
| 4 | *Bad bet* | Pay $100 into the pot |
| 5 | *Parking ticket* | Pay $50 into the pot |
| 6 | *Busted!* | Go straight to County Jail |
| 7 | *Head for the Docks* | Move to The Docks and collect $200 |
| 8 | *Shortcut* | Move forward 3 tiles and resolve that tile |
| 9 | *Friends in construction* | Your cheapest territory below ★★★ goes up one level, free. None? Collect $100 instead |
| 10 | *Building inspector* | Pay $25 into the pot for every upgrade on your territories |

*Shortcut* always lands on a territory (from tile 12 on Chop Shop, from tile 20
on The Onyx Room), so it can open a Buy or Upgrade question. That question is
still the turn's only one.

### Winning

Checked at the end of every turn:

- **Target reached**: if any player still in has net worth ≥ the target, the
  match ends. If several do, the highest net worth wins.
- **Last one standing**: if everyone else is bankrupt or has quit, the survivor
  wins, target or not.
- **Round 30 ends**: the highest net worth wins.

Ties, anywhere: more territories, then earlier seat.

### Standings (ADR-0005)

`Standing[]`, winner first:

1. Players still in, by net worth: `detail: "$3,640 net worth"`
2. Bankrupt players, most recent first: `detail: "Bankrupt · round 24"`,
   `eliminated: true`
3. Players who quit: `detail: "Walked away"`, `eliminated: true`

### Leaving the table

- **Closing the tab** (ADR-0004): the seat keeps its money and territories and
  the CPU plays it.
- **Quitting**: the player is out and their territories go back to the bank,
  unowned at ★. They rank below everyone else.
- **No humans left**: the session ends abandoned with no winner (ADR-0004).

### The turn clock

A human seat has **30 seconds** per move (the roll, then the answer). When time
runs out, the CPU makes that one move for them using the CPU rules below. The
countdown only appears in the last 10 seconds. Expiry is judged on the
server's clock via ADR-0005's `turnExpired`, never a client's.

### CPU players

This table is the whole bot:

| Situation | The CPU… |
|---|---|
| Its turn to roll | Rolls |
| A Buy question | Buys if it would still have **$150** left; otherwise passes |
| An Upgrade question | Upgrades if it would still have **$150** left; otherwise skips |

There is nothing else to decide. It waits 1–3 s before each move, the same
pacing as Nuno. v1's separate bot spec is retired, and this table is the
contract.

### What each player can see

**Everything is public**: every player's cash, net worth, territories, levels
and position, plus the pot and the target. The only thing nobody can know is
the next roll or card, and that isn't stored anywhere. Randomness comes from
`ctx.random` inside each move.

The view still differs per seat, as the platform contract requires. It carries
a `you` block with your seat, whether it's your move, and the question in front
of you if there is one. A spectator's `you` is `null`.

## Formulas

Every value lives in `lib/game/data/empire-wars.ts`. Every price is a multiple
of 20, so **every formula below yields whole dollars and no rounding rule is
needed anywhere**.

### Rent

`rent = price × RENT_RATE × LEVEL_RENT_MULT[level] × held`

| Variable | Type | Value | Meaning |
|---|---|---|---|
| `price` | int | $100–$380 | The district's price |
| `RENT_RATE` | float | 0.30 | Base rent as a fraction of price |
| `LEVEL_RENT_MULT` | int[3] | ★ 1 · ★★ 2 · ★★★ 4 | By level |
| `held` | int | 1, 2 or 3 | Tiles of this district the owner holds |

Rent per tile with `held = 1`. Double it with two tiles in the district, triple
it with three:

| District | Price | ★ | ★★ | ★★★ | Each upgrade costs |
|---|---|---|---|---|---|
| Old Town | 100 | 30 | 60 | 120 | 50 |
| Little Havana | 140 | 42 | 84 | 168 | 70 |
| The Harbor | 180 | 54 | 108 | 216 | 90 |
| Industrial | 220 | 66 | 132 | 264 | 110 |
| Downtown | 260 | 78 | 156 | 312 | 130 |
| Nightclub District | 300 | 90 | 180 | 360 | 150 |
| Casino Strip | 340 | 102 | 204 | 408 | 170 |
| Financial District | 380 | 114 | 228 | 456 | 190 |

**Output range**: $30 (Old Town ★, one tile) to **$1,368** (Financial ★★★,
whole district: `380 × 0.3 × 4 × 3`).

**Worked example**: Gin Joint (Nightclub, $300) at ★★, and its owner holds two
of the three Nightclub tiles. `300 × 0.3 × 2 × 2 = $360`.

### Upgrades, value and forced sales

| | Formula | Example — Nightclub ($300) |
|---|---|---|
| Upgrade cost, each level | `price × UPGRADE_COST_RATE` (0.5) | $150 |
| Territory value | `price + upgradeCost × (level − 1)` | ★ $300 · ★★ $450 · ★★★ $600 |
| Forced-sale proceeds | `value × SALE_RATE` (0.5) | ★ $150 · ★★ $225 · ★★★ $300 |

### Net worth

`netWorth = cash + Σ value(territory owned)`

**Worked example**: $900 cash + Pawn Shop ★ ($100) + Barber Shop ★★ ($150) +
Gin Joint ★★★ ($600) = **$1,750**.

### Money in and out

| | Value |
|---|---|
| `STARTING_CASH` | $1,500 |
| `PAYDAY` (The Docks) | $200 per pass or landing |
| `CHECKPOINT_FINE` | $100, into the pot |
| Board total, all 24 at ★ | **$5,760** |

The board costs roughly four seats' starting cash. At 2–3 seats it almost
never sells out. At 6 seats it usually does, around round 18.

### Target net worth, by table size

| Seats | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|
| `TARGET_NET_WORTH` | $2,800 | $3,200 | $3,600 | $3,800 | $4,000 |

Bigger tables move more rent, so the leader's net worth climbs faster. The
target scales so that the race finishes at about the same round at every
table size. Players never need to know it scales, because the number is always
on screen.

### Measured match shape

These numbers come from a Monte Carlo of exactly the rules above: 5,000 seeded
matches per table size, with every seat following the CPU rules. They are
**calibration targets**. The implementation's `simulate.ts` has to reproduce
them (see Acceptance Criteria → *Calibration*).

| Seats | Ends on target | Median last round | Turns | ≈ Length\* | Any bankruptcy | Round-10 leader wins | Turns with a question |
|---|---|---|---|---|---|---|---|
| 2 | 77% | 26 | 51 | 5 min | <1% | 67% | 49% |
| 3 | 78% | 26 | 76 | 7 min | 1% | 58% | 41% |
| 4 | 73% | 27 | 103 | 9–10 min | 3% | 54% | 34% |
| 5 | 77% | 26 | 126 | 11–12 min | 3% | 51% | 28% |
| 6 | 80% | 26 | 149 | 13–14 min | 4% | 49% | 24% |

\* Assumes ~5.5 s per turn (dice, walk, one answer or CPU pacing).
**Unmeasured**: getting a real number is the first playtest's job.

What the calibration shows:

- **Matches usually end at a finish line, not on a timer**: about three in four
  at every table size, around round 26 of 30.
- **No bankruptcy before round 16** in 25,000 matches, and fewer than 1 in 500
  before round 20. Getting knocked out is a late-game threat, never a way to
  lose your evening in minute three.
- **The round-10 leader wins about half the time** at 4–6 seats, against a
  17–25% baseline. The early lead matters, but it doesn't decide the match.
- **Rent out-earns paydays at 4+ seats**, so the property game decides the
  winner, not lap-counting. At 3 seats the two are about even, and at 2 seats
  paydays still dominate (see Open Questions).

What the calibration rejected (recorded so nobody re-proposes it):

| Tried | Result |
|---|---|
| Rent at 10–20% of price | Paydays out-earned rent, nobody ever went bankrupt, and the richest player finished around $2,500–3,500, too flat for a race |
| "Complete the district, rent ×2" (Monopoly) | Without trading, only 0.05–0.4 complete districts existed at match end, so the rule almost never fired |
| One fixed target for all table sizes ($3,500) | 2-seat games reached it 19% of the time; 6-seat games were over by round 21 |

## Edge Cases

### Movement and tiles

- **Passing and landing on The Docks in one move**: $200, once.
- ***Head for the Docks*** moves you onto The Docks, and the $200 it pays *is*
  the payday. You get it once, not twice.
- ***Busted!*** (tile or card) moves you to tile 8 **without passing The
  Docks**: no $200.
- **Jail**: the missed turn counts as your turn for the round. You're released
  automatically, and your next roll starts from tile 8. Rent keeps coming to
  you while you're inside.
- ***Shortcut*** fully resolves the new tile, including rent or a Buy/Upgrade
  question.
- **Doubles** have no effect.

### Buying and upgrading

- **Exactly enough cash**: you may buy or upgrade down to $0.
- **Can't afford**: no question is asked. The tile shows "Can't afford — $300"
  and the turn ends.
- **Passing** leaves the tile unowned at its normal price: no auction, no
  mark-down, no memory of the pass.
- **Your own tile at ★★★**: nothing happens.
- **A stale answer** (for example, your 30 seconds ran out, the CPU answered
  for you, and your click arrived late) is **rejected**. Every answer names the
  tile it's for, and that tile must match the open question.
- **Rolling while a question is open**, or answering when none is: rejected.

### Money

- **Rent to a jailed owner** is paid in full.
- **Forced-sale order**: lowest value first, with ties broken by board order.
  The bank stops the moment the debt can be covered.
- **A forced sale breaks up your district holding**: rent on the tiles you
  still own there drops immediately.
- **Bankrupt owing a player**: they get all the cash you had after the sales,
  not the full debt.
- **Bankrupt owing the bank**: your remaining cash goes into the pot.
- ***The boys chip in* breaks another player**: their forced sale, and
  bankruptcy if needed, happen automatically inside your turn. Nobody is asked
  anything. If several players go broke at once, they're processed in seat
  order starting after the drawer, and they rank in the order they went out.

### Winning

- **Two players cross the target on one turn** (rent to one, a card to
  another): highest net worth wins. Ties go to more territories, then earlier
  seat.
- **You cross the target on someone else's turn** (they paid you rent): the
  check runs when their turn ends, and you win then.
- **Last player standing, below the target**: wins anyway.
- **Round 30**: the match ends after the last turn of round 30. A jailed
  player's skipped turn counts as their turn.
- **The pot at match end** isn't counted for anyone.

### Seats

- **A human closes their tab**: the CPU plays the seat from its next move (the
  turn clock covers the current one).
- **A quit on your own turn** ends that turn. Your territories return to the
  bank unowned at ★, and rent from them stops immediately.
- **A quit leaves one player**: that player wins.
- **Only CPUs left**: the session ends abandoned, with no winner (ADR-0004).
- **A v1 match still running at deploy**: its state fails v2's `parseState`.
  The platform already retires unreadable sessions and reopens the lobby (the
  2026-08-10 fix), so no migration is needed.

## Dependencies

### Upstream

| Depends on | Nature | Interface |
|---|---|---|
| **Lobby** | Hard | Seats, host, CPU seats, join codes. Empire Wars adds no lobby UI (ADR-0004) |
| **Game module interface** (ADR-0005 + Amendment 1) | Hard | `GameModule<EmpireState, EmpireView, EmpireMove>`. Dice and cards come from `ctx.random`; the turn clock uses the optional `turnExpired`. **Both already exist** |
| **`persistGameState` / `Standing[]`** | Hard | The platform owns finish/abandon, the chat wipe, lobby reopen and `GameWin` |
| **Catalog + both registries** | Hard | `empire-wars` in `lib/game/catalog.ts`, `lib/game/registry.ts` and `components/game/boards.tsx`. Unchanged |
| **Per-seat colour** | Hard | Owner colour is how the board is read. **Done** 2026-08-04 (`AvatarChip`'s `seat` prop, `--chart-6`) |
| **Realtime** (ADR-0001) | Soft | `game-changed` hints. Missing Pusher env degrades to plain refresh |
| **Art** | Soft | Logo, cover, and 4 landmark tile SVGs in `public/games/empire-wars/`. A missing tile image degrades to the plain band |

What v2 **no longer needs** from the platform: off-turn pending decisions,
`expiresAt` resolvers with jitter, and bot triggers keyed on a decision rather
than the turn. The only clock left is the turn clock.

### Downstream

Empire Wars is a leaf. `nuno-core.md` is a sibling, not a dependency, and
ADR-0005 already names this GDD.

### Implementation notes

- **The whole move schema**: `{ kind: "roll" }`,
  `{ kind: "buy", tile }`, `{ kind: "upgrade", tile }`,
  `{ kind: "decline", tile }`, plus the platform's quit. `tile` is what makes
  a stale answer detectable (Edge Cases).
- **State holds no history.** A bounded feed of the last 8 events (for the
  centre lines and the money-flight animation) replaces any log. Each event
  carries the `seq` of the move that made it, so a client can tell what's new.
  `state.version` is bumped on every applied move, because the CPU driver's
  effect depends on it (the 2026-08-10 stall fix).
- **Roll and automatic resolution are one `apply`.** A turn is never more than
  two server round-trips: the roll, and the answer.

### Rebuild: what the v1 code keeps

The v1 implementation (~6,000 lines across `lib/game/empire-wars/`,
`components/game/empire-wars/`, the data files and five test files) implements
the archived rules:

| Keep, adapt | Rewrite | Delete |
|---|---|---|
| Board ring, `tile.tsx`, `dice.tsx`, `pieces.tsx`, the piece art in `icons.tsx`, the turn clock, the `state.version` bump, `.default()` hardening in `parseState`, module/registry/catalog wiring, the `simulate.ts` harness | `rules.ts` (state schema), `turn.ts`, `economy.ts`, `bot.ts`, `view.ts`, `rail.tsx` → the prompt, `decision-overlay.tsx` → the Buy/Upgrade prompt, `lib/game/data/empire-wars.ts` | `combat.ts`, `progress.ts`, `coach.ts`, `heat-track.tsx`, `lib/game/data/empire-wars-content.ts`, and the v1 combat/economy/coach/turn tests |

Knock-on changes outside the game folder: the catalog tagline ("Run the city.
Pay, or find out." refers to the cut standoff; proposed: **"Run the city.
Collect the rent."**), and `design/empire-wars-art-manifest.md`. Boss portraits
are no longer needed, and the special-tile art set becomes *docks, checkpoint,
jail, street-luck, safehouse, busted*.

## Tuning Knobs

All in `lib/game/data/empire-wars.ts`, none inline in logic.

| Knob | Default | Safe range | Raise it and… | Lower it and… |
|---|---|---|---|---|
| `ROUND_LIMIT` | 30 | 20–40 | A long tail of rounds after the race is decided | Most matches end on the clock, not the target |
| `TARGET_NET_WORTH` | $2,800–4,000 by seats | ±15% | Matches end on the clock | Matches end before anyone has upgraded |
| `STARTING_CASH` | $1,500 | 1,000–2,000 | Buying never costs anything | Top districts stay unsold until late |
| `PAYDAY` | $200 | 100–300 | Lapping beats owning; rent stops mattering | A player who falls behind can't recover |
| `RENT_RATE` | 0.30 | 0.20–0.40 | Earlier bankruptcies; the leader snowballs | Paydays decide the game (measured at 0.10–0.20) |
| `LEVEL_RENT_MULT` | 1 / 2 / 4 | — | One ★★★ district ends the match | Upgrading isn't worth the landing |
| `UPGRADE_COST_RATE` | 0.5 | 0.3–1.0 | Nobody upgrades | Everything is ★★★ by mid-game |
| `SALE_RATE` | 0.5 | 0.3–0.8 | Going broke is painless | One big rent wipes a player out |
| `CHECKPOINT_FINE` | $100 | 50–200 | Checkpoints feel like a tax | The pot is never worth landing on |
| `TURN_WINDOW_MS` | 30,000 | 15,000–60,000 | Absent players stall everyone | Real players get auto-played mid-thought |
| `BOT_RESERVE` | $150 | 0–400 | CPUs hoard and never build | CPUs go bankrupt on the first big rent |
| `BOT_DELAY_MS` | 1,000–3,000 | — | CPUs feel sluggish | CPUs feel like machines |
| `MIN/MAX_PLAYERS` | 2 / 6 | fixed | — | — |

`RENT_RATE`, `TARGET_NET_WORTH` and `ROUND_LIMIT` **move together**. Richer
rent makes the leader richer faster, so the target has to rise with it or
matches get shorter. Re-run the calibration after changing any of the three.

## Acceptance Criteria

### Board and setup

- [ ] **GIVEN** a new match, **WHEN** dealt, **THEN** the board has 32 tiles: 24 territories in 8 districts of 3 at the documented indices and prices, plus 8 specials at 0/4/8/12/16/20/24/28. *(unit)*
- [ ] **GIVEN** a new match, **WHEN** dealt, **THEN** every seat has $1,500, no territories and a token on tile 0, and the target matches the seat count. *(unit)*

### The one-question turn — the rule v2 exists for

- [ ] **GIVEN** any state, **WHEN** the active seat has rolled, **THEN** at most one question is open, and the turn passes as soon as it's answered, or immediately if there's none. *(unit — **blocking**)*
- [ ] **GIVEN** a 1,000-seed all-CPU corpus, **WHEN** every move is recorded, **THEN** no turn contains more than two moves by the active seat, and no seat other than the active one ever moves, except to quit. *(simulation — **blocking**)*

### Movement

- [ ] **GIVEN** a token on tile 30, **WHEN** it moves 5, **THEN** it's on tile 3 and its owner received $200 exactly once. *(unit)*
- [ ] **GIVEN** a player lands on Busted! (or draws it), **WHEN** it resolves, **THEN** they're on tile 8 with no $200, and their next turn is skipped and counted. *(unit)*

### Buying and upgrading

- [ ] **GIVEN** an affordable unowned territory, **WHEN** a player lands, **THEN** a Buy question opens for that tile. Buying makes it theirs at ★ for its price; declining leaves it unowned at the same price. *(unit)*
- [ ] **GIVEN** an unaffordable one, **WHEN** a player lands, **THEN** no question opens and the turn passes. *(unit)*
- [ ] **GIVEN** their own territory below ★★★ and an affordable upgrade, **WHEN** they land, **THEN** an Upgrade question opens. At ★★★, none does. *(unit)*
- [ ] **GIVEN** an open question for tile A, **WHEN** an answer naming tile B arrives, **THEN** it's rejected and the state is unchanged. *(unit — **blocking**)*

### Rent

- [ ] **GIVEN** every territory × every level × 1–3 tiles held (216 cases), **WHEN** rent is computed, **THEN** it matches the Formulas table exactly. *(unit, table-driven)*
- [ ] **GIVEN** a rival lands on an owned territory, **WHEN** it resolves, **THEN** rent moves to the owner with no question asked, including when the owner is in jail. *(unit)*

### Money

- [ ] **GIVEN** a debt larger than cash, **WHEN** it's settled, **THEN** territories sell lowest value first at half value, stopping as soon as the debt is covered, and each sold tile returns unowned at ★. *(unit)*
- [ ] **GIVEN** everything sold and still short, **WHEN** it's settled, **THEN** the player's cash goes to the creditor (or the pot), they're marked bankrupt, and they never take another turn. *(unit)*
- [ ] **GIVEN** a card that makes a non-active player go broke, **WHEN** it resolves, **THEN** their forced sale or bankruptcy completes inside the same move, with no question to anyone. *(unit)*

### Special tiles and cards

- [ ] **GIVEN** a Checkpoint, **WHEN** landed on, **THEN** $100 moves to the pot. **GIVEN** the Safehouse, **THEN** the lander takes the whole pot and the pot is $0. The pot is never part of anyone's net worth. *(unit)*
- [ ] **GIVEN** each of the 10 Street Luck cards, **WHEN** drawn under a seeded `random`, **THEN** its exact effect occurs. The test is table-driven and fails if a card is added without a case. *(unit — **blocking**)*

### Winning and standings

- [ ] **GIVEN** a player at or above the target when a turn ends, **WHEN** checked, **THEN** the match ends and they win. With several, the highest net worth wins; ties go to more territories, then earlier seat. *(unit)*
- [ ] **GIVEN** round 30's last turn, **WHEN** it ends, **THEN** the highest net worth wins. *(unit)*
- [ ] **GIVEN** all but one player bankrupt or quit, **WHEN** the last one goes, **THEN** the survivor wins immediately. *(unit)*
- [ ] **GIVEN** a finished match, **WHEN** standings are built, **THEN** the order is: still in by net worth → bankrupt, latest first → quit, with the documented `detail` strings. *(unit)*

### Calibration — the numbers are a contract

- [ ] **GIVEN** 1,000 seeded all-CPU matches at 4 seats, **WHEN** simulated, **THEN** 65–85% end on the target, the median last round is 23–29, and at most 1% of matches see a bankruptcy before round 15 (the calibration saw none). *(simulation — **blocking**; seeded, so deterministic)*
- [ ] **GIVEN** the same at 2 and 6 seats, **WHEN** simulated, **THEN** each "ends on target" rate is within ±10 points of the Measured match shape table. *(simulation)*

A calibration failure is a bug to investigate. The fix is never to widen the
band until the test passes: if a knob changes on purpose, this document's
tables change in the same commit.

### Platform

- [ ] **GIVEN** the module is registered, **WHEN** `tests/game-module.test.ts` runs, **THEN** every contract test passes unchanged. *(unit — **blocking**)*
- [ ] **GIVEN** any state, **WHEN** `viewFor` runs per seat, **THEN** the views differ only in the `you` block, and a spectator's `you` is `null`. *(unit)*
- [ ] **GIVEN** a v1 `GameSession.state`, **WHEN** `parseState` runs, **THEN** it returns null and fails closed. *(unit — **blocking**)*
- [ ] **GIVEN** a human seat on the clock, **WHEN** the platform tries to play it before 30 s of server time, **THEN** that's rejected. After 30 s, the CPU rules make exactly one move. *(unit)*
- [ ] **GIVEN** a 6-seat state late in a match, **WHEN** serialized, **THEN** it's under 10 KB, and its event feed never exceeds 8 entries. *(unit)*
- [ ] **GIVEN** 6 CPUs and a fixed seed, **WHEN** a match is simulated, **THEN** it reaches a winner within 30 rounds with no rejected CPU moves. *(simulation — **blocking**)*

### Teachability — why v2 exists

- [ ] **GIVEN** a first-time player who has read only the How to play card, **WHEN** their first round ends, **THEN** they can say how to win and what happens on a rival's tile. *(playtest — manual; passes at 4 of 5 new players)*
- [ ] **GIVEN** a 4-seat match against CPUs, **WHEN** played live, **THEN** it finishes end to end in under 15 minutes. *(manual)*

## UI Requirements

Everything important on one screen, nothing in menus, like the reference
screen this redesign came from. The board lives in
`components/game/empire-wars/board.tsx`, inside `GameScreen`'s existing split
with game chat, with **no shell changes** (ADR-0004).

| Region | Contents |
|---|---|
| **Header** | "**$3,600** net worth to win · **27** rounds left" |
| **Players** | One panel per seat: piece in seat colour, name, **cash** and **(net worth)**, e.g. "$1,020 ($1,150)", plus a thin bar showing progress toward the target. **You always sit bottom-left.** Rivals follow in turn order, clockwise from you: top-left, top-centre, top-right, bottom-right, bottom-centre, so at two seats your rival sits diagonally opposite, top-right. The active seat is highlighted, bankrupt seats are greyed, and a CPU shows a thinking state |
| **Board** | The 32-tile ring, as big as the screen allows. Each territory has a district band, a **tag** (its price if unowned, its current rent in the owner's seat colour if owned) and ★ pips. Tile text, pieces and dice scale with the ring's width |
| **Centre** | The last event in one line ("jenga paid $360 rent to chicken"), the dice, the pot |
| **Your prompt** | Only on your turn: one sentence, one primary button, one quiet secondary. "**Buy Gin Joint — $300** · Pass" or "**Upgrade to ★★ — rent $90 → $180** · Skip" |

Five rules for the surface:

1. **One screen, one question.** Nothing competes with the prompt: no stat
   panels, no build menu, no explanation nobody asked for.
2. **Show money moving.** When rent is paid, the amount flies from the payer to
   the owner and both numbers tick. This is the most important feedback in the
   game, because it teaches rent without a word.
3. **The tag is the rule.** Nobody computes rent; the tile says it. Buying a
   second tile in a district visibly bumps the tags on both.
4. **Every automatic event gets one line** in the centre: "Busted! — chicken
   sits out a turn", "jenga takes the pot: $240", "*The boys chip in* — jenga
   collects $75".
5. **How to play** is the six-line card above. It opens once on a player's
   first game, then from a "?" button.

Buy and Upgrade are the **`game`** button variant (the primary action on the
felt), and Pass and Skip are quiet ghost buttons. Gold stays reserved for
status: the winner, and the target being reached. v1's problem with two
equal-weight choices (Pay/Refuse) is gone, because every v2 question has a
natural yes and a way out.

### Wide and narrow tables

The ring is the only board layout, at every size, and it's always 9×9, because
the corners are the special tiles at 0/8/16/24. What changes with the felt's
own width (a container query, not the viewport) is where the players sit and
how the ring stretches:

| | Wide felt (≥ 42rem, a desktop column) | Narrow felt (a phone) |
|---|---|---|
| **Players** | *Inside* the ring's centre, around the dice and the prompt | In rows above and below the ring |
| **Ring** | The felt's full width, and as tall as the viewport allows under the app and game bars. A square at most and never flatter than 3:2, so cells may be wider than they are tall | A square as wide as the column |
| **Tiles** | Names shown | Names dropped; band, tag and pips stay (the reference screen fits a 28-tile ring on a phone this way) |

Putting the players inside the ring on wide screens is what lets the board take
the whole height: rows above and below cost ~10rem of height that a square
ring then lost in width too. Tapping a tile opens its card at any size: name,
price, rent at each level and owner.

### Motion

Dice tumble (~600 ms), pieces hop tile to tile (~120 ms per step), rent flies
(~400 ms), a purchase stamps the owner's colour onto the tile, and an upgrade
pops a star. All of it follows `design/art-direction.md`'s budget, and
`prefers-reduced-motion` collapses everything to instant.

### Accessibility

- The board is also an ordered list. Each tile's accessible name carries its
  district, owner, level and price or rent.
- Ownership shows by colour **and** by the owner's piece or initial, never by
  colour alone.
- The prompt takes focus when it opens and gives it back when it closes, and is
  fully keyboard-reachable.
- Event lines go to a polite live region. Ticking money counters don't announce.

### Removed from v1's surface

The Heat track, Dirty Money, crew, boss card, missions, the standoff and truce
overlays, the City Hall and bail actions, the Airport picker, and the coach's
explainer lines. v2 doesn't need a coach, because every moment has at most one
thing to do.

## Open Questions

| Question | Why it matters | Resolve by |
|---|---|---|
| Is ~10 minutes at 4 seats the right length? | Short for "game night", which is also why people play another | First playtest. Knobs: `ROUND_LIMIT` and `TARGET_NET_WORTH` together |
| Is 2 seats too thin? | Only ~8 rent payments in a 2-seat match, and paydays out-earn rent | Playtest. Candidate: a 2-seat rent boost in data, not a rule change |
| Is Pass ever right? | Buying never lowers net worth, so buying is nearly always correct and the Buy question may feel like a formality | Playtest. Accepted for now, because the click is the fun |
| Are late turns at 5–6 seats too passive? | At 6 seats only about 1 turn in 4 asks anything, and fewer once the board sells out (~round 18) | Playtest. Candidate: a second *Friends in construction* card |
| Is bankruptcy too rare to be felt? | "Bankrupt = out" was chosen, but it happens in only 3–4% of matches | Playtest. Knob: `RENT_RATE`, then re-run the calibration |
| Should doubles do something? | Deliberately inert for simplicity, though "roll again" is a cheap, familiar thrill | Only if playtests ask for it |

### Decided — not open

Recorded so they aren't re-proposed without a new reason:

- **Takeovers / buyouts**: rejected by the user (2026-09-10). A tile you buy is
  yours for the match.
- **Auctions**: they'd be the only off-turn decision in the game, and the
  platform's one-seat-on-the-clock model (ADR-0005) is the reason v2 has none.
- **Trading, mortgages, voluntary sales**: each adds a negotiation or a menu,
  which is exactly what v2 removed.
- **Anything from v1** (Heat, Dirty Money, combat, crew, bosses, missions,
  truces, bribery, laundering, the action die): see the archive. Any of it
  coming back has to fit on the How to play card first.
