import { ChipaeLogo } from "@/components/chipae-logo";

/**
 * Route loader. The old mark was a disc, so spinning it read fine; the logo
 * is a wordmark, and spinning text does not. It breathes instead, over a
 * pulsing glow in the logo's own purple (--game). Both stop under
 * prefers-reduced-motion, leaving a legible static mark.
 */
export default function PlatformLoading() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24">
      <div className="relative flex items-center justify-center">
        <span
          aria-hidden
          className="absolute size-28 rounded-full bg-[var(--game)] opacity-25 blur-3xl motion-safe:animate-pulse"
        />
        {/* priority, not lazy: this only renders while a route resolves, and
            a lazy image would leave an empty box for exactly that window. */}
        <ChipaeLogo
          size={72}
          priority
          className="relative motion-safe:animate-breathe"
        />
      </div>
      <p className="text-xs text-muted-foreground">Shuffling…</p>
    </div>
  );
}
