# Empire Wars — Core Game

> **Status**: Implemented — **v3, empires re-theme + Monopoly depth** (2026-09-10).
> Code matches this doc; building and monuments are unit-tested but not yet
> played live. **Match setup added 2026-09-11** (the table picks the target
> and the round limit; a toss settles a disagreement).
> **Last Updated**: 2026-09-10
> **Supersedes**: v2 (archived at `design/gdd/archive/empire-wars-core-v2.md`)
> and v1 (`archive/empire-wars-core-v1.md`)
> **Governing ADRs**: ADR-0004 (lobby as group, games as catalog),
> ADR-0005 (game module interface, incl. Amendment 1 `ctx` and
> **Amendment 2 `ctx.humans`** — see Dependencies)
>
> Every number here is locked by the v3 calibration run (2026-09-10) — see
> Formulas → *Measured match shape*. Change one and re-run it.

## Why v3 exists

v2 fixed an unteachable v1 by stripping it to roll, buy, rent and race. v3 is
the user's next step (2026-09-10): **re-theme it from 1930s gangsters to
history's great empires**, and bring back the classic Monopoly depth that
makes the middle of a match interesting — **whole-empire building, trading and
auctions**.

| | v2 | v3 |
|---|---|---|
| Theme | 1930s crime city, eight districts | **Eight historical empires**, three cities each, one monument each |
| Currency | `$` | **Coins** |
| Rent | ×1/×2/×3 by how much of a district you hold | **Tribute**: doubles when you hold the whole empire; soars with houses and the monument |
| Upgrades | Land on your own tile, one level (★→★★★) | **Own the whole empire**, then build up to 4 houses per city and the empire's **monument** on one of them — any time on your turn |
| A passed-on city | Stays unowned | **Goes to auction**; everyone bids |
| Trading | None | **The Market**: trade cities and coins with any rival, or auction one of your cities |
| Cards | One deck, *Street Luck* | Two decks: **Bonanza** (Chance) and **Royal Decree** (Community Chest) |
| A turn | Roll + at most one question | Roll + at most one landing question, then an **optional manage step** and **End turn** |
| Off-turn decisions | None | Two, both timed with a safe default: answering a trade, bidding at an auction |

**Kept from v2:** the 32-tile ring, the net-worth race to a target with a
round limit (both now picked at setup), bankrupt = out, everything public, the
turn clock, the CPU driver, the money flights and the table layout.

**The cost, stated plainly:** v3 brings back three things v2 removed because
v1 died of complexity — trading, auctions, and decisions on someone else's
turn. They are all optional, and the core turn still reads *roll, answer, end
turn*, but the first playtest must re-test teachability (Acceptance Criteria
→ *Teachability*).

Decided with the user on 2026-09-10: the Market is a button on your turn (not
a board tile); a city that is passed on goes to auction; coins, not `$`; keep
the net-worth race; placeholder SVG art until real art arrives.

Added with the user on 2026-09-11: **match setup**. Before the first roll every
human picks *Assets* (the net worth that wins) and *Rounds*; if they disagree a
toss decides whose picks are played, and CPUs play by the humans' choice. It
happens in the game, over the board — the lobby is unchanged.

## Overview

Empire Wars is Chipae's second game: a race to build the richest empire in
history, for 2–6 seats, as short or as long as the table chooses. Players roll two dice around
a ring of the world's great imperial cities — from Istanbul and Rome to Paris,
London and Dhaka — buying the cities they land on, or bidding for them at
auction when someone passes. Rivals who land on your city pay you tribute.
Hold all three cities of an empire and your tribute doubles and you can
build: four houses per city, then the empire's monument — Topkapı Palace,
the Eiffel Tower, the Taj Mahal. On your turn you can build, sell, or open the
Market to trade cities and coins with any rival. The first player whose net
worth — coins plus the value of their cities — reaches the target wins;
otherwise the richest when the rounds run out. The table picks both before the
first roll — a toss settles it if the players disagree. Run out of coins and
you're out.

## The whole game in 60 seconds

The in-game **How to play** card, word for word. The test for every future
rule: a first-time player must be able to play without a rule that isn't on
this card.

> 1. **Roll and move.** Passing the Silk Road pays you 200 coins.
> 2. **Land on a free city?** Buy it — or pass, and everyone bids for it at
>    auction.
> 3. **Land on a rival's city?** You pay them tribute, automatically.
> 4. **Own a whole empire** — all three of its cities? Your tribute doubles,
>    and you can build.
> 5. **Build up to 4 houses on a city, then the empire's monument** — the
>    Eiffel Tower, the Taj Mahal… Tribute soars.
> 6. **On your turn, open the Market** to trade cities and coins, or to
>    auction a city.
> 7. **First to 5,000 net worth wins** — your coins plus what your cities are
>    worth; after 50 rounds, the richest. Run out of coins and you're out.

Line 7 is written from the match's own settings (*Match setup*); this is the
standard match. With no round limit the clause after the semicolon goes; with
no target it reads *"The richest after 50 rounds wins"*; with neither, *"The
last empire standing wins — no target, no round limit."* The card opens after
setup and the toss, so it always describes the match being played. The
Dungeon, the Treasury and the cards explain themselves in one line when they
happen.

## Player Fantasy

You're an emperor, and history is for sale.

The pleasure is completing an empire. You hold Lyon and Marseille; someone else
has Paris. You open the Market, offer them Pompeii and 150 coins, and they
take it — and now France is yours, the tribute doubles, and next turn the
Eiffel Tower goes up. The sting is the reverse: you see a rival's Big Ben on
London, you count the tiles, and you land on it.

The tension is the race and the table. Everyone's coins and net worth are on
screen, so everyone can see who is close — and who is one city short of an
empire. Auctions put the whole table in the moment together; trades turn
rivals into partners for exactly one turn.

It should stay learnable in one round: the Market and building are there when
you want them, never demanded.

**Reference points**: classic Monopoly's sets, houses, hotels and trading;
the net-worth race of mobile property games; Civilization's wonders as the
image of a monument. Voice follows `design/art-direction.md` — "game-night
host, not esports announcer". History as a playful backdrop, not a lecture.

## Detailed Rules

### Setup

- 2–6 seats. Turn order is seat order.
- Everyone starts with **1,500 coins** on the Silk Road (tile 0), owning
  nothing.
- Before the first roll the table picks its **target net worth** and its
  **round limit** (*Match setup*, next). Both stay on screen all match.
- A **round** is one turn for every seat still in.

### Match setup

Over the board, before anyone rolls:

- **Every human picks two things.** **Assets** — the net worth that wins:
  **3K · 5K · 10K · Unlimited**. **Rounds** — when the richest wins instead:
  **30 · 50 · 100 · Unlimited**. The picker starts on the **standard match**,
  5K · 50.
- **Picks are public**: everyone sees who picked what, and who is still
  choosing. A pick can be changed until the settings are decided.
- **CPUs never pick.** They play by whatever the humans choose; a table with
  one human plays that human's pick.
- The settings are decided **the moment the last human still in has picked**,
  or when the **30-second** clock runs out:
  - everyone who picked chose the same → that's the match; no toss;
  - they disagree → **the toss**: one picker is drawn at random, each with the
    same chance, and the table plays **their** Assets and Rounds, both;
  - nobody picked → the standard match.
- The toss plays out on screen for the whole table, then the first seat still
  in rolls, with a fresh clock.
- **Unlimited Assets**: no target — the round limit, or the last one standing,
  ends it. **Unlimited Rounds**: no limit — the target, or the last one
  standing, ends it. **Both Unlimited**: the last one standing wins; if nobody
  has been knocked out by **round 200**, the richest wins. Without that safety
  net a few matches never end (*Measured match shape*).
- A table of only CPUs (simulations, tests) has nobody to pick, so it plays
  the standard match straight away.

### The board — 32 tiles

Corners at 0/8/16/24; **24 cities** in **8 empires** of 3, plus **8 special
tiles**. Empires get richer clockwise from the Silk Road; all three cities of
an empire share one price.

| Tiles | Empire | Cities, in board order | Monument | Price |
|---|---|---|---|---|
| 1–3 | Ottoman Empire | Edirne · Bursa · Istanbul | Topkapı Palace | 100 |
| 5–7 | Rome | Pompeii · Ravenna · Rome | The Colosseum | 140 |
| 9–11 | Mongol Empire | Tabriz · Sarai · Karakorum | The Genghis Khan Statue | 180 |
| 13–15 | Ming China | Guangzhou · Nanjing · Beijing | The Forbidden City | 220 |
| 17–19 | Mughal Empire | Lahore · Delhi · Agra | The Taj Mahal | 260 |
| 21–23 | France | Marseille · Lyon · Paris | The Eiffel Tower | 300 |
| 25–27 | Britain | Liverpool · Manchester · London | Big Ben | 340 |
| 29–31 | Bengal | Sonargaon · Dhaka · Murshidabad | Hazarduari Palace | 380 |

The roster follows the painted art in `public/games/empire-wars/` (see
`design/empire-wars-art-manifest.md`) — changed 2026-09-11 from Egypt, Carthage,
Antioch, Samarkand, Xi'an, Edinburgh, the Silver Tree and the Great Wall so
every city and monument has its picture. Prices and tiers didn't move, so the
calibration stands.

No city appears twice (Beijing is Ming China's, so the Mongols' third city is
Tabriz, the Ilkhanate capital, not Khanbaliq). No monument is a working place
of worship. The order is gameplay tiers only — reorder or swap empires freely
(alternates: Egypt · The Great Pyramid, Persia · Persepolis, Spain · El
Escorial, Japan · Himeji Castle) — but a swap needs its crest, house, monument
and three city icons painted first.

| Tile | Special | What happens |
|---|---|---|
| 0 | **Silk Road** *(start)* | Collect **200** every time you pass or land on it |
| 4, 20 | **Royal Decree** | Draw a Royal Decree card (the Community Chest) |
| 8 | **The Dungeon** | Just visiting — unless you were sent here |
| 12, 28 | **Bonanza** | Draw a Bonanza card (the Chance) |
| 16 | **Royal Treasury** | Take **everything in the treasury** |
| 24 | **Treason!** | Go straight to the Dungeon. You don't pass the Silk Road |

**The treasury** sits in the middle of the board. It starts empty; every card
payment "to the treasury" goes in; whoever lands on the Royal Treasury takes
it all. It counts toward nobody's net worth.

**The Dungeon**: a player sent there **misses their next turn**, then plays on
from tile 8. No bail, no rolling out. They still collect tribute.

### A turn

1. **Roll** two dice and move clockwise. Doubles mean nothing.
2. **Pass the Silk Road?** Collect 200.
3. **Land:**

| You land on… | What happens |
|---|---|
| A **free** city you can afford | **Buy** it at its price — or **Pass**, and it goes to **auction** |
| A free city you can't afford | It goes straight to **auction** |
| A **rival's** city | You pay them **tribute**, automatically |
| **Your own** city | Nothing |
| A special tile | Its effect, automatically |

4. **Manage** *(optional)*: build or sell on your cities, or open the
   **Market** to trade or auction. Nothing here is ever required.
5. **End turn.**

A turn asks at most **one landing question** (Buy or Pass). Everything after
it is optional. A player who goes bankrupt during their own landing skips the
manage step.

### Auctions

An auction opens whenever a free city is passed on (or can't be afforded), and
whenever a player puts one of their own cities up from the Market.

- **Everyone still in may bid**, including the player who passed — except the
  seller of their own city.
- Bids go up in **steps of 10** (the table offers +10 / +50 / +100). The first
  bid is at least **10** for a city the bank is selling — and at least **half
  the city's price** for one a player puts up, which is what the bank would
  have paid them, so auctioning never loses you coins against selling. You
  can't bid more coins than you hold, or outbid yourself.
- A **countdown** runs while the auction is open: **12 s** to start, and every
  bid tops it back up to at least **6 s**, up to **40 s** in all.
- **CPUs bid as proxies**: each has a ceiling (see *CPU players*) and bids just
  enough to lead, instantly — the moment an auction opens and the moment a
  human outbids it. So a human sees *"Croupier bids 110"* right after bidding
  100, and can answer.
- If **no human** is taking part, the auction settles the instant it opens —
  and whenever a bid leaves **nobody able to beat it** (no other human can
  bid, no CPU's ceiling reaches the next step), it closes on the spot rather
  than run out a countdown nobody can use.
- **When the countdown ends**, the highest bidder pays the seller (or the bank)
  and takes the city. No bids: a bank city stays free; a player's city stays
  theirs.
- Nothing else happens while an auction is open. Then the turn carries on
  where it was.

### Tribute

Paid automatically, in full, the moment you land on a rival's city:

| The city has… | Tribute |
|---|---|
| No buildings, owner holds 1 or 2 of the empire | base |
| No buildings, owner holds the **whole empire** | base × 2 |
| 1, 2, 3 or 4 houses | base × the house multiplier |
| The empire's monument | base × the monument multiplier |

Base tribute is 10% of the city's price. Every owned tile shows exactly what a
visitor pays right now.

### Building

- Only on **your turn**, in the manage step, and only on an empire whose
  **three cities you all own**.
- Each **build** adds one level to one city: 1 → 2 → 3 → 4 houses, then the
  **monument**.
- **One monument per empire.** It goes on whichever city of the empire first
  has 4 houses and gets built on again; after that, the empire's other cities
  stop at 4 houses.
- Every level costs **half the city's price** (the house cost), monument
  included.
- There is no "build evenly" rule.

### Selling

Any time in your manage step:

- **Sell a building**: the city drops one level; you get half its cost back.
- **Sell a city**: only while its **empire has no buildings**. You get half the
  city's price, and it goes back to the bank, free.

### The Market

A button in your manage step. Two things you can do there:

**Trade** — offer any rival any mix of cities and coins, both ways: *"Paris
and 150 coins for your Karakorum"*, or a whole empire for another.

- Cities in an empire that has **any buildings** can't be traded — sell the
  buildings first.
- Coins can't exceed what either side holds.
- The rival answers **Accept** or **Decline** within **20 s**; no answer means
  Decline. The table waits, and then your turn carries on.
- At most **2 offers per turn**.

**Auction a city** — put one of your own cities (from an empire with no
buildings) up for everyone else to bid on. The winner pays you.

### Net worth

`net worth = coins + the value of every city you own`, where a city's value is
its price plus what its buildings cost. Buying, building and fair trades don't
move it; tribute, paydays, cards, sales at half and auctions at a bargain do.

### Can't pay: forced sales and bankruptcy

When you owe more coins than you hold (tribute, or a card):

1. **The bank sells for you** — buildings first, one level at a time from your
   most-built city; then cities, cheapest first — each at **half its value**,
   stopping the moment you can pay.
2. Still short with nothing left: **bankrupt**. What you have goes to whoever
   you owed (or the treasury), and **you're out**. You stay to watch and chat.

Nothing asks the debtor a question, so it works the same off-turn.

### Bonanza and Royal Decree

Two decks of ten, drawn at random (no deck to track). Every card resolves
immediately; none asks a question.

**Bonanza** (tiles 12, 28; id `fortune` in code and saved games — renamed for players 2026-09-14)

| Card | Effect |
|---|---|
| *A silk caravan arrives* | Collect 150 |
| *Spices from the East* | Collect 100 |
| *An ambassador's gift* | Collect 75 |
| *Shipwreck* | Pay 100 to the treasury |
| *Bandits on the road* | Pay 50 to the treasury |
| *Treason!* | Go straight to the Dungeon |
| *Take the Silk Road home* | Move to the Silk Road and collect 200 |
| *Forced march* | Move forward 3 tiles and land there |
| *Master builders* | A free build on your least-built city in a whole empire; none? Collect 100 |
| *Plague* | Pay 25 per house and 100 per monument to the treasury |

**Royal Decree** (tiles 4, 20)

| Card | Effect |
|---|---|
| *Vassals pay tribute* | Collect 25 from every player |
| *A lost treasure* | Collect 200 |
| *An inheritance* | Collect 100 |
| *A bountiful harvest* | Collect 50 |
| *A scholar's grant* | Collect 75 |
| *Coronation feast* | Pay 100 to the treasury |
| *The royal census* | Pay 10 per city you own to the treasury |
| *You host a banquet* | Pay 20 to every player |
| *Banished!* | Go straight to the Dungeon |
| *Summoned to court* | Move to the Silk Road and collect 200 |

*Forced march* from tile 12 lands on Beijing, from 28 on Murshidabad — always a
city, so it can open a Buy question (still the turn's only one) or an auction.

### Winning, standings, leaving

Unchanged from v2:

- **Target reached** at the end of any turn → the highest net worth among
  those at the target wins. **Last one standing** wins. **The round limit
  ends** → richest wins. Ties: more cities, then earlier seat. An Unlimited
  setting simply never fires (both Unlimited: round 200 is the limit).
- **Standings**: still in, by net worth (`"3,640 net worth"`), then bankrupt,
  latest first (`"Bankrupt · round 24"`), then quitters (`"Walked away"`).
- **Closing the tab**: the CPU plays the seat, empire intact (ADR-0004).
  **Quitting**: out; cities and buildings return to the bank.

### Clocks

| Clock | Length | When it runs out |
|---|---|---|
| **Match setup** | 30 s, every human at once | The picks made so far decide it; none → the standard match |
| **Your move** | 30 s per move; **60 s** in the manage step | Roll → rolled for you · Buy question → the CPU buy rule · Manage → **End turn** |
| **Trade answer** | 20 s | Declined |
| **Auction** | 12 s, +6 s per bid, 40 s max | It closes; highest bid wins |

Every deadline is judged on the server's clock. A human who times out is never
made to build, sell, trade or bid — only to end the turn.

### CPU players

| Situation | The CPU… |
|---|---|
| Match setup | Never picks — plays by the humans' choice |
| Its turn to roll | Rolls |
| A Buy question | Buys if it keeps **150**, or if the city completes an empire it can afford |
| An auction | Proxy-bids up to its **ceiling**: the price, ×1.5 if the city completes an empire for it, ×1.2 if it gives it two of three — never leaving itself under **50** |
| Manage: build | While it keeps 150: builds on its whole empires, least-built city first (ties: dearest), at most **3** builds a turn |
| Manage: trade | Every **other round** (seats alternate), at most one offer: if it holds two cities of an unbuilt empire and a rival holds the third, it first looks for a **swap** that completes an empire for both of them (topping up any price difference in coins); failing that, it offers **2.5×** the city's price in coins. Only if it keeps its reserve |
| Answering a trade | If the trade completes an empire **for it**, accepts when it gets at least **0.8×** what it gives. Otherwise accepts when it gets at least **1.2×** what it gives — and at least **2.5×** the city's price if the trade hands the proposer a whole empire |
| Sell | Never, unless forced |
| End turn | When it has nothing left to do |

The CPU numbers are part of the calibration: with an offer below the
2.5× premium, CPUs never traded and far fewer empires formed.

### What each player can see

**Everything is public**, as in v2 — coins, net worth, cities, buildings,
positions, the treasury, every bid and every trade offer. Nothing is stored
that a client mustn't see; randomness comes from `ctx.random` inside each
move. The view's `you` block (your seat, and what you can do now) is the only
per-seat part.

## Formulas

All values in `lib/game/data/empire-wars.ts`. Every price is a multiple of 20,
so with the published rates every formula yields whole coins.

| Formula | Value |
|---|---|
| Base tribute | `price × BASE_TRIBUTE_RATE` (0.10) → 10 … 38 |
| Whole-empire tribute, no buildings | `base × 2` |
| Tribute with buildings | `base × BUILT_MULT[level]`, `BUILT_MULT` = 5 / 15 / 40 / 55 (houses) / 75 (monument) |
| Build cost, each level | `price × BUILD_COST_RATE` (0.5) → 50 … 190 |
| City value | `price + level × buildCost` |
| Sale: a building | `buildCost × SALE_RATE` (0.5) |
| Sale: a city | `price × SALE_RATE` (0.5) |
| Target net worth | Picked at setup: 3,000 / 5,000 / 10,000 / none — standard 5,000 |
| Round limit | Picked at setup: 30 / 50 / 100 / none — standard 50; none with no target either → 200 |

### Measured match shape

Seeded all-CPU matches through the real engine
(`lib/game/empire-wars/simulate.ts`), measured 2026-09-11 once match setup
replaced the old seat-scaled target (3,200–5,000 with a fixed 30 rounds).

**The standard match** — 5,000 net worth · 50 rounds, what the picker starts
on and what plays when nobody picks — over 5,000 matches per table size:

| Seats | Ends on target | Ends on rounds | Last one standing | Median last round | 90% over by round | Whole empires at the end | A monument built | Anyone bankrupt | Bankrupt before round 12 | Round-10 leader wins | Trades accepted |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2 | 60% | 32% | 8% | 46 | 50 | 3.87 | 30% | 8% | 0% | 52% | 1.8 |
| 3 | 91% | 4% | 6% | 34 | 45 | 2.39 | 83% | 59% | 0.1% | 36% | 2.3 |
| 4 | 99% | 1% | 0.4% | 28 | 38 | 2.28 | 91% | 58% | 0.2% | 29% | 2.6 |
| 5 | 98% | 2% | 0% | 25 | 36 | 2.06 | 87% | 44% | 0.6% | 27% | 2.4 |
| 6 | 95% | 5% | 0% | 23 | 35 | 1.80 | 81% | 34% | 0.6% | 27% | 2.1 |

No CPU proposed a rejected move, the longest CPU turn was 7 moves, and every
match finished.

**Every setting** at 4 seats, 300 matches each — how most matches end, and the
median last round (the other sizes follow the same pattern: shorter at 5–6
seats, longer at 2):

| Assets \ Rounds | 30 | 50 | 100 | Unlimited |
|---|---|---|---|---|
| **3K** | target 98% · 21 | target 100% · 21 | target 100% · 21 | target 100% · 21 |
| **5K** | target 59%, rounds 40% · 29 | target 99% · 29 | target 99% · 29 | target 99% · 29 |
| **10K** | rounds 89% · 30 | last standing 69% · 43 | last standing 82% · 43 | last standing 82% · 43 |
| **Unlimited** | rounds 89% · 30 | last standing 73% · 43 | last standing 99.7% · 43 | last standing 99.7% · 43 |

What it means:

- **3K is a sprint**: over by round ~21 whatever the round limit, bankruptcy
  rare (6%), a monument in a third of matches.
- **5K is the full game**: two whole empires, a monument in 91% of matches,
  and someone knocked out in about half. Hence the standard match.
- **10K and Unlimited are wars of attrition**: someone goes bankrupt in almost
  every match (97–100%) and most end with one empire left — median round 43
  at 4 seats, 90% over by round ~60, past 100 at 6 seats.
- **A 30-round limit with a high target** is a "richest after 30 rounds" match.
- **Unlimited · Unlimited needed a safety net**: before round 200 ended it,
  1 in 300 matches at 4 seats, 2% at 5 and 5% at 6 never finished — nobody
  could be knocked out, and paydays kept everyone afloat (one ran past 26,000
  rounds).
- **2 seats run long on the standard match** (median round 46): two players
  pass tribute back and forth. 3K is the better two-player pick.
- **The early leader is beatable** at 3+ seats (27–36%); at 2 seats about
  half the time.
- **Limits of the model**: every seat is a CPU, so every auction settles the
  instant it opens, nobody puts a city up from the Market, and nobody picks.
  Live auctions, human trades and the toss are for the playtest.

The bands the test suite holds (`tests/empire-wars-sim.test.ts`), on the
standard match at 4 seats over 1,000 matches:

| Metric | Band |
|---|---|
| Matches ending on the target | ≥ 90% |
| Median last round | 25–31 |
| Whole empires per match | ≥ 1.8 |
| Matches where a monument is built | ≥ 80% |
| Trades accepted per match | > 1.5 |
| Bankruptcy before round 12 | ≤ 2% |
| Round-10 leader wins | ≤ 45% |
| Longest CPU turn | ≤ 7 moves |

2 and 6 seats must end on target within ±10 points of the table above (60%,
95%), and every one of the 16 settings must play 20 matches at 4 seats to a
winner inside its own limits.

## Edge Cases

### Match setup

- **Everyone agreed**: no toss; the feed says *"Everyone agreed: …"*.
- **One human**: their pick is the match the moment they lock in.
- **Nobody picks in 30 s**: the standard match.
- **Some picked, some didn't**: the toss is among those who picked; the rest
  get no say.
- **A pick changed**: the latest one counts, until the settings are decided.
- **A human leaves the lobby mid-setup**: they're no longer waited for; if
  everyone else has picked it's decided on the next move, or at the clock.
- **A human quits mid-setup**: their pick is dropped; if everyone left has
  picked it's decided on the spot; if only one player is left, they win. If
  seat 1 quit, the first turn goes to the next seat still in.
- **A CPU picks**: it never does; the rules refuse it anyway.
- **A setting that isn't on offer** (4,000; 45 rounds): refused at the move
  schema.
- **A spectator**: sees the choices, the picks and the clock; can't pick.
- **Unlimited · Unlimited and nobody can be knocked out**: round 200 ends it;
  the richest wins.

### Auctions

- **Nobody bids**: a bank city stays free; a player's city stays theirs.
- **The high bidder can't pay at the close**: can't happen — nothing else moves
  while an auction is open, and a bid is checked against the bidder's coins
  when it's made. The server re-checks at the close anyway, and cancels the
  sale if it fails.
- **A bidder can't afford the next step**: they can't bid; nothing else
  happens.
- **Two CPUs with the same ceiling**: the earlier seat after the current player
  wins, at that ceiling.
- **The countdown**: never more than 40 s from the opening, however many bids.
- **Everyone left is a CPU**: settles instantly.

### Trades

- **An offer is stale when answered** (a city or coins no longer where they
  were): impossible — nothing else moves while an offer is open — but the
  server re-checks anyway and declines if anything changed.
- **The recipient quits or goes bankrupt while an offer is open**: the offer
  is declined.
- **A 2-for-1 that completes empires on both sides**: allowed; CPUs judge it
  by the rule above.
- **Trading with yourself, or an empty offer**: rejected.

### Building and selling

- **Building a monument when the empire already has one**: rejected.
- **Selling a city from an empire with buildings**: rejected — sell buildings
  first.
- **Losing a city of a built empire** can't happen by choice (the rule above);
  by force, the bank sells buildings before cities, so an empire is always
  stripped before it's broken up.
- **A forced sale of a monument** drops it to 4 houses; it can be rebuilt.

### Everything else

As v2: Silk Road pays once per pass; Treason!/Banished! never pass the Silk
Road; a jailed turn counts; tribute is paid to a jailed owner; a stale answer
(it names the tile or offer it was for) is rejected; a v1, v2 or pre-setup v3
match running at deploy fails `parseState` (ruleset 4) and is retired.

## Dependencies

| Depends on | Nature | Interface |
|---|---|---|
| Lobby, catalog, both registries | Hard | Unchanged |
| **ADR-0005 + Amendment 1** | Hard | `ctx.random`, `ctx.now`, `turnExpired` |
| **ADR-0005 Amendment 2 (new)** | Hard | `MoveContext.humans?: readonly string[]` — the seats a connected human holds at this transition, **passed to `deal` too**. Absent means every seat is a CPU (simulation and tests). Used for CPU proxy bids, to keep timed-out humans from being played as CPUs, and to open a match with humans on setup. Game-agnostic; Nuno ignores it |
| `persistGameState` / `Standing[]` | Hard | Unchanged |
| Per-seat colour | Hard | Done |
| Art | Soft | Inline SVG monument silhouettes and Remix-icon pieces today. Cover and logo already replaced with empire art; monument art is arriving and not wired in yet (`design/empire-wars-art-manifest.md`) |

## Tuning Knobs

| Knob | Default | Raise it and… | Lower it and… |
|---|---|---|---|
| `BASE_TRIBUTE_RATE` | 0.10 | Early game bites; paydays matter less | Nothing happens until someone builds |
| `BUILT_MULT` | 5/15/40/55/75 | Monuments end matches — and players | Building isn't worth the coins |
| `BUILD_COST_RATE` | 0.5 | Building is rare | Everything is built by mid-game |
| `SALE_RATE` | 0.5 | Selling is painless | One big tribute wipes a player out |
| `SETUP.targets` (Assets) | 3,000 / 5,000 / 10,000 / none | A higher top option: longer wars, more knockouts | A lower bottom option: matches end before anyone builds |
| `SETUP.rounds` | 30 / 50 / 100 / none | Longer tails | More matches end on the clock |
| `SETUP.defaults` | 5,000 · 50 | Change only with a new calibration run — the standard match is what the bands test | — |
| `SETUP.windowMs` | 30,000 | The table waits on AFK pickers | Players can't read the choices in time |
| `SETUP.safetyRounds` | 200 | Stalemates run longer before they're called | Unlimited stops feeling unlimited |
| Auction clocks | 12 / +6 / 40 s | Auctions drag | Humans can't react to a CPU bid |
| `TURN_WINDOW_MS` | 30,000 | Tables stall on AFK players | Rolls and Buy answers get timed out |
| `MANAGE_WINDOW_MS` | 60,000 | Tables stall on AFK players | A turn ends while you're building a trade (30 s did, live) |
| `TRADE_WINDOW_MS` | 20,000 | Tables stall on AFK players | Real players get timed out |
| `TRADE_OFFERS_PER_TURN` | 2 | Offer spam | Hard to find a deal |
| CPU trade offer / accept / premium | 2.5× every 2 rounds / 1.2× / 2.5× | Empires form too easily | Empires never form (an offer below the premium is never accepted) |

## Acceptance Criteria

### Board, setup, turn

- [ ] 32 tiles: 24 cities in 8 empires of 3 at the documented tiles and prices; specials at 0/4/8/12/16/20/24/28. *(unit)*
- [ ] Every seat starts with 1,500 coins on tile 0; a table with humans opens on setup, a table of CPUs plays the standard match. *(unit)*
- [ ] A turn is: roll → at most one landing question → manage → End turn; the landing question is the only mandatory answer. *(unit — **blocking**)*

### Match setup — **blocking**

- [ ] Only humans pick, only from the options on offer; a later pick replaces an earlier one. *(unit)*
- [ ] The last human's pick decides it at once: agreed → no toss; disagreeing → a toss among the pickers through `ctx.random`, each equally likely, and the winner's Assets and Rounds both apply. *(unit)*
- [ ] At the 30 s clock (server clock) the picks so far decide it; no picks → the standard match; closing early is refused. *(unit)*
- [ ] Nothing but picking is possible until the settings are decided; then the first seat still in rolls with a fresh 30 s. *(unit)*
- [ ] A quit mid-setup drops that pick and can decide it; a human who left the lobby isn't waited for. *(unit)*
- [ ] No target → no net worth wins; no round limit → play goes on past round 100; neither → round 200 ends it, richest winning. *(unit)*
- [ ] Every one of the 16 settings plays 20 CPU matches at 4 seats to a winner inside its limits. *(simulation)*

### Auctions — **blocking**

- [ ] Passing on, or being unable to afford, a free city opens an auction; buying doesn't. *(unit)*
- [ ] Bids must beat the high bid by at least one step, fit the bidder's coins, and never come from the seller or the current leader. *(unit)*
- [ ] Each bid tops the countdown up to 6 s, never past 40 s from opening. *(unit)*
- [ ] With humans in `ctx.humans`, CPUs answer a human bid with the minimum lead up to their ceiling, in the same move; with two CPUs, the higher ceiling wins at the lower ceiling + one step. *(unit)*
- [ ] With no humans taking part, the auction settles the moment it opens. *(unit)*
- [ ] Closing before the deadline (server clock) is rejected; after it, the winner pays the seller or bank and takes the city. *(unit)*

### Tribute and building

- [ ] Tribute for every city × holding (partial/whole) × level 0–5 matches the Formulas table. *(unit, table-driven)*
- [ ] Building requires the whole empire; each level costs half the price; the monument needs 4 houses and is one per empire. *(unit)*
- [ ] Selling a building refunds half its cost; selling a city is refused while its empire has buildings, and refunds half the price otherwise. *(unit)*

### Market

- [ ] A trade moves exactly the named cities and coins on Accept; nothing on Decline or timeout. *(unit)*
- [ ] Cities from built empires, coins beyond a side's holding, empty offers and self-trades are rejected; a third offer in one turn is rejected. *(unit)*
- [ ] Only the recipient may answer; the table can't move while an offer is open. *(unit — **blocking**)*
- [ ] A Market auction of your own city pays you the winning bid. *(unit)*

### Money, cards, winning

- [ ] Forced sales sell buildings first (most-built city), then cities cheapest first, at half value, stopping when covered; then bankruptcy as v2. *(unit)*
- [ ] Every Bonanza and Royal Decree card has a table-driven test; adding a card without one fails. *(unit — **blocking**)*
- [ ] Winning, standings and quitting behave as v2. *(unit)*

### CPUs and clocks

- [ ] A timed-out human (in `ctx.humans`) is never made to build, sell, trade or bid — in manage, the fallback is End turn. *(unit — **blocking**)*
- [ ] CPUs never propose a move the rules reject; 6 CPUs from a fixed seed reach a winner within the standard 50 rounds. *(simulation — **blocking**)*

### Calibration

- [ ] The Measured match shape bands hold over 1,000 seeded standard matches at 4 seats. *(simulation — **blocking**)*

### Platform

- [ ] The contract test passes; a v2 or pre-setup v3 state fails `parseState`; the state stays under 12 KB with a bounded event feed. *(unit — **blocking**)*

### Teachability

- [ ] A first-time player who reads only the How to play card can say how to win, what tribute is and how to build, after two rounds. *(playtest — 4 of 5)*

## UI Requirements

As v2 (the ring as big as the screen allows, players around the centre, you
bottom-left, one primary action, money flights, the How to play card), plus:

| Moment | UI |
|---|---|
| **Match setup** | A dialog over the board: *Assets* 3K · 5K · 10K · Unlimited and *Rounds* 30 · 50 · 100 · Unlimited as chips (the standard match preselected), the match in one line ("First to 5,000 net worth · 50 rounds"), **Lock in**, the 30 s clock, and every human's pick or "choosing…". CPUs: "play by the table's choice" |
| **The toss** | Shown to everyone who watched setup: the pickers and their picks, a highlight that runs down them and stops on the winner, then the match in one line. With nothing to toss, just the line — "Your rules", "Everyone agreed", "Standard match". Holds ~2.6 s or until *Let's play*; CPUs wait for it; a reload never replays it |
| **Header** | "5,000 net worth to win · 38 rounds left"; no target → "Richest at the end wins"; no limit → "Round 12"; neither → "Last empire standing wins · Round 12". No target → no progress bars on the player panels |
| **Your manage step** | **End turn** is the primary; **Market** sits beside it. Tapping one of your cities opens its card with *Build a house — 150*, *Raise the Eiffel Tower — 150*, *Sell a house — 75*, *Sell city — 150* as they apply |
| **Tiles** | Empire band, the city's painted icon (name over its top-left once the board is wide enough), the tribute tag, and up to 4 of the empire's own houses — or its monument |
| **Auction** | A panel in the centre for everyone: the city, the high bid and bidder, the countdown, and **+10 / +50 / +100** for anyone who can bid |
| **Trade** | The Market's trade builder: pick a rival, tick cities on both sides, set coins either way, *Send offer*. The recipient gets a card: *"Croupier offers Pompeii + 150 coins for your Paris — Accept / Decline"* with its countdown |
| **Coins** | A coin icon beside every amount; plain text says "coins" |
| **Motion** | The dice tumble onto the medallion; pieces hop tile to tile; money flies payer → owner. A **ring in the owner's colour** leaves a city when someone lands on it, buys it or wins it, timed to the piece's arrival. Raising a monument is the table's **one orchestrated moment**: the monument rises onto its tile with a brass glint, and a card — "The Eiffel Tower rises · You built it in Paris" — arrives, holds ~2 s, and leaves, never taking a click. Only events after the viewer arrived animate (a reload replays nothing). Tiles brighten on hover rather than move. Reduced motion: no pulse, no rise; the card only fades |

Art (`design/empire-wars-art-manifest.md`): every city, crest, house and
monument is a painted miniature; the six pieces are a crown, galleon, cannon,
trebuchet, balloon and lamp, each standing on a chip of its seat's colour.
Where a painting is still missing, the game draws a stand-in — a faded crest
for a city, a gold house glyph, the monument's SVG silhouette — so no gap in
the art ever blocks play.

## Open Questions

| Question | Resolve by |
|---|---|
| Does v3 still pass the teachability test v2 was built for? | First playtest |
| Do CPU trades form empires often enough, without handing out monopolies? | Calibration, then playtest |
| Is 15 minutes at 4 seats still the right length? | Calibration + playtest |
| Is 5K · 50 the right standard match — and should a 2-player table start on 3K? | Playtest |
| Is round 200 the right safety net for Unlimited · Unlimited? | Playtest |
| Does the toss read as fair when three or more people pick differently? | Playtest |
| Should monuments be one per city instead of one per empire? | Playtest |
