# Empire Wars — Core Game

> **Status**: In Design — revised after design review (2026-08-04)
> **Last Updated**: 2026-08-04
> **Scope**: v1 core (see Open Questions for what is deliberately deferred to v2)
> **Governing ADRs**: ADR-0004 (lobby as group, games as catalog),
> ADR-0005 (game module interface)
>
> **Revision 2 (2026-08-04)** — post-review scope cut and structural fixes.
> Cut from v1: **sealed-bid auctions**, **all six boss actives**, **city
> events**. Missions trimmed to 10. Fixed: Heat now costs a clean player
> something (asset seizure), the Gun die face is defined (**strike**),
> adjacency is an abstract graph rather than the ring's geometry, Respect
> floors at 0, the bailout is capped, and the bribe ladder is re-priced.
> The cuts remove the entire **off-turn decision class** — every pending
> decision now has exactly one named answerer, which keeps ADR-0005's
> "one seat on the clock" assumption intact.

## Overview

Empire Wars is Chipae's second game: a prohibition-era crime-empire board game
for 2–6 seats (humans, friends, public walk-ins, or CPU bots). Players roll
around a 32-tile city buying territories, recruiting crew, and collecting
protection money from rivals who land on their turf — but a visitor may always
refuse to pay and fight instead, so income is contested rather than automatic.
Three currencies pull against each other: **Cash** buys, **Dirty Money** earns
more but draws police Heat every round it is held, and **Respect** unlocks
abilities and settles the final score. Heat rises with wealth as well as with
crime, so the biggest empire is always the one the police find most
interesting. A match runs **20 rounds** and ends on the highest Empire Value —
unless someone first becomes **Kingpin** by holding four complete districts,
30 Respect, and Heat below 6. Nobody is ever eliminated: a player who runs out
of money loses their best territory and some Respect, then keeps playing. The
server is the sole authority — a client sees the public board, its own money,
crew and secret missions, and never anyone else's.

## Player Fantasy

You are a boss in a hat, and so is everyone else at the table.

The fantasy is the standoff. A rival's car pulls up on your corner, your crew
steps out of the doorway, and they have to decide: pay, or find out. Most of
the time they pay — and you both remember it. Sometimes they don't, and the
dice settle it in front of everybody. That exchange happens a dozen times a
match and it is the reason this is not Monopoly: money changes hands because
someone *decided* to let it, not because a rule said so.

Around that sits the satisfaction of a district clicking shut and becoming
yours, the slow itch of dirty money you can't put down, and the very specific
pleasure of watching the police walk straight past you toward whoever is
winning. Threats are theatrical, not menacing — this is friends doing accents,
not a crime simulator. A betrayal should be funny for about ten seconds and
expensive for the rest of the game.

And nobody gets knocked out and sent to watch. You can be broke, disrespected,
and down to one liquor store on Round 14 and still be playing a real game —
because the player in front is carrying more Heat than you are, and the city is
about to notice.

**Reference points**: *The Godfather*'s business-not-personal politeness over
real menace; the moment in a good game of Diplomacy where everyone is smiling.
Deliberately **not** GTA-style violence-as-spectacle — `design/art-direction.md`
fixes the platform voice as "game-night host, not esports announcer," and the
game's own art is glossy and gold-lit rather than bleak.

## Detailed Rules

### Seats and setup

2–6 seats. Every seat starts identically except its boss:

| | Starting value |
|---|---|
| Cash | $1,500 |
| Dirty Money | $0 |
| Respect | 3 |
| Heat | 0 |
| Crew | 2 (unassigned) |
| Territories | none |
| Boss | 1, chosen during setup — no two seats share one |
| Secret missions | 3, dealt face-down |
| Token | on The Docks (tile 0) |

Turn order is seat order. A **round** is one turn for every seat still in the
match. The match runs **20 rounds** (`ROUND_LIMIT`).

> **Deferred to v2**: vehicles and weapons as a separate item economy. In v1
> combat strength comes from crew and property level, and per-player
> differentiation comes from bosses.

### The board — 32 tiles

Four sides of eight, corners at 0/8/16/24. **24 territories** in **8 districts**
of 3, plus **8 special tiles**.

| Tile | | Tile | |
|---|---|---|---|
| 0 | **The Docks** *(start)* | 16 | **The Safehouse** *(corner)* |
| 1–3 | Old Town | 17–19 | Downtown |
| 4 | Police Checkpoint | 20 | City Hall |
| 5–7 | Little Havana | 21–23 | Nightclub District |
| 8 | **County Jail** *(corner)* | 24 | **The Airport** *(corner)* |
| 9–11 | The Harbor | 25–27 | Casino Strip |
| 12 | The Speakeasy | 28 | Police Checkpoint |
| 13–15 | Industrial | 29–31 | Financial District |

Districts run cheap-to-expensive clockwise from the Docks. Each territory is
one of three tiers — **small** (12), **illegal** (8), **landmark** (4):

| District | Territories (tier) |
|---|---|
| Old Town | Pawn Shop *(s)*, Barber Shop *(s)*, Tattoo Parlour *(s)* |
| Little Havana | Cigar Lounge *(s)*, Car Wash *(s)*, Liquor Store *(i)* |
| The Harbor | Fish Market *(s)*, Boat Yard *(i)*, **Shipping Port** *(L)* |
| Industrial | Garage *(s)*, Factory *(s)*, Chop Shop *(i)* |
| Downtown | Coffee House *(s)*, Drug Lab *(i)*, Money Laundry *(i)* |
| Nightclub District | Jazz Cellar *(s)*, Gin Joint *(i)*, **The Onyx Room** *(L)* |
| Casino Strip | Poker Room *(i)*, Racetrack *(i)*, **The Golden Chip** *(L)* |
| Financial District | Accounting Office *(s)*, Bail Bonds *(s)*, **First City Bank** *(L)* |

Special tiles:

| Tile | Effect |
|---|---|
| **The Docks** (0) | Passing or landing collects your round income. |
| **County Jail** (8) | Visiting is harmless; being *sent* here locks you in. |
| **The Safehouse** (16) | Launder Dirty Money at the best rate on the board; clears 1 Heat. |
| **The Airport** (24) | Pay a fee to move your token to any tile, then resolve it. |
| **Police Checkpoint** (4, 28) | Heat check. At Heat ≥ 6 you are searched. |
| **The Speakeasy** (12) | Draw an event card. |
| **City Hall** (20) | Buy Respect with Cash, or attempt a bribe to clear Heat. |

### Turn structure

1. **Upkeep** — Dirty Money accrues Heat; jail timer ticks; expired pending
   decisions resolve to their defaults.
2. **Roll** — 2d6 plus the action die, all revealed together.
3. **Move** — clockwise by the 2d6 total. If the action die showed **Car**, you
   may add 1–3 tiles before moving.
4. **Resolve the tile** — buy, pay-or-fight, or a special tile effect.
5. **Use the action die** — Gun and Handshake are offers you may decline; Money
   Bag, Police and Question apply automatically.
6. **Build** — upgrade territories you own and recruit crew, in any order you
   can afford. A turf war may be declared here.
7. **End turn.**

> Bosses have **passives only** in v1 — they are always on and need no step.
> Actives were cut: two of the six (cancel an attack, force a reroll) were
> reactive interrupts on *another* player's turn, which needs a second
> concurrent pending decision that ADR-0005's one-seat-on-the-clock model
> cannot express. "Bosses are how you're built, not a button."

**Doubles**: rolling doubles takes another full turn after this one. Three
doubles in a row instead sends you straight to County Jail — you got sloppy.

### The dice

Every roll is **2d6 + 1 action die**. Five of the action die's six faces are
things you *may* do rather than must:

| Face | Effect |
|---|---|
| **Money Bag** | Collect a cash windfall. *Automatic.* |
| **Police** | +1 Heat. *Automatic.* |
| **Question** | Draw an event card. *Automatic.* |
| **Car** | You **may** add 1–3 tiles to this move. |
| **Gun** | You **may** declare a **strike** (below) on one rival within 6 tiles of your token, or who owns a territory adjacent to one of yours. |
| **Handshake** | You **may** offer a truce to one player. They answer within the pending window; no answer means declined. |

### The strike

The Gun face's attack. A strike is **crew against crew** — it hits a *player*,
not a tile, and no territory ever changes hands.

- **Attacker** fights with their pool crew. **Defender** fights with theirs.
- Same resolution as every other fight: roll d6 equal to strength, keep the
  best two, sum. Minimum one die. **Ties go to the defender.**
- The defender has no decision — a strike is not a pending decision and never
  blocks the table.

| Outcome | Effect |
|---|---|
| Attacker wins | Defender loses 1 pool crew. Attacker **+1 Respect** |
| Attacker loses | Attacker loses 1 pool crew |

Either way the attacker gains **+1 Heat**. Shooting at people is noticed.

A strike is the cheap, frequent aggression that keeps a garrison-heavy player
honest: it ignores adjacency, so there is nowhere on the board that is safe
from it, and it only ever costs crew. Turf war moves land; the strike moves
*pressure*.

Gun and Handshake being optional is load-bearing. A compelled attack every
sixth turn makes combat a tax rather than a decision, and a compelled trade
blocks the table on a player who may have closed their tab. Serverless has no
server clock (ADR-0005), so **no rule may require another human to respond**.

### The three currencies

| | Earned by | Spent on | Notes |
|---|---|---|---|
| **Cash** | Territory income, Money Bag, laundering | Territories, upgrades, crew, protection fees | The only currency that buys land |
| **Dirty Money** | The greedy option on illegal/landmark income, some events | Bribes, crew (discounted), Level 4–5 upgrades | **Cannot** buy territories or pay protection. Generates Heat every upkeep. Confiscated entirely in a raid. Counts at a reduced rate toward Empire Value |
| **Respect** | Winning fights, completing missions, completing districts | Recruiting enforcers | Also a scoring component — spending it costs points, which is the point |

**Heat** (0–10) is a meter, not a currency.

### Income

Territory income is collected **every round, at upkeep**. The **Docks stipend**
($200) still only pays when you pass or land on The Docks — that beat stays
lap-based. Protection money arrives continuously as rivals land on you.

> **Changed (2026-08-04) — measured, not assumed.** Income was originally
> lap-only, ~4.3 collections per match. Simulation over 60 seeded matches
> showed that breaks three things at once:
>
> 1. **Every upgrade in the game was economically irrational.** Payback periods
>    ran **5.4–27.8 laps** against a match containing ~4.3, and every upgrade
>    was EV-negative on purchase (−$45 to −$475). A player who bought tiles and
>    never upgraded strictly beat one who did — so the entire five-level
>    property system, Fortress and all, was dead weight.
> 2. **Empire Value came in at ~$3.4k**, against this document's stated
>    $10–14k target.
> 3. **The Most Wanted brake could never fire.** The leader averaged only
>    ~1.16× the table mean, below the 1.25× threshold, so the wealth clause
>    never triggered no matter what the consequence rules said.
>
> Collecting territory income every round gives 20 collections instead of 4.3.
> Measured over 40 seeds afterwards: leader Empire Value **$10,714** (inside
> the target band), leader-to-mean ratio **1.35×** (above the threshold),
> leader reaches the Raids band in **68%** of matches, and territory seizure
> actually fires. One change, five problems.
>
> Knob: `EMPIRE_WARS_CONFIG.incomeEveryRound` — set `false` to reproduce the
> lap-only economy. `tests/empire-wars-economy.test.ts` asserts the outcomes.
>
> **Both Heat fixes were required.** Suppressing the clean shed fixed the
> arithmetic; the income cadence created enough spread for the threshold to be
> crossed at all. Either alone leaves the leader untouched.

At collection, each **illegal** or **landmark** territory offers a choice: take
its income in Cash, or take a larger sum as Dirty Money. **Small** territories
always pay Cash. The choice is made per territory, every collection.

### Buying territories

Land on an unowned territory and you may buy it at list price, in Cash. If you
decline — or cannot afford it — the territory **stays unowned and its price
drops 10%, permanently and cumulatively** (floored at 50% of list). Anyone who
lands on it later, including you, may buy it at the reduced price.

There is no auction. Declining is not free: you have made the tile cheaper for
whoever lands on it next, and expensive districts get marked down until someone
can afford them, which is what keeps the board from stalling half-bought.

> **Cut from v1 (2026-08-04): sealed-bid auctions.** They were the game's only
> **all-seats off-turn decision** — every other pending decision has exactly
> one named answerer. Removing them means the platform never has to ask "which
> seats owe an answer?", so ADR-0005 needs no `pendingDecisionSeats` amendment,
> the bot needs no bidding heuristic, `viewFor` never has to hide a live bid
> from other seats, and there is no minimum-bid collusion hole. The mark-down
> keeps the pressure ("if I pass on this, someone gets it cheap") without the
> machinery. Revisit in v2 if playtests show the board sitting unsold.

### Crew

Recruited during Build, for Cash or for Dirty Money at a discount. Crew arrive
in your **pool**.

- **Pool crew** are your raiding party. They attack, and they are what you
  fight with when you refuse to pay.
- **Garrisoned crew** are assigned to a territory you own. They raise its level
  and defend *that tile only*.

A crew member is in one place or the other, never both. A player who garrisons
everything has nothing to attack with; a player who keeps everyone mobile owns
a lot of undefended corners.

**Enforcers** cost Cash plus 2 Respect and count as two crew in combat, but
cannot be garrisoned.

### Property levels

Levels are sequential — no skipping.

| Level | Name | To reach it | Effect |
|---|---|---|---|
| 1 | Owned | Buy the territory | Base income |
| 2 | Crew | Garrison 1 crew | +income, +1 defence |
| 3 | Business | Pay the upgrade cost | +income |
| 4 | Empire | Pay the upgrade cost — Dirty Money accepted | +income, +1 defence |
| 5 | Fortress | Pay the upgrade cost + garrison a 2nd crew | Max income, +2 defence |

### Protection money and the standoff

Land on a rival's territory and they demand a protection fee. You choose:

- **Pay** — hand over the fee in Cash. Turn continues.
- **Refuse** — a fight starts immediately.

This is a **pending decision** with a 20-second window and a default of
**Pay**. With an active truce, no fee is demanded at all.

Fight resolution:

- **Attacker** (the visitor) fights with their pool crew.
- **Defender** (the owner) fights with that territory's garrison plus its level
  defence bonus. The owner's pool crew are elsewhere and do not help.
- Each side rolls d6 equal to its strength, **keeps the best two**, and sums.
  Minimum one die per side. **Ties go to the defender.**

| Outcome | Effect |
|---|---|
| Visitor wins | Pays nothing. **+1 Respect**; owner **−1 Respect** |
| Visitor loses | Pays **double** the fee and loses 1 pool crew |

Refusing never transfers the territory. Land changes hands only through a
declared turf war, so the standoff can happen a dozen times a match without
making ownership meaningless.

### Turf war

Declared during Build, at most once per turn, against a territory **adjacent**
to one you own. Same combat resolution, higher stakes:

| Outcome | Effect |
|---|---|
| Attacker wins | **Takes the territory** at its current level; its garrison is destroyed. **+2 Respect**, defender **−1** |
| Attacker loses | Loses 1 pool crew, **−1 Respect** |

Either way the attacker gains **+2 Heat**. A turf war is loud.

### Heat

Heat runs 0–10 and rises from what you do *and* from how well you are doing.

| Gains Heat | |
|---|---|
| Action die shows **Police** | +1 |
| Holding Dirty Money at upkeep | +1 per `DIRTY_HEAT_STEP` held |
| Declaring a turf war | +2 |
| Refusing to pay protection | +1, win or lose |
| Failed bribe | +2 |
| **Empire Value above 1.25× the table average**, end of round | +1 |

| Sheds Heat | |
|---|---|
| Landing on The Safehouse | −1 |
| Successful bribe at City Hall | −3 |
| Holding zero Dirty Money at upkeep — **only while not Most Wanted** | −1 |
| Leaving County Jail | Heat set to **2** |

The wealth clause is the anti-runaway-leader mechanic, and it is relative on
purpose: 1.25× the *table average* self-tunes across 2–6 players and across
early and late game, so it never needs retuning per lobby size. It surfaces in
the UI as **Most Wanted**. Shedding Heat for holding no Dirty Money is what
makes "go clean for a while" a real strategy rather than a fantasy — but it is
suppressed for the leader, or the two cancel and neither works.

> **Fixed (2026-08-04) — the brake did not engage.** As previously written,
> Most Wanted (+1/round) and the clean-upkeep shed (−1/round) cancelled
> **exactly**. A rich player holding no Dirty Money netted only the Police die
> face, ≈ +0.17 Heat/round: about 3.3 Heat across a full 20-round match. They
> reached **Watched** near round 18 and **never reached Raids at all**, so the
> raid never rolled and the territory-seizure clause below — the rule this
> document calls load-bearing — could never execute. The revision that added
> seizure fixed what happens *after* a raid without changing what causes one.
>
> Suppressing the shed while Most Wanted separates the two mechanics: the
> leader climbs +1/round and reaches Raids around round 6 and Federal around
> round 9, while a clean player who is *not* leading still sheds and is still
> rewarded for going straight. Knob:
> `HEAT.cleanShedAppliesToMostWanted` in `lib/game/data/empire-wars.ts` —
> set it `true` to reproduce the broken behaviour in simulation.

### Heat bands

| Heat | Band | Effect |
|---|---|---|
| 0–2 | **Clean** | Nothing |
| 3–5 | **Watched** | Illegal territories pay 25% less; checkpoints search you |
| 6–8 | **Raids** | At upkeep, roll d6 — on 5–6 you are raided |
| 9–10 | **Federal** | Raided at upkeep on 3–6; may not take income as Dirty Money at all; a raid also sends you to County Jail |

A **raid confiscates all Dirty Money**. If the raided player holds **no Dirty
Money**, the raid **seizes their lowest-level territory instead** — it returns
to unowned at Level 1, its garrison disbanded. Nothing else is ever taken.

**This clause is what makes Heat mean anything to a clean player**, and it is
load-bearing. Without it every Heat consequence in the game is Dirty-Money-
shaped — raids, checkpoints and the Federal income ban all confiscate or block
Dirty Money — so a player who simply never touches it would be immune to the
police no matter how high their Heat climbs. Seizure is only half the fix: it
gives Heat teeth against a clean player, but the leader has to actually *reach*
the Raids band for it to bite, which is what suppressing the clean shed while
Most Wanted (above) achieves. Neither change works without the other. The
Overview promises the biggest empire
is the one the police find most interesting; seizure is the rule that keeps
that promise. It takes the *lowest*-level tile, not the best, so it is a
steady bleed on a sprawling empire rather than a single catastrophic swing.

**Police Checkpoints** (tiles 4, 28) resolve on landing: Clean passes freely;
Watched loses half your Dirty Money (rounded down); Raids or Federal loses all
of it, and at Federal you are jailed too. A checkpoint **never** seizes
territory — only an upkeep raid does.

### County Jail

You are sent to jail by three consecutive doubles, by a raid while Federal, or
by certain events.

While inside:

- You do not roll or move, and you do not collect Docks income.
- You **do** still collect protection money — your crew are still working.
- Each turn inside you may recruit **one inmate crew at half price**.

You get out by paying **$200 bail** (`BAIL_COST`), by rolling doubles on a bail
attempt, or automatically after **3 turns**. On release your Heat is set to
**2** and your token sits on the jail tile, just visiting. A doubles roll in
jail is a bail attempt, not a movement roll, and **does not** pay the Casino
Strip jackpot.

Jail is the only hard reset on Heat, which makes getting busted a viable
*strategy* for a player at 9 rather than purely a punishment.

### Bribery (City Hall)

Land on City Hall and you may either buy Respect with Cash, or attempt a bribe.

**Respect costs $150 per point** (`RESPECT_PRICE`), **capped at 3 points per
visit**. The price is deliberately above Respect's Empire Value weight of 100
— buying Respect must *cost* you score, not mint it. Every other Cash→EV
conversion in this game is EV-negative on purpose; if this one paid better than
holding the cash, "dump everything into Respect on the last turn" would be the
correct play and the whole property game would be decoration. You buy Respect
to reach **Kingpin** or to afford an **enforcer**, never to win on points.

A bribe costs Cash or Dirty Money and rolls d6 against a threshold that
improves the more you pay. **Success: −3 Heat. Failure: the money is gone and
+2 Heat.**

### District bonuses

Owning all three territories in a district unlocks its power permanently — and
loses it if you lose a tile:

| District | Bonus |
|---|---|
| Old Town | Crew cost −25% |
| Little Havana | +1 Respect every income collection |
| The Harbor | Dirty Money income option pays +50% |
| Industrial | Upgrade costs −50% |
| Downtown | Protection fees +50% |
| Nightclub District | Laundering also clears **1 Heat**, wherever you do it |
| Casino Strip | Rolling doubles pays a **$200** jackpot |
| Financial District | Dirty Money accrues Heat at half rate |

These are spread deliberately across the win strategies, so no single district
is correct for everyone.

> **Changed (2026-08-04)**: Nightclub previously granted "launder anywhere at
> the Safehouse rate" (80%), which was strictly dominated by simply buying the
> **Money Laundry** — one $480 tile granting 75% anywhere, i.e. 94% of the
> benefit for 28.6% of the cost. Two districts collapsed into one correct
> purchase. Clearing Heat on every launder is a different axis entirely, so
> Nightclub now pairs with a dirty-money engine instead of replacing one.

### The six bosses

Each seat picks one during setup; no two seats share a boss. **Passives only in
v1** — they are always on, need no turn step, and cannot be forgotten.

| Boss | Passive |
|---|---|
| **The Godfather** | Completing a district pays **+2** Respect instead of the usual +1 |
| **The Drug Lord** | Dirty Money income option pays +25% |
| **The Casino King** | Rolling doubles pays a **$100** cash jackpot (stacks with Casino Strip's $200) |
| **The Smuggler** | Laundering returns 10 percentage points more, at any rate |
| **The Corrupt Politician** | Bribes cost 50% less |
| **The Street Boss** | Crew cost −25% (does **not** stack with Old Town — take the better of the two) |

Two ambiguities the review caught, resolved here:

- **Completing a district pays +1 Respect to everyone.** The currencies table
  always said Respect was earned by "completing districts", but the only
  specified payout was the Godfather's passive. It is now a universal rule and
  the Godfather's edge is that he gets *double*.
- **The Corrupt Politician no longer "never fails below Heat 6."** That clause
  had two readings, and the permissive one removed Heat — the game's only
  anti-runaway brake and its only gate on Kingpin — as a constraint for that
  seat entirely. A flat 50% discount is a real edge that does not break the
  system.

> **Cut from v1: all six actives.** The Godfather's ("cancel one attack against
> you") and the Casino King's ("force a reroll") were reactive interrupts on
> *another player's* turn, which requires a second concurrent pending decision
> the platform cannot express. Rather than keep four and cut two, all six go —
> it is easier to explain and removes twelve edge-case interactions. The
> asymmetry that made bosses interesting lives in the passives.

### Secret missions

You always hold **3**, dealt face-down and visible only to you (`viewFor` keeps
them private). Completion is checked automatically at the end of your turn. A
completed mission flips face-up, pays out, and is replaced from the deck.

**The v1 deck is exactly 10 missions**, each paying **Respect + Cash**:

| # | Mission | Respect | Cash |
|---|---|---|---|
| 1 | Control a full district | 4 | $300 |
| 2 | Reach $5,000 Cash | 3 | $0 |
| 3 | Win 3 fights (any kind) | 4 | $250 |
| 4 | Own 2 landmarks | 5 | $400 |
| 5 | Take a territory by turf war | 4 | $300 |
| 6 | Launder $3,000 total | 3 | $250 |
| 7 | Finish a round at Heat 0 owning 6+ territories | 5 | $400 |
| 8 | Own a Level 5 Fortress | 4 | $350 |
| 9 | Hold 6 pool crew at once | 3 | $250 |
| 10 | Serve a full jail sentence and leave with 3+ territories | 3 | $300 |

**Respect payouts are load-bearing, not flavour.** Kingpin needs **Respect ≥
30** from a start of 3, and the other faucets (standoff wins +1, turf war wins
+2, strikes +1, Little Havana +1/collection, district completion +1) top out
around 20–22 across a whole match. Missions are what close that gap, so these
numbers decide whether the second victory condition exists at all. If playtests
show Kingpin unreachable, **this table is the knob to turn** — before
`KINGPIN_RESPECT` itself.

Missions are the reason two players in identical board positions want different
things.

### Events

Drawn on the **Question** die face and on **The Speakeasy** tile. The deck
reshuffles when empty; all draws use injected RNG.

**All v1 events are personal** — they hit only the player who drew them. The
deck is exactly 8 cards:

| Card | Effect |
|---|---|
| *Lucky Night* | +$300 Cash |
| *Shakedown* | +$200 Cash, +1 Heat |
| *Made Man* | +2 Respect |
| *Bad Press* | −2 Respect |
| *Tip-Off* | −2 Heat |
| *Sloppy Work* | +2 Heat |
| *Dirty Deal* | Convert $400 Cash to $600 Dirty Money (skipped if you hold under $400) |
| *Old Debt* | Pay $250, or −2 Respect if you cannot |

> **Cut from v1: city events.** *Police Strike*, *Election*, *Market Crash*,
> *Street Festival*, *Power Outage* and *Prison Break* each rewrote a global
> rule for a round, which made them the single largest source of cross-system
> edge cases in the document — every one needed an acceptance criterion
> against every system it suspended, and *Power Outage* alone forced a special
> case into the standoff (the game's core loop). Personal events are
> self-contained, cost almost nothing to test, and still deliver the "what did
> you just draw?" beat. City events return in v2 once the base systems are
> balanced and there is something stable to interrupt.

### Truce and betrayal

Offered with the **Handshake** die face. The target has a 20-second pending
window; no answer means declined. **One active truce per player.**

While active, neither of you pays the other protection, and neither may declare
a turf war on the other.

Either may break it during their Build step. The breaker **loses 3 Respect** and
immediately gets **one free attack** on the other — a turf war or a strike,
their choice. The attack still costs its normal Heat (+2 turf war, +1 strike):
"free" means it does not consume the turn's one turf-war declaration, not that
it is silent. A truce also ends if either player is broken.

> **Changed (2026-08-04)**: betrayal previously waived the attack's Heat cost,
> which made breaking a truce *cheaper* than the same attack made honestly —
> the punishment was a discount. The Player Fantasy asks for betrayal to be
> "funny for about ten seconds and expensive for the rest of the game."

This is a real alliance and a real betrayal in one rule, with no negotiation UI
and nothing that blocks on another human.

### Broken, not bankrupt

Triggered when you owe more Cash than you hold — a fee, a doubled fee, bail, or
or bail.

1. Your Dirty Money is force-laundered at the **worst rate** to try to cover it.
2. Still short? You are **broken**:
   - Your **highest-value territory transfers to the creditor** (or to the bank
     if the debt was to the bank).
   - The debt is cleared in full.
   - **−3 Respect**, floored at 0.
   - You receive a **$500 bailout** — for your **first two breaks only**
     (`BAILOUT_LIMIT` = 2). On the third and any later break, the debt still
     clears and you still take the Respect hit, but there is no cash.

Own nothing? You take the bailout (if you have one left) and the Respect hit and
keep playing. **There is no elimination.**

**Respect is clamped 0–40**, exactly as Heat is clamped 0–10. It feeds Empire
Value at ×100, and a player should never finish with a *negative* contribution
from their own reputation.

> **Why the cap, and why these two rules had to be decided together.** Breaking
> paid −3 Respect (−300 EV) and +$500 cash, a net **+200 EV** — so for a player
> with no territory to lose, there was no outcome where refusing to pay was
> worse than paying, regardless of the combat odds. Flooring Respect at 0
> *alone* would have made that worse, not better: a landless player already at
> 0 Respect would take the $500 with no offsetting penalty at all, netting a
> clean **+500 EV** per break. Capping the bailout is what closes the loop —
> the lifeline stays real for the two breaks a genuinely unlucky player might
> suffer, and stops being a business on the third.

### Victory and scoring

The match ends the moment either happens:

- **Kingpin** — at the end of any turn, a player holds **4 complete districts**,
  **Respect ≥ 30**, and **Heat < 6**. Immediate win.
- **Round 20 completes** — highest **Empire Value** wins.

Empire Value sums Cash, Dirty Money at a discount, territory value scaled by
level, crew, and Respect (weights in Formulas).

Ties break on: most territories → most Respect → earliest seat.

For the platform's `Standing[]` contract (ADR-0005), seats sort by Empire Value
descending, with `detail` as the formatted value (`"$12,400 empire"`), or
`"Kingpin"` for a Kingpin winner. Players who quit are marked eliminated with
`"walked away"` and rank below everyone still playing.

### Pending decisions

At most **one** pending decision exists at a time, and it **halts turn
progression for the whole table** — not merely the opener's own turn. No new
turn begins and no second decision can open while one is live. This is what
makes the one-at-a-time invariant true rather than merely asserted.

Every pending decision has **exactly one named answerer**, carried on the
decision as `memberId`:

| Kind | Who answers | Default on expiry |
|---|---|---|
| `protection` | The visitor (always the active player) | **Pay** |
| `truce` | The offer's target | **Decline** |

That single-answerer property is a **design constraint, not an accident** — it
is why auctions were cut. It means the platform never needs to ask "which seats
owe an answer?", so ADR-0005 needs no `pendingDecisionSeats` amendment and a
bot seat is driven by the existing "is the answerer a bot?" check.

Each carries an `expiresAt` 20 seconds out. Because serverless has **no server
clock** (ADR-0005), resolution is *lazy*: clients schedule a resolver call at
expiry, any seat's client may make it, and the lobby lock plus an expiry check
make duplicate calls no-ops. If every tab is closed nothing resolves until
someone returns — which is correct, not a bug. Bots answer immediately and
never hold up the table.

Three rules the review found were implied but never stated, and which a
correct-looking implementation would otherwise get wrong:

1. **Expiry is checked server-side, against the server's own clock.** The
   resolver is an ordinary move; inside `apply`, if `ctx.now < expiresAt` it
   returns `{ ok: false }` and nothing happens. A client's wall clock decides
   only *when to ask*, never *whether it is time*. Without this, one player
   with a fast clock force-resolves a live decision and defaults a real human's
   open choice.
2. **Every timer derives from `expiresAt`, recomputed at mount.** Neither the
   visible countdown nor the resolver's own scheduling may use a client-started
   duration — the decision overlay is remounted routinely by navigation and
   Fast Refresh, and a local countdown would restart each time.
3. **The scheduled resolver call is jittered** by 0–2 s past `expiresAt`.
   Every connected client computes the *same* absolute deadline, so an unjittered
   call means up to 6 simultaneous transactions contending for one advisory
   lock — unlike `advanceBot`, whose 1–3 s randomised delay spreads them out by
   design.

### Bots and departed seats

A bot plays by utility heuristics with every weight in
`lib/game/data/empire-wars.ts`.

Two terms the heuristics depend on, defined here because they were previously
used as if they were:

- **Assessed value** of a territory = `price × LEVEL_VALUE_MULT[level] +
  DISTRICT_BONUS_WEIGHT` if buying it would complete a district, else
  `price × LEVEL_VALUE_MULT[level]`.
- **Stronger player** = a player whose current Empire Value exceeds the bot's
  by more than 15% (`BOT_STRONGER_MARGIN`).

| Decision | Heuristic |
|---|---|
| Buy a territory | Buy if it completes a district, or if assessed value ≥ `BOT_BUY_THRESHOLD` and cash after purchase ≥ `BOT_CASH_FLOOR` |
| Pay or refuse protection | Refuse if pool crew exceeds the tile's defence by `BOT_FIGHT_MARGIN`, else pay |
| Take Dirty or Cash income | Dirty below Heat `BOT_DIRTY_HEAT_CAP`, else Cash |
| Launder | Launder all Dirty above Heat `BOT_LAUNDER_HEAT` |
| Bribe | At Heat 7+ with cash above `BOT_CASH_FLOOR`; take the cheapest tier that clears 50% |
| Upgrade | Upgrade toward district completion first, then highest income-per-dollar |
| **Car die** | Use it only if it lands the token on an unowned tile it would buy, or off a rival's tile it cannot pay |
| **Gun die (strike)** | Strike the *strongest* player it beats on crew by `BOT_FIGHT_MARGIN`; never strike a truce partner |
| **Handshake die** | Offer a truce to the strongest player without one |
| **Turf war** | Declare when attack strength exceeds defence by `BOT_FIGHT_MARGIN` **and** the target completes a district or is a landmark |
| **Break a truce** | Never in v1 — bots keep their word. A bot that betrayed on a threshold would read as arbitrary, and the drama belongs to humans |
| **Buy Respect** | Only when it would complete Kingpin's Respect requirement this turn |
| **Recruit crew** | Keep pool crew ≥ 2; garrison beyond that, highest-value tile first |
| **Enforcer** | Only above Respect 10 with cash above `BOT_CASH_FLOOR` |
| **Bail** | Pay bail if cash ≥ 3× `BAIL_COST`, else serve the sentence |
| **Airport** | Move to the highest assessed-value unowned tile it can afford |

A bot **must be able to answer every pending decision** — a contract
requirement, not a nicety. With auctions cut there are only two kinds, both
single-answerer, which is what makes that requirement tractable.

> **The bot is a system, not a section.** This table is the v1 contract; the
> tuning behind it (weights, thresholds, the utility function itself) belongs
> in a companion spec, `design/gdd/empire-wars-bot.md`, before implementation
> is scoped. The Risks section already calls the bot the largest schedule risk
> and that has not changed.

Per ADR-0004, a seat whose human closed their tab is **played as a bot with its
empire intact**. Only an explicit **quit** eliminates: that player's territories
return to unowned, their crew disband, and they rank below all active players.
If no human remains, the session ends abandoned with no winner.

## Formulas

Anchored on three targets: a player affords ~2 territories in the first two
laps; the whole board costs more than the table's combined starting cash (so
income has to matter); a strong final Empire Value lands around $10–14k.

### Territory prices and income

**Total board value: $10,010** against $9,000 of combined starting cash at 6
seats — the board is deliberately unaffordable at the start.

| District | Territory | Tier | Price | Cash income (L1) | Dirty option (L1) |
|---|---|---|---|---|---|
| Old Town | Pawn Shop | s | 120 | 18 | — |
| | Barber Shop | s | 140 | 21 | — |
| | Tattoo Parlour | s | 160 | 24 | — |
| Little Havana | Cigar Lounge | s | 160 | 24 | — |
| | Car Wash | s | 180 | 27 | — |
| | Liquor Store | i | 300 | 45 | 75 |
| The Harbor | Fish Market | s | 200 | 30 | — |
| | Boat Yard | i | 330 | 50 | 83 |
| | **Shipping Port** | L | 600 | 96 | 168 |
| Industrial | Garage | s | 240 | 36 | — |
| | Factory | s | 260 | 39 | — |
| | Chop Shop | i | 420 | 63 | 105 |
| Downtown | Coffee House | s | 280 | 42 | — |
| | Drug Lab | i | 450 | 68 | 113 |
| | Money Laundry | i | 480 | 72 | 120 |
| Nightclub | Jazz Cellar | s | 320 | 48 | — |
| | Gin Joint | i | 510 | 77 | 128 |
| | **The Onyx Room** | L | 850 | 136 | 238 |
| Casino Strip | Poker Room | i | 560 | 84 | 140 |
| | Racetrack | i | 580 | 87 | 145 |
| | **The Golden Chip** | L | 950 | 152 | 266 |
| Financial | Accounting Office | s | 400 | 60 | — |
| | Bail Bonds | s | 420 | 63 | — |
| | **First City Bank** | L | 1,100 | 176 | 308 |

Income is generated, not hand-tuned:

`cashIncome  = round(price × TIER_CASH_RATE  × LEVEL_INCOME_MULT)`
`dirtyIncome = round(price × TIER_DIRTY_RATE × LEVEL_INCOME_MULT)`

> **`round()` means half-up** throughout this document — JavaScript's
> `Math.round()`. This is not pedantry: several published values land exactly
> on `.5` (Boat Yard income 49.5 → 50, the maximum protection fee 1336.5 →
> 1337), and the acceptance criterion that checks all 120 income combinations
> against the formula will disagree with the table on those rows under any
> other rule. Pin it once, here.

| Variable | Type | Value | Meaning |
|---|---|---|---|
| `TIER_CASH_RATE` | float | small/illegal 0.15, landmark 0.16 | Fraction of price per collection |
| `TIER_DIRTY_RATE` | float | illegal 0.25, landmark 0.28 | The greedy option |
| `LEVEL_INCOME_MULT` | float[5] | 1.0, 1.5, 2.2, 3.2, 4.5 | By property level |

**Output range:** 18 (Pawn Shop L1) to 792 (First City Bank L5 cash) per
collection.

### Costs

| | Formula | Example |
|---|---|---|
| Level 3 upgrade | `price × 0.6` | Drug Lab: $270 |
| Level 4 upgrade | `price × 0.9` — Dirty accepted | Drug Lab: $405 |
| Level 5 upgrade | `price × 1.3` + 1 crew | Drug Lab: $585 |
| Crew | $250 Cash **or** $200 Dirty | — |
| Inmate crew (in jail) | $125 | — |
| Enforcer | $400 + 2 Respect | Counts as 2 crew, cannot garrison |
| Docks stipend | $200 per pass, plus territory income | — |
| Airport fee | $150 | — |
| Bail | $200 | — |
| Respect at City Hall | $150 per point, max 3 per visit | Above the ×100 EV weight on purpose |
| Money Bag windfall | $150 | Action die, automatic |
| Doubles jackpot | $200 Casino Strip · $100 Casino King | Both may apply |
| Declined-tile mark-down | −10% of list per decline, floor 50% | Cumulative, permanent |

Dirty Money buying crew *cheaper* is intentional: it is the main reason to hold
Dirty rather than launder immediately, which makes the Heat cost a genuine
trade rather than a pure penalty.

### Protection fees

`protectionFee = round(price × PROTECTION_RATE × LEVEL_INCOME_MULT × PROTECTION_MARKUP)`,
× `DISTRICT_FEE_MULT` if the owner holds the whole district.

| Variable | Value |
|---|---|
| `PROTECTION_RATE` | 0.15 |
| `PROTECTION_MARKUP` | 1.2 |
| `DISTRICT_FEE_MULT` | 1.5 |

**Worked example** — Drug Lab (450) at Level 3, owner holds Downtown:
`450 × 0.15 × 2.2 × 1.2 × 1.5 = 267.3 → $267`

**Output range:** $22 (Pawn Shop L1) to **$1,337** (First City Bank L5,
district held: `1100 × 0.15 × 4.5 × 1.2 × 1.5 = 1336.5 → 1337`).

> **Corrected (2026-08-04)**: the maximum was published as $1,481, which no
> combination of these variables produces. Note the rate stays a flat 0.15 even
> for landmarks, whose *income* rate is 0.16 — that divergence is deliberate
> (protection is a fraction of the tile, not of its yield), but it was
> previously an unnamed literal and is now a named constant.

### Combat

Each side rolls d6 equal to its strength, keeps the **best two**, and sums. One
die minimum. **Ties go to the defender.**

- Attacker strength = pool crew (enforcers count 2)
- Defender strength = garrisoned crew + level defence bonus (L2 +1, L4 +1,
  L5 +2 — cumulative, so a Fortress carries +4)

Expected value of best-2-of-N: **7.0, 8.46, 9.31, 9.86, 10.24** for N = 2…6.
The curve flattens hard by design — a 6-crew army is not twice a 3-crew army,
so stacking has sharply diminishing returns.

**Attacker win rate — exact**, by full enumeration of both dice
distributions (not sampled, so there is no error bar):

| Att \ Def | 1 | 2 | 3 | 4 | 5 | **6** | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| **1** | 41.7% | 9.3% | 3.0% | 1.0% | 0.3% | 0.1% | 0.0% | 0.0% |
| **2** | 83.8% | 44.4% | 27.6% | 18.3% | 12.7% | 9.2% | 6.9% | 5.3% |
| **3** | 93.8% | 61.9% | 43.7% | 31.9% | 23.9% | 18.4% | 14.4% | 11.5% |
| **4** | 97.5% | 72.4% | 55.0% | 42.5% | 33.3% | 26.6% | 21.4% | 17.5% |
| **5** | 99.0% | 79.1% | 63.1% | 50.6% | 41.0% | 33.5% | 27.6% | 23.0% |
| **6** | 99.5% | 83.5% | 69.1% | 57.0% | 47.3% | 39.4% | 33.0% | 27.8% |
| **7** | 99.8% | 86.6% | 73.6% | 62.1% | 52.4% | 44.4% | 37.7% | 32.1% |
| **8** | 99.9% | 88.8% | 77.0% | 66.2% | 56.7% | 48.6% | 41.7% | 35.8% |

Exact expected value of best-2-of-N: **3.5000, 7.0000, 8.4583, 9.3441, 9.9302,
10.3445, 10.6515, 10.8868** for N = 1…8.

> **Computed 2026-08-04 — and the previous estimates failed this document's own
> acceptance criterion.** Twelve of the sixteen published cells were outside
> ±2 percentage points, all in the same direction: the estimates were too
> generous to the attacker whenever the defender held **3 or more dice**, by up
> to **6pp** (5v5 was published at 47%, actual **41.0%**). The defender-2 column
> was accurate, which is why the error went unnoticed — the cases everyone
> checked by hand were the cases that happened to be right. The AC said "or the
> table is corrected to match"; it is corrected.
>
> The published expected values were also slightly off from N=5 (9.86 vs
> **9.9302**, 10.24 vs **10.3445**).

> **`LEVEL_DEFENCE` stays as it is.** The decision was deferred pending this
> table *and* a working Heat brake; both are now in.
>
> A Level 5 Fortress fields 2 garrisoned crew + 4 = **6 defence dice**. Against
> that an attacker needs roughly **8 pool crew for a coin flip** (48.6%). That
> is expensive — about $2,000 of crew — but a Fortress costs its owner
> `price × 3.8` plus two crew to build (~$2,210 for a Drug Lab) and **locks
> those two crew out of their own raiding party** for the rest of the match.
> Comparable investment, near-even odds, and a real opportunity cost on both
> sides. That is what "Fortress" ought to mean: hard, not sealed.
>
> The failure mode named in Tuning Knobs — "a Fortress becomes untakeable; the
> board freezes" — was only fatal while the Heat brake was broken, because a
> Fortress-heavy leader could sit unbothered. With the brake working, a large
> empire bleeds a tile per raid regardless of how well defended it is, so the
> board keeps moving even if nobody storms the Fortress.

### Dirty Money and Heat

| | Value |
|---|---|
| `DIRTY_HEAT_STEP` | +1 Heat per **$400** held, at upkeep (floor) |
| Launder — The Safehouse | 80% returned |
| Launder — owning Money Laundry, anywhere | 75% |
| Launder — City Hall or elsewhere | 60% |
| Launder — forced, when broken | 50% |
| Most Wanted check | +1 Heat if `empireValue > 1.25 × mean(active empire values)`, end of round |

Holding $1,200 dirty costs **+3 Heat every round**. That is the squeeze.

### Bribery

| Cost | Succeeds on d6 | Odds | EV(Heat) |
|---|---|---|---|
| $300 | 4–6 | 50% | −0.5 |
| $600 | 3–6 | 67% | −1.33 |
| $1,000 | 2–6 | 83% | −2.17 |

Success −3 Heat; failure +2 Heat and the money is gone either way. Corrupt
Politician halves the cost.

> **Re-priced (2026-08-04).** `EV(Heat) = p × (−3) + (1 − p) × (+2) = 2 − 5p`,
> so a tier only removes Heat on average when **p > 0.4**. The old $300 tier
> sat at 33%, giving `EV = +0.34` — you paid $300 and got *hotter*. It was
> strictly dominated by doing nothing, which is a bad enough bug in a
> competitive game and a worse one in a casual social game: a player who takes
> the cheap option twice and ends up worse off concludes the game cheated them
> and cannot articulate why. Every tier now clears the threshold; the ladder
> still rewards paying more (cost per expected Heat point removed: $600, $451,
> $461).

### Empire Value

`EV = cash + (dirty × 0.5) + Σ(price × LEVEL_VALUE_MULT) + (crew × 150) + (respect × 100)`

| Variable | Type | Range | Meaning |
|---|---|---|---|
| `cash` | int | 0–∞ | Full face value |
| `dirty` | int | 0–∞ | Halved — it isn't really yours until it's clean |
| `LEVEL_VALUE_MULT` | float[5] | 1.0, 1.3, 1.8, 2.4, 3.2 | Territory value by level |
| `crew` | int | 0–~12 | $150 each — **pool crew only** |
| `respect` | int | 0–40 | $100 each, clamped |

**`crew` counts pool crew only.** Garrisoned crew are already priced in through
`LEVEL_VALUE_MULT` — Levels 2 and 5 are *reached by* garrisoning — so counting
them again here would value a Fortress twice, inflating a heavily-upgraded
empire by up to ~$1,200 of phantom score.

**Worked example** — Round 20, a solid mid-table empire: $2,000 cash, $400
dirty, Drug Lab L3 (810) + Chop Shop L2 (546) + Garage L4 (576) + Factory L1
(260) + Coffee House L2 (364), 4 pool crew, 12 Respect:

`2000 + 200 + 2556 + 600 + 1200 = $6,556`

**Output range:** ~$2,000 (a broken player who never recovered) to ~$25,000 (a
runaway the Heat system failed to contain — if playtests produce this, the
1.25× multiplier is the knob to turn).

> **Corrected (2026-08-04)**: this example was published as `$8,556`. Every
> term is right; the sum was not. The correction matters beyond arithmetic —
> this is the document's **only calibration anchor**, and the Formulas preamble
> targets "a strong final Empire Value around $10–14k". If a *solid mid-table*
> empire is $6,556 rather than $8,556, then either the $10–14k band describes a
> considerably stronger position than intended, or the economy runs light.
> **Resolve this against the first bot simulation before tuning anything
> downstream of Empire Value** — Most Wanted, Kingpin and the final standings
> all read from it.

## Edge Cases

### Money and debt

- **If a player declines a territory they could afford**: it stays unowned and
  drops 10% of list price, permanently. The same tile declined repeatedly keeps
  dropping, to a floor of 50% of list.
- **If a player cannot afford a territory they land on**: same as declining —
  the mark-down applies. There is no penalty for being poor beyond the
  opportunity lost.
- **If a marked-down territory is later seized by a raid**: it returns to
  unowned at its **marked-down** price, not list. Prices only ever move down.
- **If a broken player's best territory is worth more than the debt**: the
  creditor takes it anyway and no change is given. It is a fire sale.
- **If a broken player owns no territories**: the debt clears, they take
  −3 Respect and the bailout **if they have one of their two remaining**, and
  play continues. This is the floor of the game; nothing below it exists.
- **If a player breaks for the third or later time**: the debt still clears and
  they still take −3 Respect, but there is no cash.
- **If Heat would exceed 10 or drop below 0**: it clamps. **Respect clamps the
  same way, 0–40.**

### Dirty money

- **If a player is at Federal (Heat 9–10) when collecting income**: the Dirty
  Money option is unavailable on every territory. Cash only.
- **If a raid fires while the player holds no Dirty Money**: it **seizes their
  lowest-level territory** instead, which returns to unowned at Level 1 with
  its garrison disbanded. At Federal it still sends them to jail as well.
- **If a raid fires on a player with no Dirty Money and no territory**: nothing
  is taken. The raid still counts, and at Federal still jails them.
- **If two territories tie for lowest level**: the **cheapest** is seized. The
  seizure is meant to bleed, not to cripple.
- **If a seizure breaks up a completed district**: the bonus is lost
  immediately, exactly as any other loss of a district tile.
- **If force-laundering covers the debt**: they are **not** broken — no
  territory changes hands and no Respect is lost. The 50% rate is the
  punishment.

### Combat

- **If either side has 0 strength**: they roll one die. Nobody rolls zero dice.
- **If both totals are equal**: the defender wins. Always.
- **Refusing to pay is always available.** No event, ability or board state
  suppresses it — the standoff is the game's core loop and nothing may take the
  choice away. (v1 has no rule that could; this is stated so none is added.)
- **If a strike and a turf war both target the same player in one turn**: both
  resolve, independently and in declaration order. A strike costs the defender
  pool crew, which may weaken a garrison-poor player before the turf war, but
  garrisoned crew are never touched by a strike.
- **If an attacker wins a turf war that completes a district**: the bonus
  activates immediately, before the turn ends.
- **If a player loses a tile from a completed district**: that bonus is lost
  immediately.

### Adjacency

- **Adjacency is a declared neighbour list, not board geometry.** The rules
  layer owns an `ADJACENCY` table — 24 territories, exactly 2 neighbours each —
  and the board *visualises* it. Special tiles are not in the list: Tattoo
  Parlour (3) neighbours Cigar Lounge (5) across the checkpoint at 4, and the
  list closes the loop, so Financial District's last tile (31) neighbours Old
  Town's first (1) across The Docks.
- **Why a list rather than "the tile ring, skipping specials".** Defining
  adjacency geometrically makes the 32-tile ring a *rules* object, which means
  the board cannot be laid out any other way — and it cannot be laid out as a
  ring on a phone. `GameScreen` splits only at `lg` (1024px), so a phone gives
  the board roughly 340px across about nine tile-widths a side: ~38px per tile,
  before a name, price, level pips and an owner chip. Chipae's whole premise is
  "game night, anywhere". With adjacency as data, desktop renders the ring,
  mobile renders eight district columns, and **the rules do not change between
  them**. See UI Requirements.
- **If the target is protected by an active truce**: the turf war cannot be
  declared.
- **A strike ignores adjacency entirely** — its range is "within 6 tiles of
  your token, or owns a territory neighbouring one of yours". Nowhere on the
  board is safe from a strike, which is the point.

### Jail

- **If a rival lands on a jailed player's territory**: the fee is still owed and
  collected. Crew work while the boss is inside.
- **If a jailed player is raided**: it resolves normally. Jail is not sanctuary.
- **Nothing releases a jailed player early except bail, doubles or the
  sentence.** v1 has no mass-release effect (*Prison Break* was cut with the
  city events), so a jail sentence is always the player's own to serve.
- **If a player is in jail when Round 20 ends**: they are scored normally.
- **If three doubles send a player to jail**: the third roll's movement is
  **not** resolved. They go straight there.
- **A doubles roll while in jail** is a bail attempt, not a movement roll.

### Pending decisions

- **If a decision expires unanswered**: the default applies — Pay, or decline.
- **If a decision is open when Round 20 would end**: it resolves first, then the
  match ends. A round boundary never truncates a live decision.
- **If a decision expires and nobody returns for hours**: it resolves on the
  next client's arrival, identically and exactly once, however stale it is.
  Resolution is time-of-return, not time-of-expiry. No rule accrues with
  real-world elapsed time, so there is nothing to catch up.
- **If a decision is open when the last human leaves**: the session ends
  abandoned with no winner (ADR-0004).
- **If the answerer quits while their decision is open**: the default applies
  immediately, then the quit resolves. A quit never leaves an orphaned
  decision.
- **If a human goes silent mid-decision without quitting**: nothing special
  happens — the ordinary 20-second default covers it. A departed seat is only
  played as a bot from its *next* turn onward.
- **Only one decision can be open at a time**, and a live decision halts turn
  progression for the whole table, so collision is impossible. Every decision
  has exactly one named answerer.
- **If a bot faces a decision with no legal option**: it takes the default. A
  bot never stalls the table.

### Truce

- **If a truce is offered to a player who already has one**: auto-declined.
- **If either party is broken, or quits**: the truce ends immediately, with no
  Respect penalty to either side.

### Missions

- **If two missions complete on the same turn**: both pay out, both replaced.
- **If the mission deck runs out**: completed missions reshuffle back in.
- **If a mission becomes temporarily impossible**: it stays in hand. Missions
  are goals, not timers — turf war can always free land again.

### Victory

- **If Kingpin conditions are met while a decision is pending**: the decision
  resolves first, then conditions are re-checked and may no longer hold.
- **If Empire Values tie at Round 20**: most territories → most Respect →
  earliest seat.
- **If only one human remains among bots**: play continues and that human can
  win.

## Dependencies

### Upstream (Empire Wars needs these)

| Depends on | Nature | Interface |
|---|---|---|
| **Lobby system** | **Hard** | Seats, ready-state, host, bot seats, join codes. Empire Wars adds no lobby UI (ADR-0004). |
| **Game module interface** (ADR-0005) | **Hard** | Implements `GameModule<EmpireState, EmpireView, EmpireMove>`; registered in `lib/game/registry.ts`. |
| **`GameSession.state` Json storage** | **Hard** | Whole state in one column, zod-validated on read. Est. 20–40 KB at 6 seats. |
| **`persistGameState` / `Standing[]`** (ADR-0005) | **Hard** | Supplies finishing order and `detail` strings; the platform owns finish/abandon, chat wipe, lobby reopen, `GameWin`. |
| **Game catalog** (ADR-0004) | **Hard** | `lib/game/catalog.ts` entry, `minPlayers: 2`, `maxPlayers: 6`. |
| **Client board registry** | **Hard** | `components/game/boards.tsx` maps `empire-wars` → `components/game/empire-wars/board.tsx`. |
| **Realtime layer** (ADR-0001) | **Soft** | Publishes `game-changed` hints. Missing Pusher env degrades to plain refresh, not a crash. |
| **Art direction** | **Soft** | `design/art-direction.md` for palette, motif and voice; game tokens live in a non-theme-scoped block, as Nuno's do. |
| **Game assets** | **Soft** | `public/games/empire-wars/{logo.png, cover.png}`. A missing cover degrades to a plain card colour. |
| **Per-lobby player colour** | **Hard** | Owner chips on 24 territories need every seat visually distinct. **This does not exist today** — see below. |

### Blocked on a platform fix: player colour is not unique per lobby

`lib/avatars.ts` defines ten avatars over five colours (`chart-1…5`) and
`components/avatar-chip.tsx` colours a player by `avatar.seat` — that is, by
**the avatar they picked**, not their seat index. "High roller" and "Table
bear" are both `seat: 1`. Two players in the same lobby can therefore already
share a colour, at any seat count, **in shipped Nuno today**.

Empire Wars does not cause this bug, but it cannot ship with it: colour is the
primary ownership signal on 24 territories plus up to five opponent strips, and
six seats need six distinguishable identities. Adding `--chart-6` is not the
fix — the lobby must **assign a distinct display colour per member,
independent of avatar choice**. That touches Nuno, the crew rail and the shell,
so it wants its own small ADR and should land independently of this game.

### Downstream

Empire Wars is a leaf — no other GDD depends on it, so there is no
bidirectional edit to make. `nuno-core.md` is a **sibling, not a dependency**:
the two games share the platform and never each other. ADR-0005 already names
this GDD under *GDD Requirements Addressed*, so that link is bidirectional.

### Required amendment to ADR-0005

`GameModule.apply()` currently takes `(state, memberId, move)` — **no RNG and
no clock**. Empire Wars cannot work with that:

- **Dice, event draws and mission deals happen inside `apply`.** Without
  injected RNG they would call `Math.random()` directly, breaking the "RNG
  injected, fully unit-testable" rule and making the combat simulation test
  impossible to write.
- **`expiresAt` needs a current time.** A pure module has no clock, and a
  client-supplied timestamp is not trustworthy.

Fix: `apply(state, memberId, move, ctx)` where
`ctx = { random: () => number, now: number }`, supplied by the server action
from `Math.random` and `Date.now()`. `deal`, `quit` and `botMove` take the same
context.

**This also fixes a latent defect in Nuno.** `applyDraw` accepts an optional
`random` for reshuffling the discard pile, but `lib/game/nuno/module.ts` calls
it without one — so Nuno's reshuffle currently falls through to `Math.random()`
inside a supposedly pure transition. No existing test forces a reshuffle, so
nothing caught it. Threading `ctx` fixes both games at once; the amendment must
land with a test that exhausts the deck and asserts a seeded reshuffle is
deterministic.

**No second amendment is needed — and that is a consequence of the auction
cut.** An earlier draft of this design required the platform to answer "which
seats currently owe a decision?", because a sealed-bid auction is answered by
*every* seat while a different seat is on the clock. `ErasedGameModule` exposes
only `currentMemberId`, so that would have meant a second ADR-0005 amendment
(`pendingDecisionSeats(state): string[]`) plus a batched off-turn bot-resolution
path in `lib/actions/games.ts` — generic platform code, which CLAUDE.md forbids
branching per game. With auctions cut, **every pending decision has exactly one
named answerer**, and the existing interface covers it.

**Two implementation constraints that are not signature changes but are just as
binding:**

- **The client trigger for a bot-owned decision must key off the pending
  decision's own identity, not `currentMemberId`.** Nuno's board schedules
  `advanceBot` when the *current* seat is a bot; copied verbatim, that never
  fires for a decision addressed to a bot while a human is on the clock, and
  the table stalls silently.
- **Expiry is validated server-side inside `apply` against `ctx.now`** — never
  by trusting that a resolve call arrived. See Pending decisions.

**Status (2026-08-04)**: the amendment's *shape* is settled by this revision.
Treat it as **not yet implemented** and land it deliberately as the first step
of Empire Wars implementation. Nuno's production behaviour is correct today;
only its testability is affected.

### New files this game adds

`lib/game/empire-wars/rules.ts` · `lib/game/empire-wars/module.ts` ·
`lib/game/data/empire-wars.ts` (all tuning) ·
`components/game/empire-wars/board.tsx` · registry and catalog entries.

**The game id is `empire-wars`** — hyphenated, matching the registry key
convention and the directory names above. Assets now sit at
`public/games/empire-wars/`, matching the catalog's `public/games/<id>/`
convention (moved 2026-08-04). They still need re-encoding: the logo is
**6.3 MB** against a 512×512 spec.

**RNG discipline for this game's rules**: `random` is a **required** parameter
everywhere in `lib/game/empire-wars/rules.ts`, with no `= Math.random` default
at any depth. Nuno's latent reshuffle defect existed precisely because a
defaulted parameter let a missed thread compile silently. Here a missed thread
must be a type error.

## Tuning Knobs

Every value lives in `lib/game/data/empire-wars.ts` — none inline in logic.

### Match shape

| Knob | Default | Safe range | Too high | Too low |
|---|---|---|---|---|
| `ROUND_LIMIT` | 20 | 12–30 | Matches drag past a sitting; bots finish them | No time to build — the winner is whoever rolled well |
| `DECISION_WINDOW_MS` | 20,000 | 10,000–45,000 | One AFK player stalls every landing | Real players get defaulted mid-thought |
| `MIN/MAX_PLAYERS` | 2 / 6 | fixed | >6 breaks the seat ring and turn wait | — |

### Economy

| Knob | Default | Safe range | Too high | Too low |
|---|---|---|---|---|
| `STARTING_CASH` | 1,500 | 800–2,500 | Everyone buys freely; nothing is ever declined | Nobody can afford past Old Town |
| `DOCKS_STIPEND` | 200 | 100–400 | Territory income stops mattering | Broke players cannot dig out |
| `TIER_CASH_RATE` | .15 / .16 | .10–.22 | Payback in one lap; board bought out by Round 8 | Territories never pay for themselves |
| `TIER_DIRTY_RATE` | .25 / .28 | .18–.35 | Dirty is always correct; Heat is a tax you accept | Nobody takes dirty and a currency dies |
| `LEVEL_INCOME_MULT` | 1/1.5/2.2/3.2/4.5 | — | Upgrading dominates buying; the map stops mattering | Upgrading is never worth the cash |
| `CREW_COST` | 250 cash / 200 dirty | 150–400 | Armies never form; combat vanishes | Everyone fields 8 crew; defence is hopeless |
| `BAILOUT` | 500 | 200–1,000 | Going broke becomes a strategy | Broken players never recover — elimination by another name |
| `BAILOUT_LIMIT` | 2 | 1–4 | The bailout is farmable again | One bad break ends a player's game in all but name |
| `RESPECT_PRICE` | 150 | 110–300 | Kingpin's Respect gate stops binding | Below 100 it mints score — buying Respect becomes the win |
| `MISSION_RESPECT` | 3–5 per card | 2–7 | Kingpin trivially reachable | Kingpin is decoration; Respect ≥ 30 unreachable |
| `DECLINE_MARKDOWN` | 10% per decline, floor 50% | 5–20% | Declining is a tactic; landmarks get cheap | The board sits unsold |
| `PROTECTION_RATE` / `_MARKUP` / `DISTRICT_FEE_MULT` | .15 / 1.2 / 1.5 | — | Protection eclipses territory income entirely | Refusing to pay is never worth the risk |

### Heat

| Knob | Default | Safe range | Too high | Too low |
|---|---|---|---|---|
| `MOST_WANTED_MULT` | 1.25 | 1.10–1.60 | The leader escapes the brake; runaway returns | Everyone is Most Wanted; the badge means nothing |
| `DIRTY_HEAT_STEP` | $400 | 200–800 | Dirty money is effectively free; the squeeze disappears | Dirty money is untouchable and goes unused |
| `HEAT_BANDS` | 3 / 6 / 9 | — | Raids never fire | The table lives under permanent federal investigation |
| `RAID_ODDS` | 5–6, then 3–6 | — | Heat is toothless | Any dirty money is instantly confiscated |
| `JAIL_HEAT_RESET` | 2 | 0–4 | Jail stops being an escape valve | Getting arrested beats staying clean |

`MOST_WANTED_MULT` and `ROUND_LIMIT` **multiply**: fewer rounds means less
accumulated Heat, so shortening the match silently weakens the rubber band.
Retune them together.

### Combat

| Knob | Default | Safe range | Too high | Too low |
|---|---|---|---|---|
| `DICE_KEPT` | 2 | 1–3 | Keep 3 and big armies always win — no upsets | Keep 1 and crew is decoration; combat is a coin flip |
| `TIES_TO` | defender | fixed | — | Attacker-favoured ties make holding territory miserable |
| `LEVEL_DEFENCE` | +1/+1/+2 at L2/L4/L5 | 0–3 each | A Fortress becomes untakeable; the board freezes | Upgrading buys income but no safety |
| `TURF_WAR_HEAT` | +2 | 1–4 | Nobody declares one; the board stops moving | Turf wars are free and ownership churns constantly |

### Victory

| Knob | Default | Safe range | Too high | Too low |
|---|---|---|---|---|
| `KINGPIN_DISTRICTS` | 4 | 3–5 | Kingpin never happens; it is decoration | Kingpin ends matches by Round 10 |
| `KINGPIN_RESPECT` | 30 | 20–40 | Same | Same |
| `KINGPIN_MAX_HEAT` | 6 | 4–8 | The Heat requirement constrains nothing | Unreachable for anyone who played aggressively |
| `EV_DIRTY_WEIGHT` | 0.5 | 0.3–0.8 | Hoarding dirty at the buzzer is optimal | Launder-everything dominates |
| `EV_RESPECT_WEIGHT` | 100 | 50–200 | Respect eclipses the property game | Missions and fights stop paying |
| `EV_CREW_WEIGHT` | 150 | 100–250 | Stockpiling crew outscores owning land | Crew is pure cost; armies never form |
| `LEVEL_VALUE_MULT` | 1/1.3/1.8/2.4/3.2 | — | Upgrading is the whole scoring game | Upgrades cost more score than they add |
| `RESPECT_CLAMP` | 0–40 | — | Ceiling never binds | Late Respect gains are wasted |

### Bots

| Knob | Default | Notes |
|---|---|---|
| `BOT_DELAY_MS` | 1,000–3,000 | Same pacing as Nuno — casual players, not instant machines |
| `BOT_BUY_THRESHOLD` | 250 | Minimum assessed value before buying |
| `BOT_CASH_FLOOR` | 300 | Reserve it will not spend below |
| `BOT_STRONGER_MARGIN` | 1.15 | Empire Value ratio defining a "stronger player" |
| `BOT_FIGHT_MARGIN` | +1 | Strength advantage needed before refusing, striking or declaring |
| `BOT_LAUNDER_HEAT` | 6 | Heat at which it dumps dirty money |
| `BOT_DIRTY_HEAT_CAP` | 3 | Heat above which it stops taking dirty income |
| `DISTRICT_BONUS_WEIGHT` | 400 | Assessed-value bonus for a district-completing tile |

`BOT_BID_FRACTION` is gone with the auctions.

The three knobs a first playtest will most likely move: `MOST_WANTED_MULT`,
`DIRTY_HEAT_STEP`, `ROUND_LIMIT`.

## Acceptance Criteria

### Visibility model

| Public to everyone | Private to the owner |
|---|---|
| Territory ownership and levels; garrison sizes | Exact Cash |
| Pool crew counts | Exact Dirty Money |
| Respect (it is reputation) | Secret missions still in hand |
| Heat, exact, and the Most Wanted badge | |
| Completed (revealed) missions | |

### Board and movement

- [ ] **GIVEN** a new match, **WHEN** the board is built, **THEN** it has exactly 32 tiles: 24 territories across 8 districts of 3, plus 8 specials at the documented indices. *(unit)*
- [ ] **GIVEN** a token near tile 31, **WHEN** it moves past 31, **THEN** it wraps to 0 and collects Docks income. *(unit)*
- [ ] **GIVEN** two consecutive doubles, **WHEN** a third is rolled, **THEN** the player goes to jail and **the third roll's movement is not resolved**. *(unit)*

### Economy

- [ ] **GIVEN** any of the 24 territories at any of the 5 levels, **WHEN** income is computed, **THEN** it equals the published formula to the rounded dollar. *(unit — table-driven over all 120 combinations)*
- [ ] **GIVEN** a small-tier territory, **WHEN** income is collected, **THEN** no Dirty Money option is offered. *(unit)*
- [ ] **GIVEN** a player at Heat 9, **WHEN** income is collected, **THEN** the Dirty option is unavailable on every territory. *(unit)*
- [ ] **GIVEN** a protection fee is owed, **WHEN** computed, **THEN** it matches `price × 0.15 × LEVEL_INCOME_MULT × 1.2`, ×1.5 with the district held. *(unit)*

### Declining a territory

- [ ] **GIVEN** a player declines an unowned territory, **WHEN** the turn continues, **THEN** it stays unowned, its price drops 10%, and **no pending decision opens**. *(unit — **blocking**)*
- [ ] **GIVEN** a territory declined five times, **WHEN** its price is read, **THEN** it is floored at 50% of list, not lower. *(unit)*
- [ ] **GIVEN** a marked-down territory, **WHEN** a player buys it, **THEN** they pay the marked-down price and all income, fees and Empire Value still derive from **list** price. *(unit)*
- [ ] **GIVEN** any sequence of play, **WHEN** the match runs, **THEN** no territory's price ever increases. *(simulation)*

### Protection and combat

- [ ] **GIVEN** a visitor lands on a rival's territory, **WHEN** the tile resolves, **THEN** a `protection` decision opens with default **Pay**. *(unit)*
- [ ] **GIVEN** the window expires unanswered, **WHEN** it resolves, **THEN** the fee is paid. *(unit)*
- [ ] **GIVEN** a visitor refuses and wins, **WHEN** combat resolves, **THEN** they pay nothing, gain 1 Respect, the owner loses 1, **the visitor gains 1 Heat**, and **ownership does not change**. *(unit)*
- [ ] **GIVEN** a visitor refuses and loses, **WHEN** combat resolves, **THEN** they pay double, lose 1 pool crew, and **gain 1 Heat**. *(unit)*
- [ ] **GIVEN** equal combat totals, **WHEN** resolved, **THEN** the defender wins. *(unit)*
- [ ] **GIVEN** a side with 0 strength, **WHEN** it rolls, **THEN** it rolls exactly 1 die. *(unit)*
- [ ] **GIVEN** a Level 5 Fortress with 2 garrisoned crew, **WHEN** defence is computed, **THEN** it is exactly 6 dice (2 crew + 4 cumulative level bonus). *(unit)*

**Combat calibration is a task, not a criterion.** Before any balance work
depends on the win-rate table, run 100,000 seeded combats per matchup across
**Attacker 1–6 × Defender 1–6** and *write the measured rates into Formulas*.
Only then does this become testable:

- [ ] **GIVEN** the **calibrated** win-rate table, **WHEN** 100,000 seeded combats are simulated per matchup, **THEN** each observed rate is within **±2 percentage points**. A failure is a bug to investigate — **the table is never auto-corrected to make the test pass**. *(simulation — **blocking**)*

> The previous wording ended "*— or the table is corrected to match*", which
> made the criterion unfailable: any disagreement between code and spec was
> resolved by rewriting the spec. Calibration and regression are different
> jobs and must not share a checkbox.

### Turf war

- [ ] **GIVEN** a territory separated from one you own only by a special tile, **WHEN** adjacency is checked, **THEN** it is adjacent. *(unit)*
- [ ] **GIVEN** an active truce, **WHEN** a turf war is declared on that player, **THEN** it is rejected. *(unit)*
- [ ] **GIVEN** an attacker wins, **WHEN** it resolves, **THEN** they take the territory at its current level, the garrison is destroyed, and they gain 2 Heat. *(unit)*
- [ ] **GIVEN** an attacker loses, **WHEN** it resolves, **THEN** they still gain 2 Heat. *(unit)*

### Heat and police

- [ ] **GIVEN** $1,200 Dirty Money at upkeep, **WHEN** upkeep runs, **THEN** Heat increases by 3. *(unit)*
- [ ] **GIVEN** zero Dirty Money at upkeep, **WHEN** upkeep runs, **THEN** Heat decreases by 1, floored at 0. *(unit)*
- [ ] **GIVEN** a player above 1.25× the table mean Empire Value, **WHEN** the round ends, **THEN** they gain 1 Heat and are flagged Most Wanted. *(unit)*
- [ ] **GIVEN** Heat at 10, **WHEN** more is added, **THEN** it stays at 10. *(unit)*
- [ ] **GIVEN** a raid, **WHEN** it resolves, **THEN** all Dirty Money is confiscated and **nothing else is lost**. *(unit)*
- [ ] **GIVEN** a raid at Heat 9+, **WHEN** it resolves, **THEN** the player is also jailed. *(unit)*

### Jail

- [ ] **GIVEN** a jailed player, **WHEN** their turn comes, **THEN** they neither roll nor move nor collect Docks income. *(unit)*
- [ ] **GIVEN** a jailed player, **WHEN** a rival lands on their territory, **THEN** the fee is still collected. *(unit)*
- [ ] **GIVEN** a jailed player, **WHEN** they recruit, **THEN** at most one inmate crew at half price per turn. *(unit)*
- [ ] **GIVEN** 3 turns served, **WHEN** the third ends, **THEN** they are released and Heat is set to 2. *(unit)*

### Broken, not bankrupt

- [ ] **GIVEN** a debt exceeding Cash, **WHEN** settled, **THEN** Dirty Money is force-laundered at 50% **first**. *(unit)*
- [ ] **GIVEN** force-laundering covers the debt, **WHEN** it settles, **THEN** the player is **not** broken — no territory lost, no Respect lost. *(unit)*
- [ ] **GIVEN** it does not cover, **WHEN** the player breaks, **THEN** their highest-value territory goes to the creditor, they lose 3 Respect and receive $500. *(unit)*
- [ ] **GIVEN** a broken player owning nothing, **WHEN** they break, **THEN** they take the bailout and keep playing. *(unit)*
- [ ] **GIVEN** any sequence of play, **WHEN** the match runs, **THEN** **no player is ever removed from the rotation except by explicit quit**. *(simulation)*

### Truce

- [ ] **GIVEN** a truce, **WHEN** either lands on the other, **THEN** no fee is demanded. *(unit)*
- [ ] **GIVEN** a truce, **WHEN** the breaker breaks it, **THEN** they lose 3 Respect and gain exactly one free attack with no Heat cost. *(unit)*
- [ ] **GIVEN** a player with an active truce, **WHEN** offered another, **THEN** it is auto-declined. *(unit)*

### Missions and victory

- [ ] **GIVEN** a state where each seat's exact Cash, exact Dirty Money and uncompleted mission ids are set to distinct **sentinel values**, **WHEN** `viewFor` runs for each seat, **THEN** a recursive walk of the serialized payload finds none of *any other* seat's sentinels. *(unit — **blocking**)*

> Written as a sentinel search rather than a size comparison on purpose. The
> platform contract test asserts only `viewSize < stateSize`, which will always
> hold here — the view legitimately strips five other seats' hands and missions
> — **so it cannot detect a leak that keeps the payload small**. This criterion
> has to be game-specific.
- [ ] **GIVEN** a mission is completed, **WHEN** the turn ends, **THEN** it reveals, pays, and is replaced. *(unit)*
- [ ] **GIVEN** 4 districts, 30 Respect and Heat 5, **WHEN** the turn ends, **THEN** the match ends immediately with that player as Kingpin. *(unit)*
- [ ] **GIVEN** a pending decision open at Round 20's end, **WHEN** the round would close, **THEN** the decision resolves first. *(unit)*
- [ ] **GIVEN** the match ends, **WHEN** standings are built, **THEN** they sort by Empire Value descending with `detail` formatted as `"$12,400 empire"`, or `"Kingpin"`. *(unit)*

### Coverage classes

Roughly a third of Detailed Rules previously had **no acceptance criterion at
all**. Rather than enumerate thirty individual checks, these are written as
table-driven classes that **fail when someone adds an untested entry** — which
is the stronger engineering guarantee:

- [ ] **GIVEN** the six boss passives, **WHEN** the suite runs, **THEN** each has a test asserting its effect on and off, driven by the same table the rules read. *(unit — **blocking**)*
- [ ] **GIVEN** the eight district bonuses, **WHEN** the suite runs, **THEN** each has a before/after completion test, table-driven. *(unit — **blocking**)*
- [ ] **GIVEN** the eight event cards, **WHEN** the suite runs, **THEN** each has a test of its exact effect, table-driven. *(unit — **blocking**)*
- [ ] **GIVEN** the ten missions, **WHEN** the suite runs, **THEN** each has a completion-detection test and asserts its exact Respect and Cash payout. *(unit — **blocking**)*
- [ ] **GIVEN** the four Heat bands, **WHEN** a Police Checkpoint resolves at each, **THEN** the documented outcome occurs. *(unit)*

### Mechanics previously untested

- [ ] **GIVEN** a new match, **WHEN** it is dealt, **THEN** every seat has $1,500 / $0 dirty / 3 Respect / 0 Heat / 2 pool crew / 3 missions / a token on tile 0, and **no two seats share a boss**. *(unit)*
- [ ] **GIVEN** the **Police** die face, **WHEN** resolved, **THEN** Heat increases by exactly 1, independent of dirty-money accrual. *(unit)*
- [ ] **GIVEN** the **Money Bag** face, **WHEN** resolved, **THEN** the player gains exactly $150. *(unit)*
- [ ] **GIVEN** the **Car** face, **WHEN** the player adds 1–3 tiles, **THEN** movement resolves from the adjusted tile and values outside 1–3 are rejected. *(unit)*
- [ ] **GIVEN** a **strike**, **WHEN** it resolves, **THEN** pool crew fight pool crew, the loser loses 1 pool crew, the winner gains 1 Respect, the attacker gains 1 Heat, and **no territory changes hands**. *(unit — **blocking**)*
- [ ] **GIVEN** a strike, **WHEN** it is declared, **THEN** it opens **no pending decision** — the defender never answers. *(unit)*
- [ ] **GIVEN** each bribe tier, **WHEN** resolved, **THEN** cost, odds, −3 on success and +2 with the money gone on failure all match Formulas, and the Corrupt Politician halves the cost. *(unit)*
- [ ] **GIVEN** each laundering context, **WHEN** used, **THEN** the rate matches Formulas, and landing on The Safehouse also sheds 1 Heat. *(unit)*
- [ ] **GIVEN** City Hall, **WHEN** Respect is bought, **THEN** it costs $150 per point and no more than 3 points are sold per visit. *(unit)*
- [ ] **GIVEN** an upgrade, **WHEN** applied, **THEN** levels are sequential with no skipping, cost matches Formulas, and Level 5 requires a second garrisoned crew. *(unit)*
- [ ] **GIVEN** crew and enforcers, **WHEN** recruited, **THEN** costs match, an enforcer counts as 2 in combat, and a crew member is in the pool **or** a garrison, never both. *(unit)*
- [ ] **GIVEN** a completed district, **WHEN** it completes, **THEN** the owner gains **+1 Respect** — **+2** for The Godfather. *(unit)*
- [ ] **GIVEN** a turf war, **WHEN** declared, **THEN** at most one may be declared per turn. *(unit)*
- [ ] **GIVEN** Respect at 0, **WHEN** a penalty would take it lower, **THEN** it stays at 0. *(unit — **blocking**)*
- [ ] **GIVEN** a player's third break, **WHEN** it resolves, **THEN** the debt clears and they lose 3 Respect but receive **no cash**. *(unit — **blocking**)*
- [ ] **GIVEN** tied Empire Values at Round 20, **WHEN** standings are built, **THEN** they break on territories → Respect → seat order. *(unit)*
- [ ] **GIVEN** a truce offer that expires unanswered, **WHEN** it resolves, **THEN** it is declined. *(unit)*
- [ ] **GIVEN** a player who quits, **WHEN** it resolves, **THEN** their territories return to unowned, their crew disband, and they rank below every active player. *(unit)*

### Platform and failure modes

- [ ] **GIVEN** malformed or corrupt `GameSession.state`, **WHEN** `parseState` runs, **THEN** it returns null and fails closed rather than throwing. *(unit — **blocking**)*
- [ ] **GIVEN** a resolver called twice for the same expired decision, **WHEN** both run, **THEN** the second is a no-op — no double charge, no double payout. *(unit — **blocking**)*
- [ ] **GIVEN** a resolver called **before** `expiresAt` against the server's `ctx.now`, **WHEN** it runs, **THEN** it is rejected and the decision stays open. *(unit — **blocking**)*
- [ ] **GIVEN** a player quits while a decision addressed to them is open, **WHEN** it resolves, **THEN** the default applies first, then the quit. *(unit)*
- [ ] **GIVEN** the last human leaves, **WHEN** the session resolves, **THEN** it ends abandoned with no winner. *(unit)*
- [ ] **GIVEN** the Nuno deck is exhausted, **WHEN** it reshuffles under a fixed seed, **THEN** the result is deterministic — the regression that must land **with** the ADR-0005 `ctx` amendment. *(unit — **blocking**)*

### Platform contract and performance

- [ ] **GIVEN** the module is registered, **WHEN** `tests/game-module.test.ts` runs, **THEN** every contract test passes unchanged. *(unit — **blocking**)*
- [ ] **GIVEN** a 6-seat state at **maximum plausible population** — all 24 territories owned and upgraded where legal, every seat holding 3 secret missions plus revealed ones, ~12 crew each, an active truce and an open pending decision — **WHEN** serialized to JSON, **THEN** it is under **50 KB**. *(unit)*
- [ ] **GIVEN** the state schema, **WHEN** inspected, **THEN** it contains **no unbounded per-round log or event history** — the most likely way to breach the size budget. *(unit)*
- [ ] **GIVEN** 6 bots and a fixed seed, **WHEN** a match is simulated, **THEN** it reaches a winner within `ROUND_LIMIT` rounds with **no stalls and no rejected bot moves**. **50 seeds in CI; the full 1,000-seed sweep runs nightly.** *(simulation — **blocking**)*
- [ ] **GIVEN** the 1,000-seed corpus, **WHEN** each move is applied, **THEN** an invariant holds after every one: `standings().length` never shrinks, and no seat's `eliminated` flips true except immediately after `quit()`. *(simulation — **blocking**)*
- [ ] **GIVEN** a full 20-round match vs CPUs, **WHEN** played live in a lobby, **THEN** it completes end to end. *(manual)*

> **The `apply` < 50 ms criterion was removed.** Wall-clock assertions are
> hardware-dependent and flaky, and `coding-standards.md` forbids
> time-dependent assertions outright. Performance is tracked instead as a
> non-blocking smoke check: record `apply`'s duration against the worst-case
> state above and flag only a >2× regression from a recorded baseline.
>
> **The 1,000-seed sweep was moved out of the per-push gate.** At roughly
> 1.2–2.4M `apply` calls it runs in minutes, and CI runs on every push to main
> and every PR across the whole repo — a tax on unrelated work.

## Visual/Audio Requirements

### Palette

Following Nuno's precedent: game art tokens live in a **non-theme-scoped
`:root` block** in `app/globals.css`, separate from app tokens, because a board
looks the same in any theme.

| Token group | Purpose |
|---|---|
| `--ew-felt-center` / `--ew-felt-edge` | The table — deeper purple than the app indigo, matching the cover art's wet-asphalt sheen |
| `--ew-gold` / `--ew-gold-edge` | Art-deco gold for tile edges, wordmark, district completion |
| `--ew-neon` | The skyline glow from the logo — sparingly, for the Kingpin track only |
| `--ew-district-1…8` | Eight district bands (the property-strip analogue) |
| `--ew-heat-clean/-watched/-raid/-federal` | The Heat track's four bands |

Player identity keeps the **platform** tokens (`chart-1…6`, one per seat) so a
player is the same colour in the lobby and at the table. The chip motif is
platform-level and must not fork per game. Colour comes from
`LobbyMember.seat`, never from the avatar a player picked — see
`components/avatar-chip.tsx`.

**The board is DOM/CSS**, like Nuno's cards — no canvas. 32 tiles around a
square, each a styled element with a district band, name, price, level pips and
an owner chip.

### Motion

Within `design/art-direction.md`'s 150–250 ms budget:

| Moment | Treatment |
|---|---|
| Dice roll | 2d6 + action die tumble and settle, ~600 ms — the one deliberate exception, because a die that does not tumble does not read as a die |
| Token move | Step tile-to-tile at ~120 ms, easing out on the last step |
| **The standoff** | The "one orchestrated moment per screen" art direction allows. Board dims, the two chips face off, crew and defence shown, dice thrown between them |
| Heat band change | The track pulses; the Most Wanted badge fades in slowly, never pops |
| Raid | A red-and-blue wash crosses the board once; the Dirty Money counter drains to zero |
| District completed | The three tiles' bands light and visually connect |

All gated on `prefers-reduced-motion`, which collapses tokens to instant
placement and dice to a straight result.

### Audio

Specified now, implemented when the platform gains an audio layer — there is
none today. Dice as wooden clatter; token movement as a soft **chip tap**,
tying the game to the platform motif; a low brass sting on a refused payment; a
distant muffled siren on a raid; a short brass flourish on district completion.
Music is sparse 1930s lounge piano — atmosphere, not a soundtrack. Muted by
default until a settings toggle exists.

### Assets

Both files exist at `public/games/empire-wars/`. Both need work before ship: the
logo is **6.3 MB** and should be a 512×512 PNG per the catalog convention; the
cover is **2.3 MB at 1712×941**, which crops slightly against the spec'd
1280×800 (16:10) — acceptable, since the subject sits in the lower two-thirds,
but it should be resized and compressed.

## UI Requirements

The board lives in `components/game/empire-wars/board.tsx` and must fit
`GameScreen`'s existing `lg:grid-cols-[1fr_300px]` split alongside game chat —
**no changes to the shell** (ADR-0004).

| Region | Contents |
|---|---|
| **Board** | 32 tiles in a square ring; centre shows the active player, round counter, and the Kingpin race |
| **Your rail** (bottom) | Cash · Dirty Money · Respect · Heat track · crew pool · boss card · 3 mission cards |
| **Opponent strips** | Per rival: avatar chip, Respect, Heat, territory count, crew count — the public model, nothing more |
| **Decision overlay** | The standoff or truce offer, with a countdown ring |

Four pieces carry the design:

1. **The Heat track is always visible**, colour-banded, with the Most Wanted
   badge. If a player cannot see their Heat rising, the entire anti-runaway
   mechanic is invisible and reads as arbitrary punishment.
2. **Dirty Money always shows its running cost inline** — `$1,200 · +3
   Heat/round`. The squeeze only works if the number is in your face.
3. **The standoff overlay** is the anchor moment: the fee, your crew against
   their defence, Pay / Refuse, and a countdown. It must state the default
   explicitly ("No answer pays the fee") so a timeout never feels stolen.
4. **A declined tile shows its mark-down** — the new price with the old struck
   through. Declining has a visible consequence or it reads as nothing
   happening.

Plus a **territory popover** — price, income, level, upgrade cost, owner — on
any tile.

### Two presentations, one rule set

Adjacency is a declared neighbour list (see Edge Cases), so the board is free
to render differently per breakpoint **without any rule changing**:

| Breakpoint | Board |
|---|---|
| `lg` and up (≥1024px) | The 32-tile ring, centre panel inside it |
| Below `lg` | **Eight district columns**, stacked and scrollable — each column a district, its three tiles as rows, specials in a separate strip |

The ring cannot survive a phone: `GameScreen`'s split only activates at `lg`,
so below it the board gets roughly 340px across about nine tile-widths a side —
**~38px per tile**, which cannot carry a name, a price, level pips and an owner
chip. ADR-0004 forbids changing the shell to make room, so the board is what
adapts.

**Minimum viable tile content is smaller than a first draft wants.** At any
size, a tile carries only a **district band, an owner chip and level pips** —
all shape- and position-encoded, none of them text. Name, price, income and
upgrade cost live in the popover. Nuno's own cards set this precedent: colour
and one large glyph, never text at small sizes.

### Pay / Refuse is two equal choices, and the button system has no slot for it

`Button` ships `default` (gold — status: ready, won, NUNO) and `game` (purple —
the primary action on the felt), with a standing rule that the two never sit
side by side competing for one decision. **Pay and Refuse are genuinely
co-equal** — the entire Player Fantasy rests on refusing being a real option,
so styling Pay as primary would put a thumb on the scale.

Resolution: both take the **`game` variant**, sized and weighted identically,
distinguished by icon and label rather than colour, with the countdown ring and
the explicit default text ("No answer pays the fee") carrying the urgency. Gold
is not spent here at all. The same shape covers the truce offer's
Accept / Decline, so it is one reusable component, not a per-overlay decision.

### Accessibility

- The countdown must be **announced** to screen readers, not merely drawn —
  once on open plus one milestone, never a per-second live-region tick.
- District bands need a label or pattern, never colour alone. **Heat bands need
  the same treatment** — the doc calls Heat visibility load-bearing elsewhere,
  so it cannot be colour-only.
- Every decision must be keyboard-reachable, and a decision overlay that opens
  unprompted must **move focus to itself** and restore focus on close. It can
  appear while the player is scrolling the board or typing in chat.
- The 32-tile board needs a **navigable structure** for screen readers — an
  ordered list of tiles with district, owner, level and price in the accessible
  name. A sighted player scans the ring at a glance; there must be a non-visual
  equivalent.
- `prefers-reduced-motion` honoured throughout.
- **Simultaneous colour load** is the real risk: 8 district bands + up to 6 seat
  colours + 4 Heat bands on one screen. Derive the district hues procedurally
  (fixed lightness and chroma, stepped hue) rather than hand-authoring eight
  independent tokens, and audit **pairwise** contrast across the whole set, not
  each against the background.
- `DECISION_WINDOW_MS` should be exposed as a **per-lobby setting**. The hard
  20-second deadline is likely exempt from WCAG 2.2.1 under the real-time
  exception — serverless genuinely requires an expiry — but exemption is not
  the same as good practice, and the knob already exists at the data layer.
- **A player who was away must be told what happened.** The overlay's explicit
  default only helps someone watching it; a backgrounded mobile tab has its
  timers throttled and may never render the overlay at all, so a player can
  return to find they paid a $1,337 fee they never saw. A "while you were away"
  recap is required. This may be a **platform** notification gap rather than
  something this game can solve alone — it currently has no owner.

> **UX Flag**: before writing implementation stories, run `/ux-design` for the
> game surface and the decision overlay. Stories should cite `design/ux/…`
> rather than this GDD.
>
> **Asset Spec**: after the art bible is approved, run
> `/asset-spec system:empire-wars-core`.

## Open Questions

### Deferred to v2 (scope decision, 2026-08-04)

Cut deliberately to keep v1 shippable and balanceable. None are cancelled:

**Deferred in the original scope pass:**

- **Black Market** tile and its item economy
- **Vehicles and weapons** as a separate item layer — v1 folds combat strength
  into crew and property level
- **Full alliances** with shared income — v1 ships the truce instead, which
  delivers alliance and betrayal without a negotiation UI
- **Informants** — a hidden-traitor mechanic among strangers is hard to balance
  and can feel bad; wants its own design pass
- **Classic elimination mode** — fights "broken, not bankrupt"
- **The jail mini-game** (escape, tunnel, riot) — v1 keeps inmate recruitment
- **The Airport as a full district** — it is a special tile in v1

**Deferred by the design review (2026-08-04):**

- **Sealed-bid auctions** — the only all-seats off-turn decision in the game.
  Cutting them keeps every pending decision single-answerer, which is what lets
  ADR-0005's "one seat on the clock" model stand unamended. Replaced by the
  decline mark-down. Revisit if playtests show the board sitting unsold.
- **All six boss actives** — two were reactive interrupts on another player's
  turn, needing a second concurrent pending decision the platform cannot
  express. Passives ship; the asymmetry survives.
- **City events** (*Police Strike*, *Election*, *Market Crash*, *Street
  Festival*, *Power Outage*, *Prison Break*) — each suspended a global rule for
  a round, making them the largest source of cross-system edge cases in the
  document. Return in v2, once there is a balanced base to interrupt.
- **The owner's side of the standoff** — letting an owner *waive* a fee
  ("this one's on the house") for goodwill and Respect would make the standoff
  a two-sided social moment rather than a one-sided risk check. Genuinely
  attractive, but it adds a branch to the game's most-exercised decision and a
  bot heuristic to go with it. Revisit once the core loop is proven.

### Open design questions

| Question | Why it matters | Resolve by | Owner |
|---|---|---|---|
| Do the combat win rates in Formulas match reality, **including Defender 6**? | They are **estimates** and the Fortress case is missing entirely. Balance work assuming them could be built on sand. | Calibration run, first week of implementation | Implementation |
| **Does territory seizure actually brake the leader?** | The whole anti-runaway premise now rests on it. If a clean leader still ends Round 20 untouched, the Overview's central promise is still false and the fix did not work. | 50-seed bot simulation, before any tuning | Implementation |
| **Is the $10–14k Empire Value target still right?** | The calibration anchor was mis-summed; a "solid mid-table" empire is $6,556, not $8,556. Either the band describes a much stronger position than intended, or the economy runs light. | First bot simulation | Implementation |
| **Do the mission Respect payouts make Kingpin reachable?** | Missions are now the only faucet that closes the gap from ~20–22 to the required 30. These ten numbers decide whether the second victory condition exists. | First 6-player playtest | Playtest |
| **Does `LEVEL_DEFENCE` still need changing after the Heat fix?** | A Fortress at 6 defence dice may be untakeable, but that is only fatal *because* the brake was broken. Deliberately not changed in this revision so the two effects stay separable. | Simulation after the Heat fix lands | Implementation |
| How many territory landings per player actually occur? | Drives income totals, Kingpin reachability and whether the decline mark-down ever fires. The previous "~14" estimate was never derived. | Bot simulation | Implementation |
| What is the real wall-clock length of 20 rounds at 6 seats? | Up to 20 s of decision window per turn is a worst case of ~40 min in waiting alone, and that estimate excludes per-move bot pacing. If it overruns, `ROUND_LIMIT` and `DECISION_WINDOW_MS` both move. | First full playtest | Playtest |
| **Does the decline mark-down fire often enough to matter?** | It replaced the auction. If players almost always buy on landing, the board never marks down and the mechanic is inert — the same question the auction had, at a tenth of the implementation cost. | First playtest | Playtest |
| Is one truce per player the right cap? | Too restrictive and diplomacy never develops; uncapped and the table can collude into stalemate. | Playtest | Playtest |
| Is fully public Heat correct? | Decided yes for the Most Wanted drama, but it also tells rivals exactly when you are safe to attack — and the Most Wanted badge already leaks a bound on hidden Cash and Dirty Money, since every other Empire Value input is public. | Playtest | Playtest |
| Can a first-time player be taught this in three minutes? | The platform's only other game is UNO, and the audience includes public walk-ins. No onboarding is designed. If the answer is no, more has to be cut. | First playtest with a new player | Playtest |

### Risks

- **The bot is still the largest schedule risk**, though a smaller one than
  before. It must handle buying, fighting, laundering, bribing, upgrading,
  striking, garrisoning and both pending decisions. It is v1 scope, not
  optional — a 30–45 minute match will have empty seats. Cutting auctions
  removed its bidding heuristic and, more importantly, removed the need to
  drive *five* off-turn bot decisions inside one human's turn. **It wants its
  own spec** (`design/gdd/empire-wars-bot.md`) before implementation is scoped.
- **Turn wait at 6 players** is the biggest UX risk. The pending-decision
  windows are what make async play possible and also what make the game slow.
  The published ~40-minute worst case counts *only* decision windows — it
  excludes per-move bot pacing (`BOT_DELAY_MS` 1–3 s) across a multi-step turn
  pipeline, which could add materially. Re-derive it against real move counts
  before the first playtest, and commit to bundling roll + move + automatic
  resolution into a single `apply` wherever no human input is needed.
- **State size** is estimated at 20–40 KB, capped at 50 KB by an acceptance
  criterion. Every move rewrites the whole `GameSession.state` row. The most
  likely way to breach it is an unbounded per-round log; an acceptance
  criterion now forbids one.
- **`apply(ctx)` must land first.** Empire Wars cannot be written against the
  current interface — see Dependencies and ADR-0005 Amendment 1. **Verify its
  true state in the working tree before starting**: the amendment's status has
  been recorded inconsistently, and a partial implementation that reads as
  complete is more dangerous than none. What is required is `ctx` threading
  *plus* server-side expiry validation; `pendingDecisionSeats` is **not**
  needed now that auctions are cut.
- **Player colour is not unique per lobby** — a live defect in shipped Nuno,
  not a new one, but Empire Wars cannot ship on top of it. See Dependencies.
  Fix it independently, ahead of this game.
- **Balance convergence.** Even after cutting four subsystems this is a large
  interaction surface for indie playtest volume. The three knobs most likely to
  move first: `MOST_WANTED_MULT`, `DIRTY_HEAT_STEP`, and the mission Respect
  payouts. Change one at a time — the review found several places where two
  plausible fixes interact and cancel (bailout × Respect floor, Heat brake ×
  Fortress defence).
