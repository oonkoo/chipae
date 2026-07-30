import { AvatarChip } from "chipae";

/**
 * Seat colour comes from the avatar definition (lib/avatars.ts) and maps to
 * chart-1..5 — gold, mint, coral, sky, lavender, in seat order.
 */

export function SeatColors() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <AvatarChip avatarId="chip-gold" />
      <AvatarChip avatarId="ghost-mint" />
      <AvatarChip avatarId="blade-coral" />
      <AvatarChip avatarId="bot-sky" />
      <AvatarChip avatarId="alien-lav" />
    </div>
  );
}

export function Sizes() {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <AvatarChip avatarId="chip-gold" className="size-6" />
      <AvatarChip avatarId="chip-gold" className="size-8" />
      <AvatarChip avatarId="chip-gold" className="size-12" />
      <AvatarChip avatarId="chip-gold" className="size-16" />
    </div>
  );
}

export function WithoutRing() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <AvatarChip avatarId="skull-coral" />
      <AvatarChip avatarId="skull-coral" ring={false} />
    </div>
  );
}

export function SeatRow() {
  return (
    <div className="flex items-center gap-3">
      {[
        ["chip-gold", "chicken"],
        ["ghost-mint", "jenga"],
        ["blade-coral", "nuno"],
      ].map(([id, name]) => (
        <div key={id} className="flex flex-col items-center gap-1.5">
          <AvatarChip avatarId={id} className="size-10" />
          <span className="text-xs text-muted-foreground">{name}</span>
        </div>
      ))}
    </div>
  );
}
