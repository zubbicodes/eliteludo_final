import type { Color } from './types';
import { COLORS } from './types';

const OPPOSITE_PAIRS: readonly (readonly [Color, Color])[] = [
  ['red', 'yellow'],
  ['green', 'blue'],
];

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

  return shuffle([...COLORS], rng).slice(0, playerCount);
}

export function isOppositePair(a: Color, b: Color): boolean {
  return oppositeColor(a) === b;
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
