"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { TurnEvent } from "@/lib/game/empire-wars/rules";
import { moneyFlowsOf, type MoneyFlow } from "./feed";

// Money moving across the table (GDD > UI: "Show money moving. When rent is
// paid, the amount flies from the payer to the owner… it teaches rent without
// a word.")
//
// Deliberately imperative: each flight is a DOM node animated with the Web
// Animations API and removed when it lands. That is an effect doing what
// effects are for — syncing with something outside React — and it means a
// flight never re-renders the board it flies over.
//
// Endpoints are found by `data-ew-anchor` attributes: `seat:<memberId>` on
// player panels, `tile:<n>` on tiles, `pot` (the treasury) and `bank` in the
// middle. Amounts are bare numbers: everything on this table is coins.

const FLIGHT_MS = 700;
/** Gap between flights from one move, so they read as separate payments. */
const STAGGER_MS = 240;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function centreOf(container: HTMLElement, anchor: string) {
  // A player's panel exists twice — inside the ring on a wide table, in a row
  // on a narrow one — and only one is displayed. Fly to the one on screen.
  const rect = Array.from(
    container.querySelectorAll<HTMLElement>(`[data-ew-anchor="${anchor}"]`)
  )
    .map((el) => el.getBoundingClientRect())
    .find((r) => r.width > 0 && r.height > 0);
  if (!rect) return null;
  const box = container.getBoundingClientRect();
  return {
    x: rect.left - box.left + rect.width / 2,
    y: rect.top - box.top + rect.height / 2,
  };
}

function chip(container: HTMLElement, text: string, tone: "gold" | "gain" | "loss") {
  const node = document.createElement("span");
  node.setAttribute("aria-hidden", "true");
  node.className =
    "pointer-events-none absolute top-0 left-0 z-40 rounded-full px-1.5 py-0.5 font-mono text-[11px] font-semibold whitespace-nowrap tabular-nums shadow-lg";
  node.style.background =
    tone === "gold" ? "var(--ew-gold)" : "color-mix(in srgb, var(--ew-ink) 85%, transparent)";
  node.style.color =
    tone === "gold" ? "var(--ew-ink)" : tone === "gain" ? "var(--ew-gain)" : "var(--ew-loss)";
  node.textContent = text;
  container.appendChild(node);
  return { node, halfW: node.offsetWidth / 2, halfH: node.offsetHeight / 2 };
}

/** A "+$360" / "−$360" that rises off a player panel and fades. */
function pop(container: HTMLElement, anchor: string, text: string, tone: "gain" | "loss") {
  const at = centreOf(container, anchor);
  if (!at) return;
  const { node, halfW, halfH } = chip(container, text, tone);
  const x = at.x - halfW;
  const y = at.y - halfH;
  node.animate(
    [
      { transform: `translate(${x}px, ${y}px)`, opacity: 0 },
      { transform: `translate(${x}px, ${y - 10}px)`, opacity: 1, offset: 0.2 },
      { transform: `translate(${x}px, ${y - 26}px)`, opacity: 0 },
    ],
    { duration: 1100, easing: "ease-out" }
  ).onfinish = () => node.remove();
}

function fly(container: HTMLElement, flow: MoneyFlow) {
  const from = centreOf(container, flow.from);
  const to = centreOf(container, flow.to);
  if (!from || !to) return;
  const amount = flow.amount.toLocaleString("en-US");

  if (flow.from.startsWith("seat:")) pop(container, flow.from, `−${amount}`, "loss");

  const { node, halfW, halfH } = chip(container, amount, "gold");
  const start = `translate(${from.x - halfW}px, ${from.y - halfH}px)`;
  const end = `translate(${to.x - halfW}px, ${to.y - halfH}px)`;
  const animation = node.animate(
    [
      { transform: `${start} scale(0.7)`, opacity: 0 },
      { transform: `${start} scale(1)`, opacity: 1, offset: 0.12 },
      { transform: `${end} scale(1)`, opacity: 1, offset: 0.88 },
      { transform: `${end} scale(0.7)`, opacity: 0 },
    ],
    { duration: FLIGHT_MS, easing: "cubic-bezier(0.65, 0, 0.35, 1)" }
  );
  animation.onfinish = () => {
    node.remove();
    if (flow.to.startsWith("seat:")) pop(container, flow.to, `+${amount}`, "gain");
  };
}

export function MoneyFlights({
  containerRef,
  events,
  version,
  startDelayMs,
}: {
  containerRef: RefObject<HTMLElement | null>;
  events: TurnEvent[];
  version: number;
  /** Hold the first flight until the moving piece has arrived. */
  startDelayMs: number;
}) {
  const seen = useRef<number | null>(null);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  // The props arrive as fresh objects on every server refresh even when
  // nothing changed, so the flight effect keys on `version` alone and reads
  // the rest from here. Keying it on `events` would let a no-op refresh cancel
  // flights that are still waiting for the piece to arrive.
  const latest = useRef({ events, startDelayMs });
  useEffect(() => {
    latest.current = { events, startDelayMs };
  });

  // Pending flights are cancelled on unmount only — never by the next move.
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const lastSeen = seen.current;
    seen.current = version;
    // Joining a match in progress shouldn't replay money that already moved.
    if (!container || lastSeen === null || version <= lastSeen) return;
    if (prefersReducedMotion()) return;

    const flows: MoneyFlow[] = latest.current.events
      .filter((e) => e.seq > lastSeen)
      .flatMap(moneyFlowsOf);

    flows.forEach((flow, i) => {
      timers.current.push(
        setTimeout(
          () => fly(container, flow),
          latest.current.startDelayMs + i * STAGGER_MS
        )
      );
    });
  }, [containerRef, version]);

  return null;
}
