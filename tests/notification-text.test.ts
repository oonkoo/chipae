import { describe, expect, it } from "vitest";
import { notificationText } from "@/lib/notification-text";

describe("notificationText", () => {
  it("renders friend requests with a link to the friends page", () => {
    const { text, href } = notificationText("FRIEND_REQUEST", {
      fromUsername: "bob",
    });
    expect(text).toContain("@bob");
    expect(href).toBe("/friends");
  });

  it("renders accepted requests linking to the friend's profile", () => {
    const { href } = notificationText("FRIEND_ACCEPTED", {
      byUsername: "bob",
    });
    expect(href).toBe("/player/bob");
  });

  it("renders lobby invites with the join link", () => {
    const { text, href } = notificationText("LOBBY_INVITE", {
      fromUsername: "bob",
      lobbyCode: "K4Q7NX",
    });
    expect(text).toContain("K4Q7NX");
    expect(href).toBe("/lobby/join/K4Q7NX");
  });

  it("survives malformed payloads without throwing", () => {
    const { text } = notificationText("FRIEND_REQUEST", {
      fromUsername: 42 as unknown as string,
    });
    expect(typeof text).toBe("string");
  });

  it("falls back gracefully for unknown types", () => {
    const { href } = notificationText("SOMETHING_NEW", {});
    expect(href).toBeNull();
  });
});
