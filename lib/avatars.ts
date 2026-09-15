import {
  RiAliensLine,
  RiBearSmileLine,
  RiGhostLine,
  RiGamepadLine,
  RiRobot2Line,
  RiRocketLine,
  RiSwordLine,
  RiVipCrownLine,
  RiSkullLine,
  RiMagicLine,
  type RemixiconComponentType,
} from "@remixicon/react";

// Predefined avatar set (no uploads in v1). avatarId is persisted on User.
//
// `hue` is the avatar's own accent colour, used ONLY where there is no table:
// the picker, friends, profiles, chat, the crew rail. It is deliberately NOT a
// seat — ten avatars share six hues, so two of them can look alike, which is
// harmless off a table and wrong on one.
//
// At a table the colour comes from the player's real LobbyMember.seat, passed
// to <AvatarChip seat={…}>. See design/art-direction.md: player colours run in
// SEAT order, and seat 1 is always gold.
export type AvatarDef = {
  id: string;
  label: string;
  icon: RemixiconComponentType;
  /** chart-1..6 accent for off-table surfaces. Never a seat number. */
  hue: 1 | 2 | 3 | 4 | 5 | 6;
};

export const AVATARS: AvatarDef[] = [
  { id: "chip-gold", label: "High roller", icon: RiVipCrownLine, hue: 1 },
  { id: "ghost-mint", label: "Friendly ghost", icon: RiGhostLine, hue: 2 },
  { id: "blade-coral", label: "Duelist", icon: RiSwordLine, hue: 3 },
  { id: "bot-sky", label: "Tin thinker", icon: RiRobot2Line, hue: 4 },
  { id: "alien-lav", label: "Off-worlder", icon: RiAliensLine, hue: 5 },
  { id: "bear-gold", label: "Table bear", icon: RiBearSmileLine, hue: 6 },
  { id: "pad-mint", label: "Button masher", icon: RiGamepadLine, hue: 2 },
  { id: "skull-coral", label: "Hard mode", icon: RiSkullLine, hue: 3 },
  { id: "rocket-sky", label: "Speedrunner", icon: RiRocketLine, hue: 4 },
  { id: "wand-lav", label: "Rule bender", icon: RiMagicLine, hue: 5 },
];

export const AVATAR_IDS = AVATARS.map((a) => a.id);

export function getAvatar(id: string): AvatarDef {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0];
}
