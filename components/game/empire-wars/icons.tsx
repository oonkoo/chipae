import {
  RiAlarmWarningFill,
  RiCopperCoinFill,
  RiFileList3Fill,
  RiLock2Fill,
  RiQuestionFill,
  RiRoadMapFill,
  RiSafe2Fill,
  type RemixiconComponentType,
} from "@remixicon/react";
import type { EmpireId, SpecialKind } from "@/lib/game/data/empire-wars";

// The game's iconography (GDD > UI).
//
// Special tiles and coins come from Remix Icon (the repo's library — not
// lucide). The eight monuments are hand-drawn silhouettes on `currentColor`,
// the stand-in wherever a painted monument is missing (see ./art). Painted
// art — cities, crests, houses, monuments, pieces — lives in
// public/games/empire-wars/, listed in design/empire-wars-art-manifest.md.

/** The currency. Every amount on the table sits beside this. */
export const CoinIcon = RiCopperCoinFill;

/** One glyph per special tile, so a corner reads before its name does. */
export const SPECIAL_ICON: Record<SpecialKind, RemixiconComponentType> = {
  "silk-road": RiRoadMapFill,
  "royal-decree": RiFileList3Fill,
  dungeon: RiLock2Fill,
  fortune: RiQuestionFill,
  treasury: RiSafe2Fill,
  treason: RiAlarmWarningFill,
};

// ─── Player pieces ───────────────────────────────────────────────────────────
// One per seat, assigned by seat order, painted at
// public/games/empire-wars/pieces/<id>.webp. The art is full colour, so the
// seat's colour comes from the chip the piece stands on, not the piece.
// Replacing a piece? Give it a new file name: Next's image optimizer caches
// by URL (4 h by default), so an overwritten file keeps serving the old art.

export const PLAYER_PIECES = [
  { id: "crown", name: "The Crown", src: "/games/empire-wars/pieces/crown.webp" },
  { id: "galleon", name: "The Galleon", src: "/games/empire-wars/pieces/galleon.webp" },
  { id: "cannon", name: "The Cannon", src: "/games/empire-wars/pieces/cannon.webp" },
  { id: "trebuchet", name: "The Trebuchet", src: "/games/empire-wars/pieces/trebuchet.webp" },
  { id: "balloon", name: "The Balloon", src: "/games/empire-wars/pieces/balloon.webp" },
  { id: "lamp", name: "The Lamp", src: "/games/empire-wars/pieces/lamp.webp" },
] as const;

/** A seat's piece. Seats are 1-based; anything out of range wraps. */
export function pieceForSeat(seat: number) {
  return PLAYER_PIECES[(Math.max(1, seat) - 1) % PLAYER_PIECES.length];
}

// ─── Monuments ───────────────────────────────────────────────────────────────

type IconProps = { className?: string; title?: string };

function Glyph({ children, className, title }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {children}
    </svg>
  );
}

const MONUMENT_GLYPH: Record<EmpireId, React.ReactNode> = {
  // Topkapı Palace — the Gate of Salutation, between its two pointed towers.
  ottoman: (
    <>
      <path d="M5 2.5 7.5 9h-5L5 2.5ZM19 2.5 21.5 9h-5L19 2.5Z" />
      <path d="M3 9h4v12H3zM17 9h4v12h-4zM7 12h10v9H7z" />
      <path d="M10 21v-4a2 2 0 0 1 4 0v4" className="fill-[var(--ew-shade)]" />
    </>
  ),
  // The Colosseum — two tiers of arches.
  rome: (
    <>
      <path d="M3 8c0-1.7 4-3 9-3s9 1.3 9 3v12H3V8Z" />
      <path
        d="M5.5 19v-3.5a1.2 1.2 0 0 1 2.4 0V19M10.8 19v-3.5a1.2 1.2 0 0 1 2.4 0V19M16.1 19v-3.5a1.2 1.2 0 0 1 2.4 0V19M5.5 12.5v-2.2a1.2 1.2 0 0 1 2.4 0v2.2M10.8 12.5v-2.2a1.2 1.2 0 0 1 2.4 0v2.2M16.1 12.5v-2.2a1.2 1.2 0 0 1 2.4 0v2.2"
        className="fill-[var(--ew-shade)]"
      />
    </>
  ),
  // The Genghis Khan Statue — a horse and rider on a round pedestal.
  mongol: (
    <>
      <path d="M5 18h14v3H5zM4 21h16v1.5H4z" />
      <path d="M6.5 12.5c0-1.4 1.1-2.5 2.5-2.5h5.5l1.8-2.6 1.9.6-.8 2.4c.9.5 1.4 1.4 1.4 2.4V14h-1.3v3.5h-1.4v-3.3H9.4v3.3H8v-3.3H6.5v-1.7Z" />
      <path d="M11 4.2a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6ZM9.8 7.3h2.4l.6 3.4H9.3l.5-3.4Z" />
    </>
  ),
  // The Forbidden City — a hall under a double-eaved roof, on its terrace.
  ming: (
    <>
      <path d="M12 3c2.5 1.6 6 2.4 9 2.5-1 .9-2.2 1.4-3.6 1.5H5.6C4.2 6.9 3 6.4 2 5.5 5 5.4 9.5 4.6 12 3Z" />
      <path d="M6 7h12v2.5H6z" />
      <path d="M12 9.5c3 1.4 7 2 10 2-1.1 1-2.5 1.5-4 1.5H6c-1.5 0-2.9-.5-4-1.5 3 0 7-.6 10-2Z" />
      <path d="M5 13h14v5H5z" />
      <path d="M8 18v-3.5h1.5V18M11.2 18v-3.5h1.6V18M14.5 18v-3.5H16V18" className="fill-[var(--ew-shade)]" />
      <path d="M2 18h20v1.5H2zM3.5 19.5h17V21h-17z" />
    </>
  ),
  // The Taj Mahal — an onion dome between two minarets.
  mughal: (
    <>
      <path d="M12 2.5c.4 1 2 1.8 2.6 3.4 1.8.8 2.9 2.4 2.9 4.1H6.5c0-1.7 1.1-3.3 2.9-4.1.6-1.6 2.2-2.4 2.6-3.4Z" />
      <path d="M6 11h12v8H6z" />
      <path d="M2.8 7h1.6v12H2.8zM19.6 7h1.6v12h-1.6zM2 20h20v1.5H2z" />
      <path d="M10.5 19v-3.2a1.5 1.5 0 0 1 3 0V19" className="fill-[var(--ew-shade)]" />
    </>
  ),
  // The Eiffel Tower — a tapering lattice with its arch.
  france: (
    <path d="M11.3 2h1.4l.5 5 1.1 1v1.5l1.4 4.5h1.3v1.5h-.9L18 21h-2.6l-1.5-2.8a2.2 2.2 0 0 0-3.8 0L8.6 21H6l1.9-5.5H7V14h1.3l1.4-4.5V8l1.1-1 .5-5Zm-.5 11.5h2.4l-.6-4H11.4l-.6 4Z" />
  ),
  // Big Ben — a clock tower with its spire.
  britain: (
    <>
      <path d="M12 1.5 14 5v1.5h1v14H9v-14h1V5l2-3.5Z" />
      <path d="M7 20.5h10V22H7z" />
      <circle cx="12" cy="10" r="2.1" className="fill-[var(--ew-shade)]" />
    </>
  ),
  // Hazarduari Palace — a pediment on a colonnade, over wide steps.
  bengal: (
    <>
      <path d="M12 3 21.5 8.5h-19L12 3Z" />
      <path d="M3.5 9.5h17v1.5h-17z" />
      <path d="M4.5 12h1.6v6H4.5zM8.2 12h1.6v6H8.2zM11.2 12h1.6v6h-1.6zM14.2 12h1.6v6h-1.6zM17.9 12h1.6v6h-1.6z" />
      <path d="M2.5 18.5h19V20h-19zM1.5 20.5h21V22h-21z" />
    </>
  ),
};

/** An empire's monument, as a placeholder silhouette. */
export function MonumentIcon({ empire, className, title }: IconProps & { empire: EmpireId }) {
  return (
    <Glyph className={className} title={title}>
      {MONUMENT_GLYPH[empire]}
    </Glyph>
  );
}

// ─── The dice ────────────────────────────────────────────────────────────────

/** Pip layout for a d6 face, on a 3×3 grid. */
const PIPS: Record<number, Array<[number, number]>> = {
  1: [[1, 1]],
  2: [
    [0, 0],
    [2, 2],
  ],
  3: [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  4: [
    [0, 0],
    [2, 0],
    [0, 2],
    [2, 2],
  ],
  5: [
    [0, 0],
    [2, 0],
    [1, 1],
    [0, 2],
    [2, 2],
  ],
  6: [
    [0, 0],
    [2, 0],
    [0, 1],
    [2, 1],
    [0, 2],
    [2, 2],
  ],
};

export function DieFace({
  value,
  className,
  style,
}: {
  value: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const pips = PIPS[Math.min(6, Math.max(1, value))] ?? PIPS[1];
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} aria-label={`${value}`} role="img">
      <rect
        x="1.5"
        y="1.5"
        width="21"
        height="21"
        rx="5"
        fill="var(--ew-paper)"
        stroke="var(--ew-gold-edge)"
        strokeWidth="1"
      />
      {pips.map(([col, row], i) => (
        <circle key={i} cx={6.5 + col * 5.5} cy={6.5 + row * 5.5} r="2.1" fill="var(--ew-ink)" />
      ))}
    </svg>
  );
}
