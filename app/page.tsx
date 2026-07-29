import Link from "next/link";
import {
  LoginLink,
  RegisterLink,
} from "@kinde-oss/kinde-auth-nextjs/components";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getOptionalKindeUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ChipMark } from "@/components/chip-mark";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { cn } from "@/lib/utils";

const SEAT_COLORS = [
  { class: "bg-chart-1", label: "Player 1" },
  { class: "bg-chart-2", label: "Player 2" },
  { class: "bg-chart-3", label: "Player 3" },
  { class: "bg-chart-4", label: "Player 4" },
  { class: "bg-chart-5", label: "Player 5" },
];

const STEPS = [
  {
    title: "Add your friends",
    body: "Find people by username and build your table crew.",
  },
  {
    title: "Open a lobby",
    body: "Create a lobby, share the code, fill empty seats with CPUs.",
  },
  {
    title: "Play",
    body: "With friends, with strangers, or against the house.",
  },
];

export default async function LandingPage() {
  const kindeUser = await getOptionalKindeUser();
  if (kindeUser) {
    redirect("/dashboard");
  }

  const [playerCount, openTables] = await Promise.all([
    db.user.count({ where: { username: { not: null } } }),
    db.lobby.count({ where: { visibility: "PUBLIC", status: "OPEN" } }),
  ]);

  return (
    <div className="flex min-h-dvh flex-1">
      <AppSidebar username={null} />

      {/* Center column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2 lg:hidden">
              <ChipMark className="size-7" />
              <span className="font-heading text-lg text-foreground">
                Chip<span className="text-primary">ae</span>
              </span>
            </Link>
            <span className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<LoginLink>Sign in</LoginLink>}
            />
            <Button
              size="sm"
              nativeButton={false}
              render={<RegisterLink>Take a seat</RegisterLink>}
            />
          </div>
        </header>

        <main className="flex flex-1 flex-col">
          {/* Hero */}
          <section className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pt-20 pb-16 text-center">
            <ChipMark className="size-24 motion-safe:animate-in motion-safe:zoom-in-75 motion-safe:duration-500" />

            <div className="space-y-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-700">
              <h1 className="font-heading text-6xl tracking-wide text-foreground sm:text-7xl">
                Chip<span className="text-primary">ae</span>
              </h1>
              <p className="mx-auto max-w-md text-lg text-muted-foreground">
                Game night, anywhere. Add your friends, open a lobby, and play
                — humans or CPUs, any hour.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                size="lg"
                nativeButton={false}
                render={<RegisterLink>Take a seat</RegisterLink>}
              />
              <Button
                variant="ghost"
                size="lg"
                nativeButton={false}
                render={<LoginLink>Sign in</LoginLink>}
              />
            </div>
          </section>

          {/* How it works */}
          <section className="border-t border-border bg-card/40 px-6 py-14">
            <ol className="mx-auto grid max-w-4xl gap-8 sm:grid-cols-3">
              {STEPS.map((step, i) => (
                <li
                  key={step.title}
                  className="flex flex-col gap-2 text-center sm:text-left"
                >
                  <span className="font-mono text-xs tracking-widest text-primary uppercase">
                    Step {i + 1}
                  </span>
                  <h2 className="font-heading text-xl text-foreground">
                    {step.title}
                  </h2>
                  <p className="text-sm text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>
          </section>

          <footer className="flex items-center justify-center gap-2 px-6 py-6 text-xs text-muted-foreground">
            <ChipMark className="size-4" />
            <span>Chipae — your table is ready.</span>
          </footer>
        </main>
      </div>

      {/* Right rail — tonight at Chipae (real numbers, no theater) */}
      <aside className="sticky top-0 hidden h-dvh w-[300px] shrink-0 flex-col gap-6 overflow-y-auto border-l border-border bg-card/40 p-5 xl:flex">
        <div className="flex flex-col gap-3">
          <h2 className="font-heading text-sm text-foreground">
            Tonight at Chipae
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col items-center gap-1 rounded-xl bg-background/60 p-4">
              <span className="font-heading text-2xl text-primary">
                {playerCount}
              </span>
              <span className="text-center text-[10px] text-muted-foreground">
                players seated
              </span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-xl bg-background/60 p-4">
              <span className="font-heading text-2xl text-primary">
                {openTables}
              </span>
              <span className="text-center text-[10px] text-muted-foreground">
                open lobbies
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="font-heading text-sm text-foreground">
            Every seat has a color
          </h2>
          <ul className="flex flex-col gap-2">
            {SEAT_COLORS.map((seat) => (
              <li
                key={seat.label}
                className="flex items-center gap-2.5 text-xs text-muted-foreground"
              >
                <span className={cn("size-3 rounded-full", seat.class)} />
                {seat.label}
              </li>
            ))}
            <li className="flex items-center gap-2.5 text-xs text-muted-foreground">
              <span className="size-3 rounded-full border-2 border-dashed border-muted-foreground/50" />
              Always room for one more
            </li>
          </ul>
        </div>

        <div className="mt-auto flex flex-col gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
          <p className="text-xs text-muted-foreground">
            Lobbies, crews, and chat are live. First games are in the shuffle.
          </p>
          <Button
            size="sm"
            nativeButton={false}
            render={<RegisterLink>Claim your chip</RegisterLink>}
          />
        </div>
      </aside>
    </div>
  );
}
