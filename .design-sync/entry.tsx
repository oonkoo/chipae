/**
 * Scoped design-system entry for design-sync (see .design-sync/NOTES.md).
 *
 * Chipae is a Next.js app, not a component library — there is no `dist/` and
 * no package entry. The converter's synth-entry mode would `export *` from
 * every file under components/, which pulls `shell/*`, `notification-bell`,
 * `friend-action-button` and `presence-*` into the bundle; those import
 * `"use server"` actions and `server-only`, so the browser IIFE would drag in
 * Prisma, `pg` and the Pusher client and fail to build.
 *
 * This barrel re-exports the browser-safe surface only. Every export below is
 * the real shipped component — nothing here is a reimplementation.
 */
import * as React from "react";

export { Button, buttonVariants } from "../components/ui/button";
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
} from "../components/ui/card";
export { Input } from "../components/ui/input";
export { Label } from "../components/ui/label";
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
export {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "../components/ui/popover";
export { AvatarChip } from "../components/avatar-chip";
export { ChipMark } from "../components/chip-mark";
export {
  NunoCardFace,
  NunoCardBack,
  NunoCardFan,
  NUNO_COLOR_VAR,
  type NunoCardSize,
} from "../components/game/nuno-card";

/**
 * Theme root for preview cards. The app hardcodes `class="dark"` on <html>
 * (app/layout.tsx) and dark is the only theme it ships, but a preview card
 * renders without that ancestor and would otherwise show the unshipped light
 * palette. Wired as `cfg.provider` so every card renders the real product.
 */
export function ChipaeTheme({ children }: { children?: React.ReactNode }) {
  // Set `dark` on the document root, not just this wrapper. Dialog and
  // Popover render their content through a Base UI Portal attached to
  // document.body — outside this subtree — so a wrapper-only class would
  // leave every overlay in the light palette the app never ships.
  // Idempotent, so React's double-render in StrictMode is harmless.
  if (typeof document !== "undefined") {
    document.documentElement.classList.add("dark");
  }
  return (
    <div className="dark bg-background text-foreground font-sans">
      {children}
    </div>
  );
}
