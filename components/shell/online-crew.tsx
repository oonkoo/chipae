"use client";

import Link from "next/link";
import { usePresence } from "@/lib/realtime/client";
import { AvatarChip } from "@/components/avatar-chip";
import { PresenceDot } from "@/components/presence-dot";
import { cn } from "@/lib/utils";

type CrewFriend = {
  id: string;
  username: string;
  displayName: string | null;
  avatarId: string;
};

/** Crew rail list: online friends surface to the top with live dots. */
export function OnlineCrew({ friends }: { friends: CrewFriend[] }) {
  const onlineIds = usePresence();

  const sorted = [...friends].sort((a, b) => {
    const aOn = onlineIds.has(a.id) ? 0 : 1;
    const bOn = onlineIds.has(b.id) ? 0 : 1;
    return aOn - bOn;
  });
  const onlineCount = friends.filter((f) => onlineIds.has(f.id)).length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 className="font-heading text-sm text-foreground">Your crew</h2>
        <span className="text-[10px] text-muted-foreground">
          {onlineCount} online
        </span>
      </div>

      {friends.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
          Empty rail — deal someone in from the{" "}
          <Link href="/friends" className="text-primary hover:underline">
            Friends
          </Link>{" "}
          page.
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {sorted.slice(0, 8).map((friend) => {
            const online = onlineIds.has(friend.id);
            return (
              <li key={friend.id}>
                <Link
                  href={`/player/${friend.username}`}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-muted/50",
                    !online && "opacity-55"
                  )}
                >
                  <span className="relative">
                    <AvatarChip avatarId={friend.avatarId} className="size-8" />
                    <PresenceDot userId={friend.id} className="size-2.5" />
                  </span>
                  <span className="truncate text-xs font-medium">
                    {friend.displayName || `@${friend.username}`}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {friends.length > 8 && (
        <Link
          href="/friends"
          className="text-[11px] text-primary hover:underline"
        >
          All {friends.length} friends →
        </Link>
      )}
    </div>
  );
}
