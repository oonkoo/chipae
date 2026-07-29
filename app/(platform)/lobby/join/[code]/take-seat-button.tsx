"use client";

import { useState, useTransition } from "react";
import { joinLobbyByCode } from "@/lib/actions/lobbies";
import { Button } from "@/components/ui/button";

export function TakeSeatButton({
  code,
  full,
}: {
  code: string;
  full: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        size="lg"
        disabled={pending || full}
        onClick={() =>
          startTransition(async () => {
            const result = await joinLobbyByCode(code);
            if (result && !result.ok) setError(result.error);
          })
        }
      >
        {full ? "Table's full" : pending ? "Pulling up a chair…" : "Take this seat"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
