"use client";

import { useState, useTransition } from "react";
import { joinLobbyByCode, joinPublicLobby } from "@/lib/actions/lobbies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function JoinByCode() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function join() {
    setError(null);
    startTransition(async () => {
      const result = await joinLobbyByCode(code);
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <div className="mt-auto flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={6}
          placeholder="K4Q7NX"
          className="font-mono tracking-[0.3em] uppercase"
          aria-label="Lobby code"
          onKeyDown={(e) => {
            if (e.key === "Enter" && code.length === 6) join();
          }}
        />
        <Button
          variant="secondary"
          disabled={pending || code.length !== 6}
          onClick={join}
        >
          {pending ? "…" : "Join"}
        </Button>
      </div>
      <p className="min-h-4 text-xs text-destructive">{error}</p>
    </div>
  );
}

export function JoinPublicButton({
  lobbyId,
  full,
}: {
  lobbyId: string;
  full: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <span className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="secondary"
        disabled={pending || full}
        onClick={() =>
          startTransition(async () => {
            const result = await joinPublicLobby(lobbyId);
            if (result && !result.ok) setError(result.error);
          })
        }
      >
        {full ? "Full" : pending ? "…" : "Take a seat"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  );
}
