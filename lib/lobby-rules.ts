// Pure lobby rules — no database, unit-testable.

// Max matches Nuno's 6-seat table (design/gdd/nuno-core.md).
export const LOBBY_LIMITS = {
  minPlayers: 2,
  maxPlayers: 6,
  defaultPlayers: 4,
} as const;

// Unambiguous alphabet — no O/0/I/1.
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;

export function randomLobbyCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

/** First open seat number, or null when the table is full. */
export function nextFreeSeat(
  takenSeats: number[],
  maxPlayers: number
): number | null {
  for (let seat = 1; seat <= maxPlayers; seat++) {
    if (!takenSeats.includes(seat)) return seat;
  }
  return null;
}
