import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { redirect } from "next/navigation";

/**
 * Authoritative session check for server components and server actions.
 * The proxy gate is optimistic only — every protected read/write calls this.
 */
export async function requireKindeUser() {
  const { getUser, isAuthenticated } = getKindeServerSession();
  const authed = await isAuthenticated();
  if (!authed) {
    redirect("/api/auth/login");
  }
  const user = await getUser();
  if (!user?.id) {
    redirect("/api/auth/login");
  }
  return user;
}

/**
 * "User or null" — used on public pages, so it must never throw. The Kinde
 * session check can fail outright (no session, JWKS fetch trouble) and a
 * signed-out visitor hitting the front door should just be treated as
 * signed out rather than served a 500.
 */
export async function getOptionalKindeUser() {
  try {
    const { getUser, isAuthenticated } = getKindeServerSession();
    const authed = await isAuthenticated();
    if (!authed) return null;
    return (await getUser()) ?? null;
  } catch (error) {
    console.error("Optional Kinde session check failed:", error);
    return null;
  }
}
