"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { getOnboardedUser } from "@/lib/user";
import { acquireTxLock, lockKeys } from "@/lib/locks";
import { publishToLobby } from "@/lib/realtime/server";
import { nextFreeSeat } from "@/lib/lobbies";
import { pickBotName } from "@/lib/bots";
import { RATE, rateLimit } from "@/lib/rate-limit";
import { getGame } from "@/lib/game/catalog";
import { getGameModule } from "@/lib/game/registry";
import type {
  ErasedGameModule,
  MoveContext,
  Transition,
} from "@/lib/game/module";
import { loadActiveSession, persistGameState } from "@/lib/game/session";

export type GameActionResult = { ok: true } | { ok: false; error: string };

const idSchema = z.string().min(1).max(64);

/**
 * Revalidate every surface a game mutation is visible on.
 *
 * The `/game` route matters most and was missing: it is the page players are
 * actually looking at mid-match. Without it the action's own response carried
 * no fresh data for that route, so each board had to fire a `router.refresh()`
 * as well — a **second** full render, four-plus queries, for every single
 * move. At a bot's pace that is several redundant renders a second, which is
 * enough to exhaust the local dev pool (P1017).
 */
function refreshGame(lobbyId: string) {
  revalidatePath(`/lobby/${lobbyId}/game`);
  revalidatePath(`/lobby/${lobbyId}`);
  revalidatePath("/dashboard");
}

type TransitionContext = {
  gameModule: ErasedGameModule;
  state: unknown;
  /** The impurity a module is allowed (ADR-0005 Amendment 1). */
  ctx: MoveContext;
  lobby: {
    id: string;
    hostId: string;
    members: Array<{ id: string; userId: string | null; isBot: boolean }>;
  };
};

/**
 * The server is the only place a module's randomness and clock come from.
 * Stamped once per transition so every rule inside one move agrees on "now",
 * and so a retry can never see a different time mid-way.
 */
function moveContext(): MoveContext {
  return { random: Math.random, now: Date.now() };
}

/**
 * Load the lobby + active session under the lobby lock, run one rules
 * transition, persist the outcome. On a finished round the session closes,
 * the lobby reopens, and human seats must ready up again for the next hand.
 * Everything game-related is server-authoritative (ADR-0003, ADR-0005) —
 * which game is being played is decided by the registry, not by this file.
 */
async function runTransition(
  lobbyId: string,
  transition: (ctx: TransitionContext) => Transition<unknown> | string
): Promise<GameActionResult> {
  const ctx = moveContext();
  const outcome = await db.$transaction(async (tx) => {
    await acquireTxLock(tx, lockKeys.lobby(lobbyId));

    const lobby = await tx.lobby.findUnique({
      where: { id: lobbyId },
      include: {
        // User details ride along so a finished game can freeze its
        // lineup into the win record.
        members: {
          include: {
            user: {
              select: {
                username: true,
                displayName: true,
                avatarId: true,
              },
            },
          },
        },
      },
    });
    if (!lobby || lobby.status !== "IN_GAME") {
      return "No game at this lobby right now";
    }
    const loaded = await loadActiveSession(tx, lobbyId);
    if (!loaded) return "No game at this lobby right now";

    const result = transition({
      gameModule: loaded.gameModule,
      state: loaded.state,
      // Which seats a connected human holds right now (Amendment 2). A seat
      // whose human left has no member row, so it counts as a CPU.
      ctx: {
        ...ctx,
        humans: lobby.members
          .filter((m) => !m.isBot && m.userId !== null)
          .map((m) => m.id),
      },
      lobby,
    });
    if (typeof result === "string") return result;
    if (!result.ok) return result.error;

    await persistGameState(tx, {
      lobbyId,
      session: loaded.session,
      gameModule: loaded.gameModule,
      state: result.state,
      members: lobby.members,
    });
    return null;
  });

  if (outcome) return { ok: false, error: outcome };
  await publishToLobby(lobbyId, { type: "game-changed" });
  refreshGame(lobbyId);
  return { ok: true };
}

/**
 * Host starts a game from the catalog once every seat is ready. The lobby
 * is the persistent group; games come and go inside it (ADR-0004).
 */
export async function startGame(
  rawLobbyId: string,
  rawGameTypeId: string
): Promise<GameActionResult> {
  const user = await getOnboardedUser();
  const parsed = idSchema.safeParse(rawLobbyId);
  const gameId = idSchema.safeParse(rawGameTypeId);
  if (!parsed.success || !gameId.success) {
    return { ok: false, error: "Invalid lobby" };
  }
  const game = getGame(gameId.data);
  if (!game || !game.available) {
    return { ok: false, error: "That game isn't on the shelf yet" };
  }
  // The catalog may list a game before its rules module ships.
  const gameModule = getGameModule(game.id);
  if (!gameModule) return { ok: false, error: "That game isn't ready yet" };

  const ctx = moveContext();
  const outcome = await db.$transaction(async (tx) => {
    await acquireTxLock(tx, lockKeys.lobby(parsed.data));

    const lobby = await tx.lobby.findUnique({
      where: { id: parsed.data },
      include: { members: { orderBy: { seat: "asc" } } },
    });
    if (!lobby) return "This lobby isn't ready to deal";

    if (lobby.status !== "OPEN") {
      // A lobby stuck IN_GAME with no *readable* session can never be played
      // or reset from the UI: the game route bounces (nothing to render) and
      // this action refuses (status isn't OPEN). That happens for real —
      // deploying a change to a game's state shape leaves every in-flight save
      // unparseable. Retire the dead session and carry on rather than leaving
      // the table bricked.
      const stale = await loadActiveSession(tx, lobby.id);
      if (stale) return "This lobby isn't ready to deal";

      await tx.gameSession.updateMany({
        where: { lobbyId: lobby.id, endedAt: null },
        data: { endedAt: new Date() },
      });
      await tx.lobby.update({
        where: { id: lobby.id },
        data: { status: "OPEN" },
      });
    }

    if (lobby.hostId !== user.id) return "Only the host starts games";
    if (lobby.members.length < game.minPlayers) {
      return "Deal in at least one more seat";
    }
    if (lobby.members.length > game.maxPlayers) {
      return `${game.name} seats at most ${game.maxPlayers}`;
    }
    if (!lobby.members.every((m) => m.ready)) {
      return "Everyone needs to be ready";
    }

    // Which seats are human reaches the deal too (ADR-0005 Amendment 2): a
    // game may open differently for people than for a table of CPUs.
    const state = gameModule.deal(
      lobby.members.map((m) => m.id),
      {
        ...ctx,
        humans: lobby.members
          .filter((m) => !m.isBot && m.userId !== null)
          .map((m) => m.id),
      }
    );
    await tx.gameSession.create({
      // The module owns the shape; Prisma just stores it as Json.
      data: {
        lobbyId: lobby.id,
        gameType: game.id,
        state: state as Prisma.InputJsonValue,
      },
    });
    await tx.lobby.update({
      where: { id: lobby.id },
      data: { status: "IN_GAME", gameType: game.id },
    });
    return null;
  });

  if (outcome) return { ok: false, error: outcome };
  await publishToLobby(parsed.data, { type: "game-changed" });
  refreshGame(parsed.data);
  return { ok: true };
}

/**
 * Make a move in the running game. The move's shape is the game's business:
 * the module zod-parses it before anything touches state, and validates
 * turn and ownership itself.
 */
export async function submitMove(
  rawLobbyId: string,
  rawMove: unknown
): Promise<GameActionResult> {
  const user = await getOnboardedUser();
  const lobbyId = idSchema.safeParse(rawLobbyId);
  if (!lobbyId.success) return { ok: false, error: "Invalid lobby" };

  return runTransition(lobbyId.data, ({ gameModule, state, ctx, lobby }) => {
    const me = lobby.members.find((m) => m.userId === user.id);
    if (!me) return "You're not seated here";
    const move = gameModule.parseMove(rawMove);
    if (!move.ok) return move.error;
    return gameModule.apply(state, me.id, move.move, ctx);
  });
}

/**
 * Quit the running game: eliminated from this hand, but still seated in
 * the lobby. Remaining humans play on; if none remain, the session ends
 * as abandoned (no winner recorded).
 */
export async function quitGame(rawLobbyId: string): Promise<GameActionResult> {
  const user = await getOnboardedUser();
  const parsed = idSchema.safeParse(rawLobbyId);
  if (!parsed.success) return { ok: false, error: "Invalid lobby" };

  return runTransition(parsed.data, ({ gameModule, state, ctx, lobby }) => {
    const me = lobby.members.find((m) => m.userId === user.id);
    if (!me) return "You're not seated here";
    return gameModule.quit(state, me.id, ctx);
  });
}

/**
 * Play one move for the seat on the clock, when that seat isn't going to play
 * it themselves — a CPU, or a human whose turn clock has expired.
 *
 * Any seated member's client may call this on a timer; the lobby lock plus the
 * whose-turn check make duplicate calls harmless. A seat whose human left
 * mid-round is played as a bot so the game never stalls.
 */
export async function advanceBot(rawLobbyId: string): Promise<GameActionResult> {
  const user = await getOnboardedUser();
  const parsed = idSchema.safeParse(rawLobbyId);
  if (!parsed.success) return { ok: false, error: "Invalid lobby" };

  return runTransition(parsed.data, ({ gameModule, state, ctx, lobby }) => {
    const me = lobby.members.find((m) => m.userId === user.id);
    if (!me) return "You're not seated here";

    const seatId = gameModule.currentMemberId(state);
    if (!seatId) return "Nobody is on the clock";

    // A CPU seat is always fair game. A human seat is only played for them
    // once their own turn clock has run out — checked against the server's
    // clock inside the module, so a fast client cannot jump the gun.
    const member = lobby.members.find((m) => m.id === seatId);
    const isHuman = !!member && !member.isBot && member.userId !== null;
    if (isHuman && !gameModule.turnExpired(state, ctx.now)) {
      return "It's a player's turn";
    }

    const move = gameModule.botMove(state, seatId, ctx);
    if (move === null) return "Nothing for the CPU to do";
    return gameModule.apply(state, seatId, move, ctx);
  });
}

/** Chat scoped to the running game — wiped when the game ends. */
export async function sendGameChat(
  rawLobbyId: string,
  rawText: string
): Promise<GameActionResult> {
  const user = await getOnboardedUser();
  if (!rateLimit(`chat:${user.id}`, RATE.chat.limit, RATE.chat.windowMs)) {
    return { ok: false, error: "Slow down — the table can't keep up" };
  }
  const lobbyId = idSchema.safeParse(rawLobbyId);
  const text = z.string().trim().min(1).max(300).safeParse(rawText);
  if (!lobbyId.success || !text.success) {
    return { ok: false, error: "Say something sayable" };
  }

  const lobby = await db.lobby.findUnique({
    where: { id: lobbyId.data },
    include: { members: true },
  });
  if (!lobby || lobby.status !== "IN_GAME") {
    return { ok: false, error: "No game at this lobby right now" };
  }
  if (!lobby.members.some((m) => m.userId === user.id)) {
    return { ok: false, error: "You're not seated here" };
  }
  const session = await db.gameSession.findFirst({
    where: { lobbyId: lobby.id, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (!session) return { ok: false, error: "No game at this lobby right now" };

  const message = await db.lobbyMessage.create({
    data: {
      lobbyId: lobby.id,
      userId: user.id,
      sessionId: session.id,
      text: text.data,
    },
  });
  await publishToLobby(lobby.id, {
    type: "chat-message",
    id: message.id,
    username: user.username!,
    avatarId: user.avatarId,
    text: text.data,
    sentAt: message.createdAt.toISOString(),
    scope: "game",
  });
  return { ok: true };
}

/** Host fills every open seat with a CPU before dealing. */
export async function fillSeatsWithBots(
  rawLobbyId: string
): Promise<GameActionResult> {
  const user = await getOnboardedUser();
  const parsed = idSchema.safeParse(rawLobbyId);
  if (!parsed.success) return { ok: false, error: "Invalid lobby" };

  const outcome = await db.$transaction(async (tx) => {
    await acquireTxLock(tx, lockKeys.lobby(parsed.data));

    const lobby = await tx.lobby.findUnique({
      where: { id: parsed.data },
      include: { members: true },
    });
    if (!lobby || lobby.status !== "OPEN") return "This lobby isn't open";
    if (lobby.hostId !== user.id) return "Only the host seats CPUs";

    let taken = lobby.members.map((m) => m.seat);
    let names = lobby.members.map((m) => m.botName);
    for (;;) {
      const seat = nextFreeSeat(taken, lobby.maxPlayers);
      if (seat === null) break;
      const botName = pickBotName(names);
      await tx.lobbyMember.create({
        data: {
          lobbyId: lobby.id,
          isBot: true,
          botName,
          botDifficulty: "NORMAL",
          seat,
          ready: true,
        },
      });
      taken = [...taken, seat];
      names = [...names, botName];
    }
    return null;
  });

  if (outcome) return { ok: false, error: outcome };
  await publishToLobby(parsed.data, { type: "bots-changed" });
  refreshGame(parsed.data);
  return { ok: true };
}
