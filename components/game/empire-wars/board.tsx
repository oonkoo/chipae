"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { RiQuestionLine, RiSafe2Fill } from "@remixicon/react";
import { advanceBot, submitMove } from "@/lib/actions/games";
import {
  BOARD_SIZE,
  CITIES,
  EMPIRE_WARS_CONFIG,
  MONUMENT_LEVEL,
  SPECIAL_TILES,
} from "@/lib/game/data/empire-wars";
import type { TurnEvent } from "@/lib/game/empire-wars/rules";
import type { EmpireView } from "@/lib/game/empire-wars/view";
import type { EmpireMove } from "@/lib/game/empire-wars/turn";
import type { BoardMember } from "@/components/game/types";
import { cn } from "@/lib/utils";
import { CityTile, SpecialTile, type CityActions } from "./tile";
import { DiceTray } from "./dice";
import { useWalkingPieces, walkDurationMs, type PieceSeat } from "./pieces";
import { SeatRow, arrangeSeats, type PanelSeat } from "./players";
import { Prompt } from "./prompt";
import { AuctionPanel } from "./auction-panel";
import { TradeCard } from "./trade-card";
import { Market } from "./market";
import { HowToPlay } from "./how-to-play";
import { SetupPanel } from "./setup-panel";
import { TossReveal, type SettledEvent } from "./toss-reveal";
import { MoneyFlights } from "./money-flights";
import { CoinIcon } from "./icons";
import { BoardCenterpiece } from "./art";
import { MonumentMoment } from "./moment";
import { describeEvent } from "./feed";

// The Empire Wars table (design/gdd/empire-wars-core.md > UI Requirements).
// Presentation only — every rule lives in lib/game/empire-wars/ and the
// server decides every move.
//
// One screen: the target and rounds on top, the ring of empires as big as the
// screen allows, and in its centre the dice and whatever the table is doing
// now — the prompt, a live auction, or an open trade. You always sit
// bottom-left; rivals follow clockwise. A match opens with setup over the
// board — everyone picks the target and rounds — then the toss.
//
// Two arrangements of the same table, switched on the felt's own width:
//   - wide (a desktop column): the players sit *inside* the ring, around the
//     dice, so the ring can take the whole height of the screen;
//   - narrow (a phone): the ring already fills the width, so the players sit
//     in rows above and below it, like the reference screen.

const SEEN_KEY = "chipae:empire-wars:v3:how-to-play-seen";

/** Tile index → cell in a 9×9 grid, walking clockwise from bottom-right. */
function ringCell(tile: number): { row: number; col: number } {
  if (tile <= 8) return { row: 9, col: 9 - tile };
  if (tile <= 16) return { row: 17 - tile, col: 1 };
  if (tile <= 24) return { row: 1, col: tile - 15 };
  return { row: tile - 23, col: 9 };
}

function fmt(amount: number): string {
  return amount.toLocaleString("en-US");
}

export function EmpireWarsBoard({
  lobbyId,
  view,
  members,
  hostId,
}: {
  lobbyId: string;
  view: EmpireView;
  members: BoardMember[];
  hostId: string;
}) {
  const [pending, startTransition] = useTransition();
  /**
   * A refused move's message, tagged with the version it was refused at. It
   * only shows while the table is still at that version — once anything
   * moves (the clock plays on, a CPU acts), a stale "It's not your turn"
   * would be wrong, so it quietly goes. Derived, so no effect clears it.
   */
  const [error, setError] = useState<{ text: string; version: number } | null>(null);
  const [marketOpen, setMarketOpen] = useState(false);
  const feltRef = useRef<HTMLDivElement>(null);
  const botTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deadlineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const byId = new Map(members.map((m) => [m.id, m]));
  const you = view.you;

  const nameOf = (memberId: string) => {
    const member = byId.get(memberId);
    if (!member) return "A departed emperor";
    return member.isBot ? (member.botName ?? "CPU") : member.displayName || `@${member.username}`;
  };
  const who = (memberId: string) => (memberId === you?.memberId ? "You" : nameOf(memberId));
  const whom = (memberId: string) => (memberId === you?.memberId ? "you" : nameOf(memberId));
  const colorOf = (memberId: string) => `var(--chart-${byId.get(memberId)?.seat ?? 1})`;
  /** A CPU, or a seat whose human has left the lobby (ADR-0004). */
  const isCpu = (memberId: string | null) => {
    if (!memberId) return false;
    const member = byId.get(memberId);
    return !member || member.isBot;
  };

  /**
   * Run a server action. No `router.refresh()` — the action revalidates the
   * game route itself, so its response already carries the new render.
   */
  function move(next: EmpireMove) {
    const at = view.version;
    setError(null);
    startTransition(async () => {
      const result = await submitMove(lobbyId, next);
      if (!result.ok) setError({ text: result.error, version: at });
    });
  }
  const shownError = error && error.version === view.version ? error.text : null;

  // ── CPU driver ────────────────────────────────────────────────────────────
  // Whoever is watching asks the server to play one move for a CPU after a
  // casual pause — the player whose turn it is, or a trade's recipient. The
  // lobby lock plus the whose-turn check make duplicate calls harmless.
  //
  // Keyed on `view.version`, which moves on every applied move: a CPU turn is
  // several moves (roll, buy, builds, End turn), and an effect keyed on
  // anything coarser stops re-firing partway through. During an auction CPUs
  // bid as proxies inside the rules, so there's nothing to drive — the
  // deadline timer below closes it.
  const onClock = view.onClockId;
  const onClockIsCpu = isCpu(onClock);

  // ── The toss ──────────────────────────────────────────────────────────────
  // Shown to whoever watched the table leave setup. Derived from the phase
  // last rendered (React's "adjust state while rendering"), so a reload
  // mid-match never replays it. The CPU driver waits while it plays.
  const [lastPhase, setLastPhase] = useState(view.phase);
  const [reveal, setReveal] = useState<SettledEvent | null>(null);
  if (lastPhase !== view.phase) {
    setLastPhase(view.phase);
    if (lastPhase === "setup") {
      const settled = view.events.findLast((e): e is SettledEvent => e.kind === "settled");
      if (settled) setReveal(settled);
    }
  }
  const closeReveal = useCallback(() => setReveal(null), []);
  const revealing = reveal !== null;

  useEffect(() => {
    if (!onClockIsCpu || view.winnerId || view.phase === "auction" || revealing) return;
    const delay =
      EMPIRE_WARS_CONFIG.botDelayMsMin +
      Math.random() * (EMPIRE_WARS_CONFIG.botDelayMsMax - EMPIRE_WARS_CONFIG.botDelayMsMin);
    botTimer.current = setTimeout(() => {
      void advanceBot(lobbyId);
    }, delay);
    return () => {
      if (botTimer.current) clearTimeout(botTimer.current);
    };
  }, [onClockIsCpu, onClock, view.version, view.winnerId, view.phase, revealing, lobbyId]);

  // ── Deadlines ─────────────────────────────────────────────────────────────
  // Serverless has no clock, so a deadline only fires because a client calls
  // in: a human who walked away (their move, their trade answer) or an
  // auction's countdown. The server re-checks every deadline on its own clock
  // and refuses early calls. Jittered, because every client computes the same
  // deadline.
  useEffect(() => {
    if (view.winnerId || view.turnExpiresAt === null) return;
    if (onClockIsCpu && view.phase !== "auction") return;
    const wait =
      Math.max(0, view.turnExpiresAt - Date.now()) + Math.random() * EMPIRE_WARS_CONFIG.turnJitterMaxMs;
    deadlineTimer.current = setTimeout(() => {
      void advanceBot(lobbyId);
    }, wait);
    return () => {
      if (deadlineTimer.current) clearTimeout(deadlineTimer.current);
    };
  }, [onClockIsCpu, view.turnExpiresAt, view.version, view.winnerId, view.phase, lobbyId]);

  // ── Pieces ────────────────────────────────────────────────────────────────
  // Everything else reads the server's position directly; only the piece lags,
  // walking tile by tile while the rest of the board is already up to date.
  const pieceSeats: PieceSeat[] = view.seats.map((s) => ({
    memberId: s.memberId,
    seat: byId.get(s.memberId)?.seat ?? 1,
    tile: s.tile,
    color: colorOf(s.memberId),
    label: nameOf(s.memberId),
    eliminated: s.status !== "in",
    inJail: s.inJail,
  }));
  const walked = useWalkingPieces(pieceSeats, view.lastRoll, BOARD_SIZE);
  const movingId = view.lastRoll?.memberId ?? null;
  const seatsOn = (tile: number) =>
    pieceSeats.filter((s) => !s.eliminated && (walked[s.memberId] ?? s.tile) === tile);
  const yourTile = you ? (walked[you.memberId] ?? -1) : -1;

  // Money waits for the piece: tribute flies once the galleon has arrived.
  const roll = view.lastRoll;
  const walkSteps = roll && roll.seq === view.version ? (roll.to - roll.from + BOARD_SIZE) % BOARD_SIZE : 0;
  const flightDelay = walkSteps > 0 ? walkDurationMs(walkSteps) + 80 : 120;

  // ── Motion cues ───────────────────────────────────────────────────────────
  // Only events that happened after this viewer arrived move anything:
  // joining a match in progress replays no pulses and no monuments. Each cue
  // is keyed by its event's `seq`, so the same event on a later refresh never
  // plays twice.
  const [arrivedAt] = useState(view.version);
  const fresh = view.events.filter((e) => e.seq > arrivedAt);
  /** The latest landing, purchase or auction win on each tile, in the colour it pays. */
  const pulses = new Map<number, { seq: number; color: string }>();
  for (const e of fresh) {
    if (e.kind === "tribute") pulses.set(e.tile, { seq: e.seq, color: colorOf(e.ownerId) });
    else if (e.kind === "buy" || e.kind === "auction-won") pulses.set(e.tile, { seq: e.seq, color: colorOf(e.memberId) });
  }
  const raised = fresh.findLast(
    (e): e is Extract<TurnEvent, { kind: "build" }> => e.kind === "build" && e.level === MONUMENT_LEVEL
  );
  const raisedCity = raised ? view.cities.find((c) => c.tile === raised.tile) : undefined;

  // ── How to play ───────────────────────────────────────────────────────────
  /**
   * Open the card the first time someone plays v3, then never again.
   *
   * `useSyncExternalStore` rather than a `useState` initialiser or an effect:
   * the server can't read localStorage, so it renders "already seen" and the
   * client corrects it. A state initialiser would mismatch on hydration; an
   * effect would trip the setState-in-effect rule.
   */
  const seenPrimer = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return !!window.localStorage.getItem(SEEN_KEY);
      } catch {
        // Private mode or blocked storage — don't nag.
        return true;
      }
    },
    () => true
  );
  /** null = follow the first-run default; true/false = the player chose. */
  const [manual, setManual] = useState<boolean | null>(null);
  // It waits for setup and the toss: it says how *this* match is won.
  const showHelp = manual ?? (!seenPrimer && you !== null && !view.setup && !revealing);
  const dismissHelp = useCallback(() => {
    setManual(false);
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Nothing to do — it will simply open again next time.
    }
  }, []);
  const closeMarket = useCallback(() => setMarketOpen(false), []);

  // ── Layout ────────────────────────────────────────────────────────────────
  const managing = !!you?.yourTurn && view.phase === "manage" && !view.winnerId;
  const showMarket = marketOpen && managing;
  const yourCash = view.seats.find((s) => s.memberId === you?.memberId)?.cash ?? 0;

  const panels: PanelSeat[] = view.seats.map((s) => {
    const member = byId.get(s.memberId);
    return {
      ...s,
      name: nameOf(s.memberId),
      seatNumber: member?.seat ?? 1,
      color: colorOf(s.memberId),
      isYou: s.memberId === you?.memberId,
      isHost: !!member && member.userId === hostId,
      isBot: !member || member.isBot,
      onClock: s.memberId === view.onClockId,
    };
  });
  const { top, bottom } = arrangeSeats(panels);

  const roundsLeft = view.roundLimit === null ? null : view.roundLimit - view.round + 1;
  const feed = view.events.slice(-3);

  const cells = Array.from({ length: BOARD_SIZE }, (_, tile) => {
    const { row, col } = ringCell(tile);
    const special = SPECIAL_TILES.find((s) => s.tile === tile);
    const def = CITIES.find((c) => c.tile === tile);
    const city = def ? view.cities.find((c) => c.id === def.id) : undefined;
    const common = {
      seats: seatsOn(tile),
      youId: you?.memberId ?? null,
      movingId,
      youAreHere: yourTile === tile,
    };
    const actions: CityActions | null =
      city && managing && city.ownerId === you?.memberId
        ? {
            cash: yourCash,
            busy: pending,
            onBuild: () => move({ kind: "build", tile }),
            onSellBuilding: () => move({ kind: "sellBuilding", tile }),
            onSellCity: () => move({ kind: "sellCity", tile }),
          }
        : null;
    return (
      <li key={tile} className="min-h-0 min-w-0" style={{ gridRow: row, gridColumn: col }}>
        {special ? (
          <SpecialTile tile={tile} kind={special.kind} name={special.name} corner={tile % 8 === 0} {...common} />
        ) : city ? (
          <CityTile
            city={city}
            ownerColor={city.ownerId ? colorOf(city.ownerId) : null}
            ownerName={city.ownerId ? whom(city.ownerId) : null}
            actions={actions}
            pulse={pulses.get(tile) ?? null}
            pulseDelayMs={flightDelay}
            monumentRising={raised?.tile === tile}
            {...common}
          />
        ) : null}
      </li>
    );
  });

  return (
    <div
      ref={feltRef}
      className="@container/felt ew-scope ew-table relative flex h-full min-h-0 min-w-0 flex-col gap-2 overflow-hidden rounded-3xl p-2 @md:gap-3 @md:p-3"
    >
      {/* ── What you're racing for ─────────────────────────────────────── */}
      <header className="flex items-center justify-between gap-2 px-1">
        <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-foreground/85 @md:text-sm">
          <CoinIcon aria-hidden className="size-4 text-[var(--ew-gold)]" />
          {view.setup ? (
            <span className="text-foreground">Choosing the rules…</span>
          ) : (
            <>
              {view.target !== null ? (
                <>
                  <span className="font-heading text-base text-[var(--ew-gain)] @md:text-lg">{fmt(view.target)}</span>
                  net worth to win
                </>
              ) : (
                <span className="text-foreground">
                  {view.roundLimit === null ? "Last empire standing wins" : "Richest at the end wins"}
                </span>
              )}
              <span aria-hidden>·</span>
              <span className="text-foreground">
                {roundsLeft === null
                  ? `Round ${view.round}`
                  : roundsLeft <= 1
                    ? "Last round"
                    : `${roundsLeft} rounds left`}
              </span>
            </>
          )}
        </p>
        <button
          type="button"
          onClick={() => setManual(true)}
          className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <RiQuestionLine className="size-3.5" aria-hidden />
          How to play
        </button>
      </header>

      {/* Narrow tables: rivals in a row above the city. */}
      <SeatRow slots={top} target={view.target} className="@2xl/felt:hidden" />

      {/* ── The world ──────────────────────────────────────────────────── */}
      {/* The stage is whatever the felt has left once the header (and, on a
          narrow table, the two player rows) are placed. The ring measures it
          (`cqw`/`cqh`) and takes one of exactly two shapes: the biggest
          square, or — on a stage wider than 5:4 — the biggest 3:2. Only two,
          because the painted centerpiece comes in those two shapes and its
          gilt frame mustn't be cropped. The corners stay at 0/8/16/24, so it's
          always 9×9; only the cells stretch. */}
      <div className="@container-size/stage relative flex min-h-0 flex-1 items-center justify-center">
        <div
          className={cn(
            "@container/ring relative",
            "size-[min(100cqw,100cqh)]",
            "ew-stage-wide:size-auto ew-stage-wide:aspect-[3/2] ew-stage-wide:w-[min(100cqw,150cqh)]"
          )}
        >
          {/* The carved frame the tiles sit in, and the centerpiece inside it. */}
          <div aria-hidden className="ew-frame absolute inset-0 rounded-[max(6px,1.2cqw)]" />
          <BoardCenterpiece className="absolute inset-[12%] rounded-[max(4px,0.8cqw)]" />

          <ol
            aria-label="The world, clockwise from the Silk Road"
            className="relative grid size-full grid-cols-9 grid-rows-9 gap-[max(2px,0.3cqw)] p-[max(3px,0.6cqw)]"
          >
            {cells}
          </ol>

          {/* The middle of the table. On a wide table the players sit here,
              around the dice: rivals along the top, you bottom-left. */}
          <div className="absolute inset-[12.5%] flex flex-col items-center gap-2">
            <SeatRow slots={top} target={view.target} className="hidden @2xl/felt:grid" />

            {/* `bank` is where card money comes from. */}
            <div
              data-ew-anchor="bank"
              className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-1.5 text-center @md:gap-2.5"
            >
              <DiceTray roll={view.lastRoll} />

              {view.setup && !view.winnerId ? (
                <p className="ew-chip rounded-full px-3 py-1 text-xs text-foreground/85">The table is choosing the rules…</p>
              ) : view.phase === "auction" && view.auction ? (
                <AuctionPanel
                  view={view}
                  who={who}
                  busy={pending}
                  error={shownError}
                  onBid={(amount) => move({ kind: "bid", id: view.auction!.id, amount })}
                />
              ) : view.phase === "trade" && view.trade ? (
                <TradeCard
                  view={view}
                  who={who}
                  whom={whom}
                  busy={pending}
                  error={shownError}
                  onAnswer={(accept) => move({ kind: "answerTrade", id: view.trade!.id, accept })}
                />
              ) : (
                <Prompt
                  view={view}
                  who={who}
                  onMove={move}
                  onOpenMarket={() => setMarketOpen(true)}
                  busy={pending}
                  error={shownError}
                />
              )}

              <span
                data-ew-anchor="pot"
                title="Card payments pile up here. Land on the Royal Treasury to take it."
                className="ew-chip flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] text-foreground/85 tabular-nums @md:text-xs"
              >
                <RiSafe2Fill aria-hidden className="size-3 text-[var(--ew-gold)]" />
                Treasury {fmt(view.treasury)}
              </span>

              {/* The feed sits on a walnut ledger: the marble underneath is too
                  light for ivory type. */}
              <ol
                aria-live="polite"
                className={cn(
                  "flex max-w-[92%] flex-col gap-0.5 rounded-lg",
                  feed.length > 0 && "ew-panel px-2.5 py-1 @md:px-3 @md:py-1.5"
                )}
              >
                {feed.map((event, i) => (
                  <li
                    key={`${event.seq}-${event.kind}-${i}`}
                    className={
                      i === feed.length - 1
                        ? "text-[10px] leading-snug text-foreground @md:text-xs"
                        : "text-[9px] leading-snug text-muted-foreground @md:text-[11px]"
                    }
                  >
                    {describeEvent(event, { who, whom, target: view.target })}
                  </li>
                ))}
              </ol>
            </div>

            <SeatRow slots={bottom} target={view.target} className="hidden @2xl/felt:grid" />
          </div>

          {raised && raisedCity && (
            <MonumentMoment
              key={raised.seq}
              empire={raisedCity.empire}
              monument={raisedCity.monument}
              city={raisedCity.name}
              builder={who(raised.memberId)}
            />
          )}
        </div>
      </div>

      {/* Narrow tables: you bottom-left, and whoever else sits this side. */}
      <SeatRow slots={bottom} target={view.target} className="@2xl/felt:hidden" />

      <MoneyFlights containerRef={feltRef} events={view.events} version={view.version} startDelayMs={flightDelay} />

      {showMarket && (
        <Market view={view} nameOf={nameOf} onMove={move} onClose={closeMarket} busy={pending} error={shownError} />
      )}
      {view.setup && !view.winnerId && (
        <SetupPanel
          setup={view.setup}
          youId={you?.memberId ?? null}
          hasCpus={view.seats.length > view.setup.humans.length}
          nameOf={nameOf}
          colorOf={colorOf}
          onPick={(settings) => move({ kind: "pickSetup", ...settings })}
          busy={pending}
          error={shownError}
        />
      )}
      {reveal && <TossReveal event={reveal} who={who} colorOf={colorOf} onDone={closeReveal} />}
      {showHelp && <HowToPlay target={view.target} rounds={view.roundLimit} onClose={dismissHelp} />}
    </div>
  );
}
