"use client";

import { useEffect, useState } from "react";
import PusherJs, { type Members, type PresenceChannel } from "pusher-js";
import { CHANNELS } from "./channels";
import {
  EVENT_NAME,
  lobbyEventSchema,
  userEventSchema,
  type LobbyEvent,
  type UserEvent,
} from "./events";

// The ONLY module allowed to import pusher-js (ADR-0001). Events are hints:
// consumers refresh server data on receipt rather than trusting payloads.

let client: PusherJs | null = null;

function getClient(): PusherJs | null {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  if (!key || !cluster) return null; // unconfigured — degrade gracefully
  client ??= new PusherJs(key, {
    cluster,
    channelAuthorization: {
      endpoint: "/api/pusher/auth",
      transport: "ajax",
    },
  });
  return client;
}

/** Live set of online user ids from the global presence channel. */
export function usePresence(): Set<string> {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const pusher = getClient();
    if (!pusher) return;

    const channel = pusher.subscribe(CHANNELS.presence) as PresenceChannel;

    const sync = () => {
      const members: Members = channel.members;
      const ids = new Set<string>();
      members.each((member: { id: string }) => ids.add(member.id));
      setOnlineIds(ids);
    };

    channel.bind("pusher:subscription_succeeded", sync);
    channel.bind("pusher:member_added", sync);
    channel.bind("pusher:member_removed", sync);

    return () => {
      channel.unbind("pusher:subscription_succeeded", sync);
      channel.unbind("pusher:member_added", sync);
      channel.unbind("pusher:member_removed", sync);
      // Leave the channel subscribed — other components may share it; pusher-js
      // reference-counts via our singleton and disconnects on page unload.
    };
  }, []);

  return onlineIds;
}

/** Subscribe to the current user's private event channel. */
export function useUserChannel(
  userId: string,
  onEvent: (event: UserEvent) => void
) {
  useEffect(() => {
    const pusher = getClient();
    if (!pusher) return;

    const channel = pusher.subscribe(CHANNELS.user(userId));
    const handler = (raw: unknown) => {
      const parsed = userEventSchema.safeParse(raw);
      if (parsed.success) onEvent(parsed.data);
    };
    channel.bind(EVENT_NAME, handler);
    return () => {
      channel.unbind(EVENT_NAME, handler);
    };
    // onEvent is intentionally captured per mount; callers memoize if needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
}

/** Subscribe to a lobby's event channel (requires membership, see auth route). */
export function useLobbyChannel(
  lobbyId: string,
  onEvent: (event: LobbyEvent) => void
) {
  useEffect(() => {
    const pusher = getClient();
    if (!pusher) return;

    const channel = pusher.subscribe(CHANNELS.lobby(lobbyId));
    const handler = (raw: unknown) => {
      const parsed = lobbyEventSchema.safeParse(raw);
      if (parsed.success) onEvent(parsed.data);
    };
    channel.bind(EVENT_NAME, handler);
    return () => {
      channel.unbind(EVENT_NAME, handler);
      pusher.unsubscribe(CHANNELS.lobby(lobbyId));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobbyId]);
}
