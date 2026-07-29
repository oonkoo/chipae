# Chipae — Art Direction

**Concept: "Night lounge, table stakes."** Chipae comes from *chip* — the token you put on the table when you sit down to play. The visual world is a game table at night: deep indigo felt, chip-gold highlights, and a seat for every friend. Warm and social, not cold cyber-neon. Dark mode is the default experience; light mode is a supported variant.

## Signature motif — the Chip

The chip is the recurring element the platform is remembered by:

- **Avatars sit in chip rings** — a circular frame with a dashed/notched edge like a poker chip. Ready state fills the ring in player color.
- **Lobby join codes are tickets** — monospace (Geist Mono), letter-spaced, on a card that reads like a claim ticket.
- **The logo is a chip** — a gold disc with a notched ring (favicon + landing hero).
- Use the motif with restraint: chips appear where a *player* or a *seat* is represented, nowhere else.

## Palette

Dark (default):

| Token | Value | Use |
|---|---|---|
| background | `oklch(0.19 0.045 290)` | indigo felt |
| card / surface | `oklch(0.23 0.05 290)` | table surfaces |
| foreground | `oklch(0.96 0.015 90)` | warm off-white text |
| **primary — chip gold** | `oklch(0.82 0.155 85)` | CTAs, focus ring, brand |
| success — mint | `oklch(0.78 0.15 165)` | online, ready |
| destructive — coral | `oklch(0.70 0.19 25)` | errors, leave/kick |
| border | warm white @ 12% | hairlines, tinted warm not gray |

**Player colors** (= chart-1…5, in seat order): gold, mint, coral, sky `oklch(0.75 0.12 235)`, lavender `oklch(0.75 0.12 305)`. Player 1 is always gold. Bots/CPU use the seat color at 50% opacity with a dashed ring.

Rules: gold is spent on actions and identity, never on large fills; one gold CTA per view. Status colors mean status — never decoration.

## Typography

| Role | Face | Notes |
|---|---|---|
| Display / headings | **Lilita One** | chunky, rounded, board-game energy; headlines and section titles only, never body |
| Body / UI | **Nunito Sans** | already the app font; friendly, highly legible |
| Data / codes | **Geist Mono** | join codes, stats, timers; letter-spaced uppercase for codes |

No pixel fonts (Press Start 2P et al.) — that's the templated "game" look.

## Shape & depth

- Chunky radii (`--radius: 0.75rem`; buttons already pill-shaped via `rounded-4xl`). Everything touchable feels like a token: rounded, solid, pressable.
- Depth comes from layered indigo surfaces (bg → card → popover), not shadows. Shadows only on floating elements (popovers, dragged cards).

## Motion

- Micro-interactions: 150–250 ms ease-out; press = 1 px translate (already in button) — snappy, arcade-cabinet tactile.
- One orchestrated moment per screen max (e.g., players "taking seats" when a lobby fills). Respect `prefers-reduced-motion`.

## Voice

Game-night host, not esports announcer: "Take a seat", "Deal you in?", "Your table is ready". Empty states invite action ("No friends yet — deal someone in"). Errors say what happened and the next move, no apologies, no mascot jokes.
