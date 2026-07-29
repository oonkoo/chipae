"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getOnboardedUser } from "@/lib/user";
import { searchPlayers as searchQuery } from "@/lib/friends";
import { publishToUser } from "@/lib/realtime/server";
import { RATE, rateLimit } from "@/lib/rate-limit";
import { acquireTxLock, lockKeys } from "@/lib/locks";

export type FriendActionResult =
  | { ok: true; friendshipId?: string }
  | { ok: false; error: string };

const idSchema = z.string().min(1).max(64);
const searchSchema = z.string().trim().min(2).max(30);

function refresh() {
  revalidatePath("/friends");
  revalidatePath("/dashboard");
  // Profile pages render relationship state and friend counts.
  revalidatePath("/player/[username]", "page");
}

export async function searchPlayers(rawQuery: string) {
  const viewer = await getOnboardedUser();
  if (!rateLimit(`search:${viewer.id}`, RATE.search.limit, RATE.search.windowMs)) {
    return [];
  }
  const parsed = searchSchema.safeParse(rawQuery);
  if (!parsed.success) return [];
  const results = await searchQuery(viewer.id, parsed.data);
  // Strip to what the UI needs — never ship whole User rows to the client.
  return results.map(({ user, relationship }) => ({
    id: user.id,
    username: user.username!,
    displayName: user.displayName,
    avatarId: user.avatarId,
    relationship: relationship.kind,
    friendshipId:
      relationship.kind === "none" ? null : relationship.friendship.id,
  }));
}

export async function sendFriendRequest(
  rawUserId: string
): Promise<FriendActionResult> {
  const viewer = await getOnboardedUser();
  if (
    !rateLimit(
      `friend-req:${viewer.id}`,
      RATE.friendRequest.limit,
      RATE.friendRequest.windowMs
    )
  ) {
    return { ok: false, error: "Easy — give the requests a minute" };
  }
  const parsed = idSchema.safeParse(rawUserId);
  if (!parsed.success) return { ok: false, error: "Invalid player" };
  const otherId = parsed.data;

  if (otherId === viewer.id) {
    return { ok: false, error: "You're already at your own table" };
  }
  const other = await db.user.findUnique({ where: { id: otherId } });
  if (!other || !other.username) {
    return { ok: false, error: "Player not found" };
  }

  // Pair lock makes the both-directions check and the insert atomic — the
  // ordered-pair unique index cannot stop A→B and B→A racing in.
  const created = await db.$transaction(async (tx) => {
    await acquireTxLock(tx, lockKeys.pair(viewer.id, otherId));
    const existing = await tx.friendship.findFirst({
      where: {
        OR: [
          { requesterId: viewer.id, addresseeId: otherId },
          { requesterId: otherId, addresseeId: viewer.id },
        ],
      },
    });
    if (existing) return null;
    const friendship = await tx.friendship.create({
      data: { requesterId: viewer.id, addresseeId: otherId },
    });
    await tx.notification.create({
      data: {
        userId: otherId,
        type: "FRIEND_REQUEST",
        payload: { fromUserId: viewer.id, fromUsername: viewer.username },
      },
    });
    return friendship.id;
  });
  if (!created) {
    return { ok: false, error: "There's already a relationship with this player" };
  }

  await publishToUser(otherId, {
    type: "friend-request-received",
    fromUsername: viewer.username!,
  });
  refresh();
  // The id lets client-held rows flip straight to "Cancel request".
  return { ok: true, friendshipId: created };
}

export async function acceptFriendRequest(
  rawFriendshipId: string
): Promise<FriendActionResult> {
  const viewer = await getOnboardedUser();
  const parsed = idSchema.safeParse(rawFriendshipId);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  const friendship = await db.friendship.findUnique({
    where: { id: parsed.data },
  });
  // Only the addressee of a pending request may accept it.
  if (
    !friendship ||
    friendship.status !== "PENDING" ||
    friendship.addresseeId !== viewer.id
  ) {
    return { ok: false, error: "Request not found" };
  }

  await db.$transaction(async (tx) => {
    await tx.friendship.update({
      where: { id: friendship.id },
      data: { status: "ACCEPTED" },
    });
    await tx.notification.create({
      data: {
        userId: friendship.requesterId,
        type: "FRIEND_ACCEPTED",
        payload: { byUserId: viewer.id, byUsername: viewer.username },
      },
    });
  });

  await publishToUser(friendship.requesterId, {
    type: "friend-request-accepted",
    byUsername: viewer.username!,
  });
  refresh();
  return { ok: true };
}

export async function declineFriendRequest(
  rawFriendshipId: string
): Promise<FriendActionResult> {
  const viewer = await getOnboardedUser();
  const parsed = idSchema.safeParse(rawFriendshipId);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  const friendship = await db.friendship.findUnique({
    where: { id: parsed.data },
  });
  if (
    !friendship ||
    friendship.status !== "PENDING" ||
    friendship.addresseeId !== viewer.id
  ) {
    return { ok: false, error: "Request not found" };
  }

  await db.friendship.delete({ where: { id: friendship.id } });
  refresh();
  return { ok: true };
}

export async function cancelFriendRequest(
  rawFriendshipId: string
): Promise<FriendActionResult> {
  const viewer = await getOnboardedUser();
  const parsed = idSchema.safeParse(rawFriendshipId);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  const friendship = await db.friendship.findUnique({
    where: { id: parsed.data },
  });
  if (
    !friendship ||
    friendship.status !== "PENDING" ||
    friendship.requesterId !== viewer.id
  ) {
    return { ok: false, error: "Request not found" };
  }

  await db.friendship.delete({ where: { id: friendship.id } });
  refresh();
  return { ok: true };
}

export async function removeFriend(
  rawFriendshipId: string
): Promise<FriendActionResult> {
  const viewer = await getOnboardedUser();
  const parsed = idSchema.safeParse(rawFriendshipId);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  const friendship = await db.friendship.findUnique({
    where: { id: parsed.data },
  });
  const isParty =
    friendship &&
    (friendship.requesterId === viewer.id ||
      friendship.addresseeId === viewer.id);
  if (!friendship || !isParty || friendship.status !== "ACCEPTED") {
    return { ok: false, error: "Friendship not found" };
  }

  await db.friendship.delete({ where: { id: friendship.id } });
  refresh();
  return { ok: true };
}

export async function blockUser(
  rawUserId: string
): Promise<FriendActionResult> {
  const viewer = await getOnboardedUser();
  const parsed = idSchema.safeParse(rawUserId);
  if (!parsed.success) return { ok: false, error: "Invalid player" };
  const otherId = parsed.data;

  if (otherId === viewer.id) {
    return { ok: false, error: "You can't block yourself" };
  }
  const other = await db.user.findUnique({ where: { id: otherId } });
  if (!other) return { ok: false, error: "Player not found" };

  // Same pair lock as sendFriendRequest: check + replace must be atomic.
  const blocked = await db.$transaction(async (tx) => {
    await acquireTxLock(tx, lockKeys.pair(viewer.id, otherId));
    const existing = await tx.friendship.findFirst({
      where: {
        OR: [
          { requesterId: viewer.id, addresseeId: otherId },
          { requesterId: otherId, addresseeId: viewer.id },
        ],
      },
    });
    if (existing?.status === "BLOCKED") {
      // Already blocked by viewer → done; blocked by other → stay invisible.
      return existing.requesterId === viewer.id ? "done" : "hidden";
    }
    if (existing) {
      await tx.friendship.delete({ where: { id: existing.id } });
    }
    // Blocker is always the requester on BLOCKED rows.
    await tx.friendship.create({
      data: {
        requesterId: viewer.id,
        addresseeId: otherId,
        status: "BLOCKED",
      },
    });
    return "done";
  });
  if (blocked === "hidden") {
    return { ok: false, error: "Player not found" };
  }

  refresh();
  return { ok: true };
}

export async function unblockUser(
  rawFriendshipId: string
): Promise<FriendActionResult> {
  const viewer = await getOnboardedUser();
  const parsed = idSchema.safeParse(rawFriendshipId);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  const friendship = await db.friendship.findUnique({
    where: { id: parsed.data },
  });
  if (
    !friendship ||
    friendship.status !== "BLOCKED" ||
    friendship.requesterId !== viewer.id
  ) {
    return { ok: false, error: "Not found" };
  }

  await db.friendship.delete({ where: { id: friendship.id } });
  refresh();
  return { ok: true };
}
