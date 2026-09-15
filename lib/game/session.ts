import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { ErasedGameModule, Standing } from "@/lib/game/module";
import { getGameModule } from "@/lib/game/registry";

// Session persistence shared by every code path that mutates a running
// game (game actions, leaving a lobby mid-game). Owns the end-of-game
// contract (ADR-0004): the session closes when there's a winner OR no
// human is left standing (abandoned); game chat is wiped with it; only
// the winner's GameWin row survives as history.
//
// Nothing here knows which game is being played — the module decides who
// won and in what order (ADR-0005); this file decides what that means for
// the lobby, the chat and the history.

type TxClient = Prisma.TransactionClient;

export type MemberLite = {
  id: string;
  userId: string | null;
  isBot: boolean;
  seat?: number;
  botName?: string | null;
  user?: {
    username: string | null;
    displayName: string | null;
    avatarId: string;
  } | null;
};

/** One row of a finished game's standings, frozen into the win record. */
export type WinLineupEntry = {
  memberId: string;
  userId: string | null;
  name: string;
  avatarId: string | null;
  isBot: boolean;
  /** 1-based lobby seat, so standings can wear the player's table colour. */
  seat?: number;
  detail?: string;
  eliminated?: boolean;
};

function memberName(member: MemberLite | undefined): string {
  if (!member) return "A departed player";
  if (member.isBot) return member.botName ?? "CPU";
  return member.user?.displayName || `@${member.user?.username ?? "player"}`;
}

/**
 * Attach who each seat actually was to the game's own standings. The module
 * supplies order and score detail; identity is the platform's business, and
 * it has to be frozen here because seats (and whole lobbies) get deleted.
 */
export function decorateStandings(
  standings: Standing[],
  members: MemberLite[]
): WinLineupEntry[] {
  return standings.map((standing) => {
    const member = members.find((m) => m.id === standing.memberId);
    return {
      memberId: standing.memberId,
      userId: member?.userId ?? null,
      name: memberName(member),
      avatarId: member?.user?.avatarId ?? null,
      isBot: member?.isBot ?? true,
      seat: member?.seat,
      detail: standing.detail,
      eliminated: standing.eliminated,
    };
  });
}

/**
 * Load the live session for a lobby along with the module that plays it.
 * Returns null when there's no usable game — no open session, an unknown
 * game type, or state that no longer parses.
 */
export async function loadActiveSession(tx: TxClient, lobbyId: string) {
  const session = await tx.gameSession.findFirst({
    where: { lobbyId, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (!session) return null;
  const gameModule = getGameModule(session.gameType);
  if (!gameModule) return null;
  const state = gameModule.parseState(session.state);
  if (!state) return null;
  return { session, state, gameModule };
}

/** True while at least one connected human seat is still in the game. */
function humanStanding(
  gameModule: ErasedGameModule,
  state: unknown,
  members: MemberLite[]
): boolean {
  return gameModule.standings(state).some((standing) => {
    if (standing.eliminated) return false;
    const member = members.find((m) => m.id === standing.memberId);
    return !!member && !member.isBot && member.userId !== null;
  });
}

/**
 * Persist a rules transition. Returns whether the session ended. On end:
 * game chat is deleted, the lobby reopens, humans must re-ready, and a
 * human winner gets their GameWin history row.
 */
export async function persistGameState(
  tx: TxClient,
  opts: {
    lobbyId: string;
    session: { id: string; gameType: string };
    gameModule: ErasedGameModule;
    state: unknown;
    members: MemberLite[];
  }
): Promise<{ finished: boolean }> {
  const { lobbyId, session, gameModule, state, members } = opts;
  const winnerId = gameModule.winnerId(state);
  const finished = winnerId !== null || !humanStanding(gameModule, state, members);

  await tx.gameSession.update({
    where: { id: session.id },
    // Prisma's Json column takes any serializable value; the module owns
    // the shape and re-validates it on the way back in.
    data: {
      state: state as Prisma.InputJsonValue,
      endedAt: finished ? new Date() : null,
    },
  });
  if (!finished) return { finished };

  // Game chat vanishes with the game.
  await tx.lobbyMessage.deleteMany({ where: { sessionId: session.id } });
  await tx.lobby.update({ where: { id: lobbyId }, data: { status: "OPEN" } });
  await tx.lobbyMember.updateMany({
    where: { lobbyId, isBot: false },
    data: { ready: false },
  });

  if (winnerId) {
    const winner = members.find((m) => m.id === winnerId);
    if (winner && !winner.isBot && winner.userId) {
      await tx.gameWin.create({
        data: {
          userId: winner.userId,
          gameType: session.gameType,
          sessionId: session.id,
          lobbyId,
          // Freeze who played: seats and lobbies get deleted, but the
          // history has to keep standing on its own.
          players: decorateStandings(gameModule.standings(state), members),
        },
      });
    }
  }
  return { finished };
}
