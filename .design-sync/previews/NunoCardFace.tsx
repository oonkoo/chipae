import { NunoCardFace } from "chipae";

/**
 * Nuno's deck. Card colours are their own palette (--nuno-* in globals.css),
 * deliberately separate from the app theme — a printed card looks the same in
 * any theme.
 */

const card = (
  id: string,
  color: "red" | "blue" | "green" | "yellow" | "wild",
  type: "number" | "skip" | "reverse" | "draw2" | "wild" | "wild4",
  value?: number
) => ({ id, color, type, value });

export function Colors() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <NunoCardFace card={card("r7", "red", "number", 7)} />
      <NunoCardFace card={card("b3", "blue", "number", 3)} />
      <NunoCardFace card={card("g0", "green", "number", 0)} />
      <NunoCardFace card={card("y6", "yellow", "number", 6)} />
    </div>
  );
}

export function ActionCards() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <NunoCardFace card={card("rs", "red", "skip")} />
      <NunoCardFace card={card("bv", "blue", "reverse")} />
      <NunoCardFace card={card("gd", "green", "draw2")} />
    </div>
  );
}

export function Wilds() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <NunoCardFace card={card("w1", "wild", "wild")} />
      <NunoCardFace card={card("w4", "wild", "wild4")} />
    </div>
  );
}

export function Sizes() {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <NunoCardFace card={card("y6", "yellow", "number", 6)} size="xs" />
      <NunoCardFace card={card("y6", "yellow", "number", 6)} size="sm" />
      <NunoCardFace card={card("y6", "yellow", "number", 6)} size="md" />
      <NunoCardFace card={card("y6", "yellow", "number", 6)} size="lg" />
    </div>
  );
}

export function PlayableVsNot() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <NunoCardFace card={card("r7", "red", "number", 7)} />
      <NunoCardFace card={card("b3", "blue", "number", 3)} dimmed />
      <NunoCardFace card={card("g5", "green", "number", 5)} dimmed />
    </div>
  );
}
