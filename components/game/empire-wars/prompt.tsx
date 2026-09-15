"use client";

import { useEffect, useState } from "react";
import { RiExchangeFill } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import type { EmpireMove } from "@/lib/game/empire-wars/turn";
import type { EmpireView } from "@/lib/game/empire-wars/view";

// The one thing to do right now (GDD > A turn): roll; answer the landing
// question; or, in your manage step, End turn — with the Market beside it and
// building one tap away on your cities. Auctions and trades have panels of
// their own. One primary button, ever.

function fmt(amount: number): string {
  return amount.toLocaleString("en-US");
}

export function Prompt({
  view,
  who,
  onMove,
  onOpenMarket,
  busy,
  error,
}: {
  view: EmpireView;
  /** "You" for the viewer, otherwise the player's name. */
  who: (memberId: string) => string;
  onMove: (move: EmpireMove) => void;
  onOpenMarket: () => void;
  busy: boolean;
  error: string | null;
}) {
  const yours = view.you?.yourTurn ?? false;
  const turn = view.currentMemberId;

  if (view.winnerId) {
    return (
      <p className="ew-panel rounded-xl px-4 py-1.5 font-heading text-lg leading-tight text-[var(--ew-gold)] @md:px-6 @md:py-2 @md:text-2xl">
        {view.winnerId === view.you?.memberId ? "You rule the world" : `${who(view.winnerId)} rules the world`}
      </p>
    );
  }

  if (!yours) {
    if (!turn) return null;
    const q = view.question;
    return (
      <p className="ew-chip rounded-full px-3 py-1 text-xs text-foreground/90 @md:text-sm">
        {view.phase === "answer" && q
          ? `${who(turn)} is deciding on ${q.name}…`
          : view.phase === "manage"
            ? `${who(turn)} is managing their empire…`
            : `${who(turn)}'s turn…`}
      </p>
    );
  }

  if (view.phase === "roll") {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <Button variant="game" size="lg" disabled={busy} onClick={() => onMove({ kind: "roll" })} className="@md:h-12 @md:px-6">
          Roll the dice
        </Button>
        <TurnClock expiresAt={view.turnExpiresAt} />
        {error && <p className="ew-chip rounded-lg px-2 py-0.5 text-[11px] text-destructive">{error}</p>}
      </div>
    );
  }

  if (view.phase === "answer" && view.question) {
    const q = view.question;
    return (
      <div className="ew-panel flex w-full max-w-72 flex-col items-center gap-1.5 rounded-xl px-2.5 py-2 @md:gap-2 @md:px-4 @md:py-3">
        <p className="font-heading text-sm leading-tight text-[var(--ew-gold)] @md:text-lg">Buy {q.name}?</p>
        <p className="text-[10px] leading-snug text-foreground/80 @md:text-xs">
          {q.completesEmpire
            ? `It completes ${q.empireName} — tribute doubles to ${fmt(q.tributeAfter)}, and you can build.`
            : `Rivals who land here pay you ${fmt(q.tributeAfter)} coins. Pass, and it goes to auction.`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="game"
            size="sm"
            disabled={busy}
            onClick={() => onMove({ kind: "buy", tile: q.tile })}
            className="@md:h-10 @md:px-4"
          >
            Buy — {fmt(q.cost)}
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => onMove({ kind: "decline", tile: q.tile })}>
            Pass
          </Button>
        </div>
        <TurnClock expiresAt={view.turnExpiresAt} />
        {error && <p className="text-[11px] text-destructive">{error}</p>}
      </div>
    );
  }

  if (view.phase === "manage") {
    const canBuild = view.cities.some((c) => c.ownerId === view.you?.memberId && c.canBuild);
    return (
      <div className="ew-panel flex w-full max-w-80 flex-col items-center gap-1.5 rounded-xl px-2.5 py-2 @md:gap-2 @md:px-4 @md:py-3">
        <p className="text-[10px] leading-snug text-foreground/80 @md:text-xs">
          {canBuild
            ? "Tap one of your glowing cities to build — or trade in the Market."
            : "Build on a whole empire, or trade in the Market for the city you're missing."}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="game" size="sm" disabled={busy} onClick={() => onMove({ kind: "endTurn" })} className="@md:h-10 @md:px-5">
            End turn
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={onOpenMarket}>
            <RiExchangeFill data-icon="inline-start" />
            Market
          </Button>
        </div>
        <TurnClock expiresAt={view.turnExpiresAt} />
        {error && <p className="text-[11px] text-destructive">{error}</p>}
      </div>
    );
  }

  return null;
}

/**
 * A countdown from an absolute deadline — shown only in the last ten seconds
 * unless `always`. Recomputed from the deadline, so remounting can't restart
 * it; starts null so server and client render the same thing.
 */
export function TurnClock({ expiresAt, always = false }: { expiresAt: number | null; always?: boolean }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (expiresAt === null) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 250);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [expiresAt]);

  if (expiresAt === null || now === null) return null;
  const remaining = Math.max(0, expiresAt - now);
  if (!always && remaining > 10_000) return null;
  return (
    <span
      className="ew-chip rounded-full px-1.5 font-mono text-[11px] text-[var(--ew-loss)] tabular-nums"
      title="When this runs out, the table plays on"
    >
      {Math.ceil(remaining / 1000)}s
    </span>
  );
}
