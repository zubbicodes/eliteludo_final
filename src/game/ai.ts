// Greedy AI bot — pure function. Picks one (token, dieValue) move per call.
// Priority: capture > release-from-home > furthest progress > land on safe cell.

import { SAFE_TRACK_INDICES, progressFor } from './board';
import { getValidMoves } from './rules';
import type { Color, GameState, MoveOption } from './types';

export function chooseMove(state: GameState, color: Color): MoveOption | null {
  const moves = getValidMoves(state, color);
  if (moves.length === 0) return null;
  return moves.slice().sort((a, b) => score(b, color) - score(a, color))[0];
}

function score(move: MoveOption, color: Color): number {
  let s = 0;
  if (move.captures.length > 0) s += 10_000 * move.captures.length;
  if (move.from.kind === 'home') s += 1_000;
  s += progressFor(color, move.to) * 10;
  if (move.to.kind === 'track' && SAFE_TRACK_INDICES.has(move.to.index)) s += 5;
  // Prefer using larger dice first when otherwise equal — keeps small dice for
  // home-column maneuvers near the end.
  s += move.dieValue;
  return s;
}
