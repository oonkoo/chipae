// Pure friendship-graph rules — no database, unit-testable.

export type FriendshipLike = {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: "PENDING" | "ACCEPTED" | "BLOCKED";
};

export type RelationshipStateOf<F extends FriendshipLike> =
  | { kind: "none" }
  | { kind: "friends"; friendship: F }
  | { kind: "outgoing"; friendship: F } // viewer sent, pending
  | { kind: "incoming"; friendship: F } // viewer received, pending
  | { kind: "blocked-by-viewer"; friendship: F }
  | { kind: "blocked-viewer"; friendship: F };

export function classifyRelationship<F extends FriendshipLike>(
  friendship: F,
  viewerId: string
): RelationshipStateOf<F> {
  const viewerIsRequester = friendship.requesterId === viewerId;
  switch (friendship.status) {
    case "ACCEPTED":
      return { kind: "friends", friendship };
    case "PENDING":
      return viewerIsRequester
        ? { kind: "outgoing", friendship }
        : { kind: "incoming", friendship };
    case "BLOCKED":
      // For BLOCKED rows the requester is always the blocker.
      return viewerIsRequester
        ? { kind: "blocked-by-viewer", friendship }
        : { kind: "blocked-viewer", friendship };
  }
}
