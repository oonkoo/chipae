import { NUNO_CONFIG } from "@/lib/game/data/nuno";

// The platform's game shelf. Every surface that lists or starts games
// (sidebar, home page, start action) reads this — adding a game means
// adding an entry here plus its rules module (ADR-0004).
//
// Content convention: each game ships two assets under public/games/<id>/ —
// a square `logo` (sidebar + small chrome; 512×512 PNG, transparent bg)
// and a wide `cover` (card backgrounds; 1280×800 = 16:10, matches the
// aspect-[16/10] cards). A missing cover degrades to the plain card color.
export type GameDefinition = {
  /** Stored as Lobby.gameType / GameSession.gameType. */
  id: string;
  name: string;
  tagline: string;
  /** Square mark for the sidebar and small chrome. */
  logo: string | null;
  /** Wide art used as the card background. */
  cover: string | null;
  minPlayers: number;
  maxPlayers: number;
  available: boolean;
};

export const GAME_CATALOG: GameDefinition[] = [
  {
    id: NUNO_CONFIG.gameType,
    name: "Nuno",
    tagline: "Match colors, shed cards, yell Nuno!",
    logo: "/games/nuno/nuno_logo.png",
    // Drop the art at this path (1280×800) and it appears everywhere.
    cover: "/games/nuno/cover.png",
    minPlayers: NUNO_CONFIG.minPlayers,
    maxPlayers: NUNO_CONFIG.maxPlayers,
    available: true,
  },
];

export function getGame(id: string): GameDefinition | null {
  return GAME_CATALOG.find((g) => g.id === id) ?? null;
}

export function availableGames(): GameDefinition[] {
  return GAME_CATALOG.filter((g) => g.available);
}
