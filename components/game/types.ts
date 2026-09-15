/**
 * What every game board is handed (ADR-0005). The shell knows this much
 * about a game and no more — seats, the viewer's projection, and the lobby
 * it belongs to. Anything game-specific is inside `view`, which only that
 * game's board knows how to read.
 */
export type BoardMember = {
  id: string;
  userId: string | null;
  isBot: boolean;
  botName: string | null;
  username: string | null;
  displayName: string | null;
  avatarId: string | null;
  /**
   * 1-based lobby seat. Drives the player's colour at the table — colours run
   * in seat order (design/art-direction.md), never from the chosen avatar.
   */
  seat: number;
};

export type GameBoardProps = {
  lobbyId: string;
  /** The module's `viewFor` output. Each board narrows this to its own type. */
  view: unknown;
  members: BoardMember[];
  hostId: string;
};
