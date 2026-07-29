import { describe, expect, it } from "vitest";
import { usernameSchema, displayNameSchema } from "@/lib/validation";

describe("usernameSchema", () => {
  it("accepts lowercase letters, digits, underscores within 3–20 chars", () => {
    for (const name of ["abc", "chip_ae", "player_1", "a".repeat(20)]) {
      expect(usernameSchema.safeParse(name).success).toBe(true);
    }
  });

  it("lowercases and trims before validating", () => {
    const parsed = usernameSchema.safeParse("  ChipMaster  ");
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toBe("chipmaster");
  });

  it("rejects names that are too short, too long, or contain symbols", () => {
    for (const name of ["ab", "a".repeat(21), "with space", "héllo", "a-b", "a.b", ""]) {
      expect(usernameSchema.safeParse(name).success).toBe(false);
    }
  });
});

describe("displayNameSchema", () => {
  it("caps display names at 40 characters", () => {
    expect(displayNameSchema.safeParse("a".repeat(40)).success).toBe(true);
    expect(displayNameSchema.safeParse("a".repeat(41)).success).toBe(false);
  });
});
