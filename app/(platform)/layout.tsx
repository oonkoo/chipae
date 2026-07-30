import Link from "next/link";
import { getOnboardedUser } from "@/lib/user";
import { getNotificationSummary } from "@/lib/notifications";
import { listFriends, listPendingRequests } from "@/lib/friends";
import { getActiveMembership, listLobbyMessages } from "@/lib/lobbies";
import { AvatarChip } from "@/components/avatar-chip";
import { ChipaeLogo } from "@/components/chipae-logo";
import { NotificationBell } from "@/components/notification-bell";
import { NotificationRow } from "@/components/notification-row";
import { PresenceBeacon } from "@/components/presence-beacon";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { LobbyQuickPanel } from "@/components/shell/lobby-quick-panel";
import { OnlineCrew } from "@/components/shell/online-crew";
import { RightRail } from "@/components/shell/right-rail";
import { SearchBox } from "@/components/shell/search-box";

// Lounge shell: left nav rail, center content with top bar, right crew rail.
// Gates on a completed profile and keeps the presence subscription alive.
export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getOnboardedUser();
  const [notifications, friends, requests, active] = await Promise.all([
    getNotificationSummary(user.id),
    listFriends(user.id),
    listPendingRequests(user.id),
    getActiveMembership(user.id),
  ]);
  const lobbyMessages = active ? await listLobbyMessages(active.lobbyId) : [];

  const latest = notifications.recent.slice(0, 3);
  const crew = friends.map((f) => ({
    id: f.id,
    username: f.username!,
    displayName: f.displayName,
    avatarId: f.avatarId,
  }));

  return (
    <div className="flex min-h-dvh flex-1">
      <PresenceBeacon />
      <AppSidebar username={user.username} />

      {/* Center column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4 sm:gap-4 sm:px-6">
            <Link href="/dashboard" className="flex items-center lg:hidden">
              <ChipaeLogo size={44} priority />
            </Link>
            <nav className="flex items-center gap-1 text-sm lg:hidden">
              <Link
                href="/lobbies"
                className="rounded-md px-2.5 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Play
              </Link>
              <Link
                href="/friends"
                className="rounded-md px-2.5 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Friends
              </Link>
            </nav>

            <div className="hidden flex-1 justify-center sm:flex">
              <SearchBox />
            </div>
            <span className="flex-1 sm:hidden" />

            <div className="flex items-center gap-2">
              <NotificationBell userId={user.id} summary={notifications} />
              <Link
                href={`/player/${user.username}`}
                aria-label="Your profile"
                className="transition-opacity hover:opacity-80"
              >
                <AvatarChip avatarId={user.avatarId} className="size-8" />
              </Link>
            </div>
          </div>
        </header>
        {children}
      </div>

      {/* Right crew rail (hidden on lobby routes and below xl) */}
      <RightRail>
        <LobbyQuickPanel
          active={
            active
              ? {
                  lobbyId: active.lobbyId,
                  name: active.lobby.name,
                  code: active.lobby.code,
                  maxPlayers: active.lobby.maxPlayers,
                  members: active.lobby.members.map((m) => ({
                    seat: m.seat,
                    isBot: m.isBot,
                    botName: m.botName,
                    userId: m.userId,
                    username: m.user?.username ?? null,
                    displayName: m.user?.displayName ?? null,
                    avatarId: m.user?.avatarId ?? null,
                  })),
                }
              : null
          }
          friends={crew}
          initialMessages={lobbyMessages}
        />

        <OnlineCrew friends={crew} />

        {requests.incoming.length > 0 && (
          <Link
            href="/friends"
            className="flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2.5 text-xs font-medium text-foreground transition-colors hover:bg-primary/15"
          >
            <span className="flex size-5 items-center justify-center rounded-full bg-primary font-mono text-[10px] font-bold text-primary-foreground">
              {Math.min(requests.incoming.length, 9)}
            </span>
            friend {requests.incoming.length === 1 ? "request" : "requests"}{" "}
            waiting
          </Link>
        )}

        <div className="flex flex-col gap-2">
          <h2 className="font-heading text-sm text-foreground">Latest</h2>
          {latest.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              All quiet. Open a lobby and stir things up.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {latest.map((notification) => (
                <li key={notification.id}>
                  <NotificationRow
                    type={notification.type}
                    payload={notification.payload}
                    createdAt={notification.createdAt}
                    read={notification.read}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </RightRail>
    </div>
  );
}
