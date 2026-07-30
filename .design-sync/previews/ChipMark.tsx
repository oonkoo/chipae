import { ChipMark } from "chipae";

/**
 * The signature motif — a gold chip with a notched ring. Used where the brand
 * or a seat is represented, nowhere else (design/art-direction.md).
 */

export function Default() {
  return <ChipMark />;
}

export function Sizes() {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <ChipMark className="size-6" />
      <ChipMark className="size-10" />
      <ChipMark className="size-16" />
      <ChipMark className="size-24" />
    </div>
  );
}

export function Lockup() {
  return (
    <div className="flex items-center gap-3">
      <ChipMark className="size-9" />
      <div className="flex flex-col">
        <span className="font-heading text-xl leading-none">Chipae</span>
        <span className="text-xs text-muted-foreground">
          game night, anywhere
        </span>
      </div>
    </div>
  );
}
