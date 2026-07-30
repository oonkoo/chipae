import Image from "next/image";
import Link from "next/link";
import {
  LoginLink,
  RegisterLink,
} from "@kinde-oss/kinde-auth-nextjs/components";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getOptionalKindeUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ChipaeLogo } from "@/components/chipae-logo";
import { AvatarChip } from "@/components/avatar-chip";
import { NunoCardFace } from "@/components/game/nuno-card";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { LandingRail } from "@/components/shell/landing-rail";
import { availableGames } from "@/lib/game/catalog";
import type { NunoCard } from "@/lib/game/nuno/rules";

// The five seat colours (chart-1..5), shown as the avatar set they belong to.
// Deliberately unnamed: these are the chips you can pick, not people who are
// online. Chipae's front door doesn't invent players.
const SEATS = [
  { avatarId: "chip-gold", label: "Seat one — gold" },
  { avatarId: "ghost-mint", label: "Seat two — mint" },
  { avatarId: "blade-coral", label: "Seat three — coral" },
  { avatarId: "bot-sky", label: "Seat four — sky" },
  { avatarId: "alien-lav", label: "Seat five — lavender" },
];

/** A real hand, so the front door shows the actual game and not an mockup. */
const HAND: NunoCard[] = [
  { id: "r7", color: "red", type: "number", value: 7 },
  { id: "bs", color: "blue", type: "skip" },
  { id: "w4", color: "wild", type: "wild4" },
  { id: "g5", color: "green", type: "number", value: 5 },
  { id: "yd", color: "yellow", type: "draw2" },
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

// The hero counts are live numbers, so this page is rendered per request.
// Without this Next tries to prerender it at build time, which drags the
// database into the build — the build then fails wherever the build
// machine can't reach it (and would otherwise ship frozen counts).
export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const kindeUser = await getOptionalKindeUser();
  if (kindeUser) {
    redirect("/dashboard");
  }

  // The hero counts are decoration. This is the front door for people who
  // aren't signed in, so it must still open if the database is unreachable
  // — degrade to zeros and leave the failure in the logs to chase.
  let playerCount = 0;
  let openTables = 0;
  try {
    [playerCount, openTables] = await Promise.all([
      db.user.count({ where: { username: { not: null } } }),
      db.lobby.count({ where: { visibility: "PUBLIC", status: "OPEN" } }),
    ]);
  } catch (error) {
    console.error("Landing page stats unavailable:", error);
  }

  const game = availableGames()[0] ?? null;

  return (
    <div className="flex min-h-dvh flex-1">
      <AppSidebar username={null} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-white/5 bg-background/40 backdrop-blur-md">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <Link href="/" className="flex items-center lg:hidden">
              <ChipaeLogo size={44} priority />
            </Link>
            <span className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<LoginLink>Sign in</LoginLink>}
            />
          </div>
        </header>

        <main className="flex flex-1 flex-col">
          {/* ── Hero: the table, seen from above ──────────────────────── */}
          <section className="relative isolate flex min-h-[34rem] flex-col items-center justify-center overflow-hidden px-6 py-20 sm:min-h-[40rem] sm:py-28">
            <Image
              src="/background.png"
              alt=""
              fill
              priority
              sizes="100vw"
              className="-z-20 object-cover object-center"
            />
            {/* Darkens under the top bar and melts the art into the section
                below, so the seam never reads as a pasted-in image. */}
            <div
              aria-hidden
              className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,color-mix(in_oklch,var(--background),transparent_45%)_0%,transparent_22%,transparent_58%,var(--background)_100%)]"
            />
            {/* Holds the centre back so type stays legible over the swirls. */}
            <div
              aria-hidden
              className="absolute inset-0 -z-10 bg-[radial-gradient(70%_55%_at_50%_45%,color-mix(in_oklch,var(--background),transparent_30%)_0%,transparent_72%)]"
            />

            <div className="flex w-full max-w-2xl flex-col items-center gap-8 text-center">
              <ChipaeLogo
                size={320}
                priority
                className="w-52 motion-safe:animate-in motion-safe:zoom-in-75 motion-safe:duration-700 sm:w-64"
              />

              <div className="flex flex-col gap-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-700 motion-safe:[animation-delay:140ms] motion-safe:[animation-fill-mode:backwards]">
                <h1 className="font-heading text-5xl leading-[0.95] tracking-tight text-foreground sm:text-6xl">
                  Your table is ready.
                </h1>
                <p className="mx-auto max-w-lg text-lg text-pretty text-muted-foreground">
                  Add your friends, open a lobby, and play — humans or CPUs,
                  any hour.
                </p>
              </div>

              {/* ── Signature: the seats fill, and the open one is the door ── */}
              <div className="flex flex-col items-center gap-4">
                <ul className="flex flex-wrap items-center justify-center gap-3">
                  {SEATS.map((seat, i) => (
                    <li
                      key={seat.avatarId}
                      style={{ animationDelay: `${320 + i * 80}ms` }}
                      className="motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:slide-in-from-bottom-3 motion-safe:duration-500 motion-safe:[animation-fill-mode:backwards]"
                    >
                      {/* Deliberately smaller than the open seat: these are
                          scenery, the empty chair is the action. */}
                      <AvatarChip
                        avatarId={seat.avatarId}
                        className="size-10 opacity-90 shadow-[0_6px_20px_-6px_var(--btn-ink-shadow)]"
                      />
                      <span className="sr-only">{seat.label}</span>
                    </li>
                  ))}

                  <li
                    style={{ animationDelay: `${320 + SEATS.length * 80}ms` }}
                    className="relative motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-500 motion-safe:[animation-fill-mode:backwards]"
                  >
                    <span
                      aria-hidden
                      className="absolute -inset-3 rounded-full bg-primary/30 blur-xl motion-safe:animate-pulse"
                    />
                    {/* The empty chair is the call to action — the one gold
                        moment on this page (design/art-direction.md). */}
                    <Button
                      variant="outline"
                      nativeButton={false}
                      className="relative h-14 rounded-full border-2 border-dashed border-primary bg-primary/15 px-7 font-heading text-lg text-primary shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary),transparent_88%)] hover:bg-primary/25 hover:text-primary"
                      render={<RegisterLink>Take a seat</RegisterLink>}
                    />
                  </li>
                </ul>

                <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
                  Every seat has a color · always room for one more
                </p>
              </div>

              {/* Live numbers only while they say something worth hearing.
                  "0 open lobbies" on a front door reads as "nobody's here";
                  the fallback is the product's real answer to an empty room,
                  and it stays true whatever the counts are. */}
              <p className="flex flex-wrap items-center justify-center gap-x-2 font-mono text-xs text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-700 motion-safe:[animation-delay:800ms] motion-safe:[animation-fill-mode:backwards]">
                {openTables > 0 ? (
                  <>
                    <span className="text-primary">{playerCount}</span>
                    {playerCount === 1 ? "player seated" : "players seated"}
                    <span className="opacity-40">·</span>
                    <span className="text-primary">{openTables}</span>
                    {openTables === 1 ? "open lobby" : "open lobbies"}
                  </>
                ) : (
                  <>Nobody around? CPUs fill every empty seat.</>
                )}
              </p>
            </div>
          </section>

          {/* ── What you'd actually be playing ─────────────────────────── */}
          {game && (
            <section className="border-t border-border bg-card/30 px-6 py-16">
              <div className="mx-auto flex max-w-4xl flex-col items-center gap-12 sm:flex-row sm:gap-16">
                <div
                  aria-hidden
                  className="flex shrink-0 items-end pt-4 pl-6 sm:pl-0"
                >
                  {HAND.map((card, i) => (
                    <span
                      key={card.id}
                      className="block origin-bottom"
                      style={{
                        marginLeft: i === 0 ? 0 : "-1.4rem",
                        transform: `rotate(${(i - 2) * 7}deg) translateY(${Math.abs(i - 2) * 7}px)`,
                        zIndex: i,
                      }}
                    >
                      <NunoCardFace card={card} size="lg" />
                    </span>
                  ))}
                </div>

                <div className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
                  <span className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
                    On the table tonight
                  </span>
                  <h2 className="font-heading text-3xl text-foreground">
                    {game.name}
                  </h2>
                  <p className="max-w-sm text-muted-foreground">
                    {game.tagline}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {game.minPlayers}–{game.maxPlayers} seats · free to play
                  </p>
                  <Button
                    variant="game"
                    size="lg"
                    nativeButton={false}
                    className="mt-3"
                    render={<RegisterLink>Deal me in</RegisterLink>}
                  />
                </div>
              </div>
            </section>
          )}

          {/* ── How it works: a real sequence, so it earns its numbers ─── */}
          <section className="border-t border-border px-6 py-16">
            <ol className="mx-auto grid max-w-4xl gap-10 sm:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex flex-col gap-2">
                  <span className="font-heading text-3xl leading-none text-primary/35">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h2 className="font-heading text-xl text-foreground">
                    {step.title}
                  </h2>
                  <p className="text-sm text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>
          </section>

          <footer className="flex flex-col items-center gap-3 border-t border-border px-6 py-10 text-center">
            <ChipaeLogo size={96} className="w-14 opacity-70" />
            <p className="text-xs text-muted-foreground">
              Lobbies, crews and chat are live. Nuno is dealt.
            </p>
          </footer>
        </main>
      </div>

      {/* Right rail — the invite door, plus a CTA that outlives the hero */}
      <LandingRail />
    </div>
  );
}
