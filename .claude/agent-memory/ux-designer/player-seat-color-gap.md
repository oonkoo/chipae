---
name: player-seat-color-gap
description: The platform's chart-1…5 seat-color tokens only cover 5 players, but the game module interface allows up to 6 seats — confirmed live gap as of 2026-08-04.
metadata:
  type: reference
---

`app/globals.css` defines exactly 5 seat-identity colors (`--chart-1`
through `--chart-5`: gold, mint, coral, sky, lavender — comment at line 75
literally says "chart-1..5 double as player seat colors"). `design/art-direction.md`
documents the same 5.

But both games on the platform allow a 6th seat: `lib/game/data/nuno.ts` and
Empire Wars' Tuning Knobs both set `maxPlayers`/`MAX_PLAYERS` to 6. There is no
6th seat-identity color and no documented fallback treatment (pattern, texture,
numbered badge) for it.

**Why this matters**: this is a platform-level design-token gap, not a
per-game bug — it will resurface in any game UI that colors seats/owners at 6
players. Nuno's opponent-seat chips likely mask it today (avatar + label +
card-count carries identity even without a unique hue), but any board-style
game that relies on color-coded ownership markers (like Empire Wars' owner
chips on tiles) will expose it directly.

**How to apply**: before shipping any 6-seat visual design that codes identity
by color, either get a 6th `chart-*` token added (coordinate with art-director,
since palette values are a visual-style decision outside ux-designer's
authority) or design seat 6 with a non-color differentiator (pattern, shape,
numeral) from the start rather than reusing another seat's hue.
