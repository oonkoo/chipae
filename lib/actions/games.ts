"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getOnboardedUser } from "@/lib/user";
import { acquireTxLock, lockKeys } from "@/lib/locks";
import { publishToLobby } from "@/lib/realtime/server";
import { nextFreeSeat } from "@/lib/lobbies";
import { pickBotName } from "@/lib/bots";
import { RATE, rateLimit } from "@/lib/rate-limit";
import { getGame } from "@/lib/game/catalog";
import { NUNO_CONFIG } from "@/lib/game/data/nuno";
import {
  NUNO_COLORS,
  applyDraw,
  applyPass,
  applyPlay,
  applyQuit,
  applyUnoCall,
  chooseBotMove,
  currentPlayer,
  dealGame,
  type NunoState,
  type PlayResult,
} from "@/lib/game/nuno/rules";
import { loadActiveSession, persistGameState } from "@/lib/game/session";

export type GameActionResult = { ok: true } | { ok: false; error: string };

const idSchema = z.string().min(1).max(64);
const colorSchema = z.enum(NUNO_COLORS);

function refreshGame(lobbyId: string) {
  revalidatePath(`/lobby/${lobbyId}`);
  revalidatePath("/dashboard");
}

/**
 * Load the lobby + active session under the lobby lock, run one rules
 * transition, persist the outcome. On a finished round the session closes,
 * the lobby reopens, and human seats must ready up again for the next hand.
 * Everything game-related is server-authoritative (ADR-0003).
 */
async function runTransition(
  lobbyId: string,
  transition: (
    state: NunoState,
    lobby: {
      id: string;
      hostId: string;
      members: Array<{ id: string; userId: string | null; isBot: boolean }>;
    }
  ) => PlayResult | string
): Promise<GameActionResult> {
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

    const result = transition(loaded.state, lobby);
    if (typeof result === "string") return result;
    if (!result.ok) return result.error;

    await persistGameState(tx, {
      lobbyId,
      session: loaded.session,
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

  const outcome = await db.$transaction(async (tx) => {
    await acquireTxLock(tx, lockKeys.lobby(parsed.data));

    const lobby = await tx.lobby.findUnique({
      where: { id: parsed.data },
      include: { members: { orderBy: { seat: "asc" } } },
    });
    if (!lobby || lobby.status !== "OPEN") {
      return "This lobby isn't ready to deal";
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

    // Each game ships its own dealer; Nuno is the only one on the shelf.
    if (game.id !== NUNO_CONFIG.gameType) return "That game isn't ready yet";
    const state = dealGame(lobby.members.map((m) => m.id));
    await tx.gameSession.create({
      data: { lobbyId: lobby.id, gameType: game.id, state },
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
 * Quit the running game: eliminated from this hand, but still seated in
 * the lobby. Remaining humans play on; if none remain, the session ends
 * as abandoned (no winner recorded).
 */
export async function quitGame(rawLobbyId: string): Promise<GameActionResult> {
  const user = await getOnboardedUser();
  const parsed = idSchema.safeParse(rawLobbyId);
  if (!parsed.success) return { ok: false, error: "Invalid lobby" };

  return runTransition(parsed.data, (state, lobby) => {
    const me = lobby.members.find((m) => m.userId === user.id);
    if (!me) return "You're not seated here";
    return applyQuit(state, me.id);
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

/** Play a card from your hand (wilds carry the chosen color). */
export async function playCard(
  rawLobbyId: string,
  rawCardId: string,
  rawChosenColor?: string,
  declareUno?: boolean
): Promise<GameActionResult> {
  const user = await getOnboardedUser();
  const lobbyId = idSchema.safeParse(rawLobbyId);
  const cardId = idSchema.safeParse(rawCardId);
  if (!lobbyId.success || !cardId.success) {
    return { ok: false, error: "Invalid play" };
  }
  const chosenColor =
    rawChosenColor === undefined
      ? undefined
      : colorSchema.safeParse(rawChosenColor);
  if (chosenColor && !chosenColor.success) {
    return { ok: false, error: "Invalid color" };
  }

  return runTransition(lobbyId.data, (state, lobby) => {
    const me = lobby.members.find((m) => m.userId === user.id);
    if (!me) return "You're not seated here";
    return applyPlay(state, me.id, cardId.data, {
      chosenColor: chosenColor?.data,
      declareUno: declareUno === true,
    });
  });
}

/** Draw one card; keeps the turn only if the drawn card is playable. */
export async function drawCard(rawLobbyId: string): Promise<GameActionResult> {
  const user = await getOnboardedUser();
  const parsed = idSchema.safeParse(rawLobbyId);
  if (!parsed.success) return { ok: false, error: "Invalid lobby" };

  return runTransition(parsed.data, (state, lobby) => {
    const me = lobby.members.find((m) => m.userId === user.id);
    if (!me) return "You're not seated here";
    return applyDraw(state, me.id);
  });
}

/** Keep the drawn card and end the turn. */
export async function passTurn(rawLobbyId: string): Promise<GameActionResult> {
  const user = await getOnboardedUser();
  const parsed = idSchema.safeParse(rawLobbyId);
  if (!parsed.success) return { ok: false, error: "Invalid lobby" };

  return runTransition(parsed.data, (state, lobby) => {
    const me = lobby.members.find((m) => m.userId === user.id);
    if (!me) return "You're not seated here";
    return applyPass(state, me.id);
  });
}

/** Call "Nuno!" on your last card before someone else acts. */
export async function callNuno(rawLobbyId: string): Promise<GameActionResult> {
  const user = await getOnboardedUser();
  const parsed = idSchema.safeParse(rawLobbyId);
  if (!parsed.success) return { ok: false, error: "Invalid lobby" };

  return runTransition(parsed.data, (state, lobby) => {
    const me = lobby.members.find((m) => m.userId === user.id);
    if (!me) return "You're not seated here";
    return applyUnoCall(state, me.id);
  });
}

/**
 * Advance one CPU turn. Any seated member's client may call this on a
 * timer; the lock plus the whose-turn check make duplicate calls no-ops.
 * A seat whose human left mid-round is played as a bot so the game never
 * stalls.
 */
export async function advanceBot(rawLobbyId: string): Promise<GameActionResult> {
  const user = await getOnboardedUser();
  const parsed = idSchema.safeParse(rawLobbyId);
  if (!parsed.success) return { ok: false, error: "Invalid lobby" };

  return runTransition(parsed.data, (state, lobby) => {
    const me = lobby.members.find((m) => m.userId === user.id);
    if (!me) return "You're not seated here";

    const seat = currentPlayer(state);
    const member = lobby.members.find((m) => m.id === seat.id);
    if (member && !member.isBot) return "It's a player's turn";

    const move = chooseBotMove(state);
    if (move.kind === "draw") return applyDraw(state, seat.id);
    if (move.kind === "pass") return applyPass(state, seat.id);
    return applyPlay(state, seat.id, move.cardId, {
      chosenColor: move.chosenColor,
      declareUno: true, // bots never forget
    });
  });
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
