import { getAvatar } from "@/lib/avatars";
import { cn } from "@/lib/utils";

/**
 * A player avatar in the chip motif: colored disc + notched ring + glyph.
 * Seat color comes from the avatar definition (chart-1..5 tokens).
 */
export function AvatarChip({
  avatarId,
  className,
  ring = true,
}: {
  avatarId: string;
  className?: string;
  ring?: boolean;
}) {
  const avatar = getAvatar(avatarId);
  const Icon = avatar.icon;

  return (
    <span
      className={cn(
        "relative inline-flex size-12 shrink-0 items-center justify-center rounded-full text-background",
        className
      )}
      style={{ backgroundColor: `var(--chart-${avatar.seat})` }}
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
