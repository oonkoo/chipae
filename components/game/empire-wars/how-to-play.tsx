"use client";

import { useEffect, useRef } from "react";
import { RiCloseLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { EMPIRE_WARS_CONFIG } from "@/lib/game/data/empire-wars";
import { FrameCorners } from "./art";

// The whole game on one card — the GDD's "The whole game in 60 seconds",
// word for word. If a rule isn't on this card, a first-time player must be
// able to play without knowing it. If it doesn't fit here, it doesn't go in
// the game.

function fmt(amount: number): string {
  return amount.toLocaleString("en-US");
}

/** The last line of the card: how *this* match is won, from its settings. */
function winningStep(target: number | null, rounds: number | null) {
  if (target !== null) {
    return {
      title: `First to ${fmt(target)} net worth wins`,
      body: `— your coins plus what your cities are worth${
        rounds === null ? "" : `; after ${rounds} rounds, the richest`
      }. Run out of coins and you're out.`,
    };
  }
  if (rounds !== null) {
    return {
      title: `The richest after ${rounds} rounds wins`,
      body: "— net worth is your coins plus what your cities are worth. Run out of coins and you're out.",
    };
  }
  return {
    title: "The last empire standing wins",
    body: "— no target, no round limit. Run out of coins and you're out.",
  };
}

function steps(target: number | null, rounds: number | null) {
  return [
    {
      title: "Roll and move.",
      body: `Passing the Silk Road pays you ${fmt(EMPIRE_WARS_CONFIG.payday)} coins.`,
    },
    { title: "Land on a free city?", body: "Buy it — or pass, and everyone bids for it at auction." },
    { title: "Land on a rival's city?", body: "You pay them tribute, automatically." },
    {
      title: "Own a whole empire",
      body: "— all three of its cities? Your tribute doubles, and you can build.",
    },
    {
      title: "Build up to 4 houses on a city, then the empire's monument",
      body: "— the Eiffel Tower, the Taj Mahal… Tribute soars.",
    },
    { title: "On your turn, open the Market", body: "to trade cities and coins, or to auction a city." },
    winningStep(target, rounds),
  ];
}

export function HowToPlay({
  target,
  rounds,
  onClose,
}: {
  target: number | null;
  rounds: number | null;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // It can open on its own, so it takes focus — and Escape closes it.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ew-how-to-play"
      className="ew-backdrop absolute inset-0 z-50 flex items-center justify-center rounded-3xl p-4 backdrop-blur-sm"
    >
      <div className="ew-dialog relative isolate max-h-full w-full max-w-md overflow-y-auto rounded-2xl p-5">
        <FrameCorners className="size-7 @md:size-9" />
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="ew-how-to-play" className="font-heading text-xl text-[var(--ew-gold)]">
            How to play
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <RiCloseLine className="size-5" />
          </button>
        </div>

        <ol className="flex flex-col gap-3">
          {steps(target, rounds).map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span
                className="flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-xs"
                style={{
                  background: "color-mix(in srgb, var(--ew-gold) 22%, transparent)",
                  color: "var(--ew-gold)",
                }}
              >
                {i + 1}
              </span>
              <p className="text-sm leading-snug text-muted-foreground">
                <span className="font-medium text-foreground">{step.title}</span> {step.body}
              </p>
            </li>
          ))}
        </ol>

        <Button variant="game" className="mt-5 w-full" onClick={onClose}>
          Build my empire
        </Button>
      </div>
    </div>
  );
}
