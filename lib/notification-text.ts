// Pure — renders notification rows on server or client.

type Payload = Record<string, unknown>;

function str(payload: Payload, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" ? value : null;
}

export function notificationText(type: string, payload: Payload): {
  text: string;
  href: string | null;
} {
  switch (type) {
    case "FRIEND_REQUEST": {
      const from = str(payload, "fromUsername");
      return {
        text: from
          ? `@${from} wants to join your crew`
          : "New friend request",
        href: "/friends",
      };
    }
    case "FRIEND_ACCEPTED": {
      const by = str(payload, "byUsername");
      return {
        text: by ? `@${by} accepted — you're crew now` : "Friend request accepted",
        href: by ? `/player/${by}` : "/friends",
      };
    }
    case "LOBBY_INVITE": {
      const from = str(payload, "fromUsername");
      const code = str(payload, "lobbyCode");
      return {
        text: from
          ? `@${from} saved you a seat${code ? ` — lobby ${code}` : ""}`
          : "Lobby invite",
        href: code ? `/lobby/join/${code}` : "/lobbies",
      };
    }
    default:
      return { text: "Something happened at the table", href: null };
  }
}
