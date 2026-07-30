import Image from "next/image";
import type { GameDefinition } from "@/lib/game/catalog";
import { cn } from "@/lib/utils";

/**
 * The cover-art face every game card shares (home shelf, lobby shelf):
 * cover as background, legibility gradient, logo + name + caption on top.
 * The interactive wrapper (Link, button, disabled state) is the caller's.
 */
export function GameCover({
  game,
  caption,
  className,
  dimmed = false,
}: {
  game: GameDefinition;
  /** Small line under the name — tagline, player range, fit warning… */
  caption?: React.ReactNode;
  className?: string;
  dimmed?: boolean;
}) {
  return (
    <span
      className={cn(
        "relative flex w-full flex-col justify-end overflow-hidden rounded-2xl bg-card",
        dimmed && "grayscale",
        className
      )}
      style={
        game.cover
          ? {
              backgroundImage: `url(${game.cover})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      <span
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, color-mix(in srgb, var(--cover-scrim) 88%, transparent) 0%, color-mix(in srgb, var(--cover-scrim) 35%, transparent) 55%, color-mix(in srgb, var(--cover-scrim) 5%, transparent) 100%)",
        }}
      />
      <span className="relative flex flex-col items-start gap-0.5 p-3 text-left">
        {game.logo && (
          <Image
            src={game.logo}
            alt=""
            width={96}
            height={96}
            unoptimized
            className="mb-1 h-9 w-auto drop-shadow-md"
          />
        )}
        <span className="font-heading text-sm text-white drop-shadow-sm">
          {game.name}
        </span>
        {caption}
      </span>
    </span>
  );
}
