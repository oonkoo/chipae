# Empire Wars — Art Manifest (v3, empires)

Everything the game shows as painted art: where each file lives, what it
depicts, and whether it's in. **Nothing here blocks play** — anything missing
falls back to a stand-in drawn in code (see *Stand-ins*).

> 2026-09-11: every city, crest, house, monument and piece is in. The game's
> roster (`lib/game/data/empire-wars.ts`) was changed to match the art — the
> art came first. Only the six special tiles are still missing.

## How to add a file

1. Drop it at the path below, named by the game's id (`rome`, not `roman`).
2. Add its id to the matching set in `components/game/empire-wars/art.tsx`
   (`CITY_ART`, `EMPIRE_ART`, `MONUMENT_ART`, `SPECIAL_ART`). The sets are a
   manifest rather than a filesystem check — a component can't stat a file, and
   an `<Image>` pointed at a missing src 404s on every render.

Pieces are listed in `PLAYER_PIECES` in `components/game/empire-wars/icons.tsx`.

A new city or empire in the game data needs its art made **first** — the roster
and the art must name the same things.

## The house style

| | |
|---|---|
| **Look** | Chunky, toy-like painted miniatures: bright saturated colour, thick gold trim, glossy board-game finish, three-quarter view. Monuments are collectible models on a round base in the empire's band colour |
| **Content** | No text, no human or animal faces |
| **Background** | **Transparent**, no floor shadow, no base ring (the game draws the seat ring itself). Gemini can't export alpha — generate on flat white and cut out, feathering the edge so no white halo shows on the dark felt |
| **Format** | PNG with alpha. Cities, crests, houses, pieces **128×128**; monuments **500–512 px**. Check a file really is a PNG — image tools save JPEGs with a `.png` name |
| **The test** | Squint at 40 px. The shape alone should say what it is |

### Empire band colours

Each band matches its empire's crest medallion and monument base, so band,
crest and monument read as one empire (`--ew-district-*` in `app/globals.css`):

| # | Empire | Band |
|---|---|---|
| 1 | Ottoman Empire | Iznik teal `#2f7d7a` |
| 2 | Rome | Tyrian purple `#9b4f96` |
| 3 | Mongol Empire | steppe slate `#6b7f8f` |
| 4 | Ming China | bronze `#7a6a4f` |
| 5 | Mughal Empire | red sandstone `#b8603f` |
| 6 | France | royal blue `#4a5db8` |
| 7 | Britain | crimson `#c0392b` |
| 8 | Bengal | green `#3f7f52` |

---

## 0. The board — "The Emperor's Map Table"

The table's materials (walnut, brass, enamel, parchment) are CSS: `--ew-*`
tokens and `ew-*` utilities in `app/globals.css`. Painted art replaces or
enriches them:

| File | Size | Renders | Status |
|---|---|---|---|
| `board/centerpiece-wide.webp` | 1920×1288 (3:2), ~220 KB | the ring's centre on a wide stage | ✓ |
| `board/centerpiece-square.webp` | 1440×1440, ~180 KB | the ring's centre on a square stage (phones) | ✓ |
| `board/walnut.webp` — walnut texture, seamless, evenly lit | 512×512, ~17 KB | tile plaques, corners and the frame (`--ew-walnut`), tinted by the `ew-*` utilities | ✓ |
| `board/parchment.webp` — parchment texture, seamless, evenly lit | 512×512, ~4 KB | Fortune and Royal Decree tiles (`--ew-parchment-tex` in `ew-card`) | ✓ |
| `board/corner.webp` — gold corner ornament, transparent | 256×256, ~27 KB | outer corner of the four corner tiles; all four corners of the setup, toss, how-to-play and Market dialogs (`CornerOrnament` / `FrameCorners` in `art.tsx`) | ✓ |

The ornament is painted as a **bottom-left** piece; the other corners are
mirrors of it. In a dialog the ornaments sit under the content, so the dialog
must `isolate`.

The ring takes exactly two shapes — square, or 3:2 when its stage is wider than
5:4 (`ew-stage-wide` in `globals.css`) — and shows the matching centerpiece, so
the painted gilt frame is never cropped. Keep both files' frames and props
clear of the edges, and the middle calm: the dice, prompt, auctions and trades
sit there on walnut panels.

## 1. Empires — 8 of 8 in

**Paths**: `crests/<empire-id>.png` (128), `houses/<empire-id>.png` (128),
`monuments/<empire-id>.png` (500)
**Renders**: crest — city card, Market, auction; houses — 1–4 on the tile and
in the tribute ladder; monument — the tile once raised, and the ladder.

| Empire | Crest | House | Monument |
|---|---|---|---|
| Ottoman Empire | red tulip | timber-framed house | Topkapı Palace (Gate of Salutation) |
| Rome | legionary helmet | villa, red roof | The Colosseum |
| Mongol Empire | horsehair war banner | ger | The Genghis Khan Statue |
| Ming China | red paper lantern | pagoda-roof house | The Forbidden City |
| Mughal Empire | peacock feather | sandstone pavilion | The Taj Mahal |
| France | fleur-de-lis | Paris townhouse | The Eiffel Tower |
| Britain | Tudor rose | Tudor cottage | Big Ben |
| Bengal | water lily | thatched do-chala hut | Hazarduari Palace |

## 2. Cities — 24 of 24 in

**Path**: `cities/<city-id>.png` · 128×128
**Renders**: the tile's picture (right-aligned, ~35 px on a desktop board), the
city card's header, the auction panel.

| Empire | Cities (board order) and what each shows |
|---|---|
| Ottoman Empire | `edirne` jewelled kilij · `bursa` silk spool · `istanbul` copper coffee pot |
| Rome | `pompeii` erupting volcano · `ravenna` gold-and-blue mosaic · `rome` legionary shield |
| Mongol Empire | `tabriz` Persian carpet · `sarai` golden tent · `karakorum` silver-tree fountain |
| Ming China | `guangzhou` tea chest · `nanjing` treasure junk · `beijing` blue-and-white vase |
| Mughal Empire | `lahore` kite · `delhi` diamond on a cushion · `agra` indigo dye |
| France | `marseille` olive-oil soap · `lyon` red wine · `paris` macarons |
| Britain | `liverpool` ship's anchor · `manchester` cotton and bobbin · `london` gold bars |
| Bengal | `sonargaon` sheaf of rice · `dhaka` muslin loom · `murshidabad` jewelled turban ornament |

## 3. Player pieces — 6 of 6 in

**Path**: `pieces/<id>.webp` · 128×128 with alpha, base on the bottom edge,
6–10 KB each
**Renders**: on the board and in the player panels, standing on a chip of the
seat's colour. By seat: `crown`, `galleon`, `cannon`, `trebuchet`, `balloon`,
`lamp`. Redrawn 2026-09-14 in a red, blue and gold set.

**Replacing art: use a new file name** (here `.png` → `.webp`). Next's image
optimizer caches by URL — four hours by default in Next 16 — so a file
overwritten in place keeps serving the old picture.

## 4. Special tiles — 6 of 6 in

**Path**: `specials/<kind>.png` · 128×128 · **Renders**: the tile's icon (the
Remix icon in `SPECIAL_ICON` is the stand-in).

| Kind | Name | Tiles | Subject |
|---|---|---|---|
| `silk-road` | Silk Road | 0 (start) | caravan saddlebags spilling spices and coins |
| `royal-decree` | Royal Decree | 4, 20 | rolled scroll, gold ribbon, red wax seal |
| `dungeon` | The Dungeon | 8 | barred wooden door in a stone arch |
| `fortune` | Fortune | 12, 28 | golden astrolabe with blue enamel |
| `treasury` | Royal Treasury | 16 | red velvet money sack spilling coins |
| `treason` | Treason! | 24 | iron shackles on a chain |

Deliberately not a chest (Guangzhou's tea chest) or silk (Bursa's spool).

## Stand-ins

What the game draws where art is missing (today only the special tiles use one):

| Missing | Stand-in |
|---|---|
| City icon | Its empire's crest, faded — or, with no crest, the monument's silhouette as a watermark |
| Crest | A blank medallion in the band colour |
| House | Remix `RiHome4Fill` in gold |
| Monument | The inline SVG silhouette in `icons.tsx` |
| Special tile | The Remix icon in `SPECIAL_ICON` |

## Unused files

None. The gangster-theme `tiles/` SVGs and every generation source sheet were
deleted on 2026-09-14; `public/games/empire-wars/` holds only art the game
uses, plus the catalog cover and logo.
