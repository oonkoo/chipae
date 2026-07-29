import "server-only";
import { db } from "@/lib/db";
import type { WinLineupEntry } from "@/lib/game/session";

// Pure rules live in lib/lobby-rules.ts (unit-tested without a database).
export {
  LOBBY_LIMITS,
  nextFreeSeat,
  randomLobbyCode,
} from "@/lib/lobby-rules";

export const lobbyInclude = {
  members: {
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarId: true,
        },
      },
    },
    orderBy: { seat: "asc" as const },
  },
} satisfies Parameters<typeof db.lobby.findUnique>[0]["include"];

export async function getLobbyWithMembers(lobbyId: string) {
  return db.lobby.findUnique({
    where: { id: lobbyId },
    include: lobbyInclude,
  });
}

export type LobbyWithMembers = NonNullable<
  Awaited<ReturnType<typeof getLobbyWithMembers>>
>;

/** The user's current seat in any lobby that is not closed. */
export async function getActiveMembership(userId: string) {
  return db.lobbyMember.findFirst({
    where: { userId, lobby: { status: { not: "CLOSED" } } },
    include: {
      lobby: {
        include: {
          members: {
            select: {
              userId: true,
              seat: true,
              isBot: true,
              botName: true,
              user: {
                select: { username: true, displayName: true, avatarId: true },
              },
            },
            orderBy: { seat: "asc" },
          },
        },
      },
    },
  });
}

/** Latest game session for a lobby — active (endedAt null) or last finished. */
export async function getLatestGameSession(lobbyId: string) {
  return db.gameSession.findFirst({
    where: { lobbyId },
    orderBy: { startedAt: "desc" },
  });
}

/** Grace window in which a finished game still renders its result screen. */
export const GAME_RESULT_GRACE_MS = 5 * 60 * 1000;

/**
 * The session the game screen should render: the live one, or one that
 * just finished — so players read the standings instead of being thrown
 * back to the room the instant someone wins.
 */
export async function getRenderableGameSession(lobbyId: string) {
  const session = await getLatestGameSession(lobbyId);
  if (!session) return null;
  if (session.endedAt === null) return session;
  const since = Date.now() - session.endedAt.getTime();
  return since < GAME_RESULT_GRACE_MS ? session : null;
}

/**
 * Last `limit` chat messages, oldest first, in the wire shape both chat
 * surfaces (room column, shell rail) seed from. The table is the authority;
 * realtime events only append live (ADR-0001).
 */
export async function listLobbyMessages(lobbyId: string, limit = 50) {
  const rows = await db.lobbyMessage.findMany({
    where: { lobbyId, sessionId: null }, // lounge chat only
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { username: true, avatarId: true } } },
  });
  return rows.reverse().map((row) => ({
    id: row.id,
    username: row.user.username ?? "unknown",
    avatarId: row.user.avatarId,
    text: row.text,
    sentAt: row.createdAt.toISOString(),
  }));
}

/**
 * What this table has played: winner plus the frozen lineup for each
 * finished game. The lineup is stored on the record, so it survives seats
 * (and players) leaving afterwards.
 */
export async function listLobbyGameHistory(lobbyId: string, limit = 10) {
  const rows = await db.gameWin.findMany({
    where: { lobbyId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: { select: { username: true, displayName: true, avatarId: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    gameType: row.gameType,
    createdAt: row.createdAt,
    winner: {
      userId: row.userId,
      name: row.user.displayName || `@${row.user.username ?? "player"}`,
      avatarId: row.user.avatarId,
    },
    players: Array.isArray(row.players)
      ? (row.players as unknown as WinLineupEntry[])
      : [],
  }));
}

/** One game's table talk — wiped when that session ends. */
export async function listGameMessages(sessionId: string, limit = 100) {
  const rows = await db.lobbyMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { username: true, avatarId: true } } },
  });
  return rows.reverse().map((row) => ({
    id: row.id,
    username: row.user.username ?? "unknown",
    avatarId: row.user.avatarId,
    text: row.text,
    sentAt: row.createdAt.toISOString(),
  }));
}

export async function listPublicLobbies() {
  return db.lobby.findMany({
    where: { visibility: "PUBLIC", status: "OPEN" },
    include: {
      host: {
        select: { username: true, displayName: true, avatarId: true },
      },
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
}
