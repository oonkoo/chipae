import { RegisterLink } from "@kinde-oss/kinde-auth-nextjs/components";
import {
  RiChat3Line,
  RiEyeOffLine,
  RiUserAddLine,
  type RemixiconComponentType,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";

/** Join codes are six of [A-Z2-9] (codeSchema in lib/actions/lobbies.ts). */
const CODE_LENGTH = 6;

/**
 * The crew layer — live, and mentioned nowhere else on the page. The
 * disappearing chat is a real promise, not copy: lobby messages are deleted
 * when the lobby closes and a game's chat dies with the game.
 */
const CREW: { icon: RemixiconComponentType; text: React.ReactNode }[] = [
  {
    icon: RiUserAddLine,
    text: (
      <>
        Friends by <span className="text-foreground">username</span>
      </>
    ),
  },
  { icon: RiChat3Line, text: <>Chat at the table</> },
  {
    icon: RiEyeOffLine,
    text: (
      <>
        <span className="text-foreground">Vanishes</span> when the lobby closes
      </>
    ),
  },
];

/**
 * A blank claim ticket — the join-code motif from design/art-direction.md,
 * with the perforation and empty mono slots. Deliberately not an input: the
 * code can only be redeemed once you're signed in, and a box that swallows
 * what you type and then loses it would be worse than an honest blank.
 */
function CodeTicket() {
  return (
    <div
      aria-hidden
      className="relative overflow-hidden rounded-xl border border-dashed border-primary/40 bg-background/50 px-2.5 pt-2 pb-3"
    >
      {/* Gold breathing under the slots, so the ticket reads warm not dead */}
      <span className="pointer-events-none absolute inset-x-5 bottom-1.5 h-7 rounded-full bg-primary/15 blur-lg motion-safe:animate-pulse" />

      <p className="text-center font-mono text-[9px] tracking-[0.22em] text-muted-foreground uppercase">
        Lobby code
      </p>

      <span className="mt-1.5 mb-2 block border-t border-dashed border-border" />

      <div className="relative flex justify-center gap-1">
        {Array.from({ length: CODE_LENGTH }, (_, i) => (
          <span
            key={i}
            className="flex size-6 items-center justify-center rounded border border-dashed border-primary/30 bg-card/70 font-mono text-xs text-primary/40"
          >
            ·
          </span>
        ))}
      </div>
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className="font-heading text-sm text-foreground">{children}</h2>;
}

/**
 * Right rail of the signed-out landing page — same width as the left rail, so
 * the shell reads symmetrical.
 *
 * The centre column already sells the table (seats, live counts, Nuno, how it
 * works), so this rail carries none of that. It covers the arrival the page has
 * nothing for — someone a friend just sent a code to — names the crew layer the
 * page only alludes to, and keeps a sign-up path on screen after the hero CTA
 * scrolls away.
 *
 * Both actions are secondary variants: the gold chip is spent in the hero, one
 * per view (design/art-direction.md).
 */
export function LandingRail() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-5 overflow-y-auto border-l border-border bg-card/40 p-4 xl:flex">
      <section className="flex flex-col gap-2.5">
        <Heading>Got a code?</Heading>
        <CodeTicket />
        <p className="text-xs leading-relaxed text-muted-foreground">
          A friend&apos;s code drops you straight at their table.
        </p>
        <Button
          variant="secondary"
          size="sm"
          nativeButton={false}
          render={
            <RegisterLink postLoginRedirectURL="/lobbies">
              Join a table
            </RegisterLink>
          }
        />
      </section>

      <section className="flex flex-col gap-2.5 border-t border-border/60 pt-5">
        <Heading>Bring your people</Heading>
        <ul className="flex flex-col gap-2">
          {CREW.map((row, i) => {
            const Icon = row.icon;
            return (
              <li
                key={i}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <Icon className="size-4 shrink-0 text-primary/70" />
                <span>{row.text}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-2.5 border-t border-border/60 pt-5">
        <Heading>Your seat&apos;s still open.</Heading>
        <Button
          variant="secondary"
          size="sm"
          nativeButton={false}
          render={<RegisterLink>Take a seat</RegisterLink>}
        />
      </section>
    </aside>
  );
}
