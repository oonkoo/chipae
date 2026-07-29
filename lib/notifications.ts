import "server-only";
import { db } from "@/lib/db";

export async function getNotificationSummary(userId: string) {
  const [unreadCount, recent] = await Promise.all([
    db.notification.count({ where: { userId, readAt: null } }),
    db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);
  return {
    unreadCount,
    recent: recent.map((n) => ({
      id: n.id,
      type: n.type,
      payload: n.payload as Record<string, unknown>,
      read: n.readAt !== null,
      createdAt: n.createdAt.toISOString(),
    })),
  };
}

export type NotificationSummary = Awaited<
  ReturnType<typeof getNotificationSummary>
>;
