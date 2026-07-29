import "server-only";
import { db } from "@/lib/db";
import type { Friendship, User } from "@/lib/generated/prisma/client";
import {
  classifyRelationship,
  type RelationshipStateOf,
} from "@/lib/friendship-rules";

/**
 * Friend-graph queries and invariants. The schema cannot prevent a reverse
 * duplicate (A→B and B→A), so every write path resolves the existing
 * relationship in BOTH directions first. Pure rules live in
 * lib/friendship-rules.ts (unit-tested without a database).
 */

export type RelationshipState = RelationshipStateOf<Friendship>;
export { classifyRelationship };

export async function getRelationship(
  viewerId: string,
  otherId: string
): Promise<RelationshipState> {
  if (viewerId === otherId) return { kind: "none" };

  const friendship = await db.friendship.findFirst({
    where: {
      OR: [
        { requesterId: viewerId, addresseeId: otherId },
        { requesterId: otherId, addresseeId: viewerId },
      ],
    },
  });
  if (!friendship) return { kind: "none" };
  return classifyRelationship(friendship, viewerId);
}

export async function listFriends(userId: string): Promise<User[]> {
  const rows = await db.friendship.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    include: { requester: true, addressee: true },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((row) =>
    row.requesterId === userId ? row.addressee : row.requester
  );
}

export async function listPendingRequests(userId: string) {
  const [incoming, outgoing] = await Promise.all([
    db.friendship.findMany({
      where: { addresseeId: userId, status: "PENDING" },
      include: { requester: true },
      orderBy: { createdAt: "desc" },
    }),
    db.friendship.findMany({
      where: { requesterId: userId, status: "PENDING" },
      include: { addressee: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { incoming, outgoing };
}

export async function listBlocked(userId: string) {
  return db.friendship.findMany({
    where: { requesterId: userId, status: "BLOCKED" },
    include: { addressee: true },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Username/display-name search excluding the viewer and anyone in a BLOCKED
 * relationship with them (either direction). Returns each hit with its
 * relationship state so the UI can render the right action.
 */
export async function searchPlayers(viewerId: string, query: string) {
  const blocked = await db.friendship.findMany({
    where: {
      status: "BLOCKED",
      OR: [{ requesterId: viewerId }, { addresseeId: viewerId }],
    },
    select: { requesterId: true, addresseeId: true },
  });
  const excludedIds = new Set<string>([viewerId]);
  for (const row of blocked) {
    excludedIds.add(row.requesterId);
    excludedIds.add(row.addresseeId);
  }

  const users = await db.user.findMany({
    where: {
      id: { notIn: [...excludedIds] },
      username: { not: null },
      OR: [
        { username: { contains: query, mode: "insensitive" } },
        { displayName: { contains: query, mode: "insensitive" } },
      ],
    },
    take: 12,
    orderBy: { username: "asc" },
  });

  const relationships = await db.friendship.findMany({
    where: {
      OR: [
        { requesterId: viewerId, addresseeId: { in: users.map((u) => u.id) } },
        { addresseeId: viewerId, requesterId: { in: users.map((u) => u.id) } },
      ],
    },
  });
  const byOther = new Map<string, Friendship>();
  for (const f of relationships) {
    byOther.set(f.requesterId === viewerId ? f.addresseeId : f.requesterId, f);
  }

  return users.map((user) => {
    const friendship = byOther.get(user.id);
    return {
      user,
      relationship: friendship
        ? classifyRelationship(friendship, viewerId)
        : ({ kind: "none" } as RelationshipState),
    };
  });
}
