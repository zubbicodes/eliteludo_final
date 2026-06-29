import assert from 'node:assert/strict';
import test from 'node:test';

import { COLOR_START_INDEX, SAFE_TRACK_INDICES } from '../src/game/board';
import {
  addRoll,
  advanceToNextPlayer,
  applyMove,
  checkWin,
  finishMove,
  getValidMoves,
  makeInitialGameState,
  tryMove,
} from '../src/game/rules';
import { assignRuntimeColors, isOppositePair, oppositeColor } from '../src/game/seating';
import { visualCornerForColor } from '../src/game/perspective';
import type { GameState, MoveOption, TokenId } from '../src/game/types';

test('rolling a six banks it and requires the bonus roll before moving', () => {
  const state = makeInitialGameState('red', 1);
  const next = addRoll(state, 6);

  assert.equal(next.status, 'awaiting_roll');
  assert.deepEqual(next.dicePool, [6]);
  assert.equal(next.currentPlayerIdx, state.currentPlayerIdx);
});

test('bonus roll settles both dice into the playable pool', () => {
  let state = makeInitialGameState('red', 1);
  state.players[0].tokens[0].location = { kind: 'track', index: COLOR_START_INDEX.red };
  state = addRoll(state, 6);
  state = addRoll(state, 3);

  assert.equal(state.status, 'awaiting_move');
  assert.deepEqual(state.dicePool, [6, 3]);
  assert.deepEqual(
    [...new Set(getValidMoves(state, 'red').map((move) => move.dieValue))].sort(),
    [3, 6],
  );
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

test('spending a banked six does not grant another bonus roll', () => {
  const state: GameState = makeInitialGameState('red', 1);
  const rolled = addRoll(addRoll(state, 6), 3);
  const move = getValidMoves(rolled, 'red').find((m) => m.tokenId === 'red-0' && m.dieValue === 6);

  assert.ok(move);
  const moved = applyMove(rolled, move);
  const settled = finishMove(moved);

  assert.equal(settled.status, 'awaiting_move');
  assert.equal(settled.currentPlayerIdx, 0);
  assert.deepEqual(settled.dicePool, [3]);
});

test('six and its bonus result are both played before the turn ends', () => {
  let state: GameState = makeInitialGameState('red', 1);
  state = addRoll(state, 6);
  state = addRoll(state, 3);

  let move = getValidMoves(state, 'red').find((m) => m.tokenId === 'red-0' && m.dieValue === 6);
  assert.ok(move);
  state = finishMove(applyMove(state, move));

  assert.equal(state.status, 'awaiting_move');
  assert.equal(state.currentPlayerIdx, 0);
  assert.deepEqual(state.dicePool, [3]);

  move = getValidMoves(state, 'red').find((m) => m.tokenId === 'red-0' && m.dieValue === 3);
  assert.ok(move);
  state = finishMove(applyMove(state, move));

  assert.equal(state.status, 'awaiting_roll');
  assert.equal(state.currentPlayerIdx, 1);
});

test('runtime 1v1 color assignment always uses opposite corners', () => {
  for (let i = 0; i < 30; i++) {
    const seats = assignRuntimeColors(2);
    assert.equal(seats.length, 2);
    assert.equal(isOppositePair(seats[0], seats[1]), true);
  }
});

test('runtime 4p color assignment uses each color exactly once', () => {
  const seats = assignRuntimeColors(4);
  assert.deepEqual([...seats].sort(), ['blue', 'green', 'red', 'yellow']);
});

test('runtime 4p turn order follows the visual board circle from local player', () => {
  for (let i = 0; i < 30; i++) {
    const seats = assignRuntimeColors(4);
    assert.deepEqual(
      seats.map((color) => visualCornerForColor(color, seats[0])),
      ['bottomLeft', 'topLeft', 'topRight', 'bottomRight'],
    );
  }
});

test('runtime 3p color assignment creates three unique seats', () => {
  const seats = assignRuntimeColors(3);
  assert.equal(seats.length, 3);
  assert.equal(new Set(seats).size, 3);
});

test('runtime 3p turn order follows the selected visual board circle', () => {
  for (let i = 0; i < 30; i++) {
    const seats = assignRuntimeColors(3);
    const corners = seats.map((color) => visualCornerForColor(color, seats[0]));
    assert.equal(corners[0], 'bottomLeft');
    assert.deepEqual(
      [...corners].sort((a, b) =>
        ['bottomLeft', 'topLeft', 'topRight', 'bottomRight'].indexOf(a) -
        ['bottomLeft', 'topLeft', 'topRight', 'bottomRight'].indexOf(b),
      ),
      corners,
    );
  }
});

test('local 4p bot game advances clockwise around the visible board', () => {
  const seats = assignRuntimeColors(4);
  let state = makeInitialGameState(seats[0], 3, undefined, seats);

  assert.deepEqual(
    state.players.map((p) => visualCornerForColor(p.color, seats[0])),
    ['bottomLeft', 'topLeft', 'topRight', 'bottomRight'],
  );

  for (const corner of ['topLeft', 'topRight', 'bottomRight', 'bottomLeft']) {
    state = advanceToNextPlayer(state);
    assert.equal(visualCornerForColor(state.players[state.currentPlayerIdx].color, seats[0]), corner);
  }
});

test('perspective mapping places each assigned color bottom-left', () => {
  for (const color of ['red', 'green', 'yellow', 'blue'] as const) {
    assert.equal(visualCornerForColor(color, color), 'bottomLeft');
  }
});

test('opposite 2p color renders diagonally across from local player', () => {
  for (const color of ['red', 'green', 'yellow', 'blue'] as const) {
    assert.equal(visualCornerForColor(oppositeColor(color), color), 'topRight');
  }
});

test('local 2p bot game uses an opposite-corner opponent', () => {
  const seats = assignRuntimeColors(2, () => 0);
  const state = makeInitialGameState(seats[0], 1, undefined, seats);

  assert.equal(state.players.length, 2);
  assert.equal(state.players[0].isAI, false);
  assert.equal(state.players[1].isAI, true);
  assert.equal(isOppositePair(state.players[0].color, state.players[1].color), true);
});
