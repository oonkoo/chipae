"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getOnboardedUser } from "@/lib/user";

export async function markAllNotificationsRead(): Promise<void> {
  const user = await getOnboardedUser();
  await db.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/", "layout");
}
