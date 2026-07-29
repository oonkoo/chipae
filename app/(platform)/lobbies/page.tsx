import { redirect } from "next/navigation";
import { getOnboardedUser } from "@/lib/user";
import { getActiveMembership, listPublicLobbies, LOBBY_LIMITS } from "@/lib/lobbies";
import { createLobby } from "@/lib/actions/lobbies";
import { AvatarChip } from "@/components/avatar-chip";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { JoinByCode, JoinPublicButton } from "./join-controls";

export const metadata = { title: "Lobbies" };

export default async function LobbiesPage() {
  const user = await getOnboardedUser();

  // Already seated? Straight back to the table.
  const active = await getActiveMembership(user.id);
  if (active) {
    redirect(`/lobby/${active.lobbyId}`);
  }

  const publicLobbies = await listPublicLobbies();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-12">
      <div>
        <h1 className="font-heading text-3xl text-foreground">Lobbies</h1>
        <p className="text-sm text-muted-foreground">
          Open a lobby or find one that&apos;s dealing.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Open a lobby */}
        <Card>
          <CardContent className="flex flex-col gap-4 p-5">
            <h2 className="font-heading text-lg">Open a lobby</h2>
            <form action={createLobby} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="lobby-name">Lobby name</Label>
                <Input
                  id="lobby-name"
                  name="name"
                  maxLength={40}
                  placeholder={`${user.username}'s lobby`}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="lobby-visibility">Visibility</Label>
                  <select
                    id="lobby-visibility"
                    name="visibility"
                    defaultValue="PRIVATE"
                    className="h-9 rounded-lg border border-input bg-input/30 px-2 text-sm"
                  >
                    <option value="PRIVATE">Private (code only)</option>
                    <option value="PUBLIC">Public (listed)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="lobby-max">Seats</Label>
                  <select
                    id="lobby-max"
                    name="maxPlayers"
                    defaultValue={LOBBY_LIMITS.defaultPlayers}
                    className="h-9 rounded-lg border border-input bg-input/30 px-2 text-sm"
                  >
                    {Array.from(
                      { length: LOBBY_LIMITS.maxPlayers - LOBBY_LIMITS.minPlayers + 1 },
                      (_, i) => i + LOBBY_LIMITS.minPlayers
                    ).map((n) => (
                      <option key={n} value={n}>
                        {n} seats
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Button type="submit">Deal me in</Button>
            </form>
          </CardContent>
        </Card>

        {/* Join by code */}
        <Card>
          <CardContent className="flex h-full flex-col gap-4 p-5">
            <h2 className="font-heading text-lg">Have a code?</h2>
            <p className="text-sm text-muted-foreground">
              Punch in the 6-character lobby code a friend shared.
            </p>
            <JoinByCode />
          </CardContent>
        </Card>
      </div>

      {/* Public lobbies */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground">Open lobbies</h2>
        {publicLobbies.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No public lobbies right now — open one and leave the door open.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {publicLobbies.map((lobby) => (
              <li
                key={lobby.id}
                className="flex items-center gap-3 rounded-xl bg-card p-3"
              >
                <AvatarChip avatarId={lobby.host.avatarId} className="size-10" />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">
                    {lobby.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    hosted by @{lobby.host.username} · {lobby._count.members}/
                    {lobby.maxPlayers} seated
                  </span>
                </div>
                <span className="ml-auto">
                  <JoinPublicButton
                    lobbyId={lobby.id}
                    full={lobby._count.members >= lobby.maxPlayers}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
