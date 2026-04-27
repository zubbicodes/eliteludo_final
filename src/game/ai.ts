// Simple AI bot. Pure function — no RN, no I/O. Decides which legal move to play.
//
// Priority order (master prompt §Phase 1):
//   1. A move that captures an opponent.
//   2. A move that releases a token from home (rolled a 6).
//   3. The move that advances furthest along the track.
//   4. A move that lands on a globally safe cell (tie-breaker).

import { SAFE_TRACK_INDICES, progressFor } from './board';
import type { Color, GameState, MoveOption } from './types';
import { getValidMoves } from './rules';

export function chooseMove(
  state: GameState,
  color: Color,
  dice: number,
): MoveOption | null {
  const moves = getValidMoves(state, color, dice);
  if (moves.length === 0) return null;

  return moves.slice().sort((a, b) => score(b, color) - score(a, color))[0];
}

function score(move: MoveOption, color: Color): number {
  let s = 0;
  if (move.captures.length > 0) s += 10_000 * move.captures.length;
  if (move.from.kind === 'home') s += 1_000;
  s += progressFor(color, move.to) * 10;
  if (move.to.kind === 'track' && SAFE_TRACK_INDICES.has(move.to.index)) s += 5;
  return s;
}
