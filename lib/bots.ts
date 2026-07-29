// CPU seat names — table-crew flavored, deterministic pick order.
const BOT_NAMES = [
  "Croupier",
  "Shuffles",
  "Ante",
  "Bluff",
  "Stacks",
  "The House",
  "Riffle",
  "Cutdeck",
];

export function pickBotName(taken: (string | null)[]): string {
  const used = new Set(taken.filter(Boolean));
  return BOT_NAMES.find((name) => !used.has(name)) ?? `CPU ${used.size + 1}`;
}

export const BOT_AVATAR_ID = "bot-sky";
