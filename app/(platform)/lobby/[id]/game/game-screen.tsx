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
import type { NunoView } from "@/lib/game/nuno/rules";
import { AvatarChip } from "@/components/avatar-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ChatMessage } from "../lobby-chat";
import { NunoBoard, type BoardMember } from "../nuno-board";

/**
 * Full-screen game surface: the board shares the stage with the game's own
 * chat (which vanishes when the game ends). Quitting eliminates you from
 * the hand but keeps your lobby seat; remaining humans play on.
 */
export function GameScreen({
  lobbyId,
  gameName,
  gameLogo,
  view,
  members,
  hostId,
  initialMessages,
}: {
  lobbyId: string;
  gameName: string;
  gameLogo?: string | null;
  view: NunoView;
  members: BoardMember[];
  hostId: string;
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

  function memberLabel(memberId: string): string {
    const member = members.find((m) => m.id === memberId);
    if (!member) return "A departed player";
    return member.isBot
      ? (member.botName ?? "CPU")
      : member.displayName || `@${member.username}`;
  }

  // Final standings, in the shape the shared modal speaks.
  const standings: GameStanding[] = (
    view.placements ??
    view.players.map((p) => ({
      memberId: p.memberId,
      cardsLeft: p.cardCount,
      eliminated: p.eliminated,
    }))
  ).map((p) => {
    const member = members.find((m) => m.id === p.memberId);
    return {
      id: p.memberId,
      name: memberLabel(p.memberId),
      avatarId: member?.avatarId ?? null,
      isBot: member?.isBot ?? true,
      eliminated: p.eliminated,
      detail: p.eliminated
        ? "quit"
        : p.cardsLeft === 0
          ? "went out"
          : `${p.cardsLeft} ${p.cardsLeft === 1 ? "card" : "cards"} left`,
    };
  });

  const eliminated =
    view.players.find((p) => p.memberId === view.yourMemberId)?.eliminated ??
    false;

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
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-4 sm:px-6">
      {/* Game bar */}
      <div className="flex items-center gap-3">
        <h1 className="font-heading text-xl text-foreground">{gameName}</h1>
        {eliminated && (
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
            You&apos;re out — the hand plays on
          </span>
        )}
        <span className="ml-auto" />
        {eliminated ? (
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
          <span className="flex items-center gap-2">
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

      <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_300px]">
        <NunoBoard
          lobbyId={lobbyId}
          view={view}
          members={members}
          hostId={hostId}
        />

        {/* Game chat — vanishes when the game ends */}
        <aside className="flex h-[420px] flex-col rounded-2xl bg-card lg:h-auto">
          <p className="border-b border-border px-4 py-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Game chat
          </p>
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
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
          <div className="flex gap-2 border-t border-border p-3">
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
        open={!!view.winnerId && !resultDismissed}
        gameName={gameName}
        gameLogo={gameLogo}
        standings={standings}
        youId={view.yourMemberId}
        onClose={() => {
          setResultDismissed(true);
          router.push(`/lobby/${lobbyId}`);
        }}
      />
    </main>
  );
}
