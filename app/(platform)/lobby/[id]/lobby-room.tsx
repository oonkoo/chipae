"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RiCloseLine,
  RiFileCopyLine,
  RiRobot2Line,
  RiSettings3Line,
  RiTrophyLine,
  RiUserAddLine,
  RiVipCrownFill,
} from "@remixicon/react";
import {
  addBot,
  inviteFriendToLobby,
  kickMember,
  leaveLobby,
  toggleReady,
  updateLobbySettings,
} from "@/lib/actions/lobbies";
import { LOBBY_LIMITS } from "@/lib/lobby-rules";
import { fillSeatsWithBots, startGame } from "@/lib/actions/games";
import { GAME_CATALOG, getGame } from "@/lib/game/catalog";
import type { Standing } from "@/lib/game/module";
import { useLobbyChannel } from "@/lib/realtime/client";
import type { LobbyEvent } from "@/lib/realtime/events";
import { AvatarChip } from "@/components/avatar-chip";
import { GameCover } from "@/components/game-cover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { LobbyChat, type ChatMessage } from "./lobby-chat";

export type LobbyView = {
  id: string;
  code: string;
  name: string;
  hostId: string;
  visibility: "PUBLIC" | "PRIVATE";
  status: "OPEN" | "IN_GAME" | "CLOSED";
  maxPlayers: number;
  /** What this table is playing, once a game has been dealt. */
  gameType: string | null;
  members: Array<{
    id: string;
    userId: string | null;
    isBot: boolean;
    botName: string | null;
    botDifficulty: "EASY" | "NORMAL" | "HARD" | null;
    seat: number;
    ready: boolean;
    username: string | null;
    displayName: string | null;
    avatarId: string | null;
  }>;
};

type Friend = {
  id: string;
  username: string;
  displayName: string | null;
  avatarId: string;
};

/**
 * What the room knows about the table's game — deliberately not the game
 * itself. The standings come from the game's own module (ADR-0005), so this
 * shape is the same whichever game was played.
 */
export type GameView = {
  active: boolean;
  /** Finishing order while over; current order while live. */
  standings: Standing[];
  youEliminated: boolean;
} | null;

/** A finished game at this table, with the lineup frozen at the time. */
export type LobbyHistoryEntry = {
  id: string;
  gameName: string;
  gameLogo: string | null;
  winnerName: string;
  winnerAvatarId: string;
  playedAt: string;
  players: Array<{ name: string; avatarId: string | null; isBot: boolean }>;
};

export function LobbyRoom({
  lobby,
  viewerId,
  invitableFriends,
  initialMessages,
  game,
  history,
}: {
  lobby: LobbyView;
  viewerId: string;
  invitableFriends: Friend[];
  initialMessages: ChatMessage[];
  game: GameView;
  history: LobbyHistoryEntry[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [gameError, setGameError] = useState<string | null>(null);

  const isHost = lobby.hostId === viewerId;
  const me = lobby.members.find((m) => m.userId === viewerId);
  const everyoneReady =
    lobby.members.length >= 2 && lobby.members.every((m) => m.ready);

  const inGame = lobby.status === "IN_GAME" && game?.active === true;
  // What is actually on this table — not "the first game on the shelf", which
  // was only ever right while Nuno shipped alone.
  const liveGame = lobby.gameType ? getGame(lobby.gameType) : null;
  const eliminatedFromGame = (inGame && me && game.youEliminated) ?? false;

  // Games are full screen — seated players get pulled in automatically
  // unless they already quit this hand.
  useEffect(() => {
    if (inGame && me && !eliminatedFromGame) {
      router.replace(`/lobby/${lobby.id}/game`);
    }
  }, [inGame, eliminatedFromGame, me, lobby.id, router]);

  const lastHand =
    !inGame && game && !game.active && game.standings.length > 0
      ? game.standings
      : null;
  const openSeats = lobby.maxPlayers - lobby.members.length;

  function labelForMemberId(memberId: string) {
    const member = lobby.members.find((m) => m.id === memberId);
    if (!member) return "a departed player";
    return member.isBot
      ? (member.botName ?? "CPU")
      : member.displayName || `@${member.username}`;
  }

  // Chat: seeded from the DB, live events append. The sender's own message
  // arrives both in the seed (after refresh) and as an event — dedupe by id.
  const onEvent = useCallback(
    (event: LobbyEvent) => {
      if (event.type === "chat-message") {
        if (event.scope === "game") return; // game chat renders in-game only
        setMessages((prev) =>
          prev.some((m) => m.id === event.id)
            ? prev
            : [...prev.slice(-99), event]
        );
      } else if (event.type === "lobby-closed") {
        router.push("/lobbies");
      } else {
        router.refresh();
      }
    },
    [router]
  );
  useLobbyChannel(lobby.id, onEvent);

  function copyCode() {
    void navigator.clipboard.writeText(lobby.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  // Never fewer slots than there are occupied seats — a member outside the
  // configured max (sparse seating) must still be visible and kickable.
  const seatCount = Math.max(
    lobby.maxPlayers,
    ...lobby.members.map((m) => m.seat),
    1
  );
  const seats = Array.from({ length: seatCount }, (_, i) => {
    const seatNo = i + 1;
    return {
      seatNo,
      member: lobby.members.find((m) => m.seat === seatNo) ?? null,
    };
  });

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-10">
      {/* Table header */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-col">
          <h1 className="font-heading text-2xl text-foreground">
            {lobby.name}
          </h1>
          <p className="text-xs text-muted-foreground">
            {lobby.visibility === "PUBLIC" ? "Public lobby" : "Private lobby"} ·{" "}
            {lobby.members.length}/{lobby.maxPlayers} seated
          </p>
        </div>
        <button
          onClick={copyCode}
          className="ml-auto flex items-center gap-2 rounded-xl border border-dashed border-primary/50 bg-primary/5 px-4 py-2 font-mono text-lg tracking-[0.3em] text-primary transition-colors hover:bg-primary/10"
          title="Copy lobby code"
        >
          {lobby.code}
          <RiFileCopyLine className="size-4 opacity-70" />
        </button>
        {copied && <span className="text-xs text-success">copied</span>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          {/* A live game plays full screen — this is the doorway. */}
          {inGame && (
            <div className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4">
              <span className="size-2.5 animate-pulse rounded-full bg-primary" />
              <span className="text-sm font-medium text-foreground">
                {liveGame?.name ?? "A game"} in progress
              </span>
              <span className="ml-auto">
                <Button
                  size="sm"
                  nativeButton={false}
                  render={
                    <Link href={`/lobby/${lobby.id}/game`}>
                      {eliminatedFromGame ? "Watch" : "Enter game"}
                    </Link>
                  }
                />
              </span>
            </div>
          )}

          {/* Seats */}
          {!inGame && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {seats.map(({ seatNo, member }) => (
              <li
                key={seatNo}
                className={cn(
                  "relative flex flex-col items-center gap-2 rounded-2xl border p-4",
                  member
                    ? "border-transparent bg-card"
                    : "border-dashed border-border"
                )}
              >
                {member ? (
                  <>
                    {member.isBot ? (
                      <span
                        className="relative inline-flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"
                        title={`CPU · ${member.botDifficulty?.toLowerCase()}`}
                      >
                        <span className="absolute inset-[9%] rounded-full border-2 border-dashed border-muted-foreground/40" />
                        <RiRobot2Line className="size-5" />
                      </span>
                    ) : (
                      <AvatarChip
                        avatarId={member.avatarId ?? "chip-gold"}
                        seat={member.seat}
                        className="size-12"
                      />
                    )}
                    <span className="flex items-center gap-1 text-sm font-medium">
                      {lobby.hostId === member.userId && (
                        <RiVipCrownFill className="size-3.5 text-primary" />
                      )}
                      <span className="max-w-24 truncate">
                        {member.isBot
                          ? member.botName
                          : member.displayName || `@${member.username}`}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                        member.ready
                          ? "bg-success/15 text-success"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {member.ready ? "ready" : "not ready"}
                    </span>
                    {isHost && member.userId !== viewerId && (
                      <button
                        aria-label={`Remove ${member.isBot ? member.botName : member.username}`}
                        className="absolute top-2 right-2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                        onClick={() =>
                          startTransition(async () => {
                            await kickMember(lobby.id, member.id);
                            router.refresh();
                          })
                        }
                      >
                        <RiCloseLine className="size-4" />
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <span className="inline-flex size-12 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30" />
                    <span className="text-xs text-muted-foreground">
                      Open seat
                    </span>
                    {isHost && (
                      <Button
                        size="xs"
                        variant="ghost"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            await addBot(lobby.id, "NORMAL");
                            router.refresh();
                          })
                        }
                      >
                        + CPU
                      </Button>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
          )}

          {/* Game shelf — the host picks what this group plays next. */}
          {!inGame && (
            <section className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-medium text-foreground">
                  Pick a game
                </h2>
                <span className="text-xs text-muted-foreground">
                  {isHost
                    ? everyoneReady
                      ? "Everyone's ready — deal one"
                      : "Everyone needs to be ready"
                    : "The host starts the game"}
                </span>
              </div>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {GAME_CATALOG.map((game) => {
                  const seated = lobby.members.length;
                  const fits =
                    seated >= game.minPlayers && seated <= game.maxPlayers;
                  const startable =
                    game.available &&
                    isHost &&
                    everyoneReady &&
                    fits &&
                    !pending;
                  const reason = !fits
                    ? seated < game.minPlayers
                      ? `Needs at least ${game.minPlayers} players`
                      : `Seats at most ${game.maxPlayers} — trim the table`
                    : isHost
                      ? everyoneReady
                        ? `Start ${game.name}`
                        : "Everyone needs to be ready"
                      : "The host starts the game";
                  return (
                    <li key={game.id}>
                      {game.available ? (
                        <button
                          type="button"
                          disabled={!startable}
                          title={reason}
                          onClick={() =>
                            startTransition(async () => {
                              setGameError(null);
                              const result = await startGame(
                                lobby.id,
                                game.id
                              );
                              if (!result.ok) {
                                setGameError(result.error);
                                router.refresh();
                              } else {
                                router.push(`/lobby/${lobby.id}/game`);
                              }
                            })
                          }
                          className={cn(
                            "block w-full overflow-hidden rounded-2xl border border-primary/30 transition-colors",
                            startable
                              ? "cursor-pointer hover:border-primary/70"
                              : "opacity-70"
                          )}
                        >
                          <GameCover
                            game={game}
                            className="aspect-[16/10]"
                            caption={
                              <>
                                <span
                                  className={cn(
                                    "font-mono text-[10px] tracking-widest uppercase",
                                    fits ? "text-primary" : "text-destructive"
                                  )}
                                >
                                  {game.minPlayers}–{game.maxPlayers} players
                                </span>
                                {!fits && (
                                  <span className="text-[10px] text-destructive">
                                    {seated < game.minPlayers
                                      ? "need more players"
                                      : "too many seats"}
                                  </span>
                                )}
                              </>
                            }
                          />
                        </button>
                      ) : (
                        <div className="overflow-hidden rounded-2xl border border-dashed border-border opacity-60">
                          <GameCover
                            game={game}
                            dimmed
                            className="aspect-[16/10]"
                            caption={
                              <span className="text-[10px] text-white/60">
                                coming soon
                              </span>
                            }
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Last hand result */}
          {lastHand && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-success/30 bg-success/10 px-4 py-2.5 text-sm text-foreground">
              <span className="flex items-center gap-2">
                <RiTrophyLine className="size-4.5 shrink-0 text-success" />
                {labelForMemberId(lastHand[0].memberId)} won the hand
              </span>
              <span className="text-xs text-muted-foreground">
                {lastHand
                  .slice(1)
                  .map(
                    (p, i) =>
                      `${i + 2}. ${labelForMemberId(p.memberId)}${
                        p.detail ? ` (${p.detail})` : ""
                      }`
                  )
                  .join(" · ")}
              </span>
            </div>
          )}

          {/* What this table has played */}
          {!inGame && history.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-foreground">
                Table history
              </h2>
              <ul className="flex flex-col gap-1">
                {history.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-card px-3 py-2"
                  >
                    {entry.gameLogo ? (
                      <Image
                        src={entry.gameLogo}
                        alt=""
                        width={48}
                        height={48}
                        className="h-6 w-auto shrink-0"
                      />
                    ) : (
                      <RiTrophyLine className="size-4 shrink-0 text-primary" />
                    )}
                    <span className="flex items-center gap-1.5 text-sm">
                      <AvatarChip
                        avatarId={entry.winnerAvatarId}
                        className="size-6"
                      />
                      <span className="font-medium text-foreground">
                        {entry.winnerName}
                      </span>
                      <span className="text-muted-foreground">
                        won {entry.gameName}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      with{" "}
                      {entry.players.length > 1
                        ? entry.players
                            .filter((p) => p.name !== entry.winnerName)
                            .map((p) => p.name)
                            .join(", ")
                        : "the table"}
                    </span>
                    <span
                      className="ml-auto text-[11px] text-muted-foreground"
                      suppressHydrationWarning
                    >
                      {new Date(entry.playedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Controls */}
          {inGame ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="ml-auto" />
              <Button
                variant="destructive"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await leaveLobby(lobby.id);
                  })
                }
              >
                Leave lobby
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant={me?.ready ? "outline" : "default"}
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await toggleReady(lobby.id);
                    router.refresh();
                  })
                }
              >
                {me?.ready ? "Not ready" : "I'm ready"}
              </Button>

              {invitableFriends.length > 0 && (
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button variant="secondary">
                        <RiUserAddLine data-icon="inline-start" />
                        Invite friends
                      </Button>
                    }
                  />
                  <PopoverContent className="w-72 p-2">
                    <InviteList lobbyId={lobby.id} friends={invitableFriends} />
                  </PopoverContent>
                </Popover>
              )}

              {isHost && openSeats > 0 && (
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      setGameError(null);
                      const result = await fillSeatsWithBots(lobby.id);
                      if (!result.ok) setGameError(result.error);
                      router.refresh();
                    })
                  }
                >
                  <RiRobot2Line data-icon="inline-start" />
                  Fill with CPUs
                </Button>
              )}

              {isHost && <TableSettings lobby={lobby} />}

              <span className="ml-auto" />
              <Button
                variant="destructive"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await leaveLobby(lobby.id);
                  })
                }
              >
                Leave lobby
              </Button>
            </div>
          )}
          {gameError && (
            <p className="text-xs text-destructive">{gameError}</p>
          )}
        </div>

        {/* Chat */}
        <LobbyChat lobbyId={lobby.id} messages={messages} />
      </div>
    </main>
  );
}

/** Host-only table settings: rename, visibility, and seat count (2–6). */
function TableSettings({
  lobby,
}: {
  lobby: Pick<LobbyView, "id" | "name" | "visibility" | "maxPlayers">;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="secondary">
            <RiSettings3Line data-icon="inline-start" />
            Table
          </Button>
        }
      />
      <PopoverContent className="w-64 p-3">
        <form
          className="flex flex-col gap-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            startTransition(async () => {
              setError(null);
              setSaved(false);
              const result = await updateLobbySettings(lobby.id, formData);
              if (!result.ok) setError(result.error);
              else setSaved(true);
              router.refresh();
            });
          }}
        >
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Lobby name
            <Input
              name="name"
              defaultValue={lobby.name}
              maxLength={40}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Visibility
            <select
              name="visibility"
              defaultValue={lobby.visibility}
              className="h-9 rounded-lg border border-input bg-input/30 px-2 text-sm text-foreground"
            >
              <option value="PRIVATE">Private (code only)</option>
              <option value="PUBLIC">Public (listed)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Seats
            <select
              name="maxPlayers"
              defaultValue={lobby.maxPlayers}
              className="h-9 rounded-lg border border-input bg-input/30 px-2 text-sm text-foreground"
            >
              {Array.from(
                {
                  length:
                    LOBBY_LIMITS.maxPlayers - LOBBY_LIMITS.minPlayers + 1,
                },
                (_, i) => i + LOBBY_LIMITS.minPlayers
              ).map((n) => (
                <option key={n} value={n}>
                  {n} seats
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
          {error && <p className="text-xs text-destructive">{error}</p>}
          {saved && !error && <p className="text-xs text-success">Saved</p>}
        </form>
      </PopoverContent>
    </Popover>
  );
}

function InviteList({
  lobbyId,
  friends,
}: {
  lobbyId: string;
  friends: Friend[];
}) {
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  return (
    <ul className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
      {friends.map((friend) => (
        <li
          key={friend.id}
          className="flex items-center gap-2 rounded-md px-2 py-1.5"
        >
          <AvatarChip avatarId={friend.avatarId} className="size-8" />
          <span className="truncate text-sm">
            {friend.displayName || `@${friend.username}`}
          </span>
          <span className="ml-auto">
            <Button
              size="xs"
              variant="ghost"
              disabled={invited.has(friend.id)}
              onClick={() =>
                startTransition(async () => {
                  const result = await inviteFriendToLobby(lobbyId, friend.id);
                  if (result.ok) {
                    setInvited((prev) => new Set(prev).add(friend.id));
                  }
                })
              }
            >
              {invited.has(friend.id) ? "Invited" : "Invite"}
            </Button>
          </span>
        </li>
      ))}
    </ul>
  );
}
