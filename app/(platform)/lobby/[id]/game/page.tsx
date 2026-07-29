import { redirect } from "next/navigation";
import { getOnboardedUser } from "@/lib/user";
import {
  getLobbyWithMembers,
  getRenderableGameSession,
  listGameMessages,
} from "@/lib/lobbies";
import { parseState, viewFor } from "@/lib/game/nuno/rules";
import { getGame } from "@/lib/game/catalog";
import { GameScreen } from "./game-screen";

export const metadata = { title: "In game" };

/**
 * Full-screen game surface (ADR-0004). Only renders while this lobby has a
 * live session; everyone else bounces back to the lobby room.
 */
export default async function GamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getOnboardedUser();
  const { id } = await params;

  const lobby = await getLobbyWithMembers(id);
  if (!lobby || lobby.status === "CLOSED") redirect("/lobbies");
  const me = lobby.members.find((m) => m.userId === user.id);
  if (!me) redirect("/lobbies");

  // A just-finished session keeps rendering so the result modal can show
  // the standings — being yanked back to the room is the thing we're
  // fixing. Older finished sessions fall through to the room as before.
  const session = await getRenderableGameSession(lobby.id);
  const state = session ? parseState(session.state) : null;
  if (!session || !state) redirect(`/lobby/${lobby.id}`);

  const messages = await listGameMessages(session.id);
  const game = getGame(session.gameType);

  return (
    <GameScreen
      lobbyId={lobby.id}
      gameName={game?.name ?? session.gameType}
      gameLogo={game?.logo ?? null}
      view={viewFor(state, me.id)}
      members={lobby.members.map((m) => ({
        id: m.id,
        userId: m.userId,
        isBot: m.isBot,
        botName: m.botName,
        username: m.user?.username ?? null,
        displayName: m.user?.displayName ?? null,
        avatarId: m.user?.avatarId ?? null,
      }))}
      hostId={lobby.hostId}
      initialMessages={messages}
    />
  );
}
