import Link from "next/link";
import { getOnboardedUser } from "@/lib/user";
import {
  listBlocked,
  listFriends,
  listPendingRequests,
} from "@/lib/friends";
import { AvatarChip } from "@/components/avatar-chip";
import { FriendActionButton } from "@/components/friend-action-button";
import { PresenceDot } from "@/components/presence-dot";
import { FriendSearch } from "./friend-search";
import { UnblockButton } from "./unblock-button";

export const metadata = { title: "Friends" };

export default async function FriendsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await getOnboardedUser();
  const { q } = await searchParams;
  const [friends, requests, blocked] = await Promise.all([
    listFriends(user.id),
    listPendingRequests(user.id),
    listBlocked(user.id),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-6 py-12">
      <div>
        <h1 className="font-heading text-3xl text-foreground">Friends</h1>
        <p className="text-sm text-muted-foreground">
          Your table crew — {friends.length}{" "}
          {friends.length === 1 ? "player" : "players"} strong.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground">Find players</h2>
        <FriendSearch initialQuery={q} />
      </section>

      {(requests.incoming.length > 0 || requests.outgoing.length > 0) && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-foreground">Requests</h2>
          <ul className="flex flex-col gap-1">
            {requests.incoming.map((request) => (
              <li
                key={request.id}
                className="flex items-center gap-3 rounded-lg bg-card p-3"
              >
                <AvatarChip
                  avatarId={request.requester.avatarId}
                  className="size-10"
                />
                <Link
                  href={`/player/${request.requester.username}`}
                  className="flex min-w-0 flex-col"
                >
                  <span className="truncate text-sm font-medium">
                    {request.requester.displayName ||
                      `@${request.requester.username}`}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    wants to join your crew
                  </span>
                </Link>
                <span className="ml-auto">
                  <FriendActionButton
                    userId={request.requesterId}
                    relationship="incoming"
                    friendshipId={request.id}
                  />
                </span>
              </li>
            ))}
            {requests.outgoing.map((request) => (
              <li
                key={request.id}
                className="flex items-center gap-3 rounded-lg bg-card/50 p-3"
              >
                <AvatarChip
                  avatarId={request.addressee.avatarId}
                  className="size-10"
                />
                <Link
                  href={`/player/${request.addressee.username}`}
                  className="flex min-w-0 flex-col"
                >
                  <span className="truncate text-sm font-medium">
                    {request.addressee.displayName ||
                      `@${request.addressee.username}`}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    waiting on their answer
                  </span>
                </Link>
                <span className="ml-auto">
                  <FriendActionButton
                    userId={request.addresseeId}
                    relationship="outgoing"
                    friendshipId={request.id}
                  />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground">Your crew</h2>
        {friends.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No friends yet — deal someone in. Search above or share your
              profile.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {friends.map((friend) => (
              <li
                key={friend.id}
                className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50"
              >
                <span className="relative">
                  <AvatarChip avatarId={friend.avatarId} className="size-10" />
                  <PresenceDot userId={friend.id} />
                </span>
                <Link
                  href={`/player/${friend.username}`}
                  className="flex min-w-0 flex-col"
                >
                  <span className="truncate text-sm font-medium">
                    {friend.displayName || `@${friend.username}`}
                  </span>
                  <span className="truncate font-mono text-xs text-muted-foreground">
                    @{friend.username}
                  </span>
                </Link>
                <span className="ml-auto" />
              </li>
            ))}
          </ul>
        )}
      </section>

      {blocked.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Blocked
          </h2>
          <ul className="flex flex-col gap-1">
            {blocked.map((row) => (
              <li
                key={row.id}
                className="flex items-center gap-3 rounded-lg p-2 opacity-70"
              >
                <AvatarChip
                  avatarId={row.addressee.avatarId}
                  className="size-8"
                />
                <span className="font-mono text-sm text-muted-foreground">
                  @{row.addressee.username}
                </span>
                <span className="ml-auto">
                  <UnblockButton friendshipId={row.id} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
