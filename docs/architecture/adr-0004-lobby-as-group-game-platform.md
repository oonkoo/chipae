# ADR-0004: Lobby as persistent group, games as a catalog

**Status:** Accepted
**Date:** 2026-07-27
**Extends:** ADR-0003 (Nuno) — the game itself is unchanged; this ADR
restructures how games live inside the platform.

## Summary

Plato-style platform shape (platoapp.com): the **lobby is the persistent
social room**; games are interchangeable activities the host starts from a
**catalog** (home page + sidebar). A running game takes over the screen
(full-screen surface with its own vanishing chat and a quit door); the only
record that outlives a game is **who won it**.

## Context

Nuno v1 wired the game directly into the lobby room. With more games
coming, game selection, game chrome (chat/quit), and history need a shape
that doesn't grow per-game UI into the lobby. Plato's model — "a room you
enter", chat sharing the stage with play, wins/XP on profiles — matches the
product intent.

## Decision

- **Catalog** (`lib/game/catalog.ts`): the single registry of games (id =
  `gameType`, name, tagline, logo under `public/games/<id>/`, player range,
  `available`). The sidebar GAMES section, the home-page shelf, and
  `startGame(lobbyId, gameTypeId)` all read it. Adding a game = catalog
  entry + rules module + dealer branch.
- **Full-screen game surface** (`/lobby/[id]/game`): the shell's left rail
  hides on this route; the board shares the stage with **game chat**.
  Seated players are auto-pulled in when a game starts; eliminated players
  may watch.
- **Game chat is session-scoped and ephemeral**: `LobbyMessage.sessionId`
  distinguishes it from lounge chat; realtime chat events carry a
  `scope` field so each surface renders only its own stream. When the
  session ends, its messages are deleted in the same transaction.
- **Quit = elimination** (`applyQuit` + `quitGame`): the seat leaves the
  rotation, its cards fold under the deck, and the player keeps their lobby
  seat. One player left standing wins by default. Leaving the lobby
  mid-game quits first. If no human is left standing, the session ends
  **abandoned** — no winner, no record.
- **Win history is the only persistent game record** (`GameWin`): written
  in the end-of-game transaction for a human winner (bots leave no
  records). Profiles show a win count and a trophy shelf (game name +
  date). Session rows keep final state for debugging, but chat and
  intermediate history vanish by design.
- **End-of-game contract centralized** (`lib/game/session.ts`
  `persistGameState`): every mutation path (moves, quits, lobby leaves)
  settles finish/abandon, chat wipe, lobby reopen, ready reset, and win
  records identically.

## Consequences

### Positive

- Adding game #2 touches the catalog + its rules module, not the lobby UI.
- Privacy-by-design continues: nothing about a finished game persists
  except the win record.
- The lobby stays a calm social room (Plato's "lobby culture"), with the
  lounge chat intact across games.

### Negative / accepted

- A single `startGame` still branches on game id for dealing; a dealer
  registry becomes worthwhile at 2–3 games.
- Placement order is shown at game end but not persisted (spec keeps
  winners only).
- Abandoned games record nothing — deliberate, but means bot-vs-bot
  endings vanish silently.

## ADR Dependencies

- ADR-0001 (realtime hints), ADR-0003 (Nuno rules/pipeline).

## Engine Compatibility

Web (Next.js 16 / React 19); no engine runtime.

## GDD Requirements Addressed

Platform-level (no single GDD): lobby-as-group flow, game catalog surfaces,
per-game ephemeral chat, win-only history, full-screen play with quit —
per product direction of 2026-07-27 (Plato reference).
