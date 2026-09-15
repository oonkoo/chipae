# Systems Index

The register of every designed system on Chipae, its GDD, and how far it has
got. `design/CLAUDE.md` requires this file to be updated whenever a GDD is
added or its status changes.

**Design order**: Foundation → Core → Feature → Presentation → Polish.

**Status values**: `Not Started` · `In Design` · `In Review` · `Approved` ·
`Implemented`.

## Platform

The platform is not a game and has no GDD — its decisions live in ADRs. Listed
here because both games depend on it.

| System | Where it is decided | Status |
|---|---|---|
| Lobby as persistent group, games as a catalog | `docs/architecture/adr-0004-lobby-as-group-game-platform.md` | Implemented |
| Game module interface | `docs/architecture/adr-0005-game-module-interface.md` | Implemented |
| Realtime layer (Pusher behind an abstraction) | `docs/architecture/adr-0001-platform-realtime-layer.md` | Implemented |
| `apply(ctx)` — injected RNG and clock | ADR-0005 Amendment 1 | Implemented — `MoveContext` in `lib/game/module.ts`, plus the optional `turnExpired` turn clock |
| `ctx.humans` — which seats a connected human holds | ADR-0005 Amendment 2 | Implemented 2026-09-10 — `runTransition` passes it; Empire Wars uses it for CPU proxy bids and to never play a timed-out human as a CPU. Since 2026-09-11 `startGame` passes it to `deal` too (Empire Wars' match setup). Nuno ignores it |
| **Per-seat player colour** | *no ADR* | Implemented 2026-08-04 — `AvatarChip` takes the real `seat`; `--chart-6` added |

> The colour fix colours a player at a table by `LobbyMember.seat`, not by the
> avatar they picked (which had let two players share a hue). Chat keeps the
> avatar hue on purpose; see `design/art-direction.md`.

## Games

| # | System | GDD | Tier | Status | Depends on |
|---|---|---|---|---|---|
| 1 | **Nuno** — UNO-style card game | `nuno-core.md` | Core | **Implemented** | Lobby, ADR-0003, ADR-0005 |
| 2 | **Empire Wars** — historical-empires property game (Monopoly-style) | `empire-wars-core.md` | Core | **Implemented — v3 (2026-09-10), match setup (2026-09-11).** Building/monuments unit-tested, not yet played live | Lobby, ADR-0005 (+ Amendments 1 and 2), per-seat colour |

Games are **siblings, not dependencies** — they share the platform and never
each other. Neither GDD may reference the other's rules.

## Empire Wars — supporting docs

| Doc | Status | Note |
|---|---|---|
| `empire-wars-core.md` | **Implemented — v3** | Eight historical empires, whole-empire building (4 houses, then a monument), auctions, the Market (trades), Fortune and Royal Decree decks. Still a net-worth race — since 2026-09-11 to a target and round limit the table picks at setup (a toss settles disagreements). Standard match calibrated over 25,000 seeded all-CPU matches, every setting over 24,000 more |
| `archive/empire-wars-core-v2.md` | Superseded | The v2 crime-city simplification: roll, buy, rent, race; nothing off-turn. v3 kept its turn, race and table |
| `archive/empire-wars-core-v1.md` | Superseded | The v1 rules (Heat, Dirty Money, combat, crew, bosses, missions, truces). History only |
| `archive/empire-wars-bot-v1.md` | Superseded | v2's CPU is three rules and lives in the core GDD |
| `design/empire-wars-art-manifest.md` | Current (v3) | 8 monuments (7 files in, with 3 mismatches against the game data), optional city/special tiles and pieces |
| `archive/empire-wars-v1-code.tar.gz` | Archive | The v1 code, kept for reference |
| `design/ux/empire-wars-*.md` | Not Started | The GDD's UI Requirements have been enough so far; the Market may earn a spec if playtests find it confusing |

## Review history

| GDD | Date | Verdict | Log |
|---|---|---|---|
| `empire-wars-core.md` v3 | — | Not yet reviewed — run `/design-review` | — |
| `empire-wars-core.md` v2 | — | Never reviewed; superseded by v3 the same day | — |
| `empire-wars-core.md` v1 | 2026-08-04 | MAJOR REVISION NEEDED → revised same day; superseded by v2 | `reviews/empire-wars-core-review-log.md` |
| `nuno-core.md` | — | Never formally reviewed | — |

> Nuno predates the review process and shipped without one. Its GDD is thin by
> current standards (no Tuning Knobs ranges, no formulas beyond deck
> composition) but the game is implemented and covered by 62 tests, so a
> retroactive review is low value. Worth `/reverse-document` only if Nuno is
> ever substantially changed.
