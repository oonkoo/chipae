import Link from "next/link";
import { LogoutLink } from "@kinde-oss/kinde-auth-nextjs/components";
import { getOnboardedUser } from "@/lib/user";
import { getActiveMembership } from "@/lib/lobbies";
import { listFriends, listPendingRequests } from "@/lib/friends";
import { GAME_CATALOG } from "@/lib/game/catalog";
import { GameCover } from "@/components/game-cover";
import { AvatarChip } from "@/components/avatar-chip";
import { PresenceDot } from "@/components/presence-dot";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { JoinByCode } from "../lobbies/join-controls";

export const metadata = { title: "Home" };

export default async function DashboardPage() {
  const user = await getOnboardedUser();
  const [active, friends, requests] = await Promise.all([
    getActiveMembership(user.id),
    listFriends(user.id),
    listPendingRequests(user.id),
  ]);

  const greeting = user.displayName?.split(" ")[0] ?? `@${user.username}`;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex items-center gap-4">
        <AvatarChip avatarId={user.avatarId} className="size-14" />
        <div>
          <h1 className="font-heading text-3xl text-foreground">
            Hi, {greeting}
          </h1>
          <p className="text-sm text-muted-foreground">
            Level {user.level} · {user.xp} XP
          </p>
        </div>
        <span className="ml-auto">
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<LogoutLink>Log out</LogoutLink>}
          />
        </span>
      </div>

      {/* Active table banner */}
      {active && (
        <Link
          href={`/lobby/${active.lobbyId}`}
          className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4 transition-colors hover:bg-primary/15"
        >
          <span className="size-2.5 animate-pulse rounded-full bg-primary" />
          <span className="text-sm font-medium text-foreground">
            Your seat at “{active.lobby.name}” is waiting
          </span>
          <span className="ml-auto font-mono text-sm tracking-widest text-primary">
            {active.lobby.code}
          </span>
        </Link>
      )}

      {/* Game shelf — the lobby is the group; pick what it plays. */}
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg text-foreground">Games</h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {GAME_CATALOG.map((game) => (
            <li key={game.id}>
              {game.available ? (
                <Link
                  href={active ? `/lobby/${active.lobbyId}` : "/lobbies"}
                  className="group block overflow-hidden rounded-2xl border border-primary/30 transition-colors hover:border-primary/70"
                >
                  <GameCover
                    game={game}
                    className="aspect-[16/10] transition-transform duration-300 group-hover:scale-[1.02]"
                    caption={
                      <>
                        <span className="text-xs text-white/70">
                          {game.tagline}
                        </span>
                        <span className="font-mono text-[10px] tracking-widest text-primary uppercase">
                          {game.minPlayers}–{game.maxPlayers} players
                        </span>
                      </>
                    }
                  />
                </Link>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-dashed border-border opacity-70">
                  <GameCover
                    game={game}
                    dimmed
                    className="aspect-[16/10]"
                    caption={
                      <span className="text-[10px] text-white/60">
                        coming soon
                      </span>
                    }
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Play */}
        <Card>
          <CardContent className="flex flex-col gap-4 p-5">
            <h2 className="font-heading text-lg">Play</h2>
            <Button
              size="lg"
              nativeButton={false}
              render={<Link href="/lobbies">Open a lobby</Link>}
            />
            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-muted-foreground">
                or join with a code
              </p>
              <JoinByCode />
            </div>
          </CardContent>
        </Card>

        {/* Crew */}
        <Card>
          <CardContent className="flex flex-col gap-3 p-5">
            <div className="flex items-center">
              <h2 className="font-heading text-lg">Your crew</h2>
              <Link
                href="/friends"
                className="ml-auto text-xs text-primary hover:underline"
              >
                {requests.incoming.length > 0
                  ? `${requests.incoming.length} request${
                      requests.incoming.length > 1 ? "s" : ""
                    } waiting`
                  : "Manage"}
              </Link>
            </div>
            {friends.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                No friends yet — deal someone in from the{" "}
                <Link href="/friends" className="text-primary hover:underline">
                  Friends
                </Link>{" "}
                page.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {friends.slice(0, 6).map((friend) => (
                  <li key={friend.id}>
                    <Link
                      href={`/player/${friend.username}`}
                      className="flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-muted/50"
                    >
                      <span className="relative">
                        <AvatarChip
                          avatarId={friend.avatarId}
                          className="size-9"
                        />
                        <PresenceDot userId={friend.id} />
                      </span>
                      <span className="truncate text-sm">
                        {friend.displayName || `@${friend.username}`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        First games are being shuffled — the table infrastructure you&apos;re
        standing on is ready for them.
      </p>
    </main>
  );
}
