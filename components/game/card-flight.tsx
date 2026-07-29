"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { NunoCard } from "@/lib/game/nuno/rules";
import { NunoCardBack, NunoCardFace } from "@/components/game/nuno-card";

// Cards travelling between places on the table. Motion spec (motion-design
// skill): this is spatial continuity / on-screen morph, so ease-in-out-cubic
// at 240ms — long enough to read as a throw, short enough to never delay
// play. Everything animates on the compositor (transform/opacity only).

export const FLIGHT_MS = 240;
export const FLIGHT_EASE = "cubic-bezier(.645, .045, .355, 1)";

export type Point = { x: number; y: number };

export type Flight = {
  key: string;
  /** Face-up card in flight; omit for a face-down draw. */
  card?: NunoCard;
  from: Point;
  to: Point;
  /** Degrees of spin picked up on the way — small, never cartoonish. */
  rotate: number;
  delayMs: number;
  /**
   * When set, the card parks on the pile after landing instead of
   * vanishing, and the board removes it once the server confirms this card
   * id as the new top. Without it the played card would blink out and
   * expose the previous top card until the refresh arrives.
   */
  holdForTopId?: string;
};

/** Centre point of an element, in viewport coordinates. */
export function centerOf(el: Element | null | undefined): Point | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function FlyingCard({
  flight,
  onDone,
}: {
  flight: Flight;
  /** Called when the card should leave the layer (never while parked). */
  onDone: (key: string) => void;
}) {
  const [moved, setMoved] = useState(false);
  const doneRef = useRef(false);

  // Two frames: mount at the origin, then commit the transform so the
  // transition actually runs.
  useLayoutEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setMoved(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, []);

  // Belt and braces: transitionend can be missed if the layer unmounts or
  // the tab is backgrounded, and a stuck card would hover forever.
  useEffect(() => {
    const timer = setTimeout(
      () => finish(),
      flight.delayMs + FLIGHT_MS + 120
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finish() {
    if (doneRef.current) return;
    // A parked card stays until the board retires it on confirmation.
    if (flight.holdForTopId) return;
    doneRef.current = true;
    onDone(flight.key);
  }

  const dx = flight.to.x - flight.from.x;
  const dy = flight.to.y - flight.from.y;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed z-50"
      style={{
        left: flight.from.x,
        top: flight.from.y,
        transform: moved
          ? `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${flight.rotate}deg)`
          : "translate(-50%, -50%) rotate(0deg)",
        opacity: moved ? 1 : 0.92,
        transition: `transform ${FLIGHT_MS}ms ${FLIGHT_EASE} ${flight.delayMs}ms, opacity ${FLIGHT_MS}ms ${FLIGHT_EASE} ${flight.delayMs}ms`,
        willChange: "transform",
      }}
      onTransitionEnd={finish}
    >
      {flight.card ? (
        <NunoCardFace card={flight.card} size="lg" className="shadow-2xl" />
      ) : (
        <NunoCardBack size="lg" className="shadow-2xl" />
      )}
    </div>
  );
}

/** Overlay of every card currently in the air. */
export function FlightLayer({
  flights,
  onDone,
}: {
  flights: Flight[];
  onDone: (key: string) => void;
}) {
  if (flights.length === 0) return null;
  return (
    <>
      {flights.map((flight) => (
        <FlyingCard key={flight.key} flight={flight} onDone={onDone} />
      ))}
    </>
  );
}
