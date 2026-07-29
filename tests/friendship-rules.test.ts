import { describe, expect, it } from "vitest";
import { classifyRelationship } from "@/lib/friendship-rules";

const base = { id: "f1", requesterId: "alice", addresseeId: "bob" } as const;

describe("classifyRelationship", () => {
  it("classifies an accepted friendship the same from both sides", () => {
    const friendship = { ...base, status: "ACCEPTED" as const };
    expect(classifyRelationship(friendship, "alice").kind).toBe("friends");
    expect(classifyRelationship(friendship, "bob").kind).toBe("friends");
  });

  it("distinguishes outgoing from incoming for pending requests", () => {
    const friendship = { ...base, status: "PENDING" as const };
    expect(classifyRelationship(friendship, "alice").kind).toBe("outgoing");
    expect(classifyRelationship(friendship, "bob").kind).toBe("incoming");
  });

  it("treats the requester of a BLOCKED row as the blocker", () => {
    const friendship = { ...base, status: "BLOCKED" as const };
    expect(classifyRelationship(friendship, "alice").kind).toBe(
      "blocked-by-viewer"
    );
    expect(classifyRelationship(friendship, "bob").kind).toBe(
      "blocked-viewer"
    );
  });

  it("returns the friendship row for actionable states", () => {
    const friendship = { ...base, status: "PENDING" as const };
    const state = classifyRelationship(friendship, "bob");
    expect(state.kind).toBe("incoming");
    if (state.kind !== "none") {
      expect(state.friendship.id).toBe("f1");
    }
  });
});
