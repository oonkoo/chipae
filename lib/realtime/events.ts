import { z } from "zod";

// Typed realtime event contracts (ADR-0001). Every payload crossing the
// realtime layer is validated against these schemas on both ends.
// Events are hints — receivers revalidate from the server; DB is the truth.

export const userEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("friend-request-received"),
    fromUsername: z.string(),
  }),
  z.object({
    type: z.literal("friend-request-accepted"),
    byUsername: z.string(),
  }),
  z.object({
    type: z.literal("lobby-invite"),
    fromUsername: z.string(),
    lobbyCode: z.string(),
    lobbyName: z.string(),
  }),
  z.object({
    type: z.literal("notification-created"),
  }),
]);
export type UserEvent = z.infer<typeof userEventSchema>;

export const lobbyEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("member-joined"), username: z.string() }),
  z.object({ type: z.literal("member-left"), username: z.string() }),
  z.object({
    type: z.literal("ready-changed"),
    memberId: z.string(),
    ready: z.boolean(),
  }),
  z.object({ type: z.literal("host-changed"), newHostUsername: z.string() }),
  z.object({ type: z.literal("bots-changed") }),
  z.object({ type: z.literal("settings-changed") }),
  z.object({ type: z.literal("game-changed") }),
  z.object({ type: z.literal("lobby-closed") }),
  z.object({
    type: z.literal("chat-message"),
    id: z.string(),
    username: z.string(),
    avatarId: z.string(),
    text: z.string().max(500),
    sentAt: z.string(),
    /** Omitted/"lobby" = lounge chat; "game" = the running game's chat. */
    scope: z.enum(["lobby", "game"]).optional(),
  }),
]);
export type LobbyEvent = z.infer<typeof lobbyEventSchema>;

/** Single Pusher event name; payloads are discriminated by `type`. */
export const EVENT_NAME = "chipae-event";
