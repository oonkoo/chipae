"use client";

import { RiAuctionFill } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import type { EmpireView } from "@/lib/game/empire-wars/view";
import { CoinIcon } from "./icons";
import { TurnClock } from "./prompt";
import { CityArt, EmpireCrest } from "./art";

// The auction, for everyone at once (GDD > Auctions). It sits where the prompt
// usually is: the city, the high bid, the countdown, and — for anyone who can
// bid — three quick raises. CPUs answer a bid instantly, so a human always
// sees the reply before deciding whether to go again.

function fmt(amount: number): string {
  return amount.toLocaleString("en-US");
}

export function AuctionPanel({
  view,
  who,
  onBid,
  busy,
  error,
}: {
  view: EmpireView;
  who: (memberId: string) => string;
  onBid: (amount: number) => void;
  busy: boolean;
  error: string | null;
}) {
  const a = view.auction;
  if (!a) return null;
  const city = view.cities.find((c) => c.tile === a.tile);
  const empire = city?.empire ?? "ottoman";
  const me = view.you ? view.seats.find((s) => s.memberId === view.you!.memberId) : null;
  const leading = me !== null && me !== undefined && a.highBidderId === me.memberId;
  const canBid =
    !!me && me.status === "in" && a.sellerId !== me.memberId && !leading && me.cash >= a.nextBid;

  // The first bid starts at the opening bid; after that, +10 / +50 / +100.
  const amounts = [
    ...new Set(
      a.raises
        .map((r) => (a.highBid === 0 ? a.nextBid + r - a.raises[0] : a.highBid + r))
        .filter((amount) => me && amount <= me.cash)
    ),
  ];

  return (
    <div className="ew-panel flex w-full max-w-80 flex-col items-center gap-1.5 rounded-xl px-3 py-2 @md:gap-2 @md:py-3">
      <p className="flex items-center gap-1.5 font-heading text-sm leading-tight text-[var(--ew-gold)] @md:text-lg">
        <RiAuctionFill aria-hidden className="size-4" />
        Auction · {a.name}
        {city && <CityArt id={city.id} empire={empire} className="size-7 @md:size-9" />}
      </p>
      <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground @md:text-xs">
        <EmpireCrest empire={empire} className="size-4" />
        {a.empireName} · worth {fmt(a.price)} ·{" "}
        {a.sellerId ? `${who(a.sellerId)} ${a.sellerId === view.you?.memberId ? "are" : "is"} selling` : "the bank is selling"}
      </p>

      <p className="flex items-center gap-1.5 text-xs text-foreground @md:text-sm" aria-live="polite">
        <CoinIcon aria-hidden className="size-3.5 text-[var(--ew-gold)]" />
        {a.highBidderId ? (
          <>
            <span className="font-mono font-semibold tabular-nums">{fmt(a.highBid)}</span>
            <span className="text-muted-foreground">— {leading ? "you lead" : who(a.highBidderId)}</span>
          </>
        ) : (
          <span className="text-muted-foreground">
            No bids yet · opens at <span className="font-mono tabular-nums">{fmt(a.nextBid)}</span>
          </span>
        )}
        <TurnClock expiresAt={a.endsAt} always />
      </p>

      {canBid && amounts.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {amounts.map((amount, i) => (
            <Button
              key={amount}
              variant={i === 0 ? "game" : "outline"}
              size="sm"
              disabled={busy}
              onClick={() => onBid(amount)}
            >
              Bid {fmt(amount)}
            </Button>
          ))}
        </div>
      )}
      {!canBid && me && me.status === "in" && !leading && a.sellerId !== me.memberId && (
        <p className="text-[10px] text-muted-foreground">You can&apos;t cover the next bid.</p>
      )}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
