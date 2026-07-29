import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireKindeUser } from "@/lib/auth";
import type { User } from "@/lib/generated/prisma/client";

/**
 * Authoritative "who is calling" for protected pages and server actions.
 * Upserts the local User mirror on first authenticated request (keyed by
 * kindeId) and refreshes email/lastSeenAt on subsequent ones.
 */
export async function getCurrentUser(): Promise<User> {
  const kindeUser = await requireKindeUser();

  const name =
    [kindeUser.given_name, kindeUser.family_name].filter(Boolean).join(" ") ||
    null;

  return db.user.upsert({
    where: { kindeId: kindeUser.id },
    create: {
      kindeId: kindeUser.id,
      email: kindeUser.email ?? `${kindeUser.id}@placeholder.chipae`,
      displayName: name,
    },
    update: {
      email: kindeUser.email ?? undefined,
      lastSeenAt: new Date(),
    },
  });
}

/**
 * Same as getCurrentUser, but additionally requires a completed profile
 * (username set during onboarding). Use in every app screen except onboarding.
 */
export async function getOnboardedUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user.username) {
    redirect("/onboarding");
  }
  return user;
}
