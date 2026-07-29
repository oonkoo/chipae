import "server-only";
import Pusher from "pusher";
import { CHANNELS } from "./channels";
import {
  EVENT_NAME,
  lobbyEventSchema,
  userEventSchema,
  type LobbyEvent,
  type UserEvent,
} from "./events";

// The ONLY module allowed to import the `pusher` server SDK (ADR-0001).
// Publish AFTER the DB write succeeds; events are best-effort hints.

const globalForPusher = globalThis as unknown as { pusher?: Pusher };

function getPusher(): Pusher | null {
  const { PUSHER_APP_ID, PUSHER_SECRET, NEXT_PUBLIC_PUSHER_KEY, NEXT_PUBLIC_PUSHER_CLUSTER } =
    process.env;
  if (!PUSHER_APP_ID || !PUSHER_SECRET || !NEXT_PUBLIC_PUSHER_KEY || !NEXT_PUBLIC_PUSHER_CLUSTER) {
    return null;
  }
  globalForPusher.pusher ??= new Pusher({
    appId: PUSHER_APP_ID,
    key: NEXT_PUBLIC_PUSHER_KEY,
    secret: PUSHER_SECRET,
    cluster: NEXT_PUBLIC_PUSHER_CLUSTER,
    useTLS: true,
  });
  return globalForPusher.pusher;
}

async function trigger(channel: string, payload: unknown) {
  const pusher = getPusher();
  if (!pusher) return; // realtime unconfigured — features degrade to refresh
  try {
    await pusher.trigger(channel, EVENT_NAME, payload);
  } catch (error) {
    // Never fail the mutation because a hint didn't send.
    console.error(`[realtime] trigger failed on ${channel}:`, error);
  }
}

export async function publishToUser(userId: string, event: UserEvent) {
  await trigger(CHANNELS.user(userId), userEventSchema.parse(event));
}

export async function publishToLobby(lobbyId: string, event: LobbyEvent) {
  await trigger(CHANNELS.lobby(lobbyId), lobbyEventSchema.parse(event));
}

export function getPusherForAuth(): Pusher {
  const pusher = getPusher();
  if (!pusher) {
    throw new Error("Pusher env vars missing — see .env.example");
  }
  return pusher;
}
