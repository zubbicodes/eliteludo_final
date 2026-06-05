import assert from 'node:assert/strict';
import test from 'node:test';

import { COLOR_START_INDEX, SAFE_TRACK_INDICES } from '../src/game/board';
import {
  addRoll,
  applyMove,
  checkWin,
  finishMove,
  getValidMoves,
  makeInitialGameState,
  tryMove,
} from '../src/game/rules';
import type { GameState, MoveOption, TokenId } from '../src/game/types';

test('rolling a six keeps the player on roll and adds to dice pool', () => {
  const state = makeInitialGameState('red', 1);
  const next = addRoll(state, 6);

  assert.equal(next.status, 'awaiting_roll');
  assert.deepEqual(next.dicePool, [6]);
  assert.equal(next.currentPlayerIdx, state.currentPlayerIdx);
});

test('three consecutive sixes forfeits the turn', () => {
  let state = makeInitialGameState('red', 1);
  state = addRoll(state, 6);
  state = addRoll(state, 6);
  state = addRoll(state, 6);

  assert.equal(state.status, 'awaiting_roll');
  assert.deepEqual(state.dicePool, []);
  assert.equal(state.currentPlayerIdx, 1);
});

test('token in home can only leave on six', () => {
  const state = makeInitialGameState('red', 1);
  const token = state.players[0].tokens[0];

  assert.equal(tryMove(token, 5), null);
  assert.deepEqual(tryMove(token, 6), {
    kind: 'track',
    index: COLOR_START_INDEX.red,
  });
});

test('capture sends opponent token back home on unsafe cells', () => {
  const state: GameState = makeInitialGameState('red', 1);
  state.dicePool = [1];
  state.status = 'awaiting_move';
  state.players[0].tokens[0].location = { kind: 'track', index: 0 };
  state.players[1].tokens[0].location = { kind: 'track', index: 1 };

  assert.equal(SAFE_TRACK_INDICES.has(1), false);
  const move = getValidMoves(state, 'red').find((m) => m.tokenId === 'red-0' && m.dieValue === 1);

  assert.ok(move);
  assert.deepEqual(move.captures, ['green-0']);

  const next = applyMove(state, move);
  const captured = next.players[1].tokens[0].location;
  assert.equal(captured.kind, 'home');
});

test('safe cells prevent capture', () => {
  const safeIndex = [...SAFE_TRACK_INDICES][0];
  const state: GameState = makeInitialGameState('red', 1);
  state.dicePool = [1];
  state.status = 'awaiting_move';
  state.players[0].tokens[0].location = { kind: 'track', index: safeIndex - 1 };
  state.players[1].tokens[0].location = { kind: 'track', index: safeIndex };

  const move = getValidMoves(state, 'red').find((m) => m.tokenId === 'red-0' && m.dieValue === 1);

  assert.ok(move);
  assert.deepEqual(move.captures, []);
});

test('finishing a token after capture or finish grants bonus roll', () => {
  const state: GameState = makeInitialGameState('red', 1);
  const move: MoveOption = {
    tokenId: 'red-0' as TokenId,
    dieValue: 1,
    from: { kind: 'home_col', index: 4 },
    to: { kind: 'finished' },
    captures: [],
  };
  state.status = 'awaiting_move';
  state.dicePool = [1];
  state.players[0].tokens[0].location = move.from;

  const moved = applyMove(state, move);
  const settled = finishMove(moved);

  assert.equal(settled.status, 'awaiting_roll');
  assert.equal(settled.currentPlayerIdx, 0);
});

test('capture with remaining dice in pool grants bonus roll immediately', () => {
  const state: GameState = makeInitialGameState('red', 1);
  // Red at start (0), green 6 steps ahead on unsafe cell
  state.players[0].tokens[0].location = { kind: 'track', index: 0 };
  state.players[1].tokens[0].location = { kind: 'track', index: 6 };
  state.dicePool = [6, 5];
  state.status = 'awaiting_move';

  const move = getValidMoves(state, 'red').find((m) => m.tokenId === 'red-0' && m.dieValue === 6);
  assert.ok(move);
  assert.deepEqual(move.captures, ['green-0']);

  const moved = applyMove(state, move);
  assert.deepEqual(moved.dicePool, [5]); // 5 still remains

  const settled = finishMove(moved);
  assert.equal(settled.status, 'awaiting_roll');
  assert.equal(settled.currentPlayerIdx, 0);
  assert.deepEqual(settled.dicePool, [5]); // remaining dice preserved
});

test('checkWin returns true when all tokens are finished', () => {
  const state: GameState = makeInitialGameState('red', 1);
  state.players[0].tokens.forEach((token) => {
    token.location = { kind: 'finished' };
  });

  assert.equal(checkWin(state, 'red'), true);
});
