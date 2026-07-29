import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getOnboardedUser } from "@/lib/user";
import { usernameSchema } from "@/lib/validation";
import { getRelationship } from "@/lib/friends";
import { AvatarChip } from "@/components/avatar-chip";
import { FriendActionButton } from "@/components/friend-action-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getGame } from "@/lib/game/catalog";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return { title: `@${username}` };
}

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const viewer = await getOnboardedUser();

  const { username: rawUsername } = await params;
  const parsed = usernameSchema.safeParse(decodeURIComponent(rawUsername));
  if (!parsed.success) {
    notFound();
  }

  const player = await db.user.findUnique({
    where: { username: parsed.data },
  });
  if (!player) {
    notFound();
  }

  const isSelf = player.id === viewer.id;
  const relationship = isSelf
    ? null
    : await getRelationship(viewer.id, player.id);

  // A player who blocked the viewer is invisible to them.
  if (relationship?.kind === "blocked-viewer") {
    notFound();
  }

  const [friendCount, winCount, recentWins] = await Promise.all([
    db.friendship.count({
      where: {
        status: "ACCEPTED",
        OR: [{ requesterId: player.id }, { addresseeId: player.id }],
      },
    }),
    db.gameWin.count({ where: { userId: player.id } }),
    db.gameWin.findMany({
      where: { userId: player.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const stats = [
    { label: "Wins", value: winCount },
    { label: "Friends", value: friendCount },
    { label: "Level", value: player.level },
  ];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12">
      {/* Identity */}
      <section className="flex items-center gap-5">
        <AvatarChip avatarId={player.avatarId} className="size-20" />
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl text-foreground">
            {player.displayName || `@${player.username}`}
          </h1>
          <p className="font-mono text-sm text-muted-foreground">
            @{player.username}
          </p>
          <p className="text-xs text-muted-foreground">
            Level {player.level} · {player.xp} XP · at the table since{" "}
            {player.createdAt.toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="ml-auto">
          {isSelf ? (
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/settings">Edit profile</Link>}
            />
          ) : (
            <FriendActionButton
              userId={player.id}
              relationship={relationship?.kind ?? "none"}
              friendshipId={
                relationship && relationship.kind !== "none"
                  ? relationship.friendship.id
                  : null
              }
              size="default"
            />
          )}
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-3 gap-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex flex-col items-center gap-1 py-5">
              <span className="font-heading text-3xl text-primary">
                {stat.value}
              </span>
              <span className="text-xs text-muted-foreground">
                {stat.label}
              </span>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Win history — the only game record that persists (ADR-0004). */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground">Trophy shelf</h2>
        {recentWins.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No wins on the shelf yet — every finished game puts its winner
            here.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {recentWins.map((win) => {
              const game = getGame(win.gameType);
              return (
                <li
                  key={win.id}
                  className="flex items-center gap-3 rounded-xl bg-card px-4 py-2.5"
                >
                  <span className="font-heading text-primary">🏆</span>
                  <span className="text-sm font-medium text-foreground">
                    Won {game?.name ?? win.gameType}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {win.createdAt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
