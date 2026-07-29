"use client";

import { usePresence } from "@/lib/realtime/client";
import { cn } from "@/lib/utils";

/**
 * Online indicator dot, positioned by the parent (relative container).
 * Mint = online, faded = offline. In-lobby / in-game states arrive with
 * the lobby feature.
 */
export function PresenceDot({
  userId,
  className,
}: {
  userId: string;
  className?: string;
}) {
  const onlineIds = usePresence();
  const online = onlineIds.has(userId);

  return (
    <span
      aria-label={online ? "Online" : "Offline"}
      className={cn(
        "absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-background transition-colors",
        online ? "bg-success" : "bg-muted-foreground/40",
        className
      )}
    />
  );
}
