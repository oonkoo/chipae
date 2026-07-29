import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import { parseState, type NunoState } from "@/lib/game/nuno/rules";

// Session persistence shared by every code path that mutates a running
// game (game actions, leaving a lobby mid-game). Owns the end-of-game
// contract (ADR-0004): the session closes when there's a winner OR no
// human is left standing (abandoned); game chat is wiped with it; only
// the winner's GameWin row survives as history.

type TxClient = Prisma.TransactionClient;

export type MemberLite = {
  id: string;
  userId: string | null;
  isBot: boolean;
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
  detail?: string;
  eliminated?: boolean;
};

function memberName(member: MemberLite | undefined): string {
  if (!member) return "A departed player";
  if (member.isBot) return member.botName ?? "CPU";
  return member.user?.displayName || `@${member.user?.username ?? "player"}`;
}

/** Standings in finishing order, ready to store or render. */
export function buildLineup(
  state: NunoState,
  members: MemberLite[]
): WinLineupEntry[] {
  const order = state.placements
    ? state.placements.map((p) => p.memberId)
    : state.players.map((p) => p.id);

  return order.map((memberId) => {
    const member = members.find((m) => m.id === memberId);
    const placement = state.placements?.find((p) => p.memberId === memberId);
    const seat = state.players.find((p) => p.id === memberId);
    const cardsLeft = placement?.cardsLeft ?? seat?.hand.length ?? 0;
    const eliminated = placement?.eliminated ?? seat?.eliminated ?? false;
    return {
      memberId,
      userId: member?.userId ?? null,
      name: memberName(member),
      avatarId: member?.user?.avatarId ?? null,
      isBot: member?.isBot ?? true,
      detail: eliminated
        ? "quit"
        : cardsLeft === 0
          ? "went out"
          : `${cardsLeft} ${cardsLeft === 1 ? "card" : "cards"} left`,
      eliminated,
    };
  });
}

export async function loadActiveSession(tx: TxClient, lobbyId: string) {
  const session = await tx.gameSession.findFirst({
    where: { lobbyId, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
  const state = session ? parseState(session.state) : null;
  if (!session || !state) return null;
  return { session, state };
}

/** True while at least one connected human seat is still in the game. */
function humanStanding(state: NunoState, members: MemberLite[]): boolean {
  return state.players.some((p) => {
    if (p.eliminated) return false;
    const member = members.find((m) => m.id === p.id);
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
    state: NunoState;
    members: MemberLite[];
  }
): Promise<{ finished: boolean }> {
  const { lobbyId, session, state, members } = opts;
  const finished = state.winnerId !== null || !humanStanding(state, members);

  await tx.gameSession.update({
    where: { id: session.id },
    data: { state, endedAt: finished ? new Date() : null },
  });
  if (!finished) return { finished };

  // Game chat vanishes with the game.
  await tx.lobbyMessage.deleteMany({ where: { sessionId: session.id } });
  await tx.lobby.update({ where: { id: lobbyId }, data: { status: "OPEN" } });
  await tx.lobbyMember.updateMany({
    where: { lobbyId, isBot: false },
    data: { ready: false },
  });

  if (state.winnerId) {
    const winner = members.find((m) => m.id === state.winnerId);
    if (winner && !winner.isBot && winner.userId) {
      await tx.gameWin.create({
        data: {
          userId: winner.userId,
          gameType: session.gameType,
          sessionId: session.id,
          lobbyId,
          // Freeze who played: seats and lobbies get deleted, but the
          // history has to keep standing on its own.
          players: buildLineup(state, members),
        },
      });
    }
  }
  return { finished };
}
