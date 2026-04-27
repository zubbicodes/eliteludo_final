// Pure ludo rules engine. No React Native, no Skia, no I/O.
//
// Turn model: each turn the player accumulates a pool of dice values by
// repeatedly rolling while they roll a six (max 3 sixes — 3rd forfeits).
// Once rolling settles on a non-six (or 3 sixes are rolled), the player plays
// dice from the pool in any order, choosing which token + which die for each
// move, until the pool is empty or no legal move exists.

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

export function makeInitialPlayer(
  color: Color,
  name: string,
  isAI: boolean,
  avatarId: number,
): Player {
  const tokens = [0, 1, 2, 3].map<Token>((slot) => ({
    id: `${color}-${slot}` as TokenId,
    color,
    location: { kind: 'home', slot: slot as 0 | 1 | 2 | 3 },
  })) as Player['tokens'];
  return { color, name, isAI, avatarId, tokens };
}

export function makeInitialGameState(humanColor: Color = 'red', botCount = 3): GameState {
  const seats = COLORS.slice(0, 1 + botCount);
  const players: Player[] = seats.map((color, i) =>
    color === humanColor
      ? makeInitialPlayer(color, 'You', false, i)
      : makeInitialPlayer(color, `Bot ${color.charAt(0).toUpperCase() + color.slice(1)}`, true, i),
  );
  const startIdx = players.findIndex((p) => p.color === humanColor);
  return {
    players,
    currentPlayerIdx: startIdx >= 0 ? startIdx : 0,
    dicePool: [],
    consecutiveSixes: 0,
    status: 'awaiting_roll',
    winnerColor: null,
    lastRollByColor: {},
  };
}

// ---------- dice ----------

export function rollDice(rng: () => number = Math.random): number {
  return 1 + Math.floor(rng() * 6);
}

// ---------- rolling phase ----------

/**
 * Add a freshly-rolled value to the pool.
 *  - rolled 6 (and not the 3rd in a row) → status stays 'awaiting_roll' so the
 *    player can roll again before moving.
 *  - rolled non-6 → status moves to 'awaiting_move'.
 *  - 3rd consecutive 6 → forfeit: pool is wiped, turn passes to next player.
 */
export function addRoll(state: GameState, value: number): GameState {
  const isSix = value === 6;
  const sixes = isSix ? state.consecutiveSixes + 1 : 0;
  const color = state.players[state.currentPlayerIdx].color;
  const lastRollByColor = { ...state.lastRollByColor, [color]: value };

  if (sixes >= 3) {
    return advanceToNextPlayer({
      ...state,
      dicePool: [],
      consecutiveSixes: 0,
      lastRollByColor,
    });
  }

  return {
    ...state,
    dicePool: [...state.dicePool, value],
    consecutiveSixes: sixes,
    status: isSix ? 'awaiting_roll' : 'awaiting_move',
    lastRollByColor,
  };
}

// ---------- single-die move resolution ----------

/**
 * Where would `token` land if its color rolled `dice`? Returns null for an
 * illegal move (token in home and dice ≠ 6, or overshoot past finish).
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
      return { kind: 'track', index: trackIndexForHop(color, nextHop) };
    }
    const colIdx = nextHop - TOTAL_TRACK_HOPS - 1;
    if (colIdx === HOME_COL_LENGTH) return { kind: 'finished' };
    if (colIdx > HOME_COL_LENGTH) return null;
    return { kind: 'home_col', index: colIdx as 0 | 1 | 2 | 3 | 4 };
  }
  // home_col
  const nextIdx = loc.index + dice;
  if (nextIdx === HOME_COL_LENGTH) return { kind: 'finished' };
  if (nextIdx > HOME_COL_LENGTH) return null;
  return { kind: 'home_col', index: nextIdx as 0 | 1 | 2 | 3 | 4 };
}

// ---------- move enumeration over the pool ----------

/**
 * All legal (token, die) combinations for the current player using the active
 * dice pool. Two dice with the same value produce two `MoveOption`s for the
 * same token, but they're equivalent — UI dedupes by `dieValue` for the picker.
 */
export function getValidMoves(state: GameState, color: Color): MoveOption[] {
  const player = state.players.find((p) => p.color === color);
  if (!player) return [];
  const allTokens = state.players.flatMap((p) => p.tokens);
  const ownTokens = player.tokens;
  const moves: MoveOption[] = [];

  // Iterate unique die values for efficiency (same value → same target).
  const uniqueDice = Array.from(new Set(state.dicePool));
  for (const die of uniqueDice) {
    for (const token of ownTokens) {
      const to = tryMove(token, die);
      if (!to) continue;
      const blockedByOwn = ownTokens.some(
        (t) => t.id !== token.id && samePlace(t.location, to),
      );
      if (blockedByOwn) continue;
      const captures: TokenId[] = [];
      if (to.kind === 'track' && !SAFE_TRACK_INDICES.has(to.index)) {
        for (const t of allTokens) {
          if (t.color === color) continue;
          if (isSameTrackCell(t.location, to)) captures.push(t.id);
        }
      }
      moves.push({ tokenId: token.id, dieValue: die, from: token.location, to, captures });
    }
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
 * Apply a chosen move: move the token, resolve any capture, and remove ONE die
 * of the chosen value from the pool. Sets winnerColor if the active player has
 * just won. Status becomes 'animating' so the UI can animate before calling
 * `finishMove` to compute the next status.
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

  const movedPlayer = players.find((p) => p.color === moved.color)!;
  const won = movedPlayer.tokens.every((t) => t.location.kind === 'finished');

  return {
    ...state,
    players,
    dicePool: removeOne(state.dicePool, move.dieValue),
    winnerColor: won ? movedPlayer.color : state.winnerColor,
    status: 'animating',
    consecutiveSixes: 0,
  };
}

/**
 * Called after the move animation finishes. Decides the next status:
 *  - winner exists → 'finished'
 *  - dice still in pool with at least one legal move → 'awaiting_move'
 *  - dice still in pool but no legal move → forfeit remaining; advance turn
 *  - empty pool → advance turn
 */
export function finishMove(state: GameState): GameState {
  if (state.winnerColor) return { ...state, status: 'finished' };
  if (state.dicePool.length > 0) {
    const color = state.players[state.currentPlayerIdx].color;
    const moves = getValidMoves(state, color);
    if (moves.length > 0) return { ...state, status: 'awaiting_move' };
    // dead pool — skip remaining
    return advanceToNextPlayer({ ...state, dicePool: [] });
  }
  return advanceToNextPlayer(state);
}

/** Advance to the next player who hasn't already finished. */
export function advanceToNextPlayer(state: GameState): GameState {
  let nextIdx = (state.currentPlayerIdx + 1) % state.players.length;
  for (let i = 0; i < state.players.length; i++) {
    const p = state.players[nextIdx];
    if (!p.tokens.every((t) => t.location.kind === 'finished')) break;
    nextIdx = (nextIdx + 1) % state.players.length;
  }
  return {
    ...state,
    currentPlayerIdx: nextIdx,
    dicePool: [],
    consecutiveSixes: 0,
    status: 'awaiting_roll',
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
  return { kind: 'home', slot: 0 };
}

function removeOne(arr: number[], v: number): number[] {
  const i = arr.indexOf(v);
  if (i < 0) return arr.slice();
  return [...arr.slice(0, i), ...arr.slice(i + 1)];
}

// ---------- queries ----------

export function checkWin(state: GameState, color: Color): boolean {
  const p = state.players.find((pl) => pl.color === color);
  if (!p) return false;
  return p.tokens.every((t) => t.location.kind === 'finished');
}

export function tokensFinished(player: Player): number {
  return player.tokens.filter((t) => t.location.kind === 'finished').length;
}
