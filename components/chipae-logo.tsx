import { cn } from "@/lib/utils";

/**
 * The Chipae logo — a glossy badge that already contains the wordmark.
 *
 * It replaces the old ChipMark + "Chipae" text lockups: never pair this with
 * the word again or the name renders twice. The artwork stops reading below
 * about 40px, so keep `size` at 44 or above (see design/art-direction.md).
 *
 * Deliberately a plain <img>, not next/image. The optimizer rejects SVG
 * outright ("image type is not allowed", HTTP 400) unless
 * images.dangerouslyAllowSVG is set — and even then it passes SVG through
 * unoptimised. Since chipae_logo.svg is a 1.3MB bitmap wrapped in <image>
 * tags rather than real paths, next/image would add a security flag and buy
 * nothing. Switch src to /chipae_logo.png and restore next/image to get
 * right-sized WebP instead.
 */
export function ChipaeLogo({
  size = 48,
  className,
  priority = false,
}: {
  /** Rendered width in px. */
  size?: number;
  className?: string;
  /** Set on marks that must paint immediately (hero, app shell, loader). */
  priority?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- see note above
    <img
      src="/chipae_logo.svg"
      alt="Chipae"
      width={size}
      height={size}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding={priority ? "sync" : "async"}
      className={cn("shrink-0 select-none", className)}
    />
  );
}
