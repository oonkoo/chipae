"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/user";
import { AVATAR_IDS } from "@/lib/avatars";
import { displayNameSchema, usernameSchema } from "@/lib/validation";
import { RATE, rateLimit } from "@/lib/rate-limit";

const onboardingSchema = z.object({
  username: usernameSchema,
  displayName: displayNameSchema.optional(),
  avatarId: z.string().refine((id) => AVATAR_IDS.includes(id), {
    message: "Pick an avatar from the set",
  }),
});

export type OnboardingState = {
  error?: string;
  fieldErrors?: Partial<Record<"username" | "displayName" | "avatarId", string>>;
};

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const user = await getCurrentUser();
  if (user.username) {
    redirect("/dashboard");
  }

  const parsed = onboardingSchema.safeParse({
    username: formData.get("username"),
    displayName: formData.get("displayName") || undefined,
    avatarId: formData.get("avatarId"),
  });

  if (!parsed.success) {
    const flat = z.flattenError(parsed.error);
    return {
      fieldErrors: {
        username: flat.fieldErrors.username?.[0],
        displayName: flat.fieldErrors.displayName?.[0],
        avatarId: flat.fieldErrors.avatarId?.[0],
      },
    };
  }

  const { username, displayName, avatarId } = parsed.data;

  const taken = await db.user.findUnique({ where: { username } });
  if (taken) {
    return { fieldErrors: { username: "That username is already seated" } };
  }

  try {
    await db.user.update({
      where: { id: user.id },
      data: {
        username,
        displayName: displayName || user.displayName,
        avatarId,
      },
    });
  } catch {
    // Unique race: someone claimed the name between check and write.
    return { fieldErrors: { username: "That username is already seated" } };
  }

  redirect("/dashboard");
}

export type ProfileUpdateState = {
  ok?: boolean;
  fieldErrors?: Partial<Record<"displayName" | "avatarId", string>>;
};

export async function updateProfile(
  _prev: ProfileUpdateState,
  formData: FormData
): Promise<ProfileUpdateState> {
  const user = await getCurrentUser();

  const parsed = z
    .object({
      displayName: displayNameSchema.optional(),
      avatarId: z.string().refine((id) => AVATAR_IDS.includes(id), {
        message: "Pick an avatar from the set",
      }),
    })
    .safeParse({
      displayName: formData.get("displayName") || undefined,
      avatarId: formData.get("avatarId"),
    });

  if (!parsed.success) {
    const flat = z.flattenError(parsed.error);
    return {
      fieldErrors: {
        displayName: flat.fieldErrors.displayName?.[0],
        avatarId: flat.fieldErrors.avatarId?.[0],
      },
    };
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      displayName: parsed.data.displayName ?? null,
      avatarId: parsed.data.avatarId,
    },
  });

  // Chip + name render in the shell (top bar, crew rail) on every page.
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function checkUsernameAvailable(
  raw: string
): Promise<{ valid: boolean; available: boolean; message?: string }> {
  const user = await getCurrentUser();
  if (
    !rateLimit(
      `username-check:${user.id}`,
      RATE.usernameCheck.limit,
      RATE.usernameCheck.windowMs
    )
  ) {
    return { valid: false, available: false, message: "Checking too fast" };
  }

  const parsed = usernameSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      valid: false,
      available: false,
      message: z.flattenError(parsed.error).formErrors[0],
    };
  }
  const existing = await db.user.findUnique({
    where: { username: parsed.data },
  });
  return { valid: true, available: !existing };
}
