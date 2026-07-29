"use client";

import { usePathname } from "next/navigation";

/**
 * Right rail of the lounge shell. Hidden inside lobby routes — the room
 * screen carries its own chat column there — and below xl.
 * Content is server-rendered and passed through as children.
 */
export function RightRail({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/lobby")) return null;

  return (
    <aside className="sticky top-0 hidden h-dvh w-[300px] shrink-0 flex-col gap-6 overflow-y-auto border-l border-border bg-card/40 p-5 xl:flex">
      {children}
    </aside>
  );
}
