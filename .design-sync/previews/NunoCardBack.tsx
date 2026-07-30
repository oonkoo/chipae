import { NunoCardBack } from "chipae";

/** The deck's back: indigo field, gold oval, NUNO wordmark. */

export function Default() {
  return <NunoCardBack size="lg" />;
}

export function Sizes() {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <NunoCardBack size="xs" />
      <NunoCardBack size="sm" />
      <NunoCardBack size="md" />
      <NunoCardBack size="lg" />
    </div>
  );
}

export function DrawPile() {
  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <NunoCardBack size="md" className="absolute top-1 left-1 opacity-60" />
        <NunoCardBack size="md" className="relative" />
      </div>
      <span className="text-xs text-muted-foreground">37 left</span>
    </div>
  );
}
