// Pure types — no React Native, no Skia, no Supabase imports.

export const COLORS = ['red', 'green', 'yellow', 'blue'] as const;
export type Color = (typeof COLORS)[number];

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
  name: string;
  avatarId: number;
  tokens: [Token, Token, Token, Token];
};

/**
 * Logical turn machine:
 *   awaiting_roll → (player presses ROLL) → rolling
 *   rolling       → (anim settles) → awaiting_roll (rolled 6) | awaiting_move | next-turn
 *   awaiting_move → (player picks token+die) → animating
 *   animating     → (token anim settles) → awaiting_move (more dice) | next-turn | finished
 */
export type GameStatus =
  | 'awaiting_roll'
  | 'rolling'
  | 'awaiting_move'
  | 'animating'
  | 'finished';

export type GameState = {
  players: Player[];
  currentPlayerIdx: number;
  /** Unplayed dice values for the current turn, in roll order. */
  dicePool: number[];
  /** Consecutive sixes rolled THIS turn. Reset when player changes or rolling phase ends. */
  consecutiveSixes: number;
  status: GameStatus;
  winnerColor: Color | null;
  /** Most-recently rolled die per color. Persists across turns so profiles can show "last roll". */
  lastRollByColor: Partial<Record<Color, number>>;
};

export type MoveOption = {
  tokenId: TokenId;
  /** Which die from the pool would be consumed by this move. */
  dieValue: number;
  from: TokenLocation;
  to: TokenLocation;
  captures: TokenId[];
};
