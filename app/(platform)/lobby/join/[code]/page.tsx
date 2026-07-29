import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getOnboardedUser } from "@/lib/user";
import { AvatarChip } from "@/components/avatar-chip";
import { Button } from "@/components/ui/button";
import { TakeSeatButton } from "./take-seat-button";

export const metadata = { title: "Join lobby" };

// Join is a button press, never a page load side effect — link prefetching
// must not seat anyone.
export default async function JoinLobbyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const user = await getOnboardedUser();
  const { code: rawCode } = await params;
  const code = decodeURIComponent(rawCode).toUpperCase();

  const lobby = await db.lobby.findUnique({
    where: { code },
    include: {
      host: { select: { username: true, avatarId: true } },
      members: { select: { userId: true } },
    },
  });

  if (lobby?.members.some((m) => m.userId === user.id)) {
    redirect(`/lobby/${lobby.id}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      {!lobby || lobby.status !== "OPEN" ? (
        <>
          <h1 className="font-heading text-2xl text-foreground">
            No open lobby with that code
          </h1>
          <p className="text-sm text-muted-foreground">
            It may have closed, or the code was mistyped.
          </p>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/lobbies">Back to lobbies</Link>}
          />
        </>
      ) : (
        <>
          <AvatarChip avatarId={lobby.host.avatarId} className="size-16" />
          <div>
            <h1 className="font-heading text-2xl text-foreground">
              {lobby.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              hosted by @{lobby.host.username} · {lobby.members.length}/
              {lobby.maxPlayers} seated
            </p>
          </div>
          <TakeSeatButton
            code={code}
            full={lobby.members.length >= lobby.maxPlayers}
          />
        </>
      )}
    </main>
  );
}
