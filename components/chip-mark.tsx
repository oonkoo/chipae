import { cn } from "@/lib/utils";

/**
 * The Chipae logo mark: a gold game chip with a notched ring.
 * Signature motif — use where the brand or a "seat" is represented
 * (see design/art-direction.md).
 */
export function ChipMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={cn("size-16", className)}
    >
      <circle cx="50" cy="50" r="48" className="fill-primary" />
      <circle
        cx="50"
        cy="50"
        r="39"
        fill="none"
        strokeWidth="7"
        strokeDasharray="12.25 8.16"
        strokeLinecap="butt"
        className="stroke-primary-foreground/50"
      />
      <circle cx="50" cy="50" r="27" className="fill-primary-foreground/15" />
      <circle cx="50" cy="50" r="10" className="fill-primary-foreground/40" />
    </svg>
  );
}
