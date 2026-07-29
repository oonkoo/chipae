"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { RiRobot2Line, RiVipCrownFill } from "@remixicon/react";
import {
  advanceBot,
  callNuno,
  drawCard,
  passTurn,
  playCard,
} from "@/lib/actions/games";
import { NUNO_CONFIG } from "@/lib/game/data/nuno";
import type { NunoCard, NunoColor, NunoView } from "@/lib/game/nuno/rules";
import { AvatarChip } from "@/components/avatar-chip";
import {
  NUNO_COLOR_HEX,
  NunoCardBack,
  NunoCardFace,
  NunoCardFan,
} from "@/components/game/nuno-card";
import {
  FlightLayer,
  centerOf,
  prefersReducedMotion,
  type Flight,
} from "@/components/game/card-flight";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type BoardMember = {
  id: string;
  userId: string | null;
  isBot: boolean;
  botName: string | null;
  username: string | null;
  displayName: string | null;
  avatarId: string | null;
};

type Seat = NunoView["players"][number];

/** Where opponents sit, by how many there are — you always hold the south seat. */
type Slot = "left" | "top-left" | "top" | "top-right" | "right";

// The south edge is always yours, so opponents fill the north half first.
const SLOTS_BY_COUNT: Record<number, Slot[]> = {
  0: [],
  1: ["top"],
  2: ["top-left", "top-right"],
  3: ["left", "top", "right"],
  4: ["left", "top-left", "top-right", "right"],
  5: ["left", "top-left", "top", "top-right", "right"],
};

const SLOT_POSITION: Record<Slot, string> = {
  left: "top-[38%] left-2 -translate-y-1/2 sm:left-4",
  "top-left": "top-3 left-[6%] sm:left-[14%]",
  top: "top-3 left-1/2 -translate-x-1/2",
  "top-right": "top-3 right-[6%] sm:right-[14%]",
  right: "top-[38%] right-2 -translate-y-1/2 sm:right-4",
};

/** Side seats stack their fan vertically; north seats fan across. */
const SLOT_IS_SIDE: Record<Slot, boolean> = {
  left: true,
  "top-left": false,
  top: false,
  "top-right": false,
  right: true,
};

function OpponentSeat({
  seat,
  slot,
  label,
  member,
  isHost,
  isCurrent,
  seatRef,
}: {
  seat: Seat;
  slot: Slot;
  label: string;
  member: BoardMember | undefined;
  isHost: boolean;
  isCurrent: boolean;
  /** Registers the seat's node so cards can fly to and from it. */
  seatRef?: (el: HTMLDivElement | null) => void;
}) {
  const side = SLOT_IS_SIDE[slot];
  return (
    <div
      ref={seatRef}
      className={cn(
        "absolute flex items-center gap-2",
        SLOT_POSITION[slot],
        side ? "flex-col" : "flex-col",
        seat.eliminated && "opacity-40 grayscale"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 rounded-full border px-2 py-1 backdrop-blur-sm transition-colors",
          isCurrent
            ? "border-primary bg-primary/20 shadow-[0_0_18px_-4px_var(--color-primary)]"
            : "border-white/10 bg-background/60"
        )}
      >
        {member && !member.isBot && member.avatarId ? (
          <AvatarChip avatarId={member.avatarId} className="size-7" />
        ) : (
          <span className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <RiRobot2Line className="size-4" />
          </span>
        )}
        <span className="flex flex-col leading-tight">
          <span className="flex items-center gap-1 text-xs font-medium text-foreground">
            {isHost && <RiVipCrownFill className="size-3 text-primary" />}
            <span className="max-w-24 truncate">{label}</span>
          </span>
          <span className="text-[10px] text-muted-foreground">
            {seat.eliminated
              ? "out"
              : `${seat.cardCount} ${seat.cardCount === 1 ? "card" : "cards"}`}
          </span>
        </span>
        {seat.hasUno && !seat.eliminated && (
          <span className="rounded-full bg-primary px-1.5 py-0.5 font-heading text-[9px] text-primary-foreground">
            NUNO!
          </span>
        )}
      </div>

      {!seat.eliminated && seat.cardCount > 0 && (
        <NunoCardFan count={seat.cardCount} size="xs" vertical={side} />
      )}
    </div>
  );
}

/**
 * The Nuno table: opponents ringed around the felt, piles at the centre,
 * your hand face-up along the south edge. Presentation only — rules live
 * in lib/game/nuno/rules.ts and the server actions decide every move.
 */
export function NunoBoard({
  lobbyId,
  view,
  members,
  hostId,
}: {
  lobbyId: string;
  view: NunoView;
  members: BoardMember[];
  hostId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [wildCardId, setWildCardId] = useState<string | null>(null);
  const botTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Card flight plumbing ────────────────────────────────────────────────
  const deckRef = useRef<HTMLButtonElement>(null);
  const discardRef = useRef<HTMLDivElement>(null);
  const seatRefs = useRef<Map<string, HTMLElement>>(new Map());
  const handCardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [flights, setFlights] = useState<Flight[]>([]);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [playingCardId, setPlayingCardId] = useState<string | null>(null);
  // Deck size at the moment we asked to draw. While it's unchanged the
  // server hasn't answered yet, so the hand holds the slot with a card
  // back instead of leaving a gap that pops later.
  const [drawPendingDeck, setDrawPendingDeck] = useState<number | null>(null);
  const flightSeq = useRef(0);
  // What we already animated optimistically, so the server-confirmed state
  // change doesn't replay the same card a second time.
  const animatedPlays = useRef<Set<string>>(new Set());
  const animatedDraw = useRef<{ memberId: string; count: number } | null>(null);
  const prevSnapshot = useRef<{
    topId: string;
    counts: Record<string, number>;
    actor: string;
  } | null>(null);

  const addFlights = useCallback((next: Flight[]) => {
    if (next.length === 0) return;
    setFlights((current) => [...current, ...next]);
  }, []);

  const clearFlight = useCallback((key: string) => {
    setFlights((current) => current.filter((f) => f.key !== key));
  }, []);

  const byId = new Map(members.map((m) => [m.id, m]));
  const me = view.yourMemberId ? byId.get(view.yourMemberId) : undefined;
  const yourTurn = view.currentMemberId === view.yourMemberId;
  const canAct = yourTurn && !pending && !view.winnerId;

  function run(action: () => Promise<{ ok: boolean }>) {
    setError(null);
    setWildCardId(null);
    startTransition(async () => {
      const result = (await action()) as
        | { ok: true }
        | { ok: false; error: string };
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  }

  // Bot driver: when a CPU (or a departed seat) is up, any client may ask
  // the server to advance it after a casual 1–3s pause. The server ignores
  // duplicate or stale calls, so racing clients are harmless.
  const currentIsBot = (() => {
    const member = byId.get(view.currentMemberId);
    return !member || member.isBot;
  })();
  useEffect(() => {
    if (!currentIsBot || view.winnerId) return;
    const delay =
      NUNO_CONFIG.botDelayMsMin +
      Math.random() * (NUNO_CONFIG.botDelayMsMax - NUNO_CONFIG.botDelayMsMin);
    botTimer.current = setTimeout(() => {
      void advanceBot(lobbyId).then((result) => {
        router.refresh();
        // A failed advance would otherwise freeze the table: this effect
        // only re-runs when the turn changes, and it just didn't. One
        // bounded retry covers a transient server hiccup.
        if (!result.ok) {
          botTimer.current = setTimeout(() => {
            void advanceBot(lobbyId).then(() => router.refresh());
          }, 1500);
        }
      });
    }, delay);
    return () => {
      if (botTimer.current) clearTimeout(botTimer.current);
    };
    // deckCount matters as much as turnCount: a bot that draws a *playable*
    // card keeps the turn, so turnCount doesn't move — without the deck in
    // the deps the driver would never fire again and the table would sit
    // frozen mid-turn.
  }, [
    currentIsBot,
    view.turnCount,
    view.deckCount,
    view.winnerId,
    lobbyId,
    router,
  ]);

  function memberLabel(memberId: string): string {
    const member = byId.get(memberId);
    if (!member) return "Empty seat";
    return member.isBot
      ? (member.botName ?? "CPU")
      : member.displayName || `@${member.username}`;
  }

  /**
   * Fly a card from wherever it is now to the discard pile, then ask the
   * server. Starting the motion before the round trip is what makes play
   * feel instant; the flight is registered so the confirmed state doesn't
   * animate the same card twice.
   */
  function playFromHand(
    card: NunoCard,
    chosenColor?: NunoColor,
    fromEl?: HTMLElement | null
  ) {
    if (!prefersReducedMotion()) {
      const from = centerOf(fromEl);
      const to = centerOf(discardRef.current);
      if (from && to) {
        animatedPlays.current.add(card.id);
        setPlayingCardId(card.id);
        addFlights([
          {
            key: `play-${card.id}-${flightSeq.current++}`,
            card,
            from,
            to,
            rotate: 6,
            delayMs: 0,
            // Park on the pile until the server confirms this as the top
            // card, so it never blinks back to the previous one.
            holdForTopId: card.id,
          },
        ]);
      }
    }
    run(() => playCard(lobbyId, card.id, chosenColor, undefined));
  }

  /** Same idea for drawing: the card leaves the deck immediately. */
  function drawToHand() {
    setDrawPendingDeck(view.deckCount);
    setPlayingCardId(null); // a draw ends any prior play's placeholder
    if (!prefersReducedMotion() && view.yourMemberId) {
      const from = centerOf(deckRef.current);
      const to = centerOf(seatRefs.current.get(view.yourMemberId));
      if (from && to) {
        animatedDraw.current = { memberId: view.yourMemberId, count: 1 };
        addFlights([
          {
            key: `draw-me-${flightSeq.current++}`,
            from,
            to,
            rotate: -5,
            delayMs: 0,
          },
        ]);
      }
    }
    run(() => drawCard(lobbyId));
  }

  // Watch the table for changes nobody on this client triggered — an
  // opponent's play, or cards dealt out by a +2/+4 — and stage the matching
  // flights so every seat sees the same motion.
  useEffect(() => {
    const counts = Object.fromEntries(
      view.players.map((p) => [p.memberId, p.cardCount])
    );
    const snapshot = {
      topId: view.topCard.id,
      counts,
      actor: view.currentMemberId,
    };
    const prev = prevSnapshot.current;
    prevSnapshot.current = snapshot;
    if (!prev || prefersReducedMotion()) return;

    const staged: Flight[] = [];
    const discardPoint = centerOf(discardRef.current);
    const deckPoint = centerOf(deckRef.current);

    // Someone played: fly the new top card from their seat to the pile.
    const played = prev.topId !== view.topCard.id;
    if (played && !animatedPlays.current.has(view.topCard.id)) {
      const from =
        centerOf(seatRefs.current.get(prev.actor)) ?? deckPoint ?? null;
      if (from && discardPoint) {
        staged.push({
          key: `play-${view.topCard.id}-${flightSeq.current++}`,
          card: view.topCard,
          from,
          to: discardPoint,
          rotate: 6,
          delayMs: 0,
        });
      }
    }
    animatedPlays.current.delete(view.topCard.id);

    // Anyone who gained cards: deal them out of the deck, lightly staggered.
    for (const player of view.players) {
      const before = prev.counts[player.memberId];
      if (before === undefined) continue;
      let gained = player.cardCount - before;
      if (animatedDraw.current?.memberId === player.memberId) {
        gained -= animatedDraw.current.count;
        animatedDraw.current = null;
      }
      if (gained <= 0) continue;
      const to = centerOf(seatRefs.current.get(player.memberId));
      if (!deckPoint || !to) continue;
      for (let i = 0; i < Math.min(gained, 4); i++) {
        staged.push({
          key: `draw-${player.memberId}-${view.turnCount}-${i}-${flightSeq.current++}`,
          from: deckPoint,
          to,
          rotate: -5,
          delayMs: 70 * i + (played ? 140 : 0),
        });
      }
    }
    animatedDraw.current = null;
    addFlights(staged);

    // Say what the action card did — penalties are otherwise invisible.
    if (played) {
      const card = view.topCard;
      const actor =
        prev.actor === view.yourMemberId ? "You" : memberLabel(prev.actor);
      const hit = view.players.find(
        (p) => (p.cardCount - (prev.counts[p.memberId] ?? 0)) >= 2
      );
      const victim = hit
        ? hit.memberId === view.yourMemberId
          ? "you"
          : memberLabel(hit.memberId)
        : "the next player";
      const line =
        card.type === "draw2"
          ? `${actor} played +2 — ${victim} draws 2`
          : card.type === "wild4"
            ? `${actor} played +4 — ${victim} draws 4`
            : card.type === "skip"
              ? `${actor} played Skip`
              : card.type === "reverse"
                ? `${actor} flipped the direction`
                : card.type === "wild"
                  ? `${actor} changed the color`
                  : null;
      if (line) setAnnouncement(line);
    }
    // memberLabel is derived from props and stable enough for this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.topCard.id, view.turnCount, addFlights]);

  // Announcements are transient.
  useEffect(() => {
    if (!announcement) return;
    const timer = setTimeout(() => setAnnouncement(null), 2600);
    return () => clearTimeout(timer);
  }, [announcement]);

  // A parked card retires the instant the server confirms it as the top
  // card — the real pile card is already underneath, so the swap is
  // invisible. Derived, so there's no state update racing the refresh.
  const visibleFlights = flights.filter(
    (f) => !f.holdForTopId || f.holdForTopId !== view.topCard.id
  );

  // Backstop only: sweep parked cards the server never confirmed (a
  // rejected play), so one can't hover over the table forever.
  useEffect(() => {
    const parked = flights.filter((f) => f.holdForTopId);
    if (parked.length === 0) return;
    const timer = setTimeout(() => {
      const keys = new Set(parked.map((f) => f.key));
      setFlights((current) => current.filter((f) => !keys.has(f.key)));
    }, 2000);
    return () => clearTimeout(timer);
  }, [flights]);

  // Opponents in turn order starting after you, seated around the felt.
  const meIndex = view.players.findIndex(
    (p) => p.memberId === view.yourMemberId
  );
  const opponents =
    meIndex >= 0
      ? [...view.players.slice(meIndex + 1), ...view.players.slice(0, meIndex)]
      : view.players;
  const slots = SLOTS_BY_COUNT[Math.min(opponents.length, 5)] ?? [];
  const activeHex = NUNO_COLOR_HEX[view.activeColor];

  // Nothing playable on your turn means the only move is to draw — say so
  // rather than leaving a hand of unresponsive cards.
  const mustDraw =
    yourTurn &&
    !view.winnerId &&
    !view.youDrew &&
    view.yourPlayableCardIds.length === 0;

  // Purely derived: the moment the deck count moves, the draw has landed
  // and the placeholder retires itself — no timers, no stale state.
  const showDrawPlaceholder =
    drawPendingDeck !== null && view.deckCount === drawPendingDeck;

  // The card is "in the air" only while its play is still in flight —
  // `pending` covers the action *and* the refresh it triggers, so the slot
  // stays collapsed right up to the moment the server drops the card from
  // the hand. A rejected play simply restores it. Derived, so a card that
  // returns to hand after a reshuffle can never be stuck invisible.
  const flyingCardId =
    pending && playingCardId && view.yourHand.some((c) => c.id === playingCardId)
      ? playingCardId
      : null;

  const status = view.winnerId
    ? `${memberLabel(view.winnerId)} wins the hand!`
    : yourTurn
      ? view.youDrew
        ? "You drew — play it or pass"
        : mustDraw
          ? "No plays — draw a card"
          : "Your turn"
      : `${memberLabel(view.currentMemberId)} is thinking…`;

  return (
    <div className="flex flex-col gap-3">
      {/* Felt */}
      <div
        className="relative min-h-[30rem] flex-1 overflow-hidden rounded-3xl border border-white/10 p-3"
        style={{
          background: `radial-gradient(120% 90% at 50% 45%, ${activeHex}22 0%, transparent 55%), radial-gradient(100% 80% at 50% 50%, oklch(0.27 0.055 290) 0%, oklch(0.2 0.045 290) 100%)`,
          transition: "background 400ms ease",
        }}
      >
        {/* Table watermark */}
        <Image
          src="/games/nuno/nuno_logo.png"
          alt=""
          width={320}
          height={318}
          className="pointer-events-none absolute top-[43%] left-1/2 w-64 -translate-x-1/2 -translate-y-1/2 opacity-[0.045]"
        />

        {/* Opponents */}
        {opponents.map((seat, i) => {
          const slot = slots[i];
          if (!slot) return null;
          const member = byId.get(seat.memberId);
          return (
            <OpponentSeat
              key={seat.memberId}
              seat={seat}
              slot={slot}
              label={memberLabel(seat.memberId)}
              member={member}
              isHost={member?.userId === hostId}
              isCurrent={view.currentMemberId === seat.memberId}
              seatRef={(el) => {
                if (el) seatRefs.current.set(seat.memberId, el);
                else seatRefs.current.delete(seat.memberId);
              }}
            />
          );
        })}

        {/* Centre: draw pile, discard, direction */}
        <div className="absolute top-[43%] left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-5">
          <button
            ref={deckRef}
            type="button"
            disabled={!canAct || view.youDrew}
            onClick={drawToHand}
            title={
              yourTurn ? "Draw a card" : `Waiting on ${memberLabel(view.currentMemberId)}`
            }
            className={cn(
              "group relative block transition-transform",
              canAct && !view.youDrew
                ? "cursor-pointer hover:-translate-y-1"
                : "opacity-70",
              mustDraw && "animate-pulse"
            )}
          >
            {/* A little stack under the top back */}
            <NunoCardBack
              size="lg"
              className="absolute top-1 left-1 rotate-3 opacity-70"
            />
            <NunoCardBack
              size="lg"
              className={cn(
                "relative",
                mustDraw && "ring-4 ring-primary/80 ring-offset-0"
              )}
            />
            <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 font-mono text-[10px] whitespace-nowrap text-muted-foreground">
              {view.deckCount} left
            </span>
          </button>

          <div className="relative" ref={discardRef}>
            <span
              className="absolute -inset-3 rounded-3xl blur-xl transition-colors duration-300"
              style={{ backgroundColor: `${activeHex}55` }}
            />
            <NunoCardFace
              key={view.topCard.id}
              card={view.topCard}
              size="lg"
              className="motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-150 relative rotate-[6deg]"
            />
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <span
              className="size-6 rounded-full border-2 border-white/70 shadow"
              style={{ backgroundColor: activeHex }}
              title={`Active color: ${view.activeColor}`}
            />
            <span
              className="font-heading text-2xl text-white/70"
              title={
                view.direction === 1 ? "Play goes left" : "Play goes right"
              }
            >
              {view.direction === 1 ? "↻" : "↺"}
            </span>
          </div>
        </div>

        {/* Status ribbon, between the piles and your hand */}
        <div className="absolute top-[62%] left-1/2 -translate-x-1/2">
          <span
            className={cn(
              "rounded-full border px-3 py-1 text-xs whitespace-nowrap backdrop-blur-sm transition-colors",
              yourTurn && !view.winnerId
                ? "border-primary/60 bg-primary/15 font-medium text-foreground"
                : "border-white/10 bg-background/60 text-muted-foreground"
            )}
          >
            {status}
          </span>
        </div>

        {/* What the last action card actually did */}
        {announcement && (
          <div className="pointer-events-none absolute top-[26%] left-1/2 -translate-x-1/2">
            <span className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-safe:duration-200 rounded-full border border-primary/50 bg-background/90 px-3 py-1 font-heading text-sm whitespace-nowrap text-foreground shadow-lg backdrop-blur-sm">
              {announcement}
            </span>
          </div>
        )}

        {/* Your seat: nameplate + hand along the south edge */}
        {view.yourMemberId && (
          <div className="absolute inset-x-0 bottom-3 flex flex-col items-center gap-2">
            <div
              ref={(el) => {
                const id = view.yourMemberId;
                if (!id) return;
                if (el) seatRefs.current.set(id, el);
                else seatRefs.current.delete(id);
              }}
              className={cn(
                "flex items-center gap-2 rounded-full border px-2 py-1 backdrop-blur-sm",
                yourTurn && !view.winnerId
                  ? "border-primary bg-primary/20 shadow-[0_0_18px_-4px_var(--color-primary)]"
                  : "border-white/10 bg-background/60"
              )}
            >
              {me?.avatarId && (
                <AvatarChip avatarId={me.avatarId} className="size-7" />
              )}
              <span className="flex flex-col leading-tight">
                <span className="flex items-center gap-1 text-xs font-medium text-foreground">
                  {me?.userId === hostId && (
                    <RiVipCrownFill className="size-3 text-primary" />
                  )}
                  You
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {view.yourHand.length}{" "}
                  {view.yourHand.length === 1 ? "card" : "cards"}
                </span>
              </span>
            </div>

            <ul className="flex items-end justify-center px-4">
              {view.yourHand.map((card, i) => {
                const playable =
                  !pending &&
                  !view.winnerId &&
                  view.yourPlayableCardIds.includes(card.id);
                const isWild = card.color === "wild";
                const isFlying = flyingCardId === card.id;
                return (
                  <li
                    key={card.id}
                    ref={(el) => {
                      if (el) handCardRefs.current.set(card.id, el);
                      else handCardRefs.current.delete(card.id);
                    }}
                    className={cn(
                      "relative transition-[width,margin,opacity] duration-200 ease-out",
                      // Small hands breathe; big hands fan tighter to fit.
                      i > 0 &&
                        (view.yourHand.length > 12
                          ? "-ml-8"
                          : view.yourHand.length > 8
                            ? "-ml-4"
                            : "ml-1"),
                      // In the air: collapse the slot so neighbours slide
                      // together while it flies. By the time the server
                      // drops the card from the hand there's nothing left
                      // to shift, so the refresh is invisible.
                      isFlying && "pointer-events-none ml-0 w-0 overflow-hidden opacity-0"
                    )}
                    style={{ zIndex: wildCardId === card.id ? 30 : i }}
                  >
                    <button
                      type="button"
                      disabled={!playable}
                      aria-label={
                        isWild ? "Wild — pick a color" : "Play this card"
                      }
                      onClick={() => {
                        if (isWild) {
                          setWildCardId(
                            wildCardId === card.id ? null : card.id
                          );
                        } else {
                          playFromHand(
                            card,
                            undefined,
                            handCardRefs.current.get(card.id)
                          );
                        }
                      }}
                      className={cn(
                        "block rounded-xl transition-transform duration-150",
                        // Playable cards sit proud of the hand and lift on
                        // hover; the rest stay flat.
                        playable
                          ? "-translate-y-2 cursor-pointer hover:-translate-y-6 focus-visible:-translate-y-6"
                          : "cursor-default"
                      )}
                    >
                      <NunoCardFace
                        card={card}
                        size="lg"
                        dimmed={!playable}
                        className={cn(
                          playable && "ring-2 ring-primary/80 drop-shadow-lg"
                        )}
                      />
                    </button>

                    {wildCardId === card.id && (
                      <span className="absolute -top-12 left-1/2 flex -translate-x-1/2 gap-1 rounded-full border border-border bg-popover p-1.5 shadow-lg">
                        {(Object.keys(NUNO_COLOR_HEX) as NunoColor[]).map(
                          (color) => (
                            <button
                              key={color}
                              type="button"
                              aria-label={`Play as ${color}`}
                              onClick={() =>
                                playFromHand(
                                  card,
                                  color,
                                  handCardRefs.current.get(card.id)
                                )
                              }
                              className="size-7 cursor-pointer rounded-full border-2 border-white/70 transition-transform hover:scale-110"
                              style={{ backgroundColor: NUNO_COLOR_HEX[color] }}
                            />
                          )
                        )}
                      </span>
                    )}
                  </li>
                );
              })}

              {/* The drawn card's slot, held with a card back until the
                  real one arrives — never an empty gap that pops. */}
              {showDrawPlaceholder && (
                <li
                  aria-hidden
                  className={cn(
                    "motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-200 relative",
                    view.yourHand.length > 0 &&
                      (view.yourHand.length > 12
                        ? "-ml-8"
                        : view.yourHand.length > 8
                          ? "-ml-4"
                          : "ml-1")
                  )}
                >
                  <NunoCardBack size="lg" className="opacity-80" />
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Actions */}
      {view.yourMemberId && (
        <div className="flex flex-col items-center gap-3">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {view.youDrew && (
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => run(() => passTurn(lobbyId))}
              >
                Keep it &amp; pass
              </Button>
            )}
            {view.pendingUnoMemberId === view.yourMemberId && (
              <Button
                size="sm"
                disabled={pending}
                className="animate-pulse font-heading text-base"
                onClick={() => run(() => callNuno(lobbyId))}
              >
                NUNO!
              </Button>
            )}
            {error && <span className="text-xs text-destructive">{error}</span>}
          </div>
        </div>
      )}

      {/* Cards in the air — fixed to the viewport, above everything */}
      <FlightLayer flights={visibleFlights} onDone={clearFlight} />
    </div>
  );
}
