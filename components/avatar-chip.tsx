import { getAvatar } from "@/lib/avatars";
import { cn } from "@/lib/utils";

/**
 * A player avatar in the chip motif: colored disc + notched ring + glyph.
 *
 * **At a table, always pass `seat`.** Player colours run in seat order and
 * seat 1 is always gold (design/art-direction.md), so the colour has to come
 * from the player's real `LobbyMember.seat` — not from the avatar they picked.
 * Without `seat` two players who chose different avatars of the same hue would
 * render identically at the same table.
 *
 * Off a table (friends, profiles, chat, the picker) there is no seat, so the
 * avatar's own `hue` is used instead. Duplicates are fine there — the glyph
 * still distinguishes them.
 */
export function AvatarChip({
  avatarId,
  seat,
  className,
  ring = true,
}: {
  avatarId: string;
  /** 1-based LobbyMember.seat. Required at a table, omitted everywhere else. */
  seat?: number | null;
  className?: string;
  ring?: boolean;
}) {
  const avatar = getAvatar(avatarId);
  const Icon = avatar.icon;
  const tone = seat ?? avatar.hue;

  return (
    <span
      className={cn(
        "relative inline-flex size-12 shrink-0 items-center justify-center rounded-full text-background",
        className
      )}
      style={{ backgroundColor: `var(--chart-${tone})` }}
      title={avatar.label}
    >
      {ring && (
        <span
          aria-hidden
          className="absolute inset-[9%] rounded-full border-2 border-dashed border-background/40"
        />
      )}
      <Icon className="size-[45%]" aria-hidden />
    </span>
  );
}
