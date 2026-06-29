import type { Color } from './types';
import { COLORS } from './types';

const OPPOSITE_PAIRS: readonly (readonly [Color, Color])[] = [
  ['red', 'yellow'],
  ['green', 'blue'],
];

const BOARD_TURN_ORDER: readonly Color[] = ['blue', 'red', 'green', 'yellow'];

export function oppositeColor(color: Color): Color {
  switch (color) {
    case 'red':
      return 'yellow';
    case 'yellow':
      return 'red';
    case 'green':
      return 'blue';
    case 'blue':
      return 'green';
  }
}

export function assignRuntimeColors(
  playerCount: 2 | 3 | 4,
  rng: () => number = Math.random,
): Color[] {
  if (playerCount === 2) {
    const pair = OPPOSITE_PAIRS[Math.floor(rng() * OPPOSITE_PAIRS.length)];
    return shuffle([...pair], rng);
  }

  const selected = shuffle([...COLORS], rng).slice(0, playerCount);
  return orderColorsByBoardTurn(selected, selected[0]);
}

export function isOppositePair(a: Color, b: Color): boolean {
  return oppositeColor(a) === b;
}

export function orderColorsByBoardTurn(colors: Color[], anchorColor: Color): Color[] {
  return [...colors].sort(
    (a, b) => boardTurnDistance(anchorColor, a) - boardTurnDistance(anchorColor, b),
  );
}

function boardTurnDistance(anchorColor: Color, color: Color): number {
  const anchorIndex = BOARD_TURN_ORDER.indexOf(anchorColor);
  const colorIndex = BOARD_TURN_ORDER.indexOf(color);
  return (colorIndex - anchorIndex + BOARD_TURN_ORDER.length) % BOARD_TURN_ORDER.length;
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
