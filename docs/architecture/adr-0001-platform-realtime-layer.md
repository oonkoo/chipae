# ADR-0001: Platform Realtime Layer — Pusher Channels behind an internal abstraction

## Status

Accepted

## Date

2026-07-27

## Last Verified

2026-07-27

## Decision Makers

CHNsPart (product owner) — delegated to Claude (technical direction), per plan approval

## Summary

Chipae's platform features (presence, lobby member sync, notifications, chat) need realtime push to browsers, but the platform must stay deployable to serverless hosting (Vercel). Decision: use **Pusher Channels** (hosted pub/sub with presence channels) for all platform realtime, accessed exclusively through an internal `lib/realtime/` abstraction so the provider can be swapped without touching feature code. Game-loop netcode is explicitly **out of scope** — it gets its own ADR when games are built.

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Web — Next.js 16 (App Router) on serverless hosting |
| **Domain** | Networking |
| **Knowledge Risk** | MEDIUM — Pusher SDKs (`pusher`, `pusher-js`) are stable and in training data, but verify current major versions and Next 16 route-handler auth patterns at implementation time |
| **References Consulted** | `node_modules/next/dist/docs/01-app/` (route handlers, server actions) |
| **Post-Cutoff APIs Used** | None expected; verify `pusher-js` version at install |
| **Verification Required** | Presence channel auth via a Next 16 route handler; events received across two browsers; reconnect behavior after network drop |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | None (foundational) |
| **Enables** | Future ADR: game-session netcode (may choose PartyKit/Rivet without replacing this layer) |
| **Blocks** | Tasks: presence (#14), realtime lobby sync (#17), lobby chat (#19), live notifications (#15) |
| **Ordering Note** | The `lib/realtime/` abstraction must exist before any feature subscribes to events |

## Context

### Problem Statement

Friends lists need live online status; lobby rooms need instant member/ready/host updates; notifications and chat need push delivery. HTTP polling gives poor UX and wasteful load. Next.js on serverless cannot host long-lived WebSocket connections itself, so the transport must be external. Deciding late would force rework of every lobby/presence feature.

### Current State

Greenfield — no realtime infrastructure exists.

### Constraints

- Must work from serverless/edge deployment (no long-running Node process to own sockets)
- Solo developer — minimal operational burden strongly preferred
- Postgres (via Prisma) is the single source of truth; realtime must not become a second authority
- Free tier must comfortably cover development and early usage

### Requirements

- Presence: who is online / in-lobby / in-game, with join/leave events
- Room-scoped broadcast: lobby events delivered only to that lobby's members
- Private channels with server-side authorization (session-checked)
- Client SDK with automatic reconnect
- Latency suitable for UI updates (<500 ms end-to-end is ample; this is not game netcode)

## Decision

Adopt **Pusher Channels**:

- **Presence channels** (`presence-user-status`, `presence-lobby-{id}`) for online status and lobby membership awareness.
- **Private channels** (`private-user-{id}`) for personal notifications; lobby broadcasts on `presence-lobby-{id}`.
- **Channel authorization** via a Next.js route handler (`app/api/pusher/auth/route.ts`) that validates the Kinde session and the user's right to the channel (e.g., lobby membership checked in Postgres).
- **Server-side triggers only**: events are published from server actions *after* the Postgres write succeeds. Clients never trigger events directly (no client events), so the DB remains the sole authority and every mutation passes authz.

### Architecture

```
Browser A ──subscribe──▶ Pusher Channels ◀──subscribe── Browser B
    │                        ▲
    │ server action          │ trigger (server SDK)
    ▼                        │
Next.js server action ──1. write──▶ Prisma Postgres
                        └─2. publish event (only after write succeeds)

Channel auth: browser ──▶ /api/pusher/auth ──▶ Kinde session + Postgres membership check
```

### Key Interfaces

```ts
// lib/realtime/server.ts — the ONLY place the Pusher server SDK is imported
publishToLobby(lobbyId: string, event: LobbyEvent): Promise<void>
publishToUser(userId: string, event: UserEvent): Promise<void>

// lib/realtime/client.ts — the ONLY place pusher-js is imported
useLobbyChannel(lobbyId: string, handlers: LobbyEventHandlers): void
useUserChannel(handlers: UserEventHandlers): void
usePresence(): { onlineUserIds: Set<string> }

// lib/realtime/events.ts — typed event contracts (zod schemas)
type LobbyEvent = MemberJoined | MemberLeft | ReadyChanged | HostChanged
               | BotSlotChanged | SettingsChanged | LobbyClosed | ChatMessage
type UserEvent  = FriendRequestReceived | FriendRequestAccepted | LobbyInvite | NotificationCreated
```

### Implementation Guidelines

- Feature code imports from `lib/realtime/` only — importing `pusher`/`pusher-js` anywhere else is a forbidden pattern (recorded in technical-preferences).
- Every event payload is validated with the shared zod schema on both ends.
- Realtime is best-effort delivery: UI must also revalidate from the server on mount/focus so a missed event never leaves stale state (event = hint, DB = truth).
- Env vars: `PUSHER_APP_ID`, `PUSHER_SECRET`, `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`.

## Alternatives Considered

### Alternative 1: Ably

- **Description**: Equivalent hosted pub/sub with presence, history/rewind, stronger delivery guarantees.
- **Pros**: More generous free tier ceilings; message history could serve chat scrollback.
- **Cons**: Slightly heavier SDK/concepts for the same platform needs.
- **Estimated Effort**: Equal.
- **Rejection Reason**: Near-tie. Pusher chosen for simpler DX; the `lib/realtime/` abstraction keeps Ably available as a drop-in replacement if Pusher's limits bite.

### Alternative 2: PartyKit (Cloudflare Durable Objects)

- **Description**: Stateful rooms as edge workers; each lobby a live server that could later run game logic.
- **Pros**: Would double as authoritative game-session host later; websockets + state in one place.
- **Cons**: Second deploy target and runtime to operate now; overkill for presence/notify/chat; game netcode needs are unknown until games are designed.
- **Estimated Effort**: Higher now.
- **Rejection Reason**: Solves a future problem prematurely. The future game-netcode ADR can adopt PartyKit/Rivet alongside this layer without conflict.

### Alternative 3: Custom Socket.IO server

- **Description**: Self-hosted Node WebSocket server beside Next.js.
- **Pros**: Full control, no vendor.
- **Cons**: Forces non-serverless deployment for the whole platform, adds scaling/ops burden, reimplements presence/auth that Pusher provides.
- **Estimated Effort**: Highest.
- **Rejection Reason**: Deployment constraint and ops cost unacceptable for a solo project at this stage.

### Alternative 4: Supabase Realtime

- **Description**: Postgres-changes/broadcast channels from Supabase.
- **Cons**: Database is Prisma Postgres, not Supabase; adopting Supabase only for realtime couples us to a second platform's auth/infra semantics.
- **Rejection Reason**: Stack mismatch.

## Consequences

### Positive

- Zero realtime infrastructure to operate; serverless deployment preserved
- Presence and channel auth are solved problems out of the box
- Typed event contracts + provider abstraction keep feature code vendor-agnostic

### Negative

- Vendor dependency with usage-based pricing beyond free tier (mitigated by abstraction)
- Best-effort delivery — no guaranteed ordering/history; chat scrollback needs DB persistence if wanted later
- Free-tier concurrent-connection cap (~100) bounds early scale testing

### Neutral

- Events are transient; any state a reconnecting client needs must be reconstructable from Postgres (this is also the correct discipline)

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Free-tier limits hit during growth | Medium | Low | Abstraction allows swap to Ably or paid tier; usage visible in Pusher dashboard |
| Missed events cause stale UI | Medium | Medium | Revalidate-on-mount/focus rule; realtime is a hint, never the record |
| Games later need low-latency authoritative netcode Pusher can't provide | High | Low | Explicitly out of scope; future ADR adds a game transport without touching this layer |

## Performance Implications

| Metric | Before | Expected After | Budget |
|--------|--------|---------------|--------|
| UI event latency | n/a (polling would be 5–30 s) | 100–300 ms typical | < 500 ms |
| Client bundle | — | +~30 KB gzip (pusher-js) | acceptable |
| Server per-mutation overhead | — | +1 HTTPS trigger call | < 50 ms, non-blocking after DB write |

## Migration Plan

Greenfield — no migration. **Rollback plan**: swap the `lib/realtime/` implementation to Ably (near drop-in) or degrade to `lastSeenAt` polling for presence; feature code unchanged.

## Validation Criteria

- [ ] Two browsers in one lobby see join/leave/ready changes without refresh
- [ ] Friend's online dot flips within 1 s of their session start/close
- [ ] Channel auth rejects a user who is not a member of the lobby
- [ ] Killing the network and reconnecting restores correct state (revalidation works)

## GDD Requirements Addressed

Foundational — no GDD requirement. Enables: friends presence, lobby rooms, notifications, lobby chat (platform infrastructure phase; see task list #14, #15, #17, #19).

## Related

- Future ADR: game-session netcode (transport for actual gameplay — not this ADR)
- `lib/realtime/` (to be implemented in tasks #14/#17)

## Addendum (2026-07-27)

The "chat scrollback needs DB persistence if wanted later" consequence was
exercised: lobby chat is now persisted in `LobbyMessage` (deleted when the
lobby closes) so every chat surface (room column, shell rail) seeds the same
history. `chat-message` events remain best-effort delivery hints published
only after the Postgres write succeeds — the table is the authority, in line
with this ADR's decision.
