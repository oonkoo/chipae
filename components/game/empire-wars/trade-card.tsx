"use client";

import { RiExchangeFill } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import type { EmpireView, TradeSideView } from "@/lib/game/empire-wars/view";
import { TurnClock } from "./prompt";

// An open trade offer (GDD > The Market). Everyone can see it — trades are
// public — but only the recipient answers, against a 20-second clock; no
// answer means Decline. The table waits meanwhile.

function side(s: TradeSideView): string {
  const parts = [...s.names];
  if (s.coins > 0) parts.push(`${s.coins.toLocaleString("en-US")} coins`);
  return parts.length ? parts.join(" + ") : "nothing";
}

export function TradeCard({
  view,
  who,
  whom,
  onAnswer,
  busy,
  error,
}: {
  view: EmpireView;
  who: (memberId: string) => string;
  whom: (memberId: string) => string;
  onAnswer: (accept: boolean) => void;
  busy: boolean;
  error: string | null;
}) {
  const t = view.trade;
  if (!t) return null;
  const youId = view.you?.memberId ?? null;
  const toYou = t.toId === youId;
  const fromYou = t.fromId === youId;

  return (
    <div className="ew-panel flex w-full max-w-80 flex-col items-center gap-1.5 rounded-xl px-3 py-2 text-center @md:gap-2 @md:py-3">
      <p className="flex items-center gap-1.5 font-heading text-sm leading-tight text-[var(--ew-gold)] @md:text-lg">
        <RiExchangeFill aria-hidden className="size-4" />
        {toYou
          ? `${who(t.fromId)} offers you a trade`
          : fromYou
            ? `You offer ${whom(t.toId)} a trade`
            : `${who(t.fromId)} offers ${whom(t.toId)} a trade`}
      </p>
      <p className="text-[11px] leading-snug text-foreground @md:text-xs">
        <span className="text-muted-foreground">{fromYou ? "You give" : `${who(t.fromId)} gives`}</span>{" "}
        <span className="font-medium">{side(t.give)}</span>
        <br />
        <span className="text-muted-foreground">for {toYou ? "your" : `${whom(t.toId)}'s`}</span>{" "}
        <span className="font-medium">{side(t.get)}</span>
      </p>

      {toYou ? (
        <div className="flex items-center gap-2">
          <Button variant="game" size="sm" disabled={busy} onClick={() => onAnswer(true)}>
            Accept
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => onAnswer(false)}>
            Decline
          </Button>
          <TurnClock expiresAt={t.expiresAt} always />
        </div>
      ) : (
        <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground @md:text-xs">
          Waiting for {whom(t.toId)} to answer… <TurnClock expiresAt={t.expiresAt} always />
        </p>
      )}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
