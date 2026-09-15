"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { pieceForSeat } from "./icons";

// The pieces on the board, and how they walk it.
//
// A piece animates by *stepping* — one tile at a time, with a small hop — so
// movement reads as walking the block rather than teleporting. The server has
// already decided the destination; this only shows the journey.

export const STEP_MS = 120;
/** The dice land first; the piece leaves once they settle. */
const WALK_DELAY_MS = 260;

/** How long a walk of this many tiles takes, start to finish. */
export function walkDurationMs(steps: number): number {
  return WALK_DELAY_MS + steps * STEP_MS;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export type PieceSeat = {
  memberId: string;
  seat: number;
  tile: number;
  color: string;
  label: string;
  eliminated: boolean;
  inJail: boolean;
};

/**
 * Where every piece should be drawn right now.
 *
 * Returns the *animated* tile per member, which lags the server's tile while a
 * walk is in progress. Everything else on the board reads from the server
 * directly; only the piece's position is interpolated.
 */
export function useWalkingPieces(
  seats: PieceSeat[],
  lastRoll: { memberId: string; from: number; to: number; seq: number } | null,
  boardSize: number
): Record<string, number> {
  /**
   * Only the walking piece is ever overridden, and only from a timer. Every
   * other piece is *derived* from the server position below, so there is no
   * copy of the board's truth to fall out of sync — and no effect that writes
   * state just to mirror props.
   */
  const [walk, setWalk] = useState<{ memberId: string; tile: number } | null>(
    null
  );
  const lastSeq = useRef<number | null>(null);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  // Keyed on the roll's values, not the `lastRoll` object: every server
  // refresh sends a fresh object for the same roll, and an effect keyed on
  // identity would re-run and cancel a walk halfway, stranding the piece.
  const seq = lastRoll?.seq ?? null;
  const walker = lastRoll?.memberId ?? null;
  const from = lastRoll?.from ?? null;
  const to = lastRoll?.to ?? null;

  // A walk in progress is only ever cancelled by unmounting or a newer roll.
  useEffect(() => {
    const pending = timers;
    return () => pending.current.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (seq === null || walker === null || from === null || to === null) return;
    if (lastSeq.current === seq) return;

    // The first roll we observe may have happened before we were watching —
    // joining a game in progress shouldn't replay someone else's move.
    const isFirst = lastSeq.current === null;
    lastSeq.current = seq;
    if (isFirst || prefersReducedMotion()) return;

    const steps: number[] = [];
    let cursor = from;
    // Bounded: corrupt from/to must not spin forever.
    for (let i = 0; i < boardSize && cursor !== to; i++) {
      cursor = (cursor + 1) % boardSize;
      steps.push(cursor);
    }
    if (steps.length === 0) return;

    timers.current.forEach(clearTimeout);
    timers.current = [
      // Snap back to the origin, then walk. Deferred by a tick so the state
      // write happens from a timer rather than from the effect body.
      setTimeout(() => setWalk({ memberId: walker, tile: from }), 0),
      ...steps.map((tile, i) =>
        setTimeout(
          () => setWalk({ memberId: walker, tile }),
          // The dice land first; the piece leaves once they settle.
          WALK_DELAY_MS + i * STEP_MS
        )
      ),
      // Hand control back to the server position at the end of the walk.
      setTimeout(() => setWalk(null), walkDurationMs(steps.length) + 40),
    ];
  }, [seq, walker, from, to, boardSize]);

  const positions: Record<string, number> = {};
  for (const seat of seats) {
    positions[seat.memberId] =
      walk && walk.memberId === seat.memberId ? walk.tile : seat.tile;
  }
  return positions;
}

/**
 * A seat's piece standing on its chip. The painted piece is full colour, so
 * the player's colour lives in the chip: a tinted disc with a ring of the
 * seat colour — the same chip motif the platform uses for seats.
 */
export function PieceChip({
  seatNumber,
  color,
  className,
  style,
  title,
}: {
  seatNumber: number;
  color: string;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}) {
  const piece = pieceForSeat(seatNumber);
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center rounded-full border-[1.5px] shadow-md", className)}
      style={{ background: `color-mix(in srgb, ${color} 55%, var(--ew-ink))`, borderColor: color, ...style }}
      title={title}
    >
      <Image
        src={piece.src}
        alt=""
        width={64}
        height={64}
        draggable={false}
        loading="eager"
        className="pointer-events-none size-[86%] object-contain drop-shadow-[0_1px_1px_var(--ew-shadow)]"
      />
    </span>
  );
}

/** One piece, sitting on a tile. */
export function GamePiece({
  seat,
  isYou,
  moving,
  className,
}: {
  seat: PieceSeat;
  isYou: boolean;
  moving: boolean;
  className?: string;
}) {
  const { name } = pieceForSeat(seat.seat);
  return (
    <PieceChip
      seatNumber={seat.seat}
      color={seat.color}
      className={cn(
        "transition-transform",
        seat.eliminated && "opacity-35 grayscale",
        moving && "motion-safe:[animation:ew-hop_var(--ew-step)_ease-in-out]",
        isYou && "ring-1 ring-[var(--ew-gold)]",
        className
      )}
      style={{ "--ew-step": `${STEP_MS}ms` } as React.CSSProperties}
      title={`${seat.label} — ${name}${seat.inJail ? " (inside)" : ""}`}
    />
  );
}
