"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LoginLink,
  LogoutLink,
  RegisterLink,
} from "@kinde-oss/kinde-auth-nextjs/components";
import {
  RiDiceLine,
  RiGroupLine,
  RiHome5Line,
  RiLock2Line,
  RiLogoutCircleRLine,
  RiSettings3Line,
  RiStackLine,
  RiUser3Line,
  type RemixiconComponentType,
} from "@remixicon/react";
import { ChipaeLogo } from "@/components/chipae-logo";
import { Button } from "@/components/ui/button";
import { GAME_CATALOG } from "@/lib/game/catalog";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: RemixiconComponentType;
  /** Extra path prefixes that count as active. */
  match?: string[];
};

const PLAY_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: RiHome5Line },
  { href: "/lobbies", label: "Lobbies", icon: RiStackLine, match: ["/lobby"] },
];

const SOCIAL_ITEMS: NavItem[] = [
  { href: "/friends", label: "Friends", icon: RiGroupLine },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-5 pb-1.5 font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
      {children}
    </p>
  );
}

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
        active
          ? "bg-primary/10 font-medium text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="size-4.5 shrink-0" />
      {item.label}
    </Link>
  );
}

/**
 * Left rail of the lounge shell. `username` null = signed-out variant
 * (landing page): same destinations (the proxy routes them through sign-in),
 * auth CTAs in the footer.
 */
export function AppSidebar({ username }: { username: string | null }) {
  const pathname = usePathname();

  // Games play full screen — the shell steps aside (ADR-0004).
  if (/^\/lobby\/[^/]+\/game/.test(pathname)) return null;

  const isActive = (item: NavItem) =>
    pathname === item.href ||
    pathname.startsWith(`${item.href}/`) ||
    (item.match?.some((m) => pathname.startsWith(m)) ?? false);

  const youItems: NavItem[] = username
    ? [
        { href: `/player/${username}`, label: "Profile", icon: RiUser3Line },
        { href: "/settings", label: "Settings", icon: RiSettings3Line },
      ]
    : [];

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-card/40 lg:flex">
      <Link
        href={username ? "/dashboard" : "/"}
        className="flex items-center px-5 pt-4 pb-2"
      >
        <ChipaeLogo size={82} className="w-1/2 mx-auto" priority />
      </Link>

      <nav className="flex flex-1 flex-col overflow-y-auto px-3 pb-4">
        <SectionLabel>Play</SectionLabel>
        {PLAY_ITEMS.map((item) => (
          <NavRow key={item.href} item={item} active={isActive(item)} />
        ))}

        <SectionLabel>Social</SectionLabel>
        {SOCIAL_ITEMS.map((item) => (
          <NavRow key={item.href} item={item} active={isActive(item)} />
        ))}

        {youItems.length > 0 && (
          <>
            <SectionLabel>You</SectionLabel>
            {youItems.map((item) => (
              <NavRow key={item.href} item={item} active={isActive(item)} />
            ))}
          </>
        )}

        <SectionLabel>Games</SectionLabel>
        {GAME_CATALOG.map((game) =>
          game.available ? (
            <Link
              key={game.id}
              href="/lobbies"
              title={`${game.tagline} (${game.minPlayers}–${game.maxPlayers} players)`}
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {game.logo ? (
                <Image
                  src={game.logo}
                  alt=""
                  width={36}
                  height={36}
                  unoptimized
                  className="size-4.5 shrink-0 object-contain"
                />
              ) : (
                <RiDiceLine className="size-4.5 shrink-0" />
              )}
              {game.name}
            </Link>
          ) : (
            <span
              key={game.id}
              className="flex cursor-default items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground/50"
              title="In the shuffle — coming soon"
            >
              {game.logo ? (
                <Image
                  src={game.logo}
                  alt=""
                  width={36}
                  height={36}
                  unoptimized
                  className="size-4.5 shrink-0 object-contain opacity-60 grayscale"
                />
              ) : (
                <RiDiceLine className="size-4.5 shrink-0" />
              )}
              {game.name}
              <RiLock2Line className="ml-auto size-3.5" />
            </span>
          )
        )}
      </nav>

      <div className="flex flex-col gap-2 border-t border-border p-4">
        {username ? (
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            className="justify-start"
            render={
              <LogoutLink>
                <RiLogoutCircleRLine data-icon="inline-start" />
                Log out
              </LogoutLink>
            }
          />
        ) : (
          <>
            {/* Secondary: the rail persists across views, so the gold chip
                stays reserved for each page's own primary action. */}
            <Button
              variant="secondary"
              nativeButton={false}
              render={<RegisterLink>Take a seat</RegisterLink>}
            />
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<LoginLink>Sign in</LoginLink>}
            />
          </>
        )}
      </div>
    </aside>
  );
}
