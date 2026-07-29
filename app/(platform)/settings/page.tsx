import { getOnboardedUser } from "@/lib/user";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getOnboardedUser();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-6 py-12">
      <div>
        <h1 className="font-heading text-3xl text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Your chip, your name, your table manners.
        </p>
      </div>

      <SettingsForm
        username={user.username!}
        email={user.email}
        displayName={user.displayName ?? ""}
        avatarId={user.avatarId}
      />
    </main>
  );
}
