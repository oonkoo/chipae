"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { RiNotification3Line } from "@remixicon/react";
import type { NotificationSummary } from "@/lib/notifications";
import { NotificationRow } from "@/components/notification-row";
import { markAllNotificationsRead } from "@/lib/actions/notifications";
import { useUserChannel } from "@/lib/realtime/client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function NotificationBell({
  userId,
  summary,
}: {
  userId: string;
  summary: NotificationSummary;
}) {
  const router = useRouter();

  // Realtime events are hints — refresh server data when one arrives.
  useUserChannel(
    userId,
    useCallback(() => router.refresh(), [router])
  );

  return (
    <Popover
      onOpenChange={(open) => {
        if (open && summary.unreadCount > 0) {
          void markAllNotificationsRead().then(() => router.refresh());
        }
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Notifications${
              summary.unreadCount ? ` (${summary.unreadCount} unread)` : ""
            }`}
            className="relative"
          >
            <RiNotification3Line />
            {summary.unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary font-mono text-[10px] font-bold text-primary-foreground">
                {Math.min(summary.unreadCount, 9)}
              </span>
            )}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80 p-2">
        <p className="px-2 py-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          At your table
        </p>
        {summary.recent.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            All quiet. Invite someone to play.
          </p>
        ) : (
          <ul className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
            {summary.recent.map((notification) => (
              <li key={notification.id}>
                <NotificationRow
                  type={notification.type}
                  payload={notification.payload}
                  createdAt={notification.createdAt}
                  read={notification.read}
                />
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
