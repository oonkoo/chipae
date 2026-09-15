"use client";

import Image from "next/image";
import { RiHome4Fill } from "@remixicon/react";
import { cn } from "@/lib/utils";
import { EMPIRES, type EmpireId, type SpecialKind } from "@/lib/game/data/empire-wars";
import { MonumentIcon } from "./icons";

// The game's painted art (design/empire-wars-art-manifest.md), and what stands
// in for a piece that hasn't been painted yet.
//
// The sets below are a manifest, not a filesystem check: a component can't
// stat a file, and an <Image> pointed at a missing src 404s on every render.
// Adding art is two steps — drop the file at its path, add its id here.
//
// Everything loads eagerly: the whole board is on screen from the first
// paint, so lazy loading would only make the tiles pop in one by one.

const ROOT = "/games/empire-wars";

/** Cities with a painted icon at `cities/<city-id>.png` — all 24. */
const CITY_ART = new Set([
  "edirne",
  "bursa",
  "istanbul",
  "pompeii",
  "ravenna",
  "rome",
  "tabriz",
  "sarai",
  "karakorum",
  "guangzhou",
  "nanjing",
  "beijing",
  "lahore",
  "delhi",
  "agra",
  "marseille",
  "lyon",
  "paris",
  "liverpool",
  "manchester",
  "london",
  "sonargaon",
  "dhaka",
  "murshidabad",
]);

const ALL_EMPIRES: EmpireId[] = ["ottoman", "rome", "mongol", "ming", "mughal", "france", "britain", "bengal"];

/** Empires with a crest (`crests/<id>.png`) and a house (`houses/<id>.png`). */
const EMPIRE_ART = new Set<EmpireId>(ALL_EMPIRES);

/** Empires with a painted monument at `monuments/<id>.png`. */
const MONUMENT_ART = new Set<EmpireId>(ALL_EMPIRES);

/** Special tiles with a painted icon at `specials/<kind>.png` — all six. */
const SPECIAL_ART = new Set<SpecialKind>(["silk-road", "royal-decree", "dungeon", "fortune", "treasury", "treason"]);

export function specialArtSrc(kind: SpecialKind): string | null {
  return SPECIAL_ART.has(kind) ? `${ROOT}/specials/${kind}.png` : null;
}

/** An empire's band colour: the `--ew-district-N` token for its tier. */
export function empireVar(empire: string): string {
  const index = EMPIRES.findIndex((e) => e.id === empire);
  return `var(--ew-district-${index < 0 ? 1 : index + 1})`;
}

type ArtProps = { className?: string };

export type Corner = "tl" | "tr" | "bl" | "br";

/**
 * The painted gold ornament is a bottom-left corner piece: a scalloped lobe
 * with arms running up and right. Every other corner is a mirror of it.
 */
const CORNER_PLACEMENT: Record<Corner, string> = {
  bl: "bottom-0 left-0",
  tl: "top-0 left-0 -scale-y-100",
  tr: "top-0 right-0 -scale-100",
  br: "bottom-0 right-0 -scale-x-100",
};

/** One gold corner ornament, pinned to a corner of its `relative` parent. */
export function CornerOrnament({ corner, className }: ArtProps & { corner: Corner }) {
  return (
    <Image
      src={`${ROOT}/board/corner.webp`}
      alt=""
      width={128}
      height={128}
      draggable={false}
      loading="eager"
      className={cn(
        "pointer-events-none absolute object-contain drop-shadow-[0_1px_2px_var(--ew-shadow)]",
        CORNER_PLACEMENT[corner],
        className
      )}
    />
  );
}

/**
 * All four corner ornaments, for a framed surface such as a dialog. They sit
 * under the surface's content (a full-width button can run over them), so the
 * surface must `isolate` — otherwise they'd drop behind its background too.
 */
export function FrameCorners({ className }: ArtProps) {
  return (
    <>
      {(["tl", "tr", "bl", "br"] as const).map((corner) => (
        <CornerOrnament key={corner} corner={corner} className={cn("-z-10", className)} />
      ))}
    </>
  );
}

/**
 * The painted centerpiece in the shape the ring has right now: 3:2 on a wide
 * stage, square otherwise. `ew-stage-wide` is the same test that shapes the
 * ring (board.tsx), so the art always matches it and its gilt frame is never
 * cropped. The hidden one stays lazy, so it never downloads.
 */
export function BoardCenterpiece({ className }: ArtProps) {
  return (
    <div aria-hidden className={cn("ew-centerpiece", className)}>
      <Image
        src={`${ROOT}/board/centerpiece-wide.webp`}
        alt=""
        fill
        sizes="(min-width: 1024px) 50vw, 76vw"
        draggable={false}
        className="hidden object-cover ew-stage-wide:block"
      />
      <Image
        src={`${ROOT}/board/centerpiece-square.webp`}
        alt=""
        fill
        sizes="(min-width: 1024px) 50vw, 76vw"
        draggable={false}
        className="object-cover ew-stage-wide:hidden"
      />
    </div>
  );
}

/** The empire's crest — or, until it has one, a blank medallion in its colour. */
export function EmpireCrest({ empire, className }: ArtProps & { empire: EmpireId }) {
  if (!EMPIRE_ART.has(empire)) {
    return (
      <span
        aria-hidden
        className={cn("inline-block shrink-0 rounded-full border border-[var(--ew-gold)]", className)}
        style={{ background: empireVar(empire) }}
      />
    );
  }
  return (
    <Image
      src={`${ROOT}/crests/${empire}.png`}
      alt=""
      width={64}
      height={64}
      draggable={false}
      loading="eager"
      className={cn("shrink-0 object-contain", className)}
    />
  );
}

/**
 * A city's icon. A city without one shows its empire's crest, faded, so the
 * tile still says whose it is — or, with no crest either, the monument's
 * silhouette as a watermark.
 */
export function CityArt({ id, empire, className }: ArtProps & { id: string; empire: EmpireId }) {
  if (CITY_ART.has(id)) {
    return (
      <Image
        src={`${ROOT}/cities/${id}.png`}
        alt=""
        width={128}
        height={128}
        draggable={false}
      loading="eager"
        className={cn("object-contain", className)}
      />
    );
  }
  if (EMPIRE_ART.has(empire)) {
    return (
      <Image
        src={`${ROOT}/crests/${empire}.png`}
        alt=""
        width={64}
        height={64}
        draggable={false}
      loading="eager"
        className={cn("scale-75 object-contain opacity-40", className)}
      />
    );
  }
  return <MonumentIcon empire={empire} className={cn("scale-75 text-[var(--ew-paper)] opacity-20", className)} />;
}

/** One of the empire's houses — or a gold house glyph for an empire without art. */
export function HouseArt({ empire, className }: ArtProps & { empire: EmpireId }) {
  if (!EMPIRE_ART.has(empire)) {
    return <RiHome4Fill aria-hidden className={cn("shrink-0 text-[var(--ew-gold)]", className)} />;
  }
  return (
    <Image
      src={`${ROOT}/houses/${empire}.png`}
      alt=""
      width={64}
      height={64}
      draggable={false}
      loading="eager"
      className={cn("shrink-0 object-contain", className)}
    />
  );
}

/** The empire's monument — the painted miniature, or its silhouette in gold. */
export function MonumentArt({ empire, title, className }: ArtProps & { empire: EmpireId; title?: string }) {
  if (!MONUMENT_ART.has(empire)) {
    return <MonumentIcon empire={empire} title={title} className={cn("shrink-0 text-[var(--ew-gold)]", className)} />;
  }
  return (
    <Image
      src={`${ROOT}/monuments/${empire}.png`}
      alt={title ?? ""}
      title={title}
      width={128}
      height={128}
      draggable={false}
      loading="eager"
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
