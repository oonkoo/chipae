import { NunoCardFan } from "chipae";

/**
 * An opponent's hand — overlapping backs. Overlaps are fixed pixel values;
 * percentage margins resolve against the flex container, not the card.
 */

export function HandSizes() {
  return (
    <div className="flex flex-col gap-4">
      <NunoCardFan count={2} />
      <NunoCardFan count={5} />
      <NunoCardFan count={7} />
    </div>
  );
}

export function Capped() {
  return (
    <div className="flex flex-col gap-2">
      <NunoCardFan count={12} max={5} />
      <span className="text-xs text-muted-foreground">
        12 cards, capped at 5 backs
      </span>
    </div>
  );
}

export function Vertical() {
  return (
    <div className="flex items-start gap-6">
      <NunoCardFan count={4} vertical />
      <NunoCardFan count={4} vertical size="sm" />
    </div>
  );
}

export function AtTheTable() {
  return (
    <div className="flex items-center gap-6">
      {[
        ["jenga", 3],
        ["Croupier", 5],
      ].map(([name, n]) => (
        <div key={String(name)} className="flex flex-col items-center gap-1.5">
          <NunoCardFan count={Number(n)} />
          <span className="text-xs text-muted-foreground">{name}</span>
        </div>
      ))}
    </div>
  );
}
