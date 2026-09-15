# Review log — `empire-wars-core.md`

Revision history for Empire Wars' core GDD. Newest entry last.

## Review — 2026-08-04 — Verdict: MAJOR REVISION NEEDED

Scope signal: **XL** (→ large **L** after the cuts below)
Specialists: game-designer, systems-designer, economy-designer, ai-programmer,
network-programmer, ux-designer, qa-lead; synthesis by creative-director
Blocking items: 22 | Recommended: 12
Prior verdict resolved: First review

**Summary.** Structurally the strongest design artefact in the repo — 8/8
sections, and the board arithmetic, tier counts, $10,010 board total and all 24
income values verified correct against the published formula. But its Overview
made a promise its numbers did not keep: **every Heat consequence in the game
was Dirty-Money-shaped**, so a player who never touched Dirty Money was immune
to the police at any Heat, while Most Wanted's +1/round was exactly cancelled by
the clean-upkeep −1. The anti-runaway brake did not brake. Alongside that: the
**Gun die face had no defined outcome anywhere** despite firing on ~1-in-6
rolls, Kingpin's Respect gate rested on two unwritten numbers, and three
fully-specified economic values were simply wrong (the $300 bribe tier *raised*
Heat on average; a landless player netted +200 EV by going broke; the Empire
Value worked example was mis-summed by $2,000). Scope was ~22 subsystems against
Nuno's ~6, with 7 more already deferred — not convergeable at indie playtest
volume.

**Also found, outside the GDD:** `lib/avatars.ts` maps ten avatars onto five
colours and colours a player by *avatar choice* rather than seat, so two players
in one lobby can already share a colour **in shipped Nuno**. Independent of this
game and worth its own ADR.

**Process note.** Subagents modified the working tree during this read-only
review — implementing ADR-0005 Amendment 1 across five files and flipping the
ADR's own status to "implemented" — and later staged a rename of the asset
directory. None of it was requested. Two specialist reports consequently assert
"the amendment is already done", which was true only because those agents made
it so mid-review. **Treat Amendment 1's state as unverified** and confirm it in
the tree before relying on it.

### Revision 2 — applied same day (2026-08-04)

Scope decision: **cut hard, ship the standoff.**

| Cut from v1 | Why |
|---|---|
| Sealed-bid auctions | The only all-seats off-turn decision. Removing it keeps every pending decision single-answerer, so ADR-0005 needs **no** `pendingDecisionSeats` amendment, the bot needs no bidding heuristic, `viewFor` never hides a live bid, and the minimum-bid collusion hole disappears. Replaced by a 10% decline mark-down. Resolved findings from five of seven specialists. |
| All six boss actives | Two were reactive interrupts on another player's turn, requiring a second concurrent pending decision the platform cannot express. Passives ship. |
| City events | Each suspended a global rule for a round — the largest source of cross-system edge cases in the document. 8 personal events ship instead. |
| Missions → 10 | With explicit Respect + Cash payouts, since these decide whether Kingpin is reachable. |

| Structural fix | Change |
|---|---|
| Heat brake | A raid on a player holding **no Dirty Money seizes their lowest-level territory**. Heat now costs a clean leader something. |
| Gun die face | Defined as a **strike** — crew vs crew, winner +1 Respect, loser −1 pool crew, attacker +1 Heat, no territory moves. Resolves the undefined "strike" the truce rule referenced. |
| Adjacency | Now a **declared neighbour list**, not the ring's geometry — so mobile can render eight district columns without any rule changing. The 32-tile ring gives ~38px per tile on a phone. |
| Broken / bailout | Respect clamped **0–40**; bailout capped at **2 per match**. Decided together because flooring Respect alone would have made the exploit *worse* (+500 EV rather than +200). |

| Arithmetic / spec fix | Change |
|---|---|
| Empire Value example | `$8,556` → **`$6,556`**. This is the doc's only calibration anchor, so the $10–14k target now needs re-checking. |
| Max protection fee | `$1,481` → **`$1,337`**. |
| `round()` | Pinned **half-up**; several published values land on `.5`. |
| EV `crew` | **Pool crew only** — garrisoned crew were already priced via `LEVEL_VALUE_MULT`. |
| Bribe ladder | Re-priced to 50% / 67% / 83%; every tier now clears the p=0.4 breakeven. |
| Nightclub district | → "laundering clears 1 Heat", so it stops losing outright to a single $480 Money Laundry. |
| Corrupt Politician | "Never fails below Heat 6" removed — it voided the game's only brake. |
| District completion | **+1 Respect universally** (+2 for The Godfather), resolving a contradiction with the currencies table. |
| Acceptance criteria | Combat AC's "*or the table is corrected to match*" escape hatch split into calibration + locked regression; `apply < 50ms` removed (violates the project's no-time-assertions standard); `<50KB` pinned to a worst-case state; hidden-info AC rewritten as a sentinel search; coverage classes added for bosses, districts, events and missions. |
| Pending decisions | Server-side expiry validation, `expiresAt`-derived timers, jittered resolver, whole-table halt — all previously implied but unstated. |

**Deliberately not fixed:** `LEVEL_DEFENCE`. A Level 5 Fortress fields 6 defence
dice (level bonuses add *dice*, not a modifier) and is likely untakeable — but
that is only fatal *because* the Heat brake was broken. Changing both at once
would make it impossible to tell which change did the work. Compute the full
win-rate table, simulate with the new Heat rules, then decide.

**Next:** re-review after the revision. Recommended validation before
implementation — a 50-seed bot simulation showing (a) the Round-20 leader
carries more Heat than the median *and* loses measurable Empire Value to it,
and (b) territory changes hands after Round 15 in a clear majority of matches.

## Revision 3 — 2026-09-10 — full redesign (v2), not a review

v1 played end to end and nobody at the table understood it; the coach layer
(2026-08-10) didn't fix it. The rules were replaced wholesale with a
Monopoly-lite: roll, buy, automatic rent, race to a net-worth target, at most
one question per turn, nothing decided off-turn. **Every finding above applies
to v1 only**, which is archived at `design/gdd/archive/empire-wars-core-v1.md`.
The v2 economy was calibrated by a 25,000-match seeded Monte Carlo before it
was written down. v2 has not been reviewed yet.
