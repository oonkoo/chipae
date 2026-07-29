"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { unblockUser } from "@/lib/actions/friends";
import { Button } from "@/components/ui/button";

export function UnblockButton({ friendshipId }: { friendshipId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="xs"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await unblockUser(friendshipId);
          router.refresh();
        })
      }
    >
      {pending ? "…" : "Unblock"}
    </Button>
  );
}
