"use client";

import { cn } from "@/lib/utils";
import type { EmpireId } from "@/lib/game/data/empire-wars";
import { MonumentArt } from "./art";

// The table's one orchestrated moment (art direction: one per screen, at
// most): a monument going up. A walnut card rises in the middle of the table
// with the painted monument, holds, and leaves — one CSS animation that ends
// invisible, so there are no timers to clean up and a server refresh can't
// cut it short. The board mounts it keyed by the build event's `seq`, only for
// builds that happened after the viewer arrived, so a reload never replays it.
//
// It never takes a click (pointer-events-none) and it's aria-hidden: the feed
// already announces the build to screen readers. Under reduced motion the card
// fades in and out without moving.

export function MonumentMoment({
  empire,
  monument,
  city,
  builder,
}: {
  empire: EmpireId;
  monument: string;
  city: string;
  /** "You", or the builder's name. */
  builder: string;
}) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-[12.5%] z-30 flex items-center justify-center">
      <div
        className={cn(
          "ew-panel flex max-w-[80%] flex-col items-center gap-1 rounded-2xl px-5 py-3 text-center opacity-0 @md:px-7 @md:py-4",
          "motion-safe:[animation:ew-moment_var(--ew-moment-ms)_var(--ew-ease-arrive)_forwards]",
          "motion-reduce:[animation:ew-moment-fade_var(--ew-moment-ms)_linear_forwards]"
        )}
      >
        <span className="relative flex items-center justify-center">
          <span className="absolute size-[160%] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--ew-brass-hi)_70%,transparent)_0%,transparent_65%)] opacity-0 motion-safe:[animation:ew-glint_1100ms_ease-out_200ms_forwards]" />
          <MonumentArt
            empire={empire}
            title={monument}
            className="relative size-[max(72px,13cqw)] drop-shadow-[0_6px_10px_var(--ew-shadow)]"
          />
        </span>
        <p className="font-heading text-lg leading-tight text-[var(--ew-gold)] @md:text-2xl">{monument} rises</p>
        <p className="text-xs text-foreground/85 @md:text-sm">
          {builder} built it in {city}
        </p>
      </div>
    </div>
  );
}
