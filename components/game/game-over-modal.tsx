"use client";

import Image from "next/image";
import { RiRobot2Line, RiTrophyLine } from "@remixicon/react";
import { AvatarChip } from "@/components/avatar-chip";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Every game ends the same way: someone won, everyone gets a placement,
// nobody gets yanked out of the room. This modal is deliberately
// game-agnostic — a title, a logo, and a ranked list — so the next game
// reuses it by handing over its own standings (ADR-0004).

export type GameStanding = {
  /** Stable key — member id, user id, whatever the game uses. */
  id: string;
  name: string;
  /** Null for CPU seats, which render the robot mark instead. */
  avatarId: string | null;
  isBot: boolean;
  /** 1-based lobby seat — keeps the player's table colour in the results. */
  seat?: number;
  /** "3 cards left", "12 points" — whatever the game scores on. */
  detail?: string;
  /** Rendered muted, for players who quit or were eliminated. */
  eliminated?: boolean;
};

export function GameOverModal({
  open,
  gameName,
  gameLogo,
  standings,
  youId,
  onPlayAgain,
  playAgainLabel = "Play again",
  playAgainPending = false,
  onClose,
  closeLabel = "Back to lobby",
}: {
  open: boolean;
  gameName: string;
  gameLogo?: string | null;
  /** Winner first, then the rest in finishing order. */
  standings: GameStanding[];
  /** Highlights the viewer's own row. */
  youId?: string | null;
  onPlayAgain?: () => void;
  playAgainLabel?: string;
  playAgainPending?: boolean;
  onClose: () => void;
  closeLabel?: string;
}) {
  const winner = standings[0];
  const youWon = !!winner && !!youId && winner.id === youId;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          {gameLogo && (
            <Image
              src={gameLogo}
              alt=""
              width={96}
              height={95}
              className="h-10 w-auto"
            />
          )}
          <span className="flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary">
            <RiTrophyLine className="size-7" />
          </span>
          <DialogTitle>
            {youWon ? "You win!" : winner ? `${winner.name} wins!` : "Game over"}
          </DialogTitle>
          <DialogDescription>
            {gameName}
            {winner?.detail ? ` · ${winner.detail}` : ""}
          </DialogDescription>
        </DialogHeader>

        <ol className="flex flex-col gap-1">
          {standings.map((player, i) => (
            <li
              key={player.id}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2",
                i === 0 ? "bg-primary/10" : "bg-card/60",
                player.eliminated && "opacity-55"
              )}
            >
              <span
                className={cn(
                  "w-4 shrink-0 text-center font-mono text-xs",
                  i === 0 ? "text-primary" : "text-muted-foreground"
                )}
              >
                {i + 1}
              </span>
              {player.isBot || !player.avatarId ? (
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <RiRobot2Line className="size-4" />
                </span>
              ) : (
                <AvatarChip
                  avatarId={player.avatarId}
                  seat={player.seat}
                  className="size-8"
                />
              )}
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-sm font-medium text-foreground">
                  {player.name}
                  {player.id === youId && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      (you)
                    </span>
                  )}
                </span>
                {player.detail && (
                  <span className="text-[11px] text-muted-foreground">
                    {player.detail}
                  </span>
                )}
              </span>
              {i === 0 && (
                <RiTrophyLine className="ml-auto size-4 shrink-0 text-primary" />
              )}
            </li>
          ))}
        </ol>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {closeLabel}
          </Button>
          {onPlayAgain && (
            <Button onClick={onPlayAgain} disabled={playAgainPending}>
              {playAgainPending ? "Dealing…" : playAgainLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
