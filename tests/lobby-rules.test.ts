import { describe, expect, it } from "vitest";
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  LOBBY_LIMITS,
  nextFreeSeat,
  randomLobbyCode,
} from "@/lib/lobby-rules";

describe("nextFreeSeat", () => {
  it("seats the first player at seat 1", () => {
    expect(nextFreeSeat([], 4)).toBe(1);
  });

  it("fills the lowest open seat, including gaps left by leavers", () => {
    expect(nextFreeSeat([1, 3, 4], 4)).toBe(2);
  });

  it("returns null when the table is full", () => {
    expect(nextFreeSeat([1, 2, 3, 4], 4)).toBeNull();
  });

  it("never seats beyond maxPlayers even with sparse seats", () => {
    expect(nextFreeSeat([1, 2], 2)).toBeNull();
  });
});

describe("randomLobbyCode", () => {
  it("generates codes of the right length from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = randomLobbyCode();
      expect(code).toHaveLength(CODE_LENGTH);
      for (const char of code) {
        expect(CODE_ALPHABET).toContain(char);
      }
    }
  });

  it("excludes ambiguous characters O, 0, I, 1", () => {
    for (const ambiguous of ["O", "0", "I", "1"]) {
      expect(CODE_ALPHABET).not.toContain(ambiguous);
    }
  });
});

describe("LOBBY_LIMITS", () => {
  it("keeps the default table size within min/max", () => {
    expect(LOBBY_LIMITS.defaultPlayers).toBeGreaterThanOrEqual(
      LOBBY_LIMITS.minPlayers
    );
    expect(LOBBY_LIMITS.defaultPlayers).toBeLessThanOrEqual(
      LOBBY_LIMITS.maxPlayers
    );
  });
});
