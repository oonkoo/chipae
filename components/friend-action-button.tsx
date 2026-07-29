"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  removeFriend,
  sendFriendRequest,
  type FriendActionResult,
} from "@/lib/actions/friends";
import { Button } from "@/components/ui/button";

export type RelationshipKind =
  | "none"
  | "friends"
  | "outgoing"
  | "incoming"
  | "blocked-by-viewer"
  | "blocked-viewer";

/**
 * The one friend button: renders the correct action for the current
 * relationship state. Blocked states render nothing (managed in settings).
 */
export function FriendActionButton({
  userId,
  relationship,
  friendshipId,
  size = "sm",
}: {
  userId: string;
  relationship: RelationshipKind;
  friendshipId: string | null;
  size?: "sm" | "default";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Optimistic override for rows whose props never refresh (client-held
  // search results advance themselves on success). Keyed to the props it
  // was derived from: a server re-render with changed props wins.
  type Rel = { relationship: RelationshipKind; friendshipId: string | null };
  const [override, setOverride] = useState<(Rel & { base: string }) | null>(
    null
  );
  // Which of the incoming pair (accept/decline) is in flight, for its label.
  const [pendingSide, setPendingSide] = useState<"accept" | "decline" | null>(
    null
  );
  const base = `${relationship}:${friendshipId}`;
  const rel: Rel =
    override?.base === base
      ? {
          relationship: override.relationship,
          friendshipId: override.friendshipId,
        }
      : { relationship, friendshipId };

  function run(
    action: () => Promise<FriendActionResult>,
    next: (friendshipId: string | null) => Rel
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error);
      else setOverride({ base, ...next(result.friendshipId ?? null) });
      router.refresh();
    });
  }

  if (
    rel.relationship === "blocked-by-viewer" ||
    rel.relationship === "blocked-viewer"
  ) {
    return null;
  }

  const button = (() => {
    switch (rel.relationship) {
      case "none":
        return (
          <Button
            size={size}
            disabled={pending}
            onClick={() =>
              run(
                () => sendFriendRequest(userId),
                (id) => ({ relationship: "outgoing", friendshipId: id })
              )
            }
          >
            {pending ? "Dealing…" : "Add friend"}
          </Button>
        );
      case "outgoing":
        return (
          <Button
            size={size}
            variant="outline"
            disabled={pending || !rel.friendshipId}
            onClick={() => {
              const id = rel.friendshipId;
              if (id)
                run(
                  () => cancelFriendRequest(id),
                  () => ({ relationship: "none", friendshipId: null })
                );
            }}
          >
            {pending ? "…" : "Cancel request"}
          </Button>
        );
      case "incoming":
        return (
          <span className="flex items-center gap-2">
            <Button
              size={size}
              variant="secondary"
              disabled={pending || !rel.friendshipId}
              onClick={() => {
                const id = rel.friendshipId;
                if (id) {
                  setPendingSide("accept");
                  run(
                    () => acceptFriendRequest(id),
                    () => ({ relationship: "friends", friendshipId: id })
                  );
                }
              }}
            >
              {pending && pendingSide === "accept" ? "…" : "Accept"}
            </Button>
            <Button
              size={size}
              variant="ghost"
              disabled={pending || !rel.friendshipId}
              onClick={() => {
                const id = rel.friendshipId;
                if (id) {
                  setPendingSide("decline");
                  run(
                    () => declineFriendRequest(id),
                    () => ({ relationship: "none", friendshipId: null })
                  );
                }
              }}
            >
              {pending && pendingSide === "decline" ? "…" : "Decline"}
            </Button>
          </span>
        );
      case "friends":
        return (
          <Button
            size={size}
            variant="ghost"
            disabled={pending || !rel.friendshipId}
            onClick={() => {
              const id = rel.friendshipId;
              if (id)
                run(
                  () => removeFriend(id),
                  () => ({ relationship: "none", friendshipId: null })
                );
            }}
          >
            {pending ? "…" : "Remove"}
          </Button>
        );
    }
  })();

  return (
    <span className="flex flex-col items-end gap-1">
      {button}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  );
}
