// Pure board geometry — no React Native, no Skia.
// Coordinates use (col, row) on a 15×15 grid with (0,0) at top-left.
// Each player travels 51 outer-track cells (50 hops) starting from their
// own start index, then 5 home-column cells, then the center "finish".

import type { Color, Token, TokenLocation } from './types';

export const BOARD_SIZE = 15;
export const HOME_COL_LENGTH = 5;
export const TOTAL_TRACK_HOPS = 50; // cells walked on outer track before turning into home column
export const TOKENS_PER_PLAYER = 4;

export type Cell = { col: number; row: number };

/**
 * The 52-cell outer track, in clockwise order starting from RED's start cell (index 0).
 * Each color's start cell is 13 indices apart.
 */
export const OUTER_TRACK: readonly Cell[] = [
  { col: 1, row: 6 }, // 0  — RED start
  { col: 2, row: 6 },
  { col: 3, row: 6 },
  { col: 4, row: 6 },
  { col: 5, row: 6 },
  { col: 6, row: 5 }, // 5
  { col: 6, row: 4 },
  { col: 6, row: 3 },
  { col: 6, row: 2 },
  { col: 6, row: 1 },
  { col: 6, row: 0 }, // 10
  { col: 7, row: 0 },
  { col: 8, row: 0 },
  { col: 8, row: 1 }, // 13 — GREEN start
  { col: 8, row: 2 },
  { col: 8, row: 3 }, // 15
  { col: 8, row: 4 },
  { col: 8, row: 5 },
  { col: 9, row: 6 },
  { col: 10, row: 6 },
  { col: 11, row: 6 }, // 20
  { col: 12, row: 6 },
  { col: 13, row: 6 },
  { col: 14, row: 6 },
  { col: 14, row: 7 },
  { col: 14, row: 8 }, // 25
  { col: 13, row: 8 }, // 26 — YELLOW start
  { col: 12, row: 8 },
  { col: 11, row: 8 },
  { col: 10, row: 8 },
  { col: 9, row: 8 }, // 30
  { col: 8, row: 9 },
  { col: 8, row: 10 },
  { col: 8, row: 11 },
  { col: 8, row: 12 },
  { col: 8, row: 13 }, // 35
  { col: 8, row: 14 },
  { col: 7, row: 14 },
  { col: 6, row: 14 },
  { col: 6, row: 13 }, // 39 — BLUE start
  { col: 6, row: 12 }, // 40
  { col: 6, row: 11 },
  { col: 6, row: 10 },
  { col: 6, row: 9 },
  { col: 5, row: 8 },
  { col: 4, row: 8 }, // 45
  { col: 3, row: 8 },
  { col: 2, row: 8 },
  { col: 1, row: 8 },
  { col: 0, row: 8 },
  { col: 0, row: 7 }, // 50
  { col: 0, row: 6 }, // 51
];

if (OUTER_TRACK.length !== 52) {
  // Defensive sanity check at module load — catches accidental typos in the table above.
  throw new Error(`OUTER_TRACK must have 52 cells, got ${OUTER_TRACK.length}`);
}

/** First outer-track index a color visits (its "start cell"). */
export const COLOR_START_INDEX: Record<Color, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

/**
 * "Globally safe" outer-track cell indices — tokens on these are immune to capture.
 * Standard ludo: each color's start cell + 4 mid-arm star squares.
 */
export const SAFE_TRACK_INDICES: ReadonlySet<number> = new Set([
  0, 8, 13, 21, 26, 34, 39, 47,
]);

/**
 * Each color's home column, ordered from "just past the outer track" (index 0)
 * to "adjacent to the finish" (index 4).
 */
export const HOME_COL_CELLS: Record<Color, readonly Cell[]> = {
  red: [
    { col: 1, row: 7 },
    { col: 2, row: 7 },
    { col: 3, row: 7 },
    { col: 4, row: 7 },
    { col: 5, row: 7 },
  ],
  green: [
    { col: 7, row: 1 },
    { col: 7, row: 2 },
    { col: 7, row: 3 },
    { col: 7, row: 4 },
    { col: 7, row: 5 },
  ],
  yellow: [
    { col: 13, row: 7 },
    { col: 12, row: 7 },
    { col: 11, row: 7 },
    { col: 10, row: 7 },
    { col: 9, row: 7 },
  ],
  blue: [
    { col: 7, row: 13 },
    { col: 7, row: 12 },
    { col: 7, row: 11 },
    { col: 7, row: 10 },
    { col: 7, row: 9 },
  ],
};

/** The 4 parking slots inside each player's home base (where tokens wait for a 6). */
export const HOME_BASE_SLOTS: Record<Color, readonly [Cell, Cell, Cell, Cell]> = {
  red: [
    { col: 1.5, row: 1.5 },
    { col: 3.5, row: 1.5 },
    { col: 1.5, row: 3.5 },
    { col: 3.5, row: 3.5 },
  ],
  green: [
    { col: 10.5, row: 1.5 },
    { col: 12.5, row: 1.5 },
    { col: 10.5, row: 3.5 },
    { col: 12.5, row: 3.5 },
  ],
  yellow: [
    { col: 10.5, row: 10.5 },
    { col: 12.5, row: 10.5 },
    { col: 10.5, row: 12.5 },
    { col: 12.5, row: 12.5 },
  ],
  blue: [
    { col: 1.5, row: 10.5 },
    { col: 3.5, row: 10.5 },
    { col: 1.5, row: 12.5 },
    { col: 3.5, row: 12.5 },
  ],
};

/** Center "finish" cell — visual position for finished tokens. */
export const FINISH_CELL: Cell = { col: 7, row: 7 };

/**
 * Convert how many hops `n` a color has traveled from its start (0..50) into the
 * absolute outer-track index. n=0 means the start cell itself.
 */
export function trackIndexForHop(color: Color, hop: number): number {
  return (COLOR_START_INDEX[color] + hop) % OUTER_TRACK.length;
}

/**
 * The number of hops a token at `loc` (for `color`) has progressed along its
 * full path. Used to compare "how far along" two tokens of the same color are.
 *
 * Range:
 *   home     → -1
 *   track    → 0..50 (0 at the start cell)
 *   home_col → 51..55
 *   finished → 56
 */
export function progressFor(color: Color, loc: TokenLocation): number {
  switch (loc.kind) {
    case 'home':
      return -1;
    case 'track': {
      const start = COLOR_START_INDEX[color];
      // Number of forward hops from start to here (mod 52). We bound to 0..50
      // because anything ≥ 51 should have been redirected into home_col already.
      const diff = (loc.index - start + OUTER_TRACK.length) % OUTER_TRACK.length;
      return diff;
    }
    case 'home_col':
      return TOTAL_TRACK_HOPS + 1 + loc.index; // 51..55
    case 'finished':
      return TOTAL_TRACK_HOPS + 1 + HOME_COL_LENGTH; // 56
  }
}

/** Visual cell for any token (used by the renderer). */
export function cellForToken(token: Token): Cell {
  const loc = token.location;
  switch (loc.kind) {
    case 'home':
      return HOME_BASE_SLOTS[token.color][loc.slot];
    case 'track':
      return OUTER_TRACK[loc.index];
    case 'home_col':
      return HOME_COL_CELLS[token.color][loc.index];
    case 'finished':
      return FINISH_CELL;
  }
}

/** True if two locations refer to the same outer-track cell. */
export function isSameTrackCell(a: TokenLocation, b: TokenLocation): boolean {
  return a.kind === 'track' && b.kind === 'track' && a.index === b.index;
}
