"use client";

import { ChipaeLogo } from "@/components/chipae-logo";
import { Button } from "@/components/ui/button";

export default function PlatformError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <ChipaeLogo size={88} priority className="opacity-70" />
      <h1 className="font-heading text-2xl text-foreground">
        The table wobbled
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Something went wrong on our side. Your seat and your crew are safe —
        try that again.
      </p>
      <Button onClick={reset}>Retry</Button>
    </main>
  );
}
