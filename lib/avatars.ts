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
// seat maps to the player colors chart-1..5 (design/art-direction.md).
export type AvatarDef = {
  id: string;
  label: string;
  icon: RemixiconComponentType;
  seat: 1 | 2 | 3 | 4 | 5;
};

export const AVATARS: AvatarDef[] = [
  { id: "chip-gold", label: "High roller", icon: RiVipCrownLine, seat: 1 },
  { id: "ghost-mint", label: "Friendly ghost", icon: RiGhostLine, seat: 2 },
  { id: "blade-coral", label: "Duelist", icon: RiSwordLine, seat: 3 },
  { id: "bot-sky", label: "Tin thinker", icon: RiRobot2Line, seat: 4 },
  { id: "alien-lav", label: "Off-worlder", icon: RiAliensLine, seat: 5 },
  { id: "bear-gold", label: "Table bear", icon: RiBearSmileLine, seat: 1 },
  { id: "pad-mint", label: "Button masher", icon: RiGamepadLine, seat: 2 },
  { id: "skull-coral", label: "Hard mode", icon: RiSkullLine, seat: 3 },
  { id: "rocket-sky", label: "Speedrunner", icon: RiRocketLine, seat: 4 },
  { id: "wand-lav", label: "Rule bender", icon: RiMagicLine, seat: 5 },
];

export const AVATAR_IDS = AVATARS.map((a) => a.id);

export function getAvatar(id: string): AvatarDef {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0];
}
