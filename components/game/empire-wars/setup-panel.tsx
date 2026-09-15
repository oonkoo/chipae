"use client";

import { useState } from "react";
import { RiCheckLine, RiRobot2Line } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { SETUP } from "@/lib/game/data/empire-wars";
import type { MatchSettings } from "@/lib/game/empire-wars/rules";
import type { SetupView } from "@/lib/game/empire-wars/view";
import { cn } from "@/lib/utils";
import { TurnClock } from "./prompt";
import { roundsLabel, settingsLine, targetLabel } from "./feed";
import { FrameCorners } from "./art";

// Match setup (GDD > Match setup). Before the first roll every human picks a
// target ("Assets") and a round limit. If the picks differ, a toss decides
// whose rules the table plays; CPUs play by whatever the humans choose. Picks
// are public, so everyone can see what the toss is between.

function Choices({
  label,
  hint,
  options,
  selected,
  format,
  onSelect,
  disabled,
}: {
  label: string;
  hint: string;
  options: readonly (number | null)[];
  selected: number | null;
  format: (value: number | null) => string;
  onSelect: (value: number | null) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      </p>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-4 gap-1.5">
        {options.map((option) => {
          const active = option === selected;
          return (
            <button
              key={String(option)}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onSelect(option)}
              className={cn(
                // Four to a row fits "Unlimited" on a phone only at text-xs.
                "rounded-xl border px-0.5 py-2 font-heading text-xs transition-colors disabled:opacity-60 @md:text-base",
                active
                  ? "border-[var(--ew-gold)] bg-[color-mix(in_srgb,var(--ew-gold)_20%,transparent)] text-[var(--ew-gold)]"
                  : "ew-chip text-foreground/85 hover:border-[var(--ew-brass)]"
              )}
            >
              {format(option)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SetupPanel({
  setup,
  youId,
  hasCpus,
  nameOf,
  colorOf,
  onPick,
  busy,
  error,
}: {
  setup: SetupView;
  /** The viewer's seat, or null for a spectator. */
  youId: string | null;
  hasCpus: boolean;
  nameOf: (memberId: string) => string;
  colorOf: (memberId: string) => string;
  onPick: (settings: MatchSettings) => void;
  busy: boolean;
  error: string | null;
}) {
  const picker = youId !== null && setup.humans.includes(youId);
  const mine = setup.picks.find((p) => p.memberId === youId) ?? null;
  const [choice, setChoice] = useState<MatchSettings>(() =>
    mine ? { target: mine.target, rounds: mine.rounds } : setup.defaults
  );
  const lockedIn = !!mine && mine.target === choice.target && mine.rounds === choice.rounds;
  const otherHumans = setup.humans.filter((id) => id !== youId);

  const intro = !picker
    ? "The players are choosing the rules."
    : otherHumans.length === 0
      ? "Pick the rules — the CPUs play by yours."
      : "Everyone picks. If you don't all agree, a toss decides whose rules the table plays.";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ew-setup"
      className="ew-backdrop absolute inset-0 z-40 flex items-center justify-center rounded-3xl p-3 backdrop-blur-sm"
    >
      <div className="ew-dialog relative isolate flex max-h-full w-full max-w-md flex-col gap-4 overflow-y-auto rounded-2xl p-4 @md:p-5">
        <FrameCorners className="size-7 @md:size-9" />
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 id="ew-setup" className="font-heading text-xl text-[var(--ew-gold)]">
              Set up the match
            </h2>
            <p className="text-xs leading-snug text-muted-foreground">{intro}</p>
          </div>
          <TurnClock expiresAt={setup.expiresAt} always />
        </div>

        <Choices
          label="Assets"
          hint="net worth that wins"
          options={setup.targets}
          selected={choice.target}
          format={targetLabel}
          onSelect={(target) => setChoice((c) => ({ ...c, target }))}
          disabled={!picker || busy}
        />
        <Choices
          label="Rounds"
          hint="then the richest wins"
          options={setup.rounds}
          selected={choice.rounds}
          format={roundsLabel}
          onSelect={(rounds) => setChoice((c) => ({ ...c, rounds }))}
          disabled={!picker || busy}
        />

        <div className="flex flex-col items-center gap-0.5 text-center">
          <p className="text-sm text-foreground first-letter:uppercase">
            {settingsLine(choice.target, choice.rounds)}
          </p>
          {choice.target === null && choice.rounds === null && (
            <p className="text-[11px] text-muted-foreground">
              Nobody knocked out by round {SETUP.safetyRounds}? The richest wins.
            </p>
          )}
        </div>

        {picker && (
          <Button
            variant="game"
            className="w-full"
            disabled={busy || lockedIn}
            onClick={() => onPick(choice)}
          >
            {lockedIn ? (
              <>
                <RiCheckLine data-icon="inline-start" />
                Locked in
              </>
            ) : mine ? (
              "Change my pick"
            ) : (
              "Lock in"
            )}
          </Button>
        )}
        {error && <p className="text-center text-[11px] text-destructive">{error}</p>}

        {/* Who the table is waiting on, and what the toss would be between. */}
        <ul className="flex flex-col gap-1 border-t border-border pt-3">
          {setup.humans.map((id) => {
            const pick = setup.picks.find((p) => p.memberId === id);
            return (
              <li key={id} className="flex items-center gap-2 text-xs">
                <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: colorOf(id) }} />
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {nameOf(id)}
                  {id === youId && <span className="text-muted-foreground"> (you)</span>}
                </span>
                <span
                  className={cn(
                    "shrink-0 font-mono tabular-nums",
                    pick ? "text-[var(--ew-gain)]" : "text-muted-foreground"
                  )}
                >
                  {pick
                    ? `${targetLabel(pick.target)} · ${roundsLabel(pick.rounds)}${pick.rounds === null ? "" : " rounds"}`
                    : setup.waitingOn.includes(id)
                      ? "choosing…"
                      : "—"}
                </span>
              </li>
            );
          })}
          {hasCpus && (
            <li className="flex items-center gap-2 text-xs text-muted-foreground">
              <RiRobot2Line aria-hidden className="size-3.5 shrink-0" />
              CPUs play by the table&apos;s choice
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
