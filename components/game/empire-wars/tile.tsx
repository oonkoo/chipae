"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  CARDS,
  EMPIRE_WARS_CONFIG,
  MAX_HOUSES,
  MONUMENT_LEVEL,
  type SpecialKind,
} from "@/lib/game/data/empire-wars";
import type { CityView } from "@/lib/game/empire-wars/view";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GamePiece, type PieceSeat } from "./pieces";
import { CoinIcon, SPECIAL_ICON } from "./icons";
import {
  CityArt,
  CornerOrnament,
  EmpireCrest,
  HouseArt,
  MonumentArt,
  empireVar,
  specialArtSrc,
  type Corner,
} from "./art";

// One board tile, drawn in DOM/CSS like Nuno's cards — no canvas.
//
// At any size a city carries only what can be read at a glance: its empire
// band, its painted icon, a tag (price while free, the tribute a visitor pays
// right now once owned) and its buildings — the empire's own houses, or its
// monument. Names appear when the board is wide enough; everything else lives
// in the card that opens on tap, which on your turn is also where you build
// and sell.
//
// Sizes use `cqw` — a share of the ring's width — so a bigger board gets
// bigger, more readable tiles rather than the same small ones with more gap.
// Colour comes from the game's own `--ew-*` tokens; owner colour uses the
// platform seat tokens so a player is the same colour here as in the lobby.

function fmt(amount: number): string {
  return amount.toLocaleString("en-US");
}

/**
 * Where a tile's wood grain starts. Every plaque tiles the same walnut
 * texture, so each starts at its own offset — neighbours never show the same
 * knot of grain side by side.
 */
function grainAt(tile: number): string {
  return `${(tile * 83) % 256}px ${(tile * 47) % 256}px`;
}

/** Which corner of the board each corner tile sits in (see `ringCell`). */
const OUTER_CORNER: Record<number, Corner> = { 0: "br", 8: "bl", 16: "tl", 24: "tr" };

/** The glow on the tile your piece stands on. */
const GLOW_HERE =
  "0 0 0 2px var(--ew-brass-hi), 0 0 14px 2px color-mix(in oklab, var(--ew-brass) 65%, transparent)";
/** The softer glow on a city you can build on right now. */
const GLOW_BUILD =
  "0 0 0 1px color-mix(in oklab, var(--ew-brass-hi) 75%, transparent), 0 0 10px color-mix(in oklab, var(--ew-brass) 45%, transparent)";

/**
 * What stands on a city: up to four of its empire's houses, overlapping like
 * tokens on a square, or the monument. Legible at 40px where a number wouldn't
 * be — the count is the shape.
 */
function Buildings({ city, rising }: { city: CityView; rising: boolean }) {
  if (city.level === 0) return null;
  if (city.level === MONUMENT_LEVEL) {
    return (
      <span className="relative flex items-center justify-center">
        {rising && (
          <span
            aria-hidden
            className="absolute size-[200%] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--ew-brass-hi)_75%,transparent)_0%,transparent_65%)] opacity-0 motion-safe:[animation:ew-glint_900ms_ease-out_120ms_forwards]"
          />
        )}
        <MonumentArt
          empire={city.empire}
          title={city.monument}
          className={cn(
            "relative size-[max(18px,4.4cqw)] origin-bottom drop-shadow-[0_2px_2px_var(--ew-shadow)]",
            rising && "motion-safe:[animation:ew-rise_var(--ew-rise-ms)_var(--ew-ease-arrive)_both]"
          )}
        />
      </span>
    );
  }
  return (
    <span className="flex -space-x-[max(3px,0.6cqw)]" aria-hidden>
      {Array.from({ length: city.level }, (_, i) => (
        <HouseArt
          key={i}
          empire={city.empire}
          className="size-[max(10px,2.2cqw)] drop-shadow-[0_1px_1px_var(--ew-shadow)]"
        />
      ))}
    </span>
  );
}

/**
 * A ring in a player's colour that leaves the tile once: someone landed here
 * and paid its owner, bought it, or won it. The board mounts it keyed by the
 * event's `seq`; the delay is frozen at mount (it waits for the walking piece
 * to arrive), so a later refresh that changes the board's timing can't
 * restart a ring that's already played.
 */
function PulseRing({ color, delayMs }: { color: string; delayMs: number }) {
  const [delay] = useState(delayMs);
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute -inset-[2px] z-[5] rounded-[6px] border-2 opacity-0 motion-safe:[animation:ew-pulse_var(--ew-pulse-ms)_var(--ew-ease-arrive)_forwards]"
      style={{
        borderColor: color,
        boxShadow: `0 0 12px ${color}, inset 0 0 8px ${color}`,
        animationDelay: `${delay}ms`,
      }}
    />
  );
}

/** Pieces standing on a tile, stacked tight so four still fit. */
function PieceStack({
  seats,
  youId,
  movingId,
}: {
  seats: PieceSeat[];
  youId: string | null;
  movingId: string | null;
}) {
  if (seats.length === 0) return null;
  return (
    <span className="pointer-events-none absolute -top-1 -right-1 z-10 flex -space-x-1.5">
      {seats.map((seat) => (
        <GamePiece
          key={seat.memberId}
          seat={seat}
          isYou={seat.memberId === youId}
          moving={seat.memberId === movingId}
          className="size-[max(14px,2.6cqw)]"
        />
      ))}
    </span>
  );
}

type TileCommon = {
  seats: PieceSeat[];
  youId: string | null;
  movingId: string | null;
  /** The tile the viewer's own piece stands on. */
  youAreHere: boolean;
};

/** What you can do with one of your own cities, on your manage step. */
export type CityActions = {
  cash: number;
  busy: boolean;
  onBuild: () => void;
  onSellBuilding: () => void;
  onSellCity: () => void;
};

export function CityTile({
  city,
  ownerColor,
  ownerName,
  actions,
  pulse,
  pulseDelayMs,
  monumentRising,
  seats,
  youId,
  movingId,
  youAreHere,
}: TileCommon & {
  city: CityView;
  /** chart-N var for the owner, or null while free. */
  ownerColor: string | null;
  ownerName: string | null;
  /** Present only when it's your city and your manage step. */
  actions: CityActions | null;
  /** The latest landing, purchase or auction win here since the viewer arrived. */
  pulse: { seq: number; color: string } | null;
  /** How long a new pulse waits — for the walking piece to arrive. */
  pulseDelayMs: number;
  /** A monument went up here since the viewer arrived: play its rise. */
  monumentRising: boolean;
}) {
  const owned = city.ownerId !== null && ownerColor !== null;
  const built =
    city.level === MONUMENT_LEVEL
      ? `, ${city.monument}`
      : city.level > 0
        ? `, ${city.level} house${city.level === 1 ? "" : "s"}`
        : "";
  const accessibleName = owned
    ? `${city.name}, ${city.empireName}, owned by ${ownerName}${built}, tribute ${fmt(city.tribute ?? 0)} coins`
    : `${city.name}, ${city.empireName}, for sale, ${fmt(city.price)} coins`;

  return (
    <Popover>
      <PopoverTrigger
        data-ew-anchor={`tile:${city.tile}`}
        aria-label={accessibleName}
        className={cn(
          // Hover brightens rather than lifts: moving the hovered tile itself
          // can slide it out from under the cursor and flicker.
          "ew-plaque relative flex size-full flex-col overflow-visible rounded-[4px] p-[max(2px,0.45cqw)] text-left transition-[filter] duration-150 ease-out hover:brightness-115",
          "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ew-brass-hi)]"
        )}
        style={
          {
            // An owner's tile wears their colour as an inner ring; the glow says
            // "you're here", or "you can build here" on your manage step.
            "--ew-grain": grainAt(city.tile),
            "--ew-ring": owned ? `inset 0 0 0 1.5px ${ownerColor}` : undefined,
            "--ew-glow": youAreHere ? GLOW_HERE : actions && city.canBuild ? GLOW_BUILD : undefined,
          } as React.CSSProperties
        }
      >
        {/* Empire band — the property strip, in enamel. */}
        <span
          aria-hidden
          className="ew-enamel block h-[max(4px,0.75cqw)] w-full shrink-0 rounded-[2px]"
          style={{ "--ew-enamel": empireVar(city.empire) } as React.CSSProperties}
        />

        {/* The body: the city's picture, with the name over its top-left and
            whatever has been built at its bottom-left. A board tile is short
            — a name row of its own would leave the picture a sliver — so the
            picture takes the whole body and sits right while names show.
            Once a monument stands, the city steps back so the monument reads. */}
        <span className="relative mt-[1px] min-h-0 w-full flex-1">
          <CityArt
            id={city.id}
            empire={city.empire}
            className={cn(
              // No % padding here: it resolves against width, and on a wide
              // tile that eats most of the height.
              "pointer-events-none absolute inset-0 size-full object-center drop-shadow-[0_2px_2px_var(--ew-shadow)] @md:object-right",
              city.level === MONUMENT_LEVEL && "opacity-45"
            )}
          />
          <span className="relative hidden truncate text-[length:max(8px,1.25cqw)] leading-[1.05] font-semibold text-[var(--ew-paper)] [text-shadow:0_1px_2px_var(--ew-shadow),0_0_6px_var(--ew-shadow)] @md:block">
            {city.name}
          </span>
          {owned && (
            <span className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center @md:justify-start">
              <Buildings city={city} rising={monumentRising} />
            </span>
          )}
        </span>

        {pulse && <PulseRing key={pulse.seq} color={pulse.color} delayMs={pulseDelayMs} />}

        {/* The tag is the rule: what it costs, or what landing here costs.
            A free city's price is brass type; an owned city's tribute sits on
            a plate in its owner's colour — so seat 1's gold still reads as
            owned, not for sale. */}
        <span
          className={cn(
            "relative mt-[1px] w-full shrink-0 rounded-[2px] py-[1px] text-center font-mono text-[length:max(7px,1.35cqw)] leading-none font-bold tabular-nums",
            owned ? "ew-plate" : "text-[var(--ew-gold)] [text-shadow:0_1px_1px_var(--ew-shadow)]"
          )}
          style={owned ? ({ "--ew-plate": ownerColor } as React.CSSProperties) : undefined}
        >
          {fmt(owned ? (city.tribute ?? 0) : city.price)}
        </span>

        <PieceStack seats={seats} youId={youId} movingId={movingId} />
      </PopoverTrigger>

      <PopoverContent side="top" className="ew-scope w-72 gap-2 border border-[var(--ew-brass-lo)] p-3">
        <CityCard city={city} ownerName={ownerName} actions={actions} yours={city.ownerId === youId && youId !== null} />
      </PopoverContent>
    </Popover>
  );
}

/** The card behind a city: everything its tag leaves out, and your options. */
function CityCard({
  city,
  ownerName,
  actions,
  yours,
}: {
  city: CityView;
  ownerName: string | null;
  actions: CityActions | null;
  yours: boolean;
}) {
  const t = city.tributeTable;
  const rows: Array<{ label: React.ReactNode; value: number; current: boolean }> = [
    { label: "Bare", value: t.bare, current: city.level === 0 && !city.wholeEmpire },
    { label: "Whole empire", value: t.whole, current: city.level === 0 && city.wholeEmpire },
    ...t.houses.map((value, i) => ({
      label: (
        <span className="flex items-center -space-x-1" aria-label={`${i + 1} house${i ? "s" : ""}`}>
          {Array.from({ length: i + 1 }, (_, h) => (
            <HouseArt key={h} empire={city.empire} className="size-4" />
          ))}
        </span>
      ),
      value,
      current: city.level === i + 1,
    })),
    {
      label: (
        <span className="flex items-center gap-1">
          <MonumentArt empire={city.empire} className="size-6" />
          {city.monument}
        </span>
      ),
      value: t.monument,
      current: city.level === MONUMENT_LEVEL,
    },
  ];

  const nextIsMonument = city.level === MAX_HOUSES;

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="relative size-12 shrink-0 overflow-hidden rounded-lg border"
            style={{
              background: "color-mix(in srgb, var(--ew-paper) 6%, var(--ew-ink))",
              borderColor: `color-mix(in srgb, ${empireVar(city.empire)} 70%, transparent)`,
            }}
          >
            <CityArt id={city.id} empire={city.empire} className="absolute inset-0 size-full p-1" />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="font-heading text-base leading-tight text-foreground">{city.name}</span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <EmpireCrest empire={city.empire} className="size-4" />
              {city.empireName}
            </span>
          </div>
        </div>
        <span className="flex items-center gap-1 font-mono text-sm text-foreground tabular-nums">
          <CoinIcon className="size-3.5 text-[var(--ew-gold)]" aria-hidden />
          {fmt(city.price)}
        </span>
      </div>

      <p className="text-xs text-foreground/85">
        {yours
          ? `Yours. Rivals who land here pay you ${fmt(city.tribute ?? 0)} coins.`
          : ownerName
            ? `Owned by ${ownerName}. Land here and you pay ${fmt(city.tribute ?? 0)} coins.`
            : `Free. Land here and it's yours for ${fmt(city.price)} coins.`}
      </p>

      {/* The tribute ladder — the whole reason to build. */}
      <ul className="flex flex-col gap-0.5 text-xs">
        {rows.map((row, i) => (
          <li
            key={i}
            className={cn(
              "flex items-center justify-between rounded-md px-1.5 py-0.5",
              row.current && ownerName ? "bg-[var(--ew-gold)]/15 text-foreground" : "text-muted-foreground"
            )}
          >
            <span>{row.label}</span>
            <span className="font-mono tabular-nums">{fmt(row.value)}</span>
          </li>
        ))}
      </ul>

      {actions ? (
        <div className="flex flex-col gap-1.5">
          {city.canBuild && (
            <Button
              variant="game"
              size="sm"
              disabled={actions.busy || actions.cash < city.buildCost}
              onClick={actions.onBuild}
            >
              {nextIsMonument ? `Raise ${city.monument}` : "Build a house"} — {fmt(city.buildCost)}
            </Button>
          )}
          {city.level > 0 && (
            <Button variant="outline" size="sm" disabled={actions.busy} onClick={actions.onSellBuilding}>
              Sell {city.level === MONUMENT_LEVEL ? city.monument : "a house"} — {fmt(city.buildingSalePrice)}
            </Button>
          )}
          {city.level === 0 && city.bare && (
            <Button variant="ghost" size="sm" disabled={actions.busy} onClick={actions.onSellCity}>
              Sell to the bank — {fmt(city.citySalePrice)}
            </Button>
          )}
          {!city.wholeEmpire && (
            <p className="text-[11px] text-muted-foreground">
              Own all three cities of {city.empireName} to build here.
            </p>
          )}
        </div>
      ) : (
        <p className="text-[11px] leading-snug text-muted-foreground">
          Tribute doubles for a whole empire. Each house — and the monument —
          costs {fmt(city.buildCost)}.
        </p>
      )}
    </>
  );
}

/** One line on what a special tile does, in the GDD's words. */
const SPECIAL_TEXT: Record<SpecialKind, string> = {
  "silk-road": `Collect ${EMPIRE_WARS_CONFIG.payday} coins every time you pass or land here.`,
  "royal-decree": `Draw a Royal Decree card — one of ${CARDS["royal-decree"].length}. It happens straight away.`,
  dungeon: "Just visiting — unless you were sent here. Sent here, you miss a turn.",
  fortune: `Draw a Fortune card — one of ${CARDS.fortune.length}. It happens straight away.`,
  treasury: "Take everything in the Royal Treasury.",
  treason: "Go straight to the Dungeon. You don't pass the Silk Road.",
};

export function SpecialTile({
  tile,
  kind,
  name,
  seats,
  youId,
  movingId,
  youAreHere,
  corner,
}: TileCommon & {
  tile: number;
  kind: SpecialKind;
  name: string;
  corner: boolean;
}) {
  const Icon = SPECIAL_ICON[kind];
  const art = specialArtSrc(kind);
  // The two card decks are parchment cards; the four corners are the table's
  // landmarks, framed twice in brass.
  const card = kind === "fortune" || kind === "royal-decree";
  return (
    <Popover>
      <PopoverTrigger
        data-ew-anchor={`tile:${tile}`}
        aria-label={`${name}: ${SPECIAL_TEXT[kind]}`}
        className={cn(
          "relative flex size-full flex-col items-center justify-center gap-[2px] rounded-[4px] p-[3px] text-center transition-[filter] duration-150 ease-out hover:brightness-115",
          "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ew-brass-hi)]",
          card ? "ew-card" : corner ? "ew-plaque-ornate" : "ew-plaque"
        )}
        style={{ "--ew-grain": grainAt(tile), "--ew-glow": youAreHere ? GLOW_HERE : undefined } as React.CSSProperties}
      >
        {art ? (
          <Image
            src={art}
            alt=""
            width={128}
            height={128}
            draggable={false}
            loading="eager"
            className="min-h-0 w-auto flex-1 object-contain drop-shadow-[0_2px_2px_var(--ew-shadow)]"
          />
        ) : (
          <Icon
            aria-hidden
            className={cn(
              corner ? "size-[45%]" : "size-[40%]",
              card
                ? "text-[var(--ew-brass-lo)]"
                : "text-[var(--ew-gold)] drop-shadow-[0_1px_2px_var(--ew-shadow)]"
            )}
          />
        )}
        <span
          className={cn(
            "hidden font-heading text-[length:max(8px,1.25cqw)] leading-tight @md:block",
            card ? "text-[var(--ew-parchment-ink)]" : "text-[var(--ew-gold)] [text-shadow:0_1px_2px_var(--ew-shadow)]"
          )}
        >
          {name}
        </span>
        {/* The board's four corners wear a gold ornament on their outer corner. */}
        {corner && (
          <CornerOrnament corner={OUTER_CORNER[tile] ?? "tl"} className="-m-[3px] size-[max(14px,2.8cqw)]" />
        )}
        <PieceStack seats={seats} youId={youId} movingId={movingId} />
      </PopoverTrigger>
      <PopoverContent side="top" className="ew-scope w-56 gap-1 border border-[var(--ew-brass-lo)] p-3">
        <span className="font-heading text-base text-foreground">{name}</span>
        <p className="text-xs text-foreground/85">{SPECIAL_TEXT[kind]}</p>
      </PopoverContent>
    </Popover>
  );
}
