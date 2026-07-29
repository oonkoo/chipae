import type { NunoCard, NunoColor } from "@/lib/game/nuno/rules";
import { cn } from "@/lib/utils";

// The Nuno deck's look, in one place: a classic card-game face (white
// frame, tilted oval, outlined glyph) wearing Chipae's chip motif — the
// oval sits inside a dashed chip rim, and wilds show the four-color chip.

const FACE_COLOR: Record<string, string> = {
  red: "#e0454c",
  blue: "#3d63d8",
  green: "#2fa46a",
  yellow: "#f0b02c",
  wild: "#1b1733",
};

/** Chip quadrants — also the wild card's center mark. */
const CHIP_CONIC =
  "conic-gradient(#e0454c 0deg 90deg, #f0b02c 90deg 180deg, #2fa46a 180deg 270deg, #3d63d8 270deg 360deg)";

export const NUNO_COLOR_HEX: Record<NunoColor, string> = {
  red: FACE_COLOR.red,
  blue: FACE_COLOR.blue,
  green: FACE_COLOR.green,
  yellow: FACE_COLOR.yellow,
};

export type NunoCardSize = "xs" | "sm" | "md" | "lg";

const SIZE: Record<
  NunoCardSize,
  {
    box: string;
    radius: number;
    frame: number;
    center: string;
    corner: string;
    chip: string;
  }
> = {
  xs: {
    box: "h-10 w-7",
    radius: 6,
    frame: 2,
    center: "text-[13px]",
    corner: "text-[6px]",
    chip: "size-3",
  },
  sm: {
    box: "h-[3.4rem] w-9",
    radius: 8,
    frame: 3,
    center: "text-lg",
    corner: "text-[8px]",
    chip: "size-4",
  },
  md: {
    box: "h-[4.9rem] w-[3.4rem]",
    radius: 10,
    frame: 4,
    center: "text-2xl",
    corner: "text-[10px]",
    chip: "size-6",
  },
  lg: {
    box: "h-[6.6rem] w-[4.6rem]",
    radius: 12,
    frame: 5,
    center: "text-4xl",
    corner: "text-xs",
    chip: "size-8",
  },
};

/** Corner + center glyph for a card. Wilds render a chip instead. */
function glyphFor(card: NunoCard): string {
  switch (card.type) {
    case "number":
      return String(card.value);
    case "skip":
      return "⊘";
    case "reverse":
      return "⇅";
    case "draw2":
      return "+2";
    case "wild":
      return "";
    case "wild4":
      return "+4";
  }
}

/** White text with a dark keyline — the card-game numeral look. */
const OUTLINED: React.CSSProperties = {
  color: "#ffffff",
  WebkitTextStrokeWidth: "0.085em",
  WebkitTextStrokeColor: "#15112b",
  paintOrder: "stroke fill",
};

function Corner({
  glyph,
  size,
  flipped = false,
  chip = false,
}: {
  glyph: string;
  size: NunoCardSize;
  flipped?: boolean;
  chip?: boolean;
}) {
  const s = SIZE[size];
  return (
    <span
      className={cn(
        "absolute font-heading leading-none",
        s.corner,
        flipped ? "right-[7%] bottom-[5%] rotate-180" : "top-[5%] left-[7%]"
      )}
      style={OUTLINED}
    >
      {chip ? (
        <span
          className={cn(
            "block rounded-full border border-white/70",
            size === "xs" ? "size-1.5" : "size-2"
          )}
          style={{ background: CHIP_CONIC }}
        />
      ) : (
        glyph
      )}
    </span>
  );
}

/**
 * A single Nuno card, face up. Pure presentation — every surface (hand,
 * discard pile, previews) renders cards through this.
 */
export function NunoCardFace({
  card,
  size = "md",
  dimmed = false,
  className,
}: {
  card: NunoCard;
  size?: NunoCardSize;
  dimmed?: boolean;
  className?: string;
}) {
  const s = SIZE[size];
  const glyph = glyphFor(card);
  const isWild = card.color === "wild";

  return (
    <span
      className={cn(
        "relative block shrink-0 overflow-hidden bg-white shadow-md select-none",
        s.box,
        className
      )}
      style={{ borderRadius: s.radius, padding: s.frame }}
    >
      {/* Face */}
      <span
        className="relative block h-full w-full overflow-hidden"
        style={{
          borderRadius: s.radius - 2,
          backgroundColor: FACE_COLOR[card.color],
        }}
      >
        {/* Chip rim + oval: the Nuno signature. A tall ellipse tilted off
            vertical, so the face colour still shows in opposing corners. */}
        <span
          className="absolute top-1/2 left-1/2 block rounded-[50%] border border-dashed border-white/40"
          style={{
            width: "96%",
            height: "130%",
            transform: "translate(-50%, -50%) rotate(20deg)",
          }}
        />
        <span
          className="absolute top-1/2 left-1/2 block rounded-[50%] bg-white"
          style={{
            width: "85%",
            height: "118%",
            transform: "translate(-50%, -50%) rotate(20deg)",
          }}
        />
        {/* Center mark */}
        <span className="absolute inset-0 flex items-center justify-center">
          {isWild && card.type === "wild" ? (
            <span
              className={cn("rounded-full border-2 border-white shadow", s.chip)}
              style={{ background: CHIP_CONIC }}
            />
          ) : (
            <span
              className={cn("font-heading leading-none", s.center)}
              style={{
                ...OUTLINED,
                ...(isWild ? {} : { color: "#ffffff" }),
              }}
            >
              {glyph}
            </span>
          )}
        </span>
        {/* Wild +4 keeps a chip behind the glyph so it still reads as wild */}
        {card.type === "wild4" && (
          <span
            className={cn(
              "absolute bottom-[8%] left-1/2 -translate-x-1/2 rounded-full border border-white/80",
              size === "xs" ? "size-2" : "size-3"
            )}
            style={{ background: CHIP_CONIC }}
          />
        )}
        <Corner glyph={glyph} size={size} chip={card.type === "wild"} />
        <Corner glyph={glyph} size={size} chip={card.type === "wild"} flipped />
        {/* Unplayable: shaded, not desaturated — the white frame stays
            crisp so it still reads as a real card. */}
        {dimmed && (
          <span className="absolute inset-0 bg-[#0b0918]/35" />
        )}
      </span>
    </span>
  );
}

/**
 * A face-down Nuno card: indigo felt, gold chip rim, and the wordmark —
 * the deck's back, used for opponents' hands and the draw pile.
 */
export function NunoCardBack({
  size = "md",
  className,
}: {
  size?: NunoCardSize;
  className?: string;
}) {
  const s = SIZE[size];
  return (
    <span
      className={cn(
        "relative block shrink-0 overflow-hidden bg-white shadow-md select-none",
        s.box,
        className
      )}
      style={{ borderRadius: s.radius, padding: s.frame }}
    >
      <span
        className="relative block h-full w-full overflow-hidden"
        style={{
          borderRadius: s.radius - 2,
          backgroundColor: FACE_COLOR.wild,
        }}
      >
        <span
          className="absolute top-1/2 left-1/2 block rounded-[50%] border border-dashed"
          style={{
            width: "96%",
            height: "130%",
            borderColor: "rgba(240,176,44,0.5)",
            transform: "translate(-50%, -50%) rotate(20deg)",
          }}
        />
        <span
          className="absolute top-1/2 left-1/2 block rounded-[50%]"
          style={{
            width: "85%",
            height: "118%",
            backgroundColor: "#f0b02c",
            transform: "translate(-50%, -50%) rotate(20deg)",
          }}
        />
        <span className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn(
              "font-heading leading-none tracking-tight",
              size === "xs"
                ? "text-[7px]"
                : size === "sm"
                  ? "text-[9px]"
                  : size === "md"
                    ? "text-xs"
                    : "text-base"
            )}
            style={{
              color: "#1b1733",
              transform: "rotate(20deg)",
            }}
          >
            NUNO
          </span>
        </span>
      </span>
    </span>
  );
}

// Fixed pixel overlaps: percentage margins resolve against the flex
// container (not the card), so they can't fan a hand reliably.
const FAN_OVERLAP: Record<NunoCardSize, { h: string; v: string }> = {
  xs: { h: "-ml-4", v: "-mt-7" },
  sm: { h: "-ml-5", v: "-mt-10" },
  md: { h: "-ml-8", v: "-mt-14" },
  lg: { h: "-ml-10", v: "-mt-20" },
};

/** Overlapping fan of face-down cards — an opponent's hand. */
export function NunoCardFan({
  count,
  size = "xs",
  max = 5,
  vertical = false,
}: {
  count: number;
  size?: NunoCardSize;
  max?: number;
  vertical?: boolean;
}) {
  const shown = Math.min(count, max);
  const overlap = FAN_OVERLAP[size];
  return (
    <span className={cn("flex", vertical ? "flex-col" : "flex-row")}>
      {Array.from({ length: shown }, (_, i) => (
        <NunoCardBack
          key={i}
          size={size}
          className={cn(i > 0 && (vertical ? overlap.v : overlap.h))}
        />
      ))}
    </span>
  );
}
