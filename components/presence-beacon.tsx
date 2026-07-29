"use client";

import { usePresence } from "@/lib/realtime/client";

/**
 * Keeps the client subscribed to the global presence channel while any
 * platform page is open, so this user reads as online to friends.
 */
export function PresenceBeacon() {
  usePresence();
  return null;
}
