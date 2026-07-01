import type { MoveOption } from '@/src/game/types';

export function sameMoveOption(left: MoveOption | null | undefined, right: MoveOption | null | undefined) {
  if (!left || !right) return false;
  return (
    left.tokenId === right.tokenId &&
    left.dieValue === right.dieValue &&
    sameLocation(left.from, right.from) &&
    sameLocation(left.to, right.to)
  );
}

function sameLocation(left: MoveOption['from'], right: MoveOption['from']) {
  if (left.kind !== right.kind) return false;
  switch (left.kind) {
    case 'home':
      return right.kind === 'home' && left.slot === right.slot;
    case 'track':
      return right.kind === 'track' && left.index === right.index;
    case 'home_col':
      return right.kind === 'home_col' && left.index === right.index;
    case 'finished':
      return right.kind === 'finished';
  }
}
