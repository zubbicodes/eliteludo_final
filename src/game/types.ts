// Pure types — no React Native, no Skia, no Supabase imports.
// This module is the contract between the rules engine, the AI, and the UI.

export const COLORS = ['red', 'green', 'yellow', 'blue'] as const;
export type Color = (typeof COLORS)[number];

/**
 * A token's location is a discriminated union over the four conceptual zones:
 *  - 'home'      → still in the player's home base (waiting to be released by a 6)
 *  - 'track'     → somewhere on the 52-cell outer track (index 0..51, absolute)
 *  - 'home_col'  → on the player's 5-cell home column (index 0..4, with 4 nearest to finish)
 *  - 'finished'  → reached the center; out of play
 */
export type TokenLocation =
  | { kind: 'home'; slot: 0 | 1 | 2 | 3 }
  | { kind: 'track'; index: number }
  | { kind: 'home_col'; index: 0 | 1 | 2 | 3 | 4 }
  | { kind: 'finished' };

export type TokenId = `${Color}-${0 | 1 | 2 | 3}`;

export type Token = {
  id: TokenId;
  color: Color;
  location: TokenLocation;
};

export type Player = {
  color: Color;
  isAI: boolean;
  /** Display name (for UI / result screen). */
  name: string;
  tokens: [Token, Token, Token, Token];
};

export type GameStatus = 'idle' | 'rolling' | 'awaiting_move' | 'animating' | 'finished';

export type GameState = {
  players: Player[];
  /** Index into `players` of whose turn it is. */
  currentPlayerIdx: number;
  /** Last dice value rolled in the active turn, or null if not yet rolled. */
  dice: number | null;
  /** Number of consecutive sixes the active player has rolled this turn (max 2 — 3 forfeits). */
  sixStreak: number;
  status: GameStatus;
  winnerColor: Color | null;
};

/**
 * Result of evaluating a single candidate move (token + dice value).
 * `to` is the location the token would land on if the move is applied.
 * `captures` lists token IDs that would be sent home (length 0 or 1 in classic ludo).
 */
export type MoveOption = {
  tokenId: TokenId;
  from: TokenLocation;
  to: TokenLocation;
  captures: TokenId[];
};
