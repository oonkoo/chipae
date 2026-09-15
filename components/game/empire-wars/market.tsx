"use client";

import { useEffect, useRef, useState } from "react";
import { RiAuctionFill, RiCloseLine, RiExchangeFill } from "@remixicon/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EmpireMove } from "@/lib/game/empire-wars/turn";
import type { CityView, EmpireView } from "@/lib/game/empire-wars/view";
import { EmpireCrest, FrameCorners } from "./art";
import { TurnClock } from "./prompt";

// The Market (GDD > The Market) — opened from your manage step.
//
// Trade: pick a rival, tick cities on both sides, set coins either way, send.
// Only cities from empires with no buildings can change hands, so only those
// are offered. Auction: put one of your own bare cities up for everyone; it
// opens at half its price, what the bank would pay.

function fmt(amount: number): string {
  return amount.toLocaleString("en-US");
}

function CityChip({
  city,
  selected,
  onToggle,
}: {
  city: CityView;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-2 py-1 text-left text-xs transition-colors",
        selected
          ? "border-[var(--ew-gold)] bg-[var(--ew-gold)]/15 text-foreground"
          : "border-border bg-background/40 text-muted-foreground hover:text-foreground"
      )}
    >
      <EmpireCrest empire={city.empire} className="size-4" />
      <span className="truncate">{city.name}</span>
      <span className="ml-auto font-mono tabular-nums">{fmt(city.price)}</span>
    </button>
  );
}

export function Market({
  view,
  nameOf,
  onMove,
  onClose,
  busy,
  error,
}: {
  view: EmpireView;
  nameOf: (memberId: string) => string;
  onMove: (move: EmpireMove) => void;
  onClose: () => void;
  busy: boolean;
  error: string | null;
}) {
  const youId = view.you?.memberId ?? "";
  const me = view.seats.find((s) => s.memberId === youId);
  const rivals = view.seats.filter((s) => s.memberId !== youId && s.status === "in");
  const [tab, setTab] = useState<"trade" | "auction">("trade");
  const [rivalId, setRivalId] = useState<string | null>(rivals[0]?.memberId ?? null);
  const [give, setGive] = useState<number[]>([]);
  const [get, setGet] = useState<number[]>([]);
  const [giveCoins, setGiveCoins] = useState(0);
  const [getCoins, setGetCoins] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);

  // It takes focus when it opens, gives it back when it closes; Escape closes.
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

  const rival = rivals.find((r) => r.memberId === rivalId) ?? null;
  const tradable = (ownerId: string) => view.cities.filter((c) => c.ownerId === ownerId && c.bare);
  const mine = tradable(youId);
  const theirs = rival ? tradable(rival.memberId) : [];
  const toggle = (list: number[], set: (next: number[]) => void, tile: number) =>
    set(list.includes(tile) ? list.filter((t) => t !== tile) : [...list, tile]);
  const clamp = (value: number, max: number) =>
    Math.max(0, Math.min(max, Math.floor(Number.isFinite(value) ? value : 0)));

  const empty = give.length + get.length === 0 && giveCoins + getCoins === 0;
  const canSend = !!rival && !empty && view.tradesLeft > 0 && !busy;

  function send() {
    if (!rival) return;
    onMove({
      kind: "offerTrade",
      to: rival.memberId,
      give: { tiles: give, coins: clamp(giveCoins, me?.cash ?? 0) },
      get: { tiles: get, coins: clamp(getCoins, rival.cash) },
    });
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ew-market"
      className="ew-backdrop absolute inset-0 z-50 flex items-center justify-center rounded-3xl p-3 backdrop-blur-sm"
    >
      <div className="ew-dialog relative isolate flex max-h-full w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-2xl p-4">
        <FrameCorners className="size-7 @md:size-9" />
        <div className="flex items-center justify-between gap-3">
          <h2 id="ew-market" className="flex items-center gap-2 font-heading text-xl text-[var(--ew-gold)]">
            The Market
            {/* The prompt's clock is hidden behind this dialog, so it's here too. */}
            <TurnClock expiresAt={view.turnExpiresAt} />
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close the Market"
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <RiCloseLine className="size-5" />
          </button>
        </div>

        <div className="ew-chip flex gap-1 rounded-xl p-1" role="tablist">
          {(["trade", "auction"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
                tab === t ? "bg-[var(--ew-wood-hi)] text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "trade" ? <RiExchangeFill className="size-4" /> : <RiAuctionFill className="size-4" />}
              {t === "trade" ? "Trade" : "Auction a city"}
            </button>
          ))}
        </div>

        {tab === "trade" ? (
          rivals.length === 0 ? (
            <p className="text-sm text-muted-foreground">There&apos;s nobody left to trade with.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {rivals.map((r) => (
                  <Button
                    key={r.memberId}
                    size="sm"
                    variant={r.memberId === rivalId ? "secondary" : "ghost"}
                    onClick={() => {
                      setRivalId(r.memberId);
                      setGet([]);
                      setGetCoins(0);
                    }}
                  >
                    {nameOf(r.memberId)}
                  </Button>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <fieldset className="flex flex-col gap-1.5">
                  <legend className="mb-1 text-xs font-medium text-foreground">You give</legend>
                  {mine.length === 0 && <p className="text-[11px] text-muted-foreground">No cities you can trade.</p>}
                  {mine.map((c) => (
                    <CityChip key={c.id} city={c} selected={give.includes(c.tile)} onToggle={() => toggle(give, setGive, c.tile)} />
                  ))}
                  <label className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    Coins
                    <Input
                      type="number"
                      min={0}
                      step={10}
                      max={me?.cash ?? 0}
                      value={giveCoins}
                      onChange={(e) => setGiveCoins(clamp(Number(e.target.value), me?.cash ?? 0))}
                      className="h-8"
                    />
                  </label>
                </fieldset>

                <fieldset className="flex flex-col gap-1.5">
                  <legend className="mb-1 text-xs font-medium text-foreground">
                    You ask {rival ? nameOf(rival.memberId) : ""} for
                  </legend>
                  {theirs.length === 0 && <p className="text-[11px] text-muted-foreground">No cities they can trade.</p>}
                  {theirs.map((c) => (
                    <CityChip key={c.id} city={c} selected={get.includes(c.tile)} onToggle={() => toggle(get, setGet, c.tile)} />
                  ))}
                  <label className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    Coins
                    <Input
                      type="number"
                      min={0}
                      step={10}
                      max={rival?.cash ?? 0}
                      value={getCoins}
                      onChange={(e) => setGetCoins(clamp(Number(e.target.value), rival?.cash ?? 0))}
                      className="h-8"
                    />
                  </label>
                </fieldset>
              </div>

              <p className="text-[11px] text-muted-foreground">
                Only cities from empires with no buildings can be traded. They have 20 seconds to
                answer. {view.tradesLeft} offer{view.tradesLeft === 1 ? "" : "s"} left this turn.
              </p>
              <Button variant="game" disabled={!canSend} onClick={send}>
                Send offer
              </Button>
            </>
          )
        ) : (
          <div className="flex flex-col gap-1.5">
            {mine.length === 0 && (
              <p className="text-sm text-muted-foreground">You have no bare cities to auction.</p>
            )}
            {mine.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 text-sm">
                <EmpireCrest empire={c.empire} className="size-5" />
                <span className="flex-1 text-foreground">{c.name}</span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    onMove({ kind: "auctionCity", tile: c.tile });
                    onClose();
                  }}
                >
                  Auction — opens at {fmt(c.citySalePrice)}
                </Button>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">
              Everyone else can bid. It opens at half the city&apos;s price — what the bank would pay you.
            </p>
          </div>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
