import { redirect } from "next/navigation";
import { getOnboardedUser } from "@/lib/user";
import {
  getLatestGameSession,
  getLobbyWithMembers,
  listLobbyGameHistory,
  listLobbyMessages,
} from "@/lib/lobbies";
import { getGameModule } from "@/lib/game/registry";
import { getGame } from "@/lib/game/catalog";
import { listFriends } from "@/lib/friends";
import { LobbyRoom, type LobbyView } from "./lobby-room";

export const metadata = { title: "Lobby" };

export default async function LobbyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getOnboardedUser();
  const { id } = await params;

  const lobby = await getLobbyWithMembers(id);
  if (!lobby || lobby.status === "CLOSED") {
    redirect("/lobbies");
  }

  const isMember = lobby.members.some((m) => m.userId === user.id);
  if (!isMember) {
    // Walk-ins go through the join door (public) or bounce (private).
    redirect(
      lobby.visibility === "PUBLIC" ? `/lobby/join/${lobby.code}` : "/lobbies"
    );
  }

  const [friends, messages, session, history] = await Promise.all([
    listFriends(user.id),
    listLobbyMessages(lobby.id),
    getLatestGameSession(lobby.id),
    listLobbyGameHistory(lobby.id),
  ]);
  // Full game state stays server-side. The room only needs to know whether
  // a game is live and how the last one finished — the standings the game's
  // module reports (ADR-0005), never its state.
  const gameModule = session ? getGameModule(session.gameType) : null;
  const gameState =
    session && gameModule ? gameModule.parseState(session.state) : null;
  const myMemberId =
    lobby.members.find((m) => m.userId === user.id)?.id ?? null;
  const game =
    session && gameModule && gameState
      ? {
          active: session.endedAt === null,
          standings: gameModule.standings(gameState),
          youEliminated:
            gameModule
              .standings(gameState)
              .find((s) => s.memberId === myMemberId)?.eliminated ?? false,
        }
      : null;
  const seatedIds = new Set(
    lobby.members.map((m) => m.userId).filter(Boolean)
  );

  const view: LobbyView = {
    id: lobby.id,
    code: lobby.code,
    name: lobby.name,
    hostId: lobby.hostId,
    visibility: lobby.visibility,
    status: lobby.status,
    maxPlayers: lobby.maxPlayers,
    gameType: lobby.gameType,
    members: lobby.members.map((m) => ({
      id: m.id,
      userId: m.userId,
      isBot: m.isBot,
      botName: m.botName,
      botDifficulty: m.botDifficulty,
      seat: m.seat,
      ready: m.ready,
      username: m.user?.username ?? null,
      displayName: m.user?.displayName ?? null,
      avatarId: m.user?.avatarId ?? null,
    })),
  };

  return (
    <LobbyRoom
      lobby={view}
      viewerId={user.id}
      initialMessages={messages}
      game={game}
      history={history.map((h) => ({
        id: h.id,
        gameName: getGame(h.gameType)?.name ?? h.gameType,
        gameLogo: getGame(h.gameType)?.logo ?? null,
        winnerName: h.winner.name,
        winnerAvatarId: h.winner.avatarId,
        playedAt: h.createdAt.toISOString(),
        players: h.players.map((p) => ({
          name: p.name,
          avatarId: p.avatarId,
          isBot: p.isBot,
        })),
      }))}
      invitableFriends={friends
        .filter((f) => !seatedIds.has(f.id))
        .map((f) => ({
          id: f.id,
          username: f.username!,
          displayName: f.displayName,
          avatarId: f.avatarId,
        }))}
    />
  );
}
