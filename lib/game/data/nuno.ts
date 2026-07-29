// Tuning knobs for Nuno (design/gdd/nuno-core.md, ADR-0003). Gameplay
// values live here, never inline in logic code.
export const NUNO_CONFIG = {
  gameType: "nuno",
  handSize: 7,
  minPlayers: 2,
  maxPlayers: 6,
  /** Cards drawn by a player caught with 1 card and no "Nuno!" call. */
  unoPenaltyCards: 2,
  draw2Count: 2,
  wild4DrawCount: 4,
  /** Standard 108-card composition. */
  deck: {
    zerosPerColor: 1,
    copiesPerNumber: 2, // values 1–9
    skipsPerColor: 2,
    reversesPerColor: 2,
    draw2sPerColor: 2,
    wilds: 4,
    wild4s: 4,
  },
  /** Client-side bot pacing — bots feel like casual players. */
  botDelayMsMin: 1000,
  botDelayMsMax: 3000,
} as const;
