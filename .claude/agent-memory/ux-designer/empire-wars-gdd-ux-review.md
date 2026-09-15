---
name: empire-wars-gdd-ux-review
description: Findings from a critical UX audit of design/gdd/empire-wars-core.md (2026-08-04) — several are BLOCKING and constrain the rules themselves, not just presentation.
metadata:
  type: project
---

A UX audit of `design/gdd/empire-wars-core.md` (as of its "Last Updated: 2026-08-04"
revision) found multiple BLOCKING problems that the GDD's own closing "UX Flag"
(defer to `/ux-design` before implementation stories) does not appropriately cover,
because they constrain the rules, not just the surface.

**Why this matters**: the GDD explicitly says implementation stories should cite
`design/ux/…` rather than the GDD itself, and defers "the game surface and the
decision overlay" wholesale to a future `/ux-design` pass. That deferral is only
safe for cosmetic/interaction-detail decisions. Several findings below are not
UX-layer-fixable and must be resolved in the GDD (or ADR-0005) first.

## Findings that block starting `/ux-design` (need a GDD/rules answer first)

1. **32-tile square ring likely does not fit `GameScreen`'s shell on mobile.**
   `app/(platform)/lobby/[id]/game/game-screen.tsx` only splits into
   `lg:grid-cols-[1fr_300px]` at the `lg` (1024px) breakpoint; below that (all
   phones) the board gets the *full* single-column width minus `px-4` padding —
   roughly 340px on a typical phone. A 32-tile ring (7 non-corner tiles per side)
   at that width works out to ~38px/tile, before even trying to fit "district
   band, name, price, level pips, owner chip" per tile as the GDD's Visual
   Requirements specify. Desktop is tight-but-survivable only near the 1152px
   `max-w-6xl` cap; a half-width laptop window (~760px, still ≥1024px `lg`) drops
   to ~44px/tile. **This is a board-representation/rules question (does
   turf-war adjacency still make sense if the board isn't a literal ring on small
   viewports?), not a pure UX polish question** — per ADR-0004 the shell cannot
   change, so something about the board's own size/representation has to give.
2. **The Gun action-die face and the Truce section's "strike" are undefined
   combat types.** Detailed Rules only resolves two attack types (protection
   standoff, turf war). Gun ("attack one rival within 6 tiles… or who owns a
   territory adjacent to one of yours") and "strike" (mentioned once, in Truce,
   nowhere else) have no resolution, no outcome table, and aren't in the Pending
   Decisions table (`protection | auction | truce` only) — so it's unclear if a
   Gun attack is even a decision the target can decline. No overlay can be
   designed for an undefined mechanic; this is a Detailed Rules/Formulas gap
   wearing a UX costume.
3. **Pay / Refuse (and Accept / Decline truce) violate the platform's "one
   primary per view" button rule** (`CLAUDE.md`: `default` gold = status only,
   `game` purple = the one on-felt primary, "never put the two side by side
   competing for the same decision"). These are genuinely symmetric binary
   choices, not primary+secondary — the variant system has no slot for that
   shape. This repeats across all three pending-decision types, so needs one
   reusable resolution, not a per-overlay guess.

## Findings that are real but properly UX/implementation-layer (fix in `/ux-design` or CSS)

- `chart-1…5` (`app/globals.css`) only defines **5** player-seat colors, but
  `MIN/MAX_PLAYERS` is 2–6 for Empire Wars (and Nuno already allows 6 too — see
  [[player-seat-color-gap]]). Empire Wars leans on owner-chip color far more
  heavily as core, constant information architecture than Nuno does, so the
  gap is more consequential here even though it isn't new.
- The **Most Wanted badge is public** and is computed from Empire Value, which
  is `cash + dirty×0.5 + [public territory/crew/respect value]` — since
  everything except cash/dirty is already public, crossing the Most Wanted
  threshold leaks a lower bound on a player's "private" cash + dirty holdings.
  This undermines the stated privacy model even though the literal
  `viewFor` payload never contains the exact numbers (the blocking acceptance
  criterion would still pass — this leak is only visible from a UX/information-
  architecture read, not a code-level test).
- **No onboarding design exists** for a game with 3 currencies, a 4-band Heat
  meter, 8 district bonuses, 6 boss abilities, and 3 hidden missions, on a
  platform whose only sibling game is UNO and whose stated audience includes
  "public walk-ins" (strangers). The GDD's accessibility list has zero items
  about cognitive-load/rules-onboarding.
- **Turn-wait (the GDD's own stated #1 risk) has no mitigating UX spec** beyond
  the in-overlay countdown ring, which only helps a player already looking.
  Needs: a way to tell "your turn" apart from "you must answer in 20s" apart
  from "just watch," and an activity feed for the long gaps between a player's
  own turns (6-seat games mean ~5-turn gaps).
- **Default-on-timeout (Pay/no-bid/decline) has no "away" recap.** A player who
  is backgrounded on mobile for the 20s window loses money/state with zero
  after-the-fact acknowledgment — the GDD's mitigation text ("state the default
  explicitly") only reaches players who are already watching the overlay live.
  This may need a platform-level notification/recap system, not something a
  single game's UX spec can solve alone — flag the ownership question when
  scoping `/ux-design`.
- Accessibility list (countdown announced, district-band pattern, keyboard
  reach, reduced-motion) misses: **Heat bands need the same
  label-or-pattern-not-color-alone treatment as district bands** (not listed,
  despite Heat being called out as core-to-the-mechanic elsewhere in the same
  doc); screen-reader navigability of a 32-node board with no spatial/DOM-order
  semantics specified; focus management when a decision overlay opens
  unprompted while the player is elsewhere on the page.
