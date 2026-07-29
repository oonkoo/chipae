import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9_]{3,20}$/,
    "3–20 characters: lowercase letters, numbers, underscores"
  );

export const displayNameSchema = z.string().trim().max(40);
