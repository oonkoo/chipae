import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOnboardedUser } from "@/lib/user";
import { getPusherForAuth } from "@/lib/realtime/server";
import { CHANNELS } from "@/lib/realtime/channels";

/**
 * Pusher channel authorization (ADR-0001). Every subscription is checked
 * against the Kinde session and, for lobby channels, actual membership.
 */
export async function POST(request: Request) {
  const user = await getOnboardedUser();

  const body = await request.formData();
  const socketId = body.get("socket_id");
  const channel = body.get("channel_name");
  if (typeof socketId !== "string" || typeof channel !== "string") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const presenceData = {
    user_id: user.id,
    user_info: { username: user.username, avatarId: user.avatarId },
  };

  if (channel === CHANNELS.presence) {
    return NextResponse.json(
      getPusherForAuth().authorizeChannel(socketId, channel, presenceData)
    );
  }

  if (channel === CHANNELS.user(user.id)) {
    return NextResponse.json(
      getPusherForAuth().authorizeChannel(socketId, channel)
    );
  }

  const lobbyMatch = channel.match(/^presence-lobby-([a-z0-9]+)$/);
  if (lobbyMatch) {
    const membership = await db.lobbyMember.findFirst({
      where: { lobbyId: lobbyMatch[1], userId: user.id },
      select: { id: true },
    });
    if (membership) {
      return NextResponse.json(
        getPusherForAuth().authorizeChannel(socketId, channel, presenceData)
      );
    }
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
