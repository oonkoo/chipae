"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { sendLobbyChat } from "@/lib/actions/lobbies";
import { AvatarChip } from "@/components/avatar-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ChatMessage = {
  id: string;
  username: string;
  avatarId: string;
  text: string;
  sentAt: string;
};

/** Ephemeral table talk — messages live only while you're seated. */
export function LobbyChat({
  lobbyId,
  messages,
}: {
  lobbyId: string;
  messages: ChatMessage[];
}) {
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

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
    <aside className="flex h-[420px] flex-col rounded-2xl bg-card lg:h-auto">
      <p className="border-b border-border px-4 py-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Table talk
      </p>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="pt-8 text-center text-xs text-muted-foreground">
            Quiet table. Say hi — messages vanish when the lobby closes.
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
          aria-label="Chat message"
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />
        <Button
          size="sm"
          variant="secondary"
          disabled={pending || !draft.trim()}
          onClick={send}
        >
          Send
        </Button>
      </div>
    </aside>
  );
}
