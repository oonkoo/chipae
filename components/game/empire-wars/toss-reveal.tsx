"use client";

import { useEffect, useState } from "react";
import { RiCopperCoinFill } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import type { TurnEvent } from "@/lib/game/empire-wars/rules";
import { cn } from "@/lib/utils";
import { roundsLabel, settingsLine, targetLabel } from "./feed";
import { FrameCorners } from "./art";

// The toss (GDD > Match setup). The server has already decided; this only
// plays it out — a highlight runs down the pickers, slows, and stops on the
// winner. With nothing to toss (everyone agreed, one human, nobody picked) it
// just announces the match. It only ever mounts on the client, after the
// table has been seen leaving setup, so a reload never replays it.

export type SettledEvent = Extract<TurnEvent, { kind: "settled" }>;

/** Full passes down the list before the highlight settles. */
const SPIN_PASSES = 3;
/** How long the result stays up before the table plays on. */
const HOLD_MS = 2600;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function TossReveal({
  event,
  who,
  colorOf,
  onDone,
}: {
  event: SettledEvent;
  who: (memberId: string) => string;
  colorOf: (memberId: string) => string;
  onDone: () => void;
}) {
  const tossed = event.settledBy === "toss";
  const count = event.picks.length;
  const winnerIndex = Math.max(0, event.picks.findIndex((p) => p.memberId === event.memberId));
  const steps = tossed ? SPIN_PASSES * count + winnerIndex : 0;

  const [reduced] = useState(prefersReducedMotion);
  const [step, setStep] = useState(0);
  const landed = !tossed || reduced || step >= steps;
  const cursor = landed ? winnerIndex : step % Math.max(1, count);

  // The spin: every step a little slower than the last.
  useEffect(() => {
    if (landed) return;
    const t = setTimeout(() => setStep((s) => s + 1), 55 + (step / steps) ** 2 * 300);
    return () => clearTimeout(t);
  }, [landed, step, steps]);

  // Then the result holds a moment, and the table plays on.
  useEffect(() => {
    if (!landed) return;
    const t = setTimeout(onDone, HOLD_MS);
    return () => clearTimeout(t);
  }, [landed, onDone]);

  const title = tossed
    ? "The toss"
    : event.settledBy === "default"
      ? "Standard match"
      : count > 1
        ? "Everyone agreed"
        : `${who(event.memberId) === "You" ? "Your" : `${who(event.memberId)}'s`} rules`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ew-toss"
      className="ew-backdrop absolute inset-0 z-40 flex items-center justify-center rounded-3xl p-3 backdrop-blur-sm"
    >
      <div className="ew-dialog relative isolate flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl p-5 text-center">
        <FrameCorners className="size-7 @md:size-9" />
        <RiCopperCoinFill
          aria-hidden
          className={cn("size-10 text-[var(--ew-gold)]", tossed && !landed && "animate-spin")}
        />
        <h2 id="ew-toss" className="font-heading text-xl text-[var(--ew-gold)]">
          {title}
        </h2>

        {tossed && (
          <ul className="flex w-full flex-col gap-1" aria-hidden={!landed}>
            {event.picks.map((pick, i) => (
              <li
                key={pick.memberId}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors duration-100",
                  i === cursor
                    ? "border-[var(--ew-gold)] bg-[color-mix(in_srgb,var(--ew-gold)_18%,transparent)] text-foreground"
                    : "ew-chip text-muted-foreground"
                )}
              >
                <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: colorOf(pick.memberId) }} />
                <span className="min-w-0 flex-1 truncate text-left">{who(pick.memberId)}</span>
                <span className="shrink-0 font-mono tabular-nums">
                  {targetLabel(pick.target)} · {roundsLabel(pick.rounds)}
                  {pick.rounds === null ? "" : " rounds"}
                </span>
              </li>
            ))}
          </ul>
        )}

        {landed && (
          <div aria-live="polite" className="flex flex-col gap-1">
            {tossed && (
              <p className="text-sm font-medium text-foreground">
                {who(event.memberId) === "You" ? "You win" : `${who(event.memberId)} wins`} the toss
              </p>
            )}
            <p className="font-heading text-lg text-[var(--ew-gain)] first-letter:uppercase">
              {settingsLine(event.target, event.rounds)}
            </p>
          </div>
        )}

        <Button variant="game" size="sm" disabled={!landed} onClick={onDone}>
          Let&apos;s play
        </Button>
      </div>
    </div>
  );
}
