// Channel naming — shared by server triggers and client subscriptions.
// presence-* and private-* prefixes are enforced by Pusher's auth flow
// (authorized in app/api/pusher/auth/route.ts).

export const CHANNELS = {
  /** Global presence channel: who is online right now. */
  presence: "presence-online",
  /** Per-user private channel: notifications, friend events, invites. */
  user: (userId: string) => `private-user-${userId}`,
  /** Per-lobby presence channel: members, ready states, chat. */
  lobby: (lobbyId: string) => `presence-lobby-${lobbyId}`,
} as const;
