import { ChipMark } from "@/components/chip-mark";

export default function PlatformLoading() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24">
      <ChipMark className="size-10 motion-safe:animate-spin [animation-duration:2.5s]" />
      <p className="text-xs text-muted-foreground">Shuffling…</p>
    </div>
  );
}
