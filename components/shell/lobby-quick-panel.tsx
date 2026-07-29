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
import {
  RiCheckLine,
  RiDoorOpenLine,
  RiFileCopyLine,
  RiPlayLine,
  RiRobot2Line,
  RiUserAddLine,
} from "@remixicon/react";
import {
  createLobby,
  inviteFriendToLobby,
  sendLobbyChat,
} from "@/lib/actions/lobbies";
import { useLobbyChannel } from "@/lib/realtime/client";
import type { LobbyEvent } from "@/lib/realtime/events";
import type { ChatMessage } from "@/app/(platform)/lobby/[id]/lobby-chat";
import { JoinByCode } from "@/app/(platform)/lobbies/join-controls";
import { AvatarChip } from "@/components/avatar-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type PanelFriend = {
  id: string;
  username: string;
  displayName: string | null;
  avatarId: string;
};

type SeatedMember = {
  seat: number;
  isBot: boolean;
  botName: string | null;
  userId: string | null;
  username: string | null;
  displayName: string | null;
  avatarId: string | null;
};

export type ActiveLobbySummary = {
  lobbyId: string;
  name: string;
  code: string;
  maxPlayers: number;
  members: SeatedMember[];
};

/** The code pill copies itself — one control instead of pill + button. */
function CopyCodePill({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title="Copy lobby code"
      onClick={() => {
        void navigator.clipboard.writeText(code).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-background/60 px-2 py-1 font-mono text-xs tracking-[0.25em] text-primary transition-colors hover:bg-background"
    >
      {code}
      {copied ? (
        <RiCheckLine className="size-3.5 text-success" />
      ) : (
        <RiFileCopyLine className="size-3.5 opacity-60" />
      )}
    </button>
  );
}

/** Who's at the table: filled avatar chips plus dashed open seats. */
function SeatRow({
  members,
  maxPlayers,
}: {
  members: SeatedMember[];
  maxPlayers: number;
}) {
  const slots = Array.from(
    { length: maxPlayers },
    (_, i) => members.find((m) => m.seat === i + 1) ?? null
  );

  return (
    <ul className="grid grid-cols-4 gap-x-1 gap-y-2">
      {slots.map((member, i) => (
        <li key={i} className="flex min-w-0 flex-col items-center gap-1">
          {member ? (
            member.isBot || !member.avatarId ? (
              <span className="flex size-10 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/40 bg-muted/40 text-muted-foreground">
                <RiRobot2Line className="size-4.5" />
              </span>
            ) : (
              <AvatarChip avatarId={member.avatarId} className="size-10" />
            )
          ) : (
            <span className="flex size-10 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30 text-base text-muted-foreground/50">
              +
            </span>
          )}
          <span
            className={cn(
              "w-full truncate text-center text-[9px] leading-tight",
              member ? "text-muted-foreground" : "text-muted-foreground/50"
            )}
          >
            {member
              ? member.isBot
                ? (member.botName ?? "CPU")
                : member.displayName?.split(" ")[0] ||
                  (member.username ? `@${member.username}` : "Player")
              : "Open"}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Invite moved into a popover so the card stays quiet until needed. */
function InvitePopover({
  lobbyId,
  friends,
}: {
  lobbyId: string;
  friends: PanelFriend[];
}) {
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            size="sm"
            variant="secondary"
            disabled={friends.length === 0}
            title={
              friends.length === 0
                ? "Your whole crew is already seated"
                : undefined
            }
          >
            <RiUserAddLine data-icon="inline-start" />
            Invite
          </Button>
        }
      />
      <PopoverContent align="end" className="w-60 p-2">
        <p className="px-2 py-1.5 font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
          Deal someone in
        </p>
        <ul className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
          {friends.map((friend) => (
            <li
              key={friend.id}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5"
            >
              <AvatarChip avatarId={friend.avatarId} className="size-7" />
              <span className="truncate text-xs">
                {friend.displayName || `@${friend.username}`}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto h-7 px-2.5 text-xs"
                disabled={invited.has(friend.id)}
                onClick={() =>
                  startTransition(async () => {
                    const result = await inviteFriendToLobby(
                      lobbyId,
                      friend.id
                    );
                    if (result.ok) {
                      setInvited((prev) => new Set(prev).add(friend.id));
                    } else {
                      setError(result.error);
                    }
                  })
                }
              >
                {invited.has(friend.id) ? "Sent" : "Invite"}
              </Button>
            </li>
          ))}
        </ul>
        {error && <p className="px-2 py-1 text-xs text-destructive">{error}</p>}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Compact lobby chat for the rail. Same persisted history as the room's
 * Table talk — seeded from LobbyMessage, live events append (deduped by id
 * since the seed and the event can both carry a message). Non-chat events
 * refresh server data so the seat row above stays live.
 */
function RailChat({
  lobbyId,
  initialMessages,
}: {
  lobbyId: string;
  initialMessages: ChatMessage[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  const onEvent = useCallback(
    (event: LobbyEvent) => {
      if (event.type === "chat-message") {
        if (event.scope === "game") return; // game chat stays in the game
        setMessages((prev) =>
          prev.some((m) => m.id === event.id)
            ? prev
            : [...prev.slice(-49), event]
        );
      } else {
        router.refresh();
      }
    },
    [router]
  );
  useLobbyChannel(lobbyId, onEvent);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  function send() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    startTransition(async () => {
      await sendLobbyChat(lobbyId, text);
    });
  }

  return (
    <div className="flex flex-col gap-2 border-t border-primary/20 pt-3">
      <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
        Lobby chat
      </p>
      <div ref={scrollRef} className="max-h-44 space-y-2 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="py-2 text-center text-[11px] text-muted-foreground">
            Quiet lobby — say hi.
          </p>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="flex items-start gap-1.5">
              <AvatarChip
                avatarId={message.avatarId}
                className="size-5 shrink-0"
                ring={false}
              />
              <p className="min-w-0 text-xs leading-snug break-words text-foreground">
                <span className="font-mono text-[10px] text-muted-foreground">
                  @{message.username}
                </span>{" "}
                {message.text}
              </p>
            </div>
          ))
        )}
      </div>
      <div className="flex gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={300}
          placeholder="Say something…"
          aria-label="Lobby chat message"
          className="h-8 text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />
        <Button
          size="sm"
          variant="secondary"
          className="h-8 px-2.5"
          disabled={pending || !draft.trim()}
          onClick={send}
        >
          Send
        </Button>
      </div>
    </div>
  );
}

/**
 * Top card of the crew rail. Seated: the lobby at a glance — name, self-copy
 * code, seat grid of who's at the table, enter/invite/start, chat. Not
 * seated: quick setup — one-tap create or join by code (defaults come from
 * the server action: private, default seats).
 */
export function LobbyQuickPanel({
  active,
  friends,
  initialMessages,
}: {
  active: ActiveLobbySummary | null;
  friends: PanelFriend[];
  initialMessages: ChatMessage[];
}) {
  if (!active) {
    return (
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card/60 p-4">
        <div>
          <h2 className="font-heading text-sm text-foreground">Quick setup</h2>
          <p className="text-xs text-muted-foreground">
            Open a lobby and start dealing seats.
          </p>
        </div>
        <form action={createLobby} className="flex flex-col gap-2">
          <Input
            name="name"
            maxLength={40}
            placeholder="Lobby name (optional)"
            aria-label="Lobby name"
          />
          <Button type="submit" size="sm">
            <RiPlayLine data-icon="inline-start" />
            Open a lobby
          </Button>
        </form>
        <p className="text-center font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
          or join with a code
        </p>
        <JoinByCode />
      </section>
    );
  }

  const invitable = friends.filter(
    (f) => !active.members.some((m) => m.userId === f.id)
  );

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-primary/25 bg-primary/5 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[10px] tracking-[0.2em] text-primary uppercase">
            Your lobby
          </p>
          <h2 className="truncate font-heading text-base text-foreground">
            {active.name}
          </h2>
        </div>
        <CopyCodePill code={active.code} />
      </div>

      <SeatRow members={active.members} maxPlayers={active.maxPlayers} />

      <div className="flex flex-col gap-2">
        <Button
          size="sm"
          nativeButton={false}
          render={
            <Link href={`/lobby/${active.lobbyId}`}>
              <RiDoorOpenLine data-icon="inline-start" />
              Enter lobby
            </Link>
          }
        />
        <div className="grid grid-cols-2 gap-2">
          <InvitePopover lobbyId={active.lobbyId} friends={invitable} />
          <Button
            size="sm"
            variant="ghost"
            nativeButton={false}
            title="Deal Nuno from inside the lobby"
            render={
              <Link href={`/lobby/${active.lobbyId}`}>
                <RiPlayLine data-icon="inline-start" />
                Start game
              </Link>
            }
          />
        </div>
      </div>

      <RailChat lobbyId={active.lobbyId} initialMessages={initialMessages} />
    </section>
  );
}
