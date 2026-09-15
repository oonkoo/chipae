"use client";

import type { ComponentType } from "react";
import type { NunoView } from "@/lib/game/nuno/rules";
import type { EmpireView } from "@/lib/game/empire-wars/view";
import { NunoBoard } from "@/components/game/nuno/board";
import { EmpireWarsBoard } from "@/components/game/empire-wars/board";
import type { GameBoardProps } from "@/components/game/types";

// The client half of the game registry (ADR-0005): game id → the surface
// that renders it. `lib/game/registry.ts` is the server's half; the two are
// keyed alike. Adding a game means one more entry here and one there.
//
// Every board fills its cell (`h-full`): the game screen gives it an exact
// share of the screen, and the page itself never scrolls.
//
// Each board narrows the opaque `view` to its own type. That cast is safe
// for the same reason the server's is: the view came from the module the
// session's gameType selected, and this map is keyed by that same id.

const BOARDS: Record<string, ComponentType<GameBoardProps>> = {
  nuno: ({ view, ...rest }) => <NunoBoard view={view as NunoView} {...rest} />,
  "empire-wars": ({ view, ...rest }) => (
    <EmpireWarsBoard view={view as EmpireView} {...rest} />
  ),
};

/** Renders the board for a game, or an honest message if none is wired up. */
export function GameBoard({
  gameType,
  ...props
}: GameBoardProps & { gameType: string }) {
  const Board = BOARDS[gameType];
  if (!Board) {
    return (
      <div className="flex h-full min-h-[30rem] items-center justify-center rounded-3xl border border-white/10 bg-card/40 p-6">
        <p className="text-sm text-muted-foreground">
          This table is set for a game the app can&apos;t draw yet.
        </p>
      </div>
    );
  }
  return <Board {...props} />;
}
