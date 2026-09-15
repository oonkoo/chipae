"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { DieFace } from "./icons";

// The dice, thrown into the middle of the table.
//
// The roll is already decided by the server before this ever renders — the
// tumble is pure theatre over a known result, which is the only honest way to
// animate a server-authoritative game. Nothing here can change what was rolled.
//
// No timers and no effects: each roll remounts the dice (keyed by its `seq`),
// and a CSS animation plays once on mount. A server refresh that re-sends the
// same roll changes nothing, so it can never cut a tumble short.

export const TUMBLE_MS = 620;

export function DiceTray({
  roll,
  className,
}: {
  /** A new `seq` is a new throw. */
  roll: { d1: number; d2: number; seq: number } | null;
  className?: string;
}) {
  // The roll showing when we arrived isn't thrown again — joining a match in
  // progress shouldn't replay someone else's dice.
  const [arrivedAt] = useState(roll?.seq ?? null);
  if (!roll) return null;
  const thrown = roll.seq !== arrivedAt;

  return (
    <div
      key={roll.seq}
      className={cn("flex items-center gap-1.5", className)}
      aria-live="polite"
      aria-label={`Rolled ${roll.d1} and ${roll.d2}`}
    >
      <Die value={roll.d1} thrown={thrown} delay={0} />
      <Die value={roll.d2} thrown={thrown} delay={70} />
    </div>
  );
}

function Die({ value, thrown, delay }: { value: number; thrown: boolean; delay: number }) {
  return (
    <DieFace
      value={value}
      className={cn(
        "size-[max(28px,4.8cqw)] drop-shadow-md",
        thrown && "motion-safe:[animation:ew-tumble_var(--ew-tumble)_ease-out_both]"
      )}
      // Two dice thrown together shouldn't tumble in lockstep.
      style={
        {
          "--ew-tumble": `${TUMBLE_MS}ms`,
          animationDelay: `${delay}ms`,
        } as React.CSSProperties
      }
    />
  );
}
