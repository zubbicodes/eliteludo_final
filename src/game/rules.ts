// Pure ludo rules engine. No React Native, no Skia, no I/O.
// All functions are deterministic given a seeded RNG (for testability later).

import {
  COLOR_START_INDEX,
  HOME_COL_LENGTH,
  OUTER_TRACK,
  SAFE_TRACK_INDICES,
  TOKENS_PER_PLAYER,
  TOTAL_TRACK_HOPS,
  isSameTrackCell,
  trackIndexForHop,
} from './board';
import type {
  Color,
  GameState,
  MoveOption,
  Player,
  Token,
  TokenId,
  TokenLocation,
} from './types';
import { COLORS } from './types';

// ---------- factories ----------

export function makeInitialPlayer(color: Color, name: string, isAI: boolean): Player {
  const tokens = [0, 1, 2, 3].map<Token>((slot) => ({
    id: `${color}-${slot}` as TokenId,
    color,
    location: { kind: 'home', slot: slot as 0 | 1 | 2 | 3 },
  })) as Player['tokens'];
  return { color, name, isAI, tokens };
}

/** New solo-vs-AI match. `humanColor` controls which seat the human plays. */
export function makeInitialGameState(humanColor: Color = 'red', botCount = 3): GameState {
  const seats = COLORS.slice(0, 1 + botCount);
  const players: Player[] = seats.map((color) =>
    color === humanColor
      ? makeInitialPlayer(color, 'You', false)
      : makeInitialPlayer(color, `Bot ${color}`, true),
  );
  // Rotate so human plays first.
  const startIdx = players.findIndex((p) => p.color === humanColor);
  return {
    players,
    currentPlayerIdx: startIdx >= 0 ? startIdx : 0,
    dice: null,
    sixStreak: 0,
    status: 'idle',
    winnerColor: null,
  };
}

// ---------- dice ----------

/**
 * Roll a fair 1..6. Pass an injected RNG for tests; defaults to Math.random.
 * NOTE: in multiplayer, the server replaces this — the client never trusts itself.
 */
export function rollDice(rng: () => number = Math.random): number {
  return 1 + Math.floor(rng() * 6);
}

// ---------- move enumeration ----------

/**
 * Compute where `token` would land if its color rolled `dice`. Returns null if
 * the move is illegal (e.g. token in home and dice ≠ 6, or overshoot past finish).
 */
export function tryMove(token: Token, dice: number): TokenLocation | null {
  const loc = token.location;
  const color = token.color;

  if (loc.kind === 'finished') return null;

  if (loc.kind === 'home') {
    if (dice !== 6) return null;
    return { kind: 'track', index: COLOR_START_INDEX[color] };
  }

  if (loc.kind === 'track') {
    const start = COLOR_START_INDEX[color];
    const currentHop = (loc.index - start + OUTER_TRACK.length) % OUTER_TRACK.length;
    const nextHop = currentHop + dice;
    if (nextHop <= TOTAL_TRACK_HOPS) {
      // Stay on outer track.
      return { kind: 'track', index: trackIndexForHop(color, nextHop) };
    }
    // Cross into home column. nextHop = TOTAL_TRACK_HOPS + 1 + colIndex
    const colIdx = nextHop - TOTAL_TRACK_HOPS - 1;
    if (colIdx === HOME_COL_LENGTH) return { kind: 'finished' };
    if (colIdx > HOME_COL_LENGTH) return null; // overshoot
    return { kind: 'home_col', index: colIdx as 0 | 1 | 2 | 3 | 4 };
  }

  // home_col → finish
  const nextIdx = loc.index + dice;
  if (nextIdx === HOME_COL_LENGTH) return { kind: 'finished' };
  if (nextIdx > HOME_COL_LENGTH) return null; // overshoot
  return { kind: 'home_col', index: nextIdx as 0 | 1 | 2 | 3 | 4 };
}

/** All legal moves for the given color rolling the given dice. */
export function getValidMoves(state: GameState, color: Color, dice: number): MoveOption[] {
  const player = state.players.find((p) => p.color === color);
  if (!player) return [];

  const allTokens = state.players.flatMap((p) => p.tokens);
  const ownTokens = player.tokens;
  const moves: MoveOption[] = [];

  for (const token of ownTokens) {
    const to = tryMove(token, dice);
    if (!to) continue;

    // Can't land on a cell occupied by your own token (block).
    const blockedByOwn = ownTokens.some(
      (t) => t.id !== token.id && samePlace(t.location, to),
    );
    if (blockedByOwn) continue;

    // Determine captures.
    const captures: TokenId[] = [];
    if (to.kind === 'track' && !SAFE_TRACK_INDICES.has(to.index)) {
      for (const t of allTokens) {
        if (t.color === color) continue;
        if (isSameTrackCell(t.location, to)) captures.push(t.id);
      }
    }

    moves.push({ tokenId: token.id, from: token.location, to, captures });
  }

  return moves;
}

function samePlace(a: TokenLocation, b: TokenLocation): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'home':
      return b.kind === 'home' && a.slot === b.slot;
    case 'track':
      return b.kind === 'track' && a.index === b.index;
    case 'home_col':
      return b.kind === 'home_col' && a.index === b.index;
    case 'finished':
      return b.kind === 'finished';
  }
}

// ---------- mutations ----------

/**
 * Apply a previously computed `MoveOption` to a state, returning a new state.
 * Captured tokens are sent back to their lowest-numbered free home slot.
 * Does NOT advance the turn — call `advanceTurn` after the UI animation completes.
 */
export function applyMove(state: GameState, move: MoveOption): GameState {
  const players = state.players.map((p) => ({
    ...p,
    tokens: p.tokens.map((t) => ({ ...t })) as Player['tokens'],
  }));

  const moved = findToken(players, move.tokenId);
  moved.location = move.to;

  for (const capturedId of move.captures) {
    const cap = findToken(players, capturedId);
    cap.location = freeHomeSlot(players, cap.color);
  }

  // Win check.
  const movedPlayer = players.find((p) => p.color === moved.color)!;
  const won = movedPlayer.tokens.every((t) => t.location.kind === 'finished');

  return {
    ...state,
    players,
    winnerColor: won ? movedPlayer.color : state.winnerColor,
    status: won ? 'finished' : state.status,
  };
}

function findToken(players: Player[], id: TokenId): Token {
  for (const p of players) {
    for (const t of p.tokens) if (t.id === id) return t;
  }
  throw new Error(`token ${id} not found`);
}

function freeHomeSlot(players: Player[], color: Color): TokenLocation {
  const player = players.find((p) => p.color === color)!;
  const used = new Set(
    player.tokens
      .filter((t) => t.location.kind === 'home')
      .map((t) => (t.location as { kind: 'home'; slot: number }).slot),
  );
  for (let s = 0; s < TOKENS_PER_PLAYER; s++) {
    if (!used.has(s)) return { kind: 'home', slot: s as 0 | 1 | 2 | 3 };
  }
  // Shouldn't happen — there's always a free slot for a captured token.
  return { kind: 'home', slot: 0 };
}

// ---------- turn flow ----------

/**
 * Decide who plays next, based on the dice that was just played.
 * Rolling a 6 grants another roll, up to 2 consecutive sixes; a 3rd six forfeits.
 * Capturing also grants another roll (classic ludo rule).
 */
export function advanceTurn(
  state: GameState,
  rolled: number,
  capturedAny: boolean,
): GameState {
  const isSix = rolled === 6;
  const bonus = isSix || capturedAny;
  const nextStreak = isSix ? state.sixStreak + 1 : 0;

  // 3rd six → forfeit, no bonus regardless of capture.
  const grantBonus = bonus && nextStreak < 3;

  if (grantBonus) {
    return { ...state, dice: null, sixStreak: nextStreak, status: 'idle' };
  }

  // Pass to next non-finished player.
  let nextIdx = (state.currentPlayerIdx + 1) % state.players.length;
  for (let i = 0; i < state.players.length; i++) {
    const p = state.players[nextIdx];
    if (!p.tokens.every((t) => t.location.kind === 'finished')) break;
    nextIdx = (nextIdx + 1) % state.players.length;
  }

  return {
    ...state,
    dice: null,
    sixStreak: 0,
    currentPlayerIdx: nextIdx,
    status: 'idle',
  };
}

/**
 * Convenience: returns true if the current player has no legal move with `dice`.
 * Used to auto-skip when, e.g., all tokens are home and dice ≠ 6.
 */
export function hasNoMoves(state: GameState, dice: number): boolean {
  const player = state.players[state.currentPlayerIdx];
  return getValidMoves(state, player.color, dice).length === 0;
}

/** Did this player win? */
export function checkWin(state: GameState, color: Color): boolean {
  const p = state.players.find((pl) => pl.color === color);
  if (!p) return false;
  return p.tokens.every((t) => t.location.kind === 'finished');
}
