"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RiDoorOpenLine } from "@remixicon/react";
import { quitGame, sendGameChat } from "@/lib/actions/games";
import {
  GameOverModal,
  type GameStanding,
} from "@/components/game/game-over-modal";
import { useLobbyChannel } from "@/lib/realtime/client";
import type { LobbyEvent } from "@/lib/realtime/events";
import { AvatarChip } from "@/components/avatar-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ChatMessage } from "../lobby-chat";
import { GameBoard } from "@/components/game/boards";
import type { BoardMember } from "@/components/game/types";

/**
 * Full-screen game surface: the board shares the stage with the game's own
 * chat (which vanishes when the game ends). Quitting eliminates you from
 * the hand but keeps your lobby seat; remaining humans play on.
 *
 * Game-agnostic by design (ADR-0004/0005) — the standings and the winner
 * are computed server-side by the game's module, so this shell never reads
 * game state.
 */
export function GameScreen({
  lobbyId,
  gameType,
  gameName,
  gameLogo,
  view,
  members,
  hostId,
  yourMemberId,
  winnerId,
  standings,
  youEliminated,
  initialMessages,
}: {
  lobbyId: string;
  gameType: string;
  gameName: string;
  gameLogo?: string | null;
  /** The module's per-viewer projection; only the board reads it. */
  view: unknown;
  members: BoardMember[];
  hostId: string;
  yourMemberId: string | null;
  winnerId: string | null;
  /** Finishing order, winner first, already decorated with identities. */
  standings: GameStanding[];
  youEliminated: boolean;
  initialMessages: ChatMessage[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [chatPending, startChat] = useTransition();
  const [quitPending, startQuit] = useTransition();
  const [confirmQuit, setConfirmQuit] = useState(false);
  // Dismissing keeps you on the finished table instead of bouncing out.
  const [resultDismissed, setResultDismissed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const onEvent = useCallback(
    (event: LobbyEvent) => {
      if (event.type === "chat-message") {
        if (event.scope !== "game") return; // lounge chat lives elsewhere
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
  useLobbyChannel(lobbyId, onEvent);

  // No auto-redirect: the hand stays on screen behind the result modal
  // until the player decides to leave.

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  function send() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    startChat(async () => {
      await sendGameChat(lobbyId, text);
    });
  }

  return (
    // Exactly the screen under the app bar — the shell's sticky header is
    // h-14 plus a 1px border (app/(platform)/layout.tsx), so the page itself
    // never scrolls. Only the chat scrolls. Below `lg` everything stacks and
    // this surface scrolls inside itself instead — still never the page.
    <main className="h-[calc(100dvh-3.5rem-1px)] w-full overflow-y-auto px-4 py-3 sm:px-6 lg:overflow-hidden">
      {/* The stage. On `lg` and up: the board fills the left two-thirds at
          full height, and the right third is a column — the game bar on top,
          the chat under it. Below `lg`: game bar, then a board as tall as the
          screen, then the chat at 420px — so Quit is never below the fold. */}
      <div className="grid h-full min-h-0 grid-rows-[auto_calc(100%-3rem)_420px] gap-3 lg:grid-cols-3 lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-x-4">
        {/* Game bar */}
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 lg:col-start-3 lg:row-start-1">
          <h1 className="font-heading text-xl text-foreground">{gameName}</h1>
          {youEliminated && (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
              You&apos;re out — the hand plays on
            </span>
          )}
          <span className="ml-auto" />
          {youEliminated ? (
            <Button
              variant="secondary"
              size="sm"
              nativeButton={false}
              render={
                <Link href={`/lobby/${lobbyId}`}>
                  <RiDoorOpenLine data-icon="inline-start" />
                  Back to lobby
                </Link>
              }
            />
          ) : confirmQuit ? (
            <span className="flex flex-wrap items-center justify-end gap-2">
              <span className="text-xs text-muted-foreground">
                Quit and sit this one out?
              </span>
              <Button
                variant="destructive"
                size="sm"
                disabled={quitPending}
                onClick={() =>
                  startQuit(async () => {
                    await quitGame(lobbyId);
                    router.push(`/lobby/${lobbyId}`);
                  })
                }
              >
                {quitPending ? "…" : "Quit game"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmQuit(false)}
              >
                Keep playing
              </Button>
            </span>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmQuit(true)}
            >
              Quit game
            </Button>
          )}
        </div>

        {/* The board: the full height of the stage. Every board fills its
            cell (`h-full`). */}
        <div className="min-h-0 min-w-0 lg:col-span-2 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <GameBoard
            gameType={gameType}
            lobbyId={lobbyId}
            view={view}
            members={members}
            hostId={hostId}
          />
        </div>

        {/* Game chat — vanishes when the game ends. Long chats scroll here,
            never the page. */}
        <aside className="flex min-h-0 flex-col rounded-2xl bg-card lg:col-start-3 lg:row-start-2">
          <p className="shrink-0 border-b border-border px-4 py-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Game chat
          </p>
          <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <p className="pt-8 text-center text-xs text-muted-foreground">
                Trash talk lives here — and vanishes with the game.
              </p>
            ) : (
              messages.map((message) => (
                <div key={message.id} className="flex items-start gap-2">
                  <AvatarChip
                    avatarId={message.avatarId}
                    className="size-6"
                    ring={false}
                  />
                  <div className="min-w-0">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      @{message.username}
                    </span>
                    <p className="text-sm break-words text-foreground">
                      {message.text}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="flex shrink-0 gap-2 border-t border-border p-3">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={300}
              placeholder="Say something…"
              aria-label="Game chat message"
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={chatPending || !draft.trim()}
              onClick={send}
            >
              Send
            </Button>
          </div>
        </aside>
      </div>

      {/* The hand stays visible behind this — nothing closes on its own. */}
      <GameOverModal
        open={!!winnerId && !resultDismissed}
        gameName={gameName}
        gameLogo={gameLogo}
        standings={standings}
        youId={yourMemberId}
        onClose={() => {
          setResultDismissed(true);
          router.push(`/lobby/${lobbyId}`);
        }}
      />
    </main>
  );
}
