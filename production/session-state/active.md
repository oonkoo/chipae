# Session State — 2026-07-27

## Current task

Dual-sidebar (left nav + right crew rail) shell across `/`, `/dashboard`,
`/lobbies`, `/friends`, `/player/[username]` — **done and verified**.

## Progress checklist

- [x] `components/shell/` — `app-sidebar` (left nav, signed-in + signed-out
      variants), `right-rail` (crew/notifications, hidden on `/lobby/*`),
      `online-crew`, `search-box`
- [x] `app/(platform)/layout.tsx` — shell wraps all platform routes
- [x] `app/page.tsx` — landing rebuilt as public shell variant (auth CTAs,
      live stats + seat-color legend in right rail)
- [x] Top-bar search → `/friends?q=…`; `FriendSearch` auto-runs initial query
- [x] typecheck / lint / build pass
- [x] Browser-verified: landing (signed out) at 1440 + 1280; dashboard,
      lobbies, friends, profile (signed in)

## Key decisions / fixes this session

- **`lib/db.ts` pool fix**: local `prisma dev` server resets connections
  beyond ~7 concurrent (reproduced with a standalone pg script). Dashboard +
  Friends burst past that (layout 3 + page 3+ parallel queries) → P1017
  "Server has closed the connection". Pool now capped at
  `DATABASE_POOL_MAX` (default 5) with `keepAlive: true`. Requires dev-server
  restart to take effect (Prisma client is cached on `globalThis`).
- **`lib/locks.ts` advisory-lock fix**: `pg_advisory_xact_lock()` returns
  Postgres `void`, which the Prisma 7 pg driver adapter cannot deserialize
  from a `$queryRaw` result (P2010 UnsupportedNativeDataType — broke
  sendFriendRequest). Switched to `$executeRaw` (row count only, no column
  deserialization). Verified live: chicken → jenga request now succeeds.
- **Mutation → UI revalidation sweep** (UX): `updateProfile` now does
  `revalidatePath("/", "layout")` (chip/name render in the shell everywhere);
  friends `refresh()` also revalidates `/player/[username]` pages;
  `refreshLobby()` also revalidates `/dashboard` (active-table banner);
  `createLobby` uses `refreshLobby`. `FriendActionButton` keeps an
  optimistic override keyed to its incoming props so client-held search
  rows flip instantly (send/cancel/accept/remove); `sendFriendRequest`
  returns the new `friendshipId` to enable the none→outgoing flip.
  Browser-verified both directions + chip change reflecting in the top bar.
  Incoming requests now render an Accept + Decline pair (decline was a
  UI-less server action before); verified live with a seeded request.
- **Shell/UX round 2**: "Table" renamed to "Lobby" across nav, pages, room,
  and action errors (flavor idioms like "Take a seat"/"The table wobbled"
  kept). New `components/shell/lobby-quick-panel.tsx` at the top of the
  crew rail — active lobby: name/code + copy, seats, Enter lobby, locked
  Start game, quick-invite of unseated friends; no lobby: Quick setup
  (one-tap create + join by code). `getActiveMembership` now includes
  member count + ids. New `components/notification-row.tsx` (per-type icon
  chip, relative time, unread dot) used by the bell popover and the rail's
  Latest list. RailChat added to the quick panel: same ephemeral Pusher
  channel as the room's Table talk; history persists across soft navigation
  (the shell layout stays mounted) and resets inside /lobby/* where the
  room chat takes over. Non-chat lobby events refresh the rail, keeping
  seat counts live. Verified both directions (rail ↔ room).
- **Lobby card redesign (rail)**: seat grid shows who's at the table
  (avatar chips + dashed Open seats, tiny names — chip motif per art
  direction); code pill copies itself; invite list moved into a popover;
  clear sections (header / seats / actions / chat). `getActiveMembership`
  members now include user + seat details; `ActiveLobbySummary` carries
  `members` instead of counts/ids.
- **Game-over modal + lobby history**: new `components/ui/dialog.tsx`
  (Base UI Dialog wrapper, matches popover.tsx conventions) and REUSABLE
  `components/game/game-over-modal.tsx` — takes `{gameName, gameLogo,
  standings[], youId, onPlayAgain?, onClose}`, i.e. game-agnostic (a title,
  a logo, a ranked list) so game #2 just passes its own standings.
  game-screen no longer auto-redirects after 3s; the finished hand stays
  behind the modal. CRITICAL companion fix: the game PAGE used to redirect
  as soon as the session ended — added `getRenderableGameSession()` with a
  5-min grace window (`GAME_RESULT_GRACE_MS`) so a just-finished session
  still renders. GameWin gained `lobbyId` + `players` (frozen lineup JSON,
  migration `20260729060000_game_win_lineup`), written by
  `buildLineup()` in lib/game/session.ts; member queries in games.ts +
  lobbies.ts now include user details for it. Lobby room shows "Table
  history" (winner, game, who they played with) when no game is running;
  profile trophy shelf unchanged.
  VERIFIED: profile shelf + history data path (via a temporary seeded
  GameWin row, since only bots had won — row deleted afterwards, GameWin
  table back to 0). NOT yet seen live: the modal itself and the lobby
  history section — the test hand was still running when I stopped.
- **BOT STALL BUG FIXED**: the bot driver effect keyed only on
  `view.turnCount`, but a bot that draws a PLAYABLE card keeps its turn
  (turnCount unchanged) → effect never re-fired → table frozen mid-turn
  forever. Added `view.deckCount` to the deps. This was a genuine
  game-freezing bug, reproduced live twice.
- **Animation glitch fixes** (play path): the played card used to reappear
  in hand before the refresh removed it. Causes + fixes: (1) a 1200ms
  "safety" timer un-hid the card before `router.refresh()` landed — removed;
  the hidden state is now DERIVED from `pending && card still in hand`, and
  `pending` spans the action *and* its refresh, so it self-corrects (a
  rejected play restores the card; a reshuffled duplicate id can't stick
  invisible). (2) The landed card unmounted while the pile still showed the
  old top → blink. Flights now take `holdForTopId` and park on the pile
  until the server confirms that id as top (derived `visibleFlights`;
  2s backstop sweep for rejected plays). (3) The slot now collapses
  (width/margin/opacity, 200ms) so neighbours slide together during the
  flight — nothing shifts when the refresh lands. (4) Drawing shows a
  NUNO card BACK holding the slot until the real card arrives (derived
  from `deckCount` being unchanged — no timers). Bot advance now retries
  once on failure (a failed advance otherwise froze the table, since the
  effect only re-runs on turn change).
  NOTE: editing hooks in this file while a game page is open corrupts it
  via Fast Refresh ("useEffect dep array changed size") and stalls the bot
  — reload the page after such edits; not a shipped bug.
- **Card motion** (`components/game/card-flight.tsx`): cards fly hand→pile
  and deck→hand. Motion spec from the motion-design skill — spatial morph,
  `ease-in-out-cubic` @ 240ms, transform/opacity only, `prefers-reduced-
  motion` skips flights entirely. Own plays animate OPTIMISTICALLY on click
  (before the server round trip) and register in `animatedPlays` so the
  confirmed state doesn't replay them; opponents' plays/draws are detected
  by diffing topCard id + per-seat card counts against `prevSnapshot`.
  Draw fan-outs stagger 70ms. Action cards also raise a 2.6s announcement
  ("X played +4 — Y draws 4") so penalties are visible.
- **RULES BUG FIXED**: a +2/+4/reverse played as the winning card returned
  before its effect ran, so the next player never drew. Now the effect
  resolves first, then the win — matches the rulebook and keeps placement
  counts honest. Regression tests + new `tests/nuno-simulation.test.ts`
  (100 full games over 2/3/4/6 seats asserting card conservation, exact
  +2/+4 amounts on the right seat, skip/reverse/wild behaviour,
  termination). 62 tests total.
- **Nuno gameplay UI**: reusable `components/game/nuno-card.tsx` —
  `NunoCardFace` (white frame, tilted oval + dashed chip rim, outlined
  glyph, corner glyphs, four-colour chip for wilds), `NunoCardBack` (indigo
  + gold oval + NUNO wordmark), `NunoCardFan` (overlapping backs; uses
  FIXED px overlaps — percentage margins don't resolve in flex). Sizes
  xs/sm/md/lg. Board rebuilt as a table: opponents ringed by slot map
  (south seat is always the viewer; 2 opponents → top-left/top-right),
  piles centre, POV hand on the felt's south edge with nameplate. Playable
  cards ring gold + rest raised; unplayable are opacity-only (filters read
  as "broken"). "No plays — draw a card" state pulses the draw pile.
  NOTE: card oval geometry is being tuned by the user directly — do not
  overwrite `nuno-card.tsx` oval values without checking with them.
- **Bug fixed — hidden seats**: `updateLobbySettings` guarded seat count
  but not seat NUMBER, so shrinking max below an occupied sparse seat
  (member at seat 4, max→2) hid that player from the grid entirely
  ("3/2 seated"). Now floors on the highest occupied seat; the room grid
  also renders `max(maxPlayers, highest seat)` slots. chicken's table data
  repaired (max 2 → 4).
- **DB pool hardening** (`lib/db.ts`): added `maxUses: 50`,
  `idleTimeoutMillis: 10s`, `maxLifetimeSeconds: 120`. Aborted RSC renders
  (router.refresh / fast navigation) can leave a socket protocol-desynced
  → 08P01 "bind message supplies N parameters, but prepared statement
  requires 0" on every reuse. Retiring sockets fast limits the blast
  radius. The local `prisma dev` server itself also wedges under load
  (all connections ECONNRESET) — restart `npm run db:dev` then the app;
  data survives in %LOCALAPPDATA%\prisma-dev-nodejs.
- **Game content system**: catalog entries carry `logo` (square, sidebar +
  chrome) and `cover` (card backgrounds). Shared `components/game-cover.tsx`
  renders cover-art cards (bg image + legibility gradient + logo/name/
  caption) on the home shelf and lobby "Pick a game" grid; missing cover
  degrades to plain card color. ASSET SPECS for user: logo 512×512 PNG
  transparent at `/games/<id>/logo.*`; cover 1280×800 (16:10) at
  `/games/<id>/cover.png` — Nuno's cover path is pre-wired, drop the file
  and it appears. Catalog now contains ONLY Nuno (placeholders removed per
  user). Host "Table" settings popover (name/visibility/seats 2–6) +
  per-game seat-fit checks on cards.
- **Lobby game shelf**: the room's "Start Nuno" button replaced with the
  same catalog card grid as the dashboard ("Pick a game" — host clicks a
  card once everyone's ready; non-hosts see "The host starts the game").
  Placement banner shows "(quit)" for eliminated players. Also fixed:
  post-`db push` stale pooled prepared statements (08P01) → dev-server
  restart required after schema pushes; eliminated players show "out" in
  the board strip.
- **Platform-of-games architecture (ADR-0004, Plato-style)**: lobby is the
  persistent group; `lib/game/catalog.ts` is the single game registry
  feeding sidebar GAMES, home-page shelf, and `startGame(lobbyId, gameId)`.
  Full-screen game surface at `/lobby/[id]/game` (sidebar hides there;
  board + game chat side by side; seated players auto-pulled in). Game
  chat = `LobbyMessage.sessionId` + event `scope:"game"`, wiped at game
  end. Quit = elimination (`applyQuit`/`quitGame`; leaving the lobby quits
  first; last human standing → abandoned session, no record). `GameWin`
  model = only persistent record; written for human winners in
  `lib/game/session.ts` `persistGameState` (centralized end-of-game
  contract). Profile: Wins stat + Trophy shelf. Migration
  `20260727070000_game_wins_and_game_chat`. 56 tests pass. NOTE: quit/
  game-chat/win-record need a live 2-human hand for e2e — unit-covered.
- **Nuno — first official game (ADR-0003, design/gdd/nuno-core.md)**:
  UNO-clone per user spec, 2–6 seats (LOBBY_LIMITS.max now 6). Pure rules
  `lib/game/nuno/rules.ts` + knobs `lib/game/data/nuno.ts`; 52 tests incl.
  full deck/actions/Nuno-call/win coverage (`tests/nuno-rules.test.ts`).
  Server actions `lib/actions/games.ts`: startGame/playCard/drawCard/
  passTurn/callNuno/advanceBot/fillSeatsWithBots — all under lobby lock;
  hidden info via `viewFor` per-viewer projection (clients never see other
  hands/deck). Bots: client-scheduled `advanceBot` after 1–3 s (config),
  server-validated; departed seats play as bots. Board UI
  `app/(platform)/lobby/[id]/nuno-board.tsx` (logo at
  public/games/nuno/nuno_logo.png, CSS cards, wild color picker, NUNO!
  window button, placements banner). High Roll fully removed (ADR-0002
  Superseded). LIVE: hand dealt at chicken's table, chicken played
  yellow 6, waiting on jenga.
- **High Roll test game (ADR-0002, superseded)**: first game through the pipeline —
  pure rules `lib/game/high-roll/rules.ts` + knobs `lib/game/data/high-roll.ts`
  (unit tests `tests/high-roll-rules.test.ts`, 35 total passing). Server
  actions `lib/actions/games.ts` (startGame host-gated on all-ready ≥2;
  submitRoll one per seat; both under the lobby advisory lock; bots roll at
  deal). State in `GameSession.state` (zod-validated on read); `game-changed`
  hint event added to the lobby schema; closing lobby force-ends open
  sessions. Room UI: roll values replace ready pills while IN_GAME, Roll
  button, waiting line, winner banner from last ended session, Start button
  wired (host-only). LIVE STATE: round in progress at "chicken's table" —
  chicken rolled 3, Croupier (CPU) 2, waiting on jenga's roll to complete.
- **Chat history now synced/persisted**: new `LobbyMessage` model (schema +
  hand-authored migration `20260727050000_add_lobby_message` for the cloud
  DB; local used `db push`). `sendLobbyChat` writes the row, then publishes
  the event with the DB id; both chat surfaces seed from
  `listLobbyMessages()` and dedupe live events by id. Messages are deleted
  when the lobby closes ("messages vanish" promise kept). ADR-0001 addendum
  records this. NOTE: local `prisma dev` DB was restarted this session (it
  wedged — connections reset under any concurrency); data persists in
  %LOCALAPPDATA%\prisma-dev-nodejs.
- Hydration-mismatch warning on `<body>` (`cz-shortcut-listen`) is a browser
  extension artifact, not an app bug.
- `.next/dev/types/validator.ts` can be corrupted by a mid-write race —
  touch any app file to regenerate before trusting typecheck failures there.

## Open questions

- User mentioned inspiration images that never arrived in chat — shell built
  from existing art direction instead. Revisit if they share them.
