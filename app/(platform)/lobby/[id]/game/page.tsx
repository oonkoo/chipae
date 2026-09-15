import { redirect } from "next/navigation";
import { getOnboardedUser } from "@/lib/user";
import {
  getLobbyWithMembers,
  getRenderableGameSession,
  listGameMessages,
} from "@/lib/lobbies";
import { getGameModule } from "@/lib/game/registry";
import { decorateStandings } from "@/lib/game/session";
import { getGame } from "@/lib/game/catalog";
import { GameScreen } from "./game-screen";

export const metadata = { title: "In game" };

/**
 * Full-screen game surface (ADR-0004). Only renders while this lobby has a
 * live session; everyone else bounces back to the lobby room.
 *
 * Which game this is stays behind the module registry (ADR-0005): this page
 * resolves the module, projects the viewer's slice of state, and decorates
 * the standings — nothing here knows a card from a city block.
 */
export default async function GamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Independent queries, so they overlap rather than queue. Every avoided
  // round-trip matters here: this page re-renders on every move, and the
  // local dev pool is small enough that serial queries hit P1017.
  const [user, lobby] = await Promise.all([
    getOnboardedUser(),
    getLobbyWithMembers(id),
  ]);
  if (!lobby || lobby.status === "CLOSED") redirect("/lobbies");
  const me = lobby.members.find((m) => m.userId === user.id);
  if (!me) redirect("/lobbies");

  // A just-finished session keeps rendering so the result modal can show
  // the standings — being yanked back to the room is the thing we're
  // fixing. Older finished sessions fall through to the room as before.
  const session = await getRenderableGameSession(lobby.id);
  const gameModule = session ? getGameModule(session.gameType) : null;
  // Full game state stays server-side — the client only ever gets the
  // viewer's projection.
  const state = session && gameModule ? gameModule.parseState(session.state) : null;
  if (!session || !gameModule || !state) redirect(`/lobby/${lobby.id}`);

  const messages = await listGameMessages(session.id);
  const game = getGame(session.gameType);

  // Standings carry identities, so the client never reaches into game state
  // to name a player.
  const standings = decorateStandings(gameModule.standings(state), lobby.members);

  return (
    <GameScreen
      lobbyId={lobby.id}
      gameType={session.gameType}
      gameName={game?.name ?? session.gameType}
      gameLogo={game?.logo ?? null}
      view={gameModule.viewFor(state, me.id)}
      members={lobby.members.map((m) => ({
        id: m.id,
        userId: m.userId,
        isBot: m.isBot,
        botName: m.botName,
        username: m.user?.username ?? null,
        displayName: m.user?.displayName ?? null,
        avatarId: m.user?.avatarId ?? null,
        seat: m.seat,
      }))}
      hostId={lobby.hostId}
      yourMemberId={me.id}
      winnerId={gameModule.winnerId(state)}
      standings={standings.map((s) => ({
        id: s.memberId,
        name: s.name,
        avatarId: s.avatarId,
        isBot: s.isBot,
        seat: s.seat,
        detail: s.detail,
        eliminated: s.eliminated,
      }))}
      youEliminated={
        standings.find((s) => s.memberId === me.id)?.eliminated ?? false
      }
      initialMessages={messages}
    />
  );
}
