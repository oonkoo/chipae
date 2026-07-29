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

export async function getOptionalKindeUser() {
  const { getUser, isAuthenticated } = getKindeServerSession();
  const authed = await isAuthenticated();
  if (!authed) return null;
  return (await getUser()) ?? null;
}
