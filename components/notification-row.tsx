import Link from "next/link";
import {
  RiDoorOpenLine,
  RiGroupLine,
  RiNotification3Line,
  RiUserAddLine,
  type RemixiconComponentType,
} from "@remixicon/react";
import { notificationText } from "@/lib/notification-text";
import { cn } from "@/lib/utils";

const KINDS: Record<string, { icon: RemixiconComponentType; tint: string }> = {
  FRIEND_REQUEST: { icon: RiUserAddLine, tint: "bg-primary/15 text-primary" },
  FRIEND_ACCEPTED: { icon: RiGroupLine, tint: "bg-success/15 text-success" },
  LOBBY_INVITE: { icon: RiDoorOpenLine, tint: "bg-chart-4/15 text-chart-4" },
};

const FALLBACK_KIND = {
  icon: RiNotification3Line,
  tint: "bg-muted text-muted-foreground",
};

function timeAgo(date: Date | string): string {
  const then = new Date(date).getTime();
  const mins = Math.round((Date.now() - then) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * One notification, anywhere notifications render (bell popover, crew rail).
 * Pure presentational — safe in server and client trees.
 */
export function NotificationRow({
  type,
  payload,
  createdAt,
  read = true,
}: {
  type: string;
  payload: Record<string, unknown>;
  createdAt: Date | string;
  read?: boolean;
}) {
  const { text, href } = notificationText(type, payload);
  const kind = KINDS[type] ?? FALLBACK_KIND;
  const Icon = kind.icon;

  const row = (
    <span
      className={cn(
        "flex items-start gap-2.5 rounded-xl px-2.5 py-2 transition-colors",
        href && "hover:bg-muted/50",
        !read && "bg-primary/5"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
          kind.tint
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span
          className={cn(
            "text-xs leading-snug",
            read ? "text-muted-foreground" : "font-medium text-foreground"
          )}
        >
          {text}
        </span>
        {/* Relative time drifts between SSR and hydration — that's fine. */}
        <span
          className="text-[10px] text-muted-foreground/70"
          suppressHydrationWarning
        >
          {timeAgo(createdAt)}
        </span>
      </span>
      {!read && (
        <span className="mt-1.5 ml-auto size-1.5 shrink-0 rounded-full bg-primary" />
      )}
    </span>
  );

  return href ? (
    <Link href={href} className="block">
      {row}
    </Link>
  ) : (
    row
  );
}
