# Building with Chipae

Chipae is a social game platform — "night lounge, table stakes." Deep indigo
felt, chip-gold highlights, a seat for every friend. Warm and social, never
cold cyber-neon.

## Wrap everything in `ChipaeTheme`

**Dark is the only theme Chipae ships.** Every tree must be wrapped:

```jsx
const { ChipaeTheme, Button, Card, CardHeader, CardTitle } = window.Chipae;

<ChipaeTheme>
  <Card>
    <CardHeader><CardTitle>chicken's table</CardTitle></CardHeader>
  </Card>
</ChipaeTheme>
```

Without it every colour token falls back to the light palette the product does
not ship, and text lands on the wrong surface. `ChipaeTheme` also sets `dark`
on the document root — `Dialog` and `Popover` render through a portal attached
to `document.body`, outside the React tree, and would otherwise come out light.

## Styling idiom: Tailwind utilities bound to semantic tokens

Style with Tailwind utility classes. Never hardcode a hex, `rgb()` or
`oklch()` literal, and never use a stock Tailwind palette class
(`bg-blue-500`) — the codebase contains zero of both by design. Use these:

| Purpose | Classes |
|---|---|
| Surfaces | `bg-background`, `bg-card`, `bg-popover`, `bg-muted`, `bg-secondary`, `bg-accent` |
| Text | `text-foreground`, `text-muted-foreground`, `text-card-foreground`, `text-popover-foreground` |
| Brand / action | `bg-primary` + `text-primary-foreground`, `ring-ring` |
| Status | `text-destructive`, `bg-destructive`, `text-success`, `bg-success` |
| Lines | `border-border`, `border-input` |
| Seat colours | `bg-chart-1` … `bg-chart-5` — gold, mint, coral, sky, lavender, in seat order |
| Type | `font-sans` (body), `font-heading` (display), `font-mono` (codes, stats) |
| Radius | `rounded-lg`, `rounded-2xl`, `rounded-4xl` (pill) |

Underlying custom properties, if you need `var()` directly: `--background`,
`--foreground`, `--card`, `--popover`, `--primary`, `--secondary`, `--muted`,
`--accent`, `--destructive`, `--success`, `--border`, `--input`, `--ring`,
`--chart-1`…`--chart-5`, `--radius`, `--font-sans`, `--font-display`,
`--font-geist-mono`.

Rules that matter: **gold is spent, not spread** — one `bg-primary` CTA per
view, never as a large fill. Status colours mean status, never decoration.
Depth comes from layered indigo surfaces (`bg-background` → `bg-card` →
`bg-popover`), not shadows; shadows only on floating elements.

`font-heading` is Lilita One — headlines and section titles only, never body
text. Join codes and stats are `font-mono`, letter-spaced and uppercase.

## Buttons have thickness — pick the right one

`Button` has two dimensional variants plus the flat ones:

- **`default`** — the gold chip pill. Hover lifts it, press sinks it into the
  table. This is the brand's primary action.
- **`game`** — candy 3D in the logo's purple. Use it for the primary action
  *on the felt*, where gold is reserved for status (ready, won, NUNO).
- `outline`, `secondary`, `ghost`, `destructive`, `link` are flat.

Sizes: `default`, `xs`, `sm`, `lg`, `xl`, and the square `icon`, `icon-xs`,
`icon-sm`, `icon-lg`.

Still one primary per view. Gold and purple are both loud — do not put a
`default` and a `game` button side by side competing for the same decision.

The dimensionality comes from token families you can reach with `var()` if you
build a custom surface: `--primary-hi/-lo/-edge`, `--game`, `--game-hi/-lo/
-edge/-ink`, `--gloss`, `--gloss-strong`, `--gloss-weak`, `--btn-ink-shadow`.
Note there is **no `bg-game` utility class** in the shipped stylesheet — reach
those values through `var(--game)`, or just use `<Button variant="game">`.

## Nuno game cards have their own palette

`NunoCardFace`, `NunoCardBack` and `NunoCardFan` are the deck for Nuno. Their
colours (`--nuno-red`, `--nuno-blue`, `--nuno-green`, `--nuno-yellow`,
`--nuno-wild`, `--nuno-paper`, `--nuno-ink`, `--nuno-oval`, `--nuno-shade`)
are deliberately independent of the app theme — a printed card looks the same
in any theme. The table surface uses `--felt-center` / `--felt-edge`. Do not
restyle cards with app tokens.

## Where the truth lives

- `styles.css` and its `@import` closure (`_ds_bundle.css`, `fonts/fonts.css`)
  — every token and component style, the authoritative source.
- `guidelines/design/art-direction.md` — palette rationale, the chip motif,
  typography, motion, and the product's voice. Read it before writing copy.
- `components/<group>/<Name>/<Name>.prompt.md` — per-component API and usage.

## Notes

- Voice is game-night host, not esports announcer: "Take a seat", "Deal you
  in?", "Your table is ready". Empty states invite action.
- The chip motif (`AvatarChip`) appears only where a *player* or a *seat* is
  represented — nowhere else.
- The Chipae logo is a glossy badge that already contains the wordmark. It is
  not part of this bundle (it renders through a Next-only image component), so
  never draw it, and never place the word "Chipae" next to it.
- No icon components are exported. `AvatarChip` renders its own glyph; for
  other icons use text or inline SVG.
- Compound parts must be composed inside their parent: `CardHeader`/
  `CardTitle`/`CardDescription`/`CardAction`/`CardContent`/`CardFooter` inside
  `Card`; `DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`/
  `DialogFooter`/`DialogClose` inside `Dialog`; the `Popover*` parts inside
  `Popover`.
