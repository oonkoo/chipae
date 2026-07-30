import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user";
import { ChipaeLogo } from "@/components/chipae-logo";
import { OnboardingForm } from "./onboarding-form";

export const metadata = { title: "Pick your chip" };

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (user.username) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <ChipaeLogo size={96} priority />
        <h1 className="font-heading text-3xl text-foreground">
          Pick your chip
        </h1>
        <p className="text-sm text-muted-foreground">
          Claim a username and choose how you show up at the table.
        </p>
      </div>
      <OnboardingForm defaultDisplayName={user.displayName ?? ""} />
    </main>
  );
}
