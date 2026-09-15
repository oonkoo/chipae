import { eraseModule, type ErasedGameModule } from "@/lib/game/module";
import { nunoModule } from "@/lib/game/nuno/module";
import { empireWarsModule } from "@/lib/game/empire-wars/module";

// The dealer registry (ADR-0005). `lib/game/catalog.ts` is the shelf players
// browse; this is the shelf the *server* plays from. Keys are the same game
// ids, which are also what lands in Lobby.gameType / GameSession.gameType.
//
// Adding a game: write its rules module, add it here and to the catalog, and
// register its board in components/game/boards.tsx. Nothing else moves.

const MODULES: ErasedGameModule[] = [
  eraseModule(nunoModule),
  eraseModule(empireWarsModule),
];

const BY_ID = new Map(MODULES.map((m) => [m.id, m]));

/** The module for a game id, or null if nothing on the shelf plays it. */
export function getGameModule(gameType: string): ErasedGameModule | null {
  return BY_ID.get(gameType) ?? null;
}

/** Game ids the server can actually deal — the catalog may list more. */
export function playableGameTypes(): string[] {
  return [...BY_ID.keys()];
}
