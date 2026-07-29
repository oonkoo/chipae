"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getOnboardedUser } from "@/lib/user";
import { getRelationship } from "@/lib/friends";
import { LOBBY_LIMITS, nextFreeSeat, randomLobbyCode } from "@/lib/lobbies";
import { acquireTxLock, lockKeys } from "@/lib/locks";
import { pickBotName } from "@/lib/bots";
import { applyQuit } from "@/lib/game/nuno/rules";
import { loadActiveSession, persistGameState } from "@/lib/game/session";
import { publishToLobby, publishToUser } from "@/lib/realtime/server";
import { RATE, rateLimit } from "@/lib/rate-limit";

export type LobbyActionResult = { ok: true } | { ok: false; error: string };

const idSchema = z.string().min(1).max(64);
const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z2-9]{6}$/, "Codes are 6 letters and numbers");
const difficultySchema = z.enum(["EASY", "NORMAL", "HARD"]);

const lobbySettingsSchema = z.object({
  name: z.string().trim().min(1).max(40),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
  maxPlayers: z.coerce
    .number()
    .int()
    .min(LOBBY_LIMITS.minPlayers)
    .max(LOBBY_LIMITS.maxPlayers),
});

function refreshLobby(lobbyId: string) {
  revalidatePath(`/lobby/${lobbyId}`);
  revalidatePath("/lobbies");
  // Dashboard shows the active-table banner.
  revalidatePath("/dashboard");
}

/** Membership + optional host authz in one lookup. */
async function requireMembership(lobbyId: string, userId: string, opts?: { host?: boolean }) {
  const lobby = await db.lobby.findUnique({
    where: { id: lobbyId },
    include: { members: true },
  });
  if (!lobby || lobby.status === "CLOSED") return null;
  const me = lobby.members.find((m) => m.userId === userId);
  if (!me) return null;
  if (opts?.host && lobby.hostId !== userId) return null;
  return { lobby, me };
}

export async function createLobby(formData: FormData): Promise<void> {
  const user = await getOnboardedUser();
  if (
    !rateLimit(
      `create-lobby:${user.id}`,
      RATE.createLobby.limit,
      RATE.createLobby.windowMs
    )
  ) {
    redirect("/lobbies?error=slow");
  }

  const parsed = lobbySettingsSchema.safeParse({
    name: formData.get("name") || `${user.username}'s lobby`,
    visibility: formData.get("visibility") ?? "PRIVATE",
    maxPlayers: formData.get("maxPlayers") ?? LOBBY_LIMITS.defaultPlayers,
  });
  if (!parsed.success) {
    redirect("/lobbies?error=settings");
  }

  // Seat lock makes "one active table per user" atomic — two parallel
  // creates/joins would otherwise both pass the membership check.
  // Retries cover lobby-code collisions (unique constraint is the backstop).
  let lobbyId: string | null = null;
  for (let attempt = 0; attempt < 3 && !lobbyId; attempt++) {
    try {
      lobbyId = await db.$transaction(async (tx) => {
        await acquireTxLock(tx, lockKeys.seat(user.id));
        const existing = await tx.lobbyMember.findFirst({
          where: { userId: user.id, lobby: { status: { not: "CLOSED" } } },
        });
        if (existing) return existing.lobbyId;
        const lobby = await tx.lobby.create({
          data: {
            code: randomLobbyCode(),
            name: parsed.data.name,
            hostId: user.id,
            visibility: parsed.data.visibility,
            maxPlayers: parsed.data.maxPlayers,
            members: {
              create: { userId: user.id, seat: 1, role: "HOST", ready: true },
            },
          },
        });
        return lobby.id;
      });
    } catch {
      // code collision — regenerate and retry
    }
  }
  if (!lobbyId) {
    redirect("/lobbies?error=busy");
  }

  refreshLobby(lobbyId);
  redirect(`/lobby/${lobbyId}`);
}

export async function joinLobbyByCode(rawCode: string): Promise<LobbyActionResult> {
  const user = await getOnboardedUser();
  // Codes gate private lobbies — throttle guessing.
  if (
    !rateLimit(`join-code:${user.id}`, RATE.joinCode.limit, RATE.joinCode.windowMs)
  ) {
    return { ok: false, error: "Too many tries — wait a moment" };
  }
  const parsed = codeSchema.safeParse(rawCode);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const lobby = await db.lobby.findUnique({
    where: { code: parsed.data },
    include: { members: true },
  });
  if (!lobby || lobby.status !== "OPEN") {
    return { ok: false, error: "No open lobby with that code" };
  }
  return joinLobby(lobby.id, user.id);
}

export async function joinPublicLobby(rawLobbyId: string): Promise<LobbyActionResult> {
  const user = await getOnboardedUser();
  const parsed = idSchema.safeParse(rawLobbyId);
  if (!parsed.success) return { ok: false, error: "Invalid lobby" };

  const lobby = await db.lobby.findUnique({ where: { id: parsed.data } });
  if (!lobby || lobby.status !== "OPEN" || lobby.visibility !== "PUBLIC") {
    return { ok: false, error: "That lobby isn't open to walk-ins" };
  }
  return joinLobby(lobby.id, user.id);
}

async function joinLobby(lobbyId: string, userId: string): Promise<LobbyActionResult> {
  const user = await getOnboardedUser();

  // Block screening happens outside the transaction — it's read-only and
  // a racing block change is harmless.
  const preview = await db.lobby.findUnique({
    where: { id: lobbyId },
    select: { hostId: true },
  });
  if (!preview) {
    return { ok: false, error: "That lobby just closed" };
  }
  const relation = await getRelationship(userId, preview.hostId);
  if (relation.kind === "blocked-viewer" || relation.kind === "blocked-by-viewer") {
    return { ok: false, error: "No open lobby with that code" };
  }

  type JoinOutcome =
    | { kind: "error"; message: string }
    | { kind: "joined"; announce: boolean };

  // Lock order: seat before lobby (see lib/locks.ts). Makes single-table
  // membership and seat assignment atomic.
  const outcome = await db.$transaction(async (tx): Promise<JoinOutcome> => {
    await acquireTxLock(tx, lockKeys.seat(userId));
    await acquireTxLock(tx, lockKeys.lobby(lobbyId));

    const active = await tx.lobbyMember.findFirst({
      where: { userId, lobby: { status: { not: "CLOSED" } } },
    });
    if (active && active.lobbyId !== lobbyId) {
      return { kind: "error", message: "You're already seated at another lobby" };
    }
    if (active) {
      return { kind: "joined", announce: false };
    }

    const lobby = await tx.lobby.findUnique({
      where: { id: lobbyId },
      include: { members: { select: { seat: true } } },
    });
    if (!lobby || lobby.status !== "OPEN") {
      return { kind: "error", message: "That lobby just closed" };
    }

    const seat = nextFreeSeat(
      lobby.members.map((m) => m.seat),
      lobby.maxPlayers
    );
    if (seat === null) {
      return { kind: "error", message: "Lobby's full — try another" };
    }

    await tx.lobbyMember.create({ data: { lobbyId, userId, seat } });
    return { kind: "joined", announce: true };
  });

  if (outcome.kind === "error") {
    return { ok: false, error: outcome.message };
  }
  if (outcome.announce) {
    await publishToLobby(lobbyId, {
      type: "member-joined",
      username: user.username!,
    });
    refreshLobby(lobbyId);
  }
  redirect(`/lobby/${lobbyId}`);
}

export async function leaveLobby(rawLobbyId: string): Promise<void> {
  const user = await getOnboardedUser();
  const parsed = idSchema.safeParse(rawLobbyId);
  if (!parsed.success) redirect("/lobbies");
  const targetLobbyId = parsed.data;

  // All membership decisions (who's left, who inherits the host chip) are
  // made inside the lobby lock — concurrent leaves see consistent state.
  const outcome = await db.$transaction(async (tx) => {
    await acquireTxLock(tx, lockKeys.lobby(targetLobbyId));

    const lobby = await tx.lobby.findUnique({
      where: { id: targetLobbyId },
      include: {
        members: {
          include: {
            user: {
              select: {
                username: true,
                displayName: true,
                avatarId: true,
              },
            },
          },
        },
      },
    });
    if (!lobby || lobby.status === "CLOSED") return null;
    const me = lobby.members.find((m) => m.userId === user.id);
    if (!me) return null;

    // Leaving mid-game quits the game first: eliminated from the hand,
    // remaining humans play on (ADR-0004).
    let gameQuit = false;
    if (lobby.status === "IN_GAME") {
      const loaded = await loadActiveSession(tx, lobby.id);
      if (loaded) {
        const quit = applyQuit(loaded.state, me.id);
        if (quit.ok) {
          await persistGameState(tx, {
            lobbyId: lobby.id,
            session: loaded.session,
            state: quit.state,
            members: lobby.members,
          });
          gameQuit = true;
        }
      }
    }

    const humansLeft = lobby.members.filter(
      (m) => !m.isBot && m.userId !== user.id
    );

    if (humansLeft.length === 0) {
      // Last human out — the table folds. Chat and any open game go with it.
      await tx.lobbyMessage.deleteMany({ where: { lobbyId: lobby.id } });
      await tx.gameSession.updateMany({
        where: { lobbyId: lobby.id, endedAt: null },
        data: { endedAt: new Date() },
      });
      await tx.lobby.update({
        where: { id: lobby.id },
        data: { status: "CLOSED", members: { deleteMany: {} } },
      });
      return { lobbyId: lobby.id, closed: true as const, gameQuit };
    }

    const newHost =
      lobby.hostId === user.id
        ? humansLeft.reduce((a, b) => (a.joinedAt <= b.joinedAt ? a : b))
        : null;

    await tx.lobbyMember.delete({ where: { id: me.id } });
    if (newHost) {
      await tx.lobby.update({
        where: { id: lobby.id },
        data: { hostId: newHost.userId! },
      });
      await tx.lobbyMember.update({
        where: { id: newHost.id },
        data: { role: "HOST" },
      });
    }

    return {
      lobbyId: lobby.id,
      closed: false as const,
      newHostUsername: newHost?.user?.username ?? null,
      gameQuit,
    };
  });

  if (outcome) {
    if (outcome.closed) {
      await publishToLobby(outcome.lobbyId, { type: "lobby-closed" });
    } else {
      await publishToLobby(outcome.lobbyId, {
        type: "member-left",
        username: user.username!,
      });
      if (outcome.newHostUsername) {
        await publishToLobby(outcome.lobbyId, {
          type: "host-changed",
          newHostUsername: outcome.newHostUsername,
        });
      }
      if (outcome.gameQuit) {
        await publishToLobby(outcome.lobbyId, { type: "game-changed" });
      }
    }
    refreshLobby(outcome.lobbyId);
  }
  redirect("/lobbies");
}

export async function kickMember(
  rawLobbyId: string,
  rawMemberId: string
): Promise<LobbyActionResult> {
  const user = await getOnboardedUser();
  const lobbyId = idSchema.safeParse(rawLobbyId);
  const memberId = idSchema.safeParse(rawMemberId);
  if (!lobbyId.success || !memberId.success) {
    return { ok: false, error: "Invalid request" };
  }

  const found = await requireMembership(lobbyId.data, user.id, { host: true });
  if (!found) return { ok: false, error: "Only the host can do that" };

  const target = found.lobby.members.find((m) => m.id === memberId.data);
  if (!target || target.userId === user.id) {
    return { ok: false, error: "Can't kick that seat" };
  }

  const targetUser = target.userId
    ? await db.user.findUnique({
        where: { id: target.userId },
        select: { username: true },
      })
    : null;

  try {
    await db.lobbyMember.delete({ where: { id: target.id } });
  } catch {
    // Already gone (left on their own) — treat as done.
    refreshLobby(found.lobby.id);
    return { ok: true };
  }

  if (target.isBot) {
    await publishToLobby(found.lobby.id, { type: "bots-changed" });
  } else {
    await publishToLobby(found.lobby.id, {
      type: "member-left",
      username: targetUser?.username ?? "unknown",
    });
  }
  refreshLobby(found.lobby.id);
  return { ok: true };
}

export async function toggleReady(rawLobbyId: string): Promise<LobbyActionResult> {
  const user = await getOnboardedUser();
  const parsed = idSchema.safeParse(rawLobbyId);
  if (!parsed.success) return { ok: false, error: "Invalid table" };

  const found = await requireMembership(parsed.data, user.id);
  if (!found) return { ok: false, error: "You're not at this table" };

  const updated = await db.lobbyMember.update({
    where: { id: found.me.id },
    data: { ready: !found.me.ready },
  });

  await publishToLobby(found.lobby.id, {
    type: "ready-changed",
    memberId: updated.id,
    ready: updated.ready,
  });
  refreshLobby(found.lobby.id);
  return { ok: true };
}

export async function addBot(
  rawLobbyId: string,
  rawDifficulty: string
): Promise<LobbyActionResult> {
  const user = await getOnboardedUser();
  const lobbyId = idSchema.safeParse(rawLobbyId);
  const difficulty = difficultySchema.safeParse(rawDifficulty);
  if (!lobbyId.success || !difficulty.success) {
    return { ok: false, error: "Invalid request" };
  }

  const found = await requireMembership(lobbyId.data, user.id, { host: true });
  if (!found) return { ok: false, error: "Only the host seats CPUs" };

  const seat = nextFreeSeat(
    found.lobby.members.map((m) => m.seat),
    found.lobby.maxPlayers
  );
  if (seat === null) return { ok: false, error: "Lobby's full" };

  try {
    await db.lobbyMember.create({
      data: {
        lobbyId: found.lobby.id,
        isBot: true,
        botName: pickBotName(found.lobby.members.map((m) => m.botName)),
        botDifficulty: difficulty.data,
        seat,
        ready: true, // CPUs are always ready
      },
    });
  } catch {
    // Seat race with a joining player — the unique(lobbyId, seat) backstop.
    return { ok: false, error: "Someone just took that seat" };
  }

  await publishToLobby(found.lobby.id, { type: "bots-changed" });
  refreshLobby(found.lobby.id);
  return { ok: true };
}

export async function updateLobbySettings(
  rawLobbyId: string,
  formData: FormData
): Promise<LobbyActionResult> {
  const user = await getOnboardedUser();
  const lobbyId = idSchema.safeParse(rawLobbyId);
  if (!lobbyId.success) return { ok: false, error: "Invalid table" };

  const found = await requireMembership(lobbyId.data, user.id, { host: true });
  if (!found) return { ok: false, error: "Only the host can change the lobby" };

  const parsed = lobbySettingsSchema.safeParse({
    name: formData.get("name"),
    visibility: formData.get("visibility"),
    maxPlayers: formData.get("maxPlayers"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  // Seats can be sparse (someone left seat 2 while seat 4 stayed), so the
  // floor is the highest occupied seat — not just the head count. Shrinking
  // past it would strand that player outside the table.
  const highestSeat = found.lobby.members.reduce(
    (max, m) => Math.max(max, m.seat),
    0
  );
  if (parsed.data.maxPlayers < highestSeat) {
    return { ok: false, error: "Someone's sitting in a seat you'd remove" };
  }

  await db.lobby.update({
    where: { id: found.lobby.id },
    data: parsed.data,
  });

  await publishToLobby(found.lobby.id, { type: "settings-changed" });
  refreshLobby(found.lobby.id);
  return { ok: true };
}

const chatSchema = z.string().trim().min(1).max(300);

/**
 * Lobby chat. Persisted to LobbyMessage (deleted when the lobby closes) so
 * every chat surface loads the same history; the realtime event is a live
 * delivery hint published after the write succeeds (ADR-0001).
 */
export async function sendLobbyChat(
  rawLobbyId: string,
  rawText: string
): Promise<LobbyActionResult> {
  const user = await getOnboardedUser();
  if (!rateLimit(`chat:${user.id}`, RATE.chat.limit, RATE.chat.windowMs)) {
    return { ok: false, error: "Slow down — the table can't keep up" };
  }
  const lobbyId = idSchema.safeParse(rawLobbyId);
  const text = chatSchema.safeParse(rawText);
  if (!lobbyId.success || !text.success) {
    return { ok: false, error: "Say something sayable" };
  }

  const found = await requireMembership(lobbyId.data, user.id);
  if (!found) return { ok: false, error: "You're not at this table" };

  const message = await db.lobbyMessage.create({
    data: { lobbyId: found.lobby.id, userId: user.id, text: text.data },
  });

  await publishToLobby(found.lobby.id, {
    type: "chat-message",
    id: message.id,
    username: user.username!,
    avatarId: user.avatarId,
    text: text.data,
    sentAt: message.createdAt.toISOString(),
    scope: "lobby",
  });
  return { ok: true };
}

export async function inviteFriendToLobby(
  rawLobbyId: string,
  rawFriendId: string
): Promise<LobbyActionResult> {
  const user = await getOnboardedUser();
  if (!rateLimit(`invite:${user.id}`, RATE.invite.limit, RATE.invite.windowMs)) {
    return { ok: false, error: "That's a lot of invites — take a breath" };
  }
  const lobbyId = idSchema.safeParse(rawLobbyId);
  const friendId = idSchema.safeParse(rawFriendId);
  if (!lobbyId.success || !friendId.success) {
    return { ok: false, error: "Invalid request" };
  }

  const found = await requireMembership(lobbyId.data, user.id);
  if (!found) return { ok: false, error: "You're not at this table" };
  if (found.lobby.status !== "OPEN") {
    return { ok: false, error: "This lobby isn't seating right now" };
  }

  const relation = await getRelationship(user.id, friendId.data);
  if (relation.kind !== "friends") {
    return { ok: false, error: "You can only invite friends" };
  }
  if (found.lobby.members.some((m) => m.userId === friendId.data)) {
    return { ok: false, error: "They're already seated here" };
  }

  await db.notification.create({
    data: {
      userId: friendId.data,
      type: "LOBBY_INVITE",
      payload: {
        fromUserId: user.id,
        fromUsername: user.username,
        lobbyId: found.lobby.id,
        lobbyCode: found.lobby.code,
        lobbyName: found.lobby.name,
      },
    },
  });
  await publishToUser(friendId.data, {
    type: "lobby-invite",
    fromUsername: user.username!,
    lobbyCode: found.lobby.code,
    lobbyName: found.lobby.name,
  });
  return { ok: true };
}
