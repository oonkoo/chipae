"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { searchPlayers } from "@/lib/actions/friends";
import { AvatarChip } from "@/components/avatar-chip";
import {
  FriendActionButton,
  type RelationshipKind,
} from "@/components/friend-action-button";
import { Input } from "@/components/ui/input";

type Result = {
  id: string;
  username: string;
  displayName: string | null;
  avatarId: string;
  relationship: RelationshipKind;
  friendshipId: string | null;
};

export function FriendSearch({ initialQuery }: { initialQuery?: string }) {
  const [results, setResults] = useState<Result[] | null>(null);
  const [searching, startSearch] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Run a search handed over from the top-bar search box immediately.
  useEffect(() => {
    const query = initialQuery?.trim();
    if (query && query.length >= 2) {
      startSearch(async () => {
        setResults((await searchPlayers(query)) as Result[]);
      });
    }
  }, [initialQuery]);

  function onChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const query = value.trim();
    if (query.length < 2) {
      setResults(null);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startSearch(async () => {
        setResults((await searchPlayers(query)) as Result[]);
      });
    }, 350);
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder="Find players by username or name…"
        defaultValue={initialQuery ?? ""}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Search players"
      />
      {searching && (
        <p className="text-xs text-muted-foreground">Searching the tables…</p>
      )}
      {results !== null && !searching && (
        <ul className="flex flex-col gap-1">
          {results.length === 0 && (
            <li className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              Nobody by that name at any table.
            </li>
          )}
          {results.map((player) => (
            <li
              key={player.id}
              className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50"
            >
              <AvatarChip avatarId={player.avatarId} className="size-10" />
              <Link
                href={`/player/${player.username}`}
                className="flex min-w-0 flex-col"
              >
                <span className="truncate text-sm font-medium text-foreground">
                  {player.displayName || `@${player.username}`}
                </span>
                <span className="truncate font-mono text-xs text-muted-foreground">
                  @{player.username}
                </span>
              </Link>
              <span className="ml-auto">
                <FriendActionButton
                  userId={player.id}
                  relationship={player.relationship}
                  friendshipId={player.friendshipId}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
