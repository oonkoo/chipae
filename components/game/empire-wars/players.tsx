"use client";

import { RiVipCrownFill } from "@remixicon/react";
import { cn } from "@/lib/utils";
import type { SeatView } from "@/lib/game/empire-wars/view";
import { CoinIcon } from "./icons";
import { PieceChip } from "./pieces";

// The players around the table: who they are, their coins, and — in
// brackets, the way the reference screen does it — their net worth, the
// number the race is run on. A thin bar shows how close each is to the
// target, so the whole table can see who is 300 coins from winning
// (GDD > Player Fantasy).

function fmt(amount: number): string {
  return amount.toLocaleString("en-US");
}

export type PanelSeat = SeatView & {
  name: string;
  seatNumber: number;
  color: string;
  isYou: boolean;
  isHost: boolean;
  isBot: boolean;
  onClock: boolean;
};

/** Three slots, left to right. `null` is an empty place at the table. */
export type SeatSlots = [PanelSeat | null, PanelSeat | null, PanelSeat | null];

/**
 * Where each player sits around the table.
 *
 * You are always bottom-left. Everyone else follows in turn order, clockwise
 * around the table from you: top-left, top-centre, top-right, bottom-right,
 * bottom-centre — so the next player to move is always the one up and to
 * your left. Two players sit diagonally opposite, like the reference screen.
 * A spectator sees the first seat where "you" would be.
 */
const RIVAL_SLOTS: Record<number, Array<"tl" | "tc" | "tr" | "bc" | "br">> = {
  0: [],
  1: ["tr"],
  2: ["tl", "tr"],
  3: ["tl", "tr", "br"],
  4: ["tl", "tc", "tr", "br"],
  5: ["tl", "tc", "tr", "br", "bc"],
};

export function arrangeSeats(seats: PanelSeat[]): { top: SeatSlots; bottom: SeatSlots } {
  const start = Math.max(0, seats.findIndex((s) => s.isYou));
  const [you, ...rivals] = [...seats.slice(start), ...seats.slice(0, start)];
  const slots: Record<string, PanelSeat | null> = {
    tl: null,
    tc: null,
    tr: null,
    bl: you ?? null,
    bc: null,
    br: null,
  };
  const order = RIVAL_SLOTS[rivals.length] ?? RIVAL_SLOTS[5];
  rivals.forEach((seat, i) => {
    if (order[i]) slots[order[i]] = seat;
  });
  return {
    top: [slots.tl, slots.tc, slots.tr],
    bottom: [slots.bl, slots.bc, slots.br],
  };
}

/** One edge of the table: three places, some of them empty. */
export function SeatRow({
  slots,
  target,
  className,
}: {
  slots: SeatSlots;
  /** The net worth that wins; null = no target, so no progress bar. */
  target: number | null;
  className?: string;
}) {
  if (slots.every((seat) => seat === null)) return null;
  // Without a centre seat, two columns: each panel gets half the edge rather
  // than a third, so names don't truncate at small tables.
  const [left, centre, right] = slots;
  const places = centre ? slots : [left, right];
  return (
    <div
      className={cn(
        "grid w-full gap-1.5 @md:gap-2",
        centre ? "grid-cols-3" : "grid-cols-2",
        className
      )}
    >
      {places.map((seat, i) =>
        seat ? (
          <PlayerPanel key={seat.memberId} seat={seat} target={target} />
        ) : (
          <span key={`empty-${i}`} aria-hidden />
        )
      )}
    </div>
  );
}

function PlayerPanel({ seat, target }: { seat: PanelSeat; target: number | null }) {
  const out = seat.status !== "in";
  const progress = target === null ? null : Math.min(1, seat.netWorth / target);

  const note = out
    ? seat.status === "bankrupt"
      ? "Bankrupt"
      : "Walked away"
    : seat.inJail
      ? "In the Dungeon"
      : seat.onClock
        ? seat.isBot
          ? "Thinking…"
          : seat.isYou
            ? "Your turn"
            : "Their turn"
        : null;

  return (
    <div
      data-ew-anchor={`seat:${seat.memberId}`}
      aria-label={`${seat.name}${seat.isYou ? " (you)" : ""}: ${fmt(seat.cash)} coins, ${fmt(seat.netWorth)} net worth${note ? `, ${note}` : ""}`}
      className={cn(
        "ew-panel relative flex min-w-0 flex-col gap-1 rounded-xl px-2 py-1.5 transition-shadow",
        out && "opacity-45 grayscale"
      )}
      style={
        {
          // Whoever is on the clock glows brass.
          "--ew-glow": seat.onClock
            ? "0 0 0 1.5px var(--ew-brass-hi), 0 0 18px -2px color-mix(in oklab, var(--ew-brass) 70%, transparent)"
            : undefined,
        } as React.CSSProperties
      }
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <PieceChip seatNumber={seat.seatNumber} color={seat.color} className="size-7" />
        <span className="flex min-w-0 items-center gap-1 text-[11px] font-medium text-foreground @md:text-xs">
          {seat.isHost && <RiVipCrownFill aria-hidden className="size-3 shrink-0 text-primary" />}
          <span className="truncate">{seat.name}</span>
          {seat.isYou && (
            <span className="ew-chip shrink-0 rounded-full px-1 text-[9px] text-muted-foreground">
              you
            </span>
          )}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-1 font-mono tabular-nums">
        <CoinIcon aria-hidden className="size-3 shrink-0 text-[var(--ew-gold)]" />
        <span className="text-xs text-foreground @md:text-sm">{fmt(seat.cash)}</span>
        <span className="text-[10px] text-[var(--ew-gain)] @md:text-[11px]">
          ({fmt(seat.netWorth)})
        </span>
      </div>

      {/* How close to the target — the race, at a glance. No target, no bar. */}
      {progress !== null && (
        <span
          aria-hidden
          className="block h-[3px] w-full overflow-hidden rounded-full bg-[var(--ew-shade)]"
        >
          <span
            className="block h-full rounded-full transition-[width] duration-500"
            style={{ width: `${progress * 100}%`, background: seat.color }}
          />
        </span>
      )}

      {note && (
        <span
          className={cn(
            "text-[9px] leading-none @md:text-[10px]",
            seat.onClock ? "text-[var(--ew-gold)]" : "text-muted-foreground"
          )}
        >
          {note}
        </span>
      )}
    </div>
  );
}
