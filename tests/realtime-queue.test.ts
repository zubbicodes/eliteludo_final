import assert from 'node:assert/strict';
import test from 'node:test';

import { pickNewestValidEvent, shouldDeferEventForOptimisticMove, shouldReconcileBoardState } from '../src/gameplay/useRealtimeBoardQueue';
import type { MatchRealtimeEvent } from '../src/supabase/matchRealtimeEvents';
import type { MatchBoardState, MoveOption, TokenId } from '../src/game/types';

function event(overrides: Partial<MatchRealtimeEvent> = {}): MatchRealtimeEvent {
  return {
    eventId: 'evt-1',
    matchId: 'match-1',
    type: 'roll_result',
    version: 1,
    ...overrides,
  };
}

function moveOpt(overrides: Partial<MoveOption> = {}): MoveOption {
  return {
    tokenId: 'red-0' as TokenId,
    dieValue: 4,
    from: { kind: 'home', slot: 0 },
    to: { kind: 'track', index: 4 },
    captures: [],
    ...overrides,
  };
}

function boardStateWithMove(move: MoveOption, version: number): MatchBoardState {
  return { lastMove: move, version } as MatchBoardState;
}

// ── pickNewestValidEvent ─────────────────────────────────────────────

test('pickNewestValidEvent returns null for empty queue', () => {
  assert.equal(pickNewestValidEvent([], 0, new Set()), null);
});

test('pickNewestValidEvent returns the event with the highest version', () => {
  const events = [
    event({ eventId: 'a', version: 2 }),
    event({ eventId: 'b', version: 5 }),
    event({ eventId: 'c', version: 3 }),
  ];
  const picked = pickNewestValidEvent(events, 0, new Set());
  assert.equal(picked?.eventId, 'b');
  assert.equal(picked?.version, 5);
});

test('pickNewestValidEvent skips events at or below currentVersion', () => {
  const events = [
    event({ eventId: 'a', version: 3 }),
    event({ eventId: 'b', version: 1 }),
    event({ eventId: 'c', version: 2 }),
  ];
  const picked = pickNewestValidEvent(events, 3, new Set());
  assert.equal(picked, null);
});

test('pickNewestValidEvent skips events with already-seen eventIds', () => {
  const events = [
    event({ eventId: 'a', version: 5 }),
    event({ eventId: 'b', version: 6 }),
  ];
  const picked = pickNewestValidEvent(events, 0, new Set(['a', 'b']));
  assert.equal(picked, null);
});

test('pickNewestValidEvent picks newest among unseen events', () => {
  const events = [
    event({ eventId: 'a', version: 4 }),
    event({ eventId: 'b', version: 6 }),
    event({ eventId: 'c', version: 5 }),
  ];
  const picked = pickNewestValidEvent(events, 0, new Set(['a']));
  assert.equal(picked?.eventId, 'b');
});

test('pickNewestValidEvent accepts sync_required events even at current version', () => {
  const events = [
    event({ eventId: 'sync-1', type: 'sync_required', version: 1 }),
  ];
  const picked = pickNewestValidEvent(events, 5, new Set());
  assert.equal(picked?.eventId, 'sync-1');
});

// ── shouldDeferEventForOptimisticMove ────────────────────────────────

test('shouldDeferEventForOptimisticMove returns false when no optimistic move', () => {
  const move = moveOpt();
  const evt = event({ boardState: boardStateWithMove(move, 1) });
  assert.equal(shouldDeferEventForOptimisticMove(evt, null), false);
});

test('shouldDeferEventForOptimisticMove returns false when event has no boardState', () => {
  const move = moveOpt();
  assert.equal(shouldDeferEventForOptimisticMove(event(), move), false);
});

test('shouldDeferEventForOptimisticMove returns true when boardState.lastMove matches optimistic move', () => {
  const move = moveOpt({ tokenId: 'red-2' as TokenId, dieValue: 3 });
  const evt = event({ boardState: boardStateWithMove(move, 1) });
  assert.equal(shouldDeferEventForOptimisticMove(evt, move), true);
});

test('shouldDeferEventForOptimisticMove returns false when boardState.lastMove differs', () => {
  const optimistic = moveOpt({ tokenId: 'red-0' as TokenId, dieValue: 4 });
  const differentMove = moveOpt({ tokenId: 'red-1' as TokenId, dieValue: 4 });
  const evt = event({ boardState: boardStateWithMove(differentMove, 1) });
  assert.equal(shouldDeferEventForOptimisticMove(evt, optimistic), false);
});

test('shouldDeferEventForOptimisticMove detects same move across tokenId, dieValue, from, and to', () => {
  const from = { kind: 'track' as const, index: 10 };
  const to = { kind: 'track' as const, index: 14 };
  const move = moveOpt({ tokenId: 'blue-3' as TokenId, dieValue: 4, from, to });
  const evt = event({ boardState: boardStateWithMove(move, 2) });
  assert.equal(shouldDeferEventForOptimisticMove(evt, { ...move }), true);
});

// ── shouldReconcileBoardState ────────────────────────────────────────

test('shouldReconcileBoardState returns false for null boardState', () => {
  assert.equal(shouldReconcileBoardState(null, 0), false);
});

test('shouldReconcileBoardState returns false for undefined boardState', () => {
  assert.equal(shouldReconcileBoardState(undefined, 0), false);
});

test('shouldReconcileBoardState returns false when board version <= currentVersion', () => {
  const bs = { version: 3 } as MatchBoardState;
  assert.equal(shouldReconcileBoardState(bs, 3), false);
  assert.equal(shouldReconcileBoardState(bs, 4), false);
});

test('shouldReconcileBoardState returns true when board version > currentVersion', () => {
  const bs = { version: 5 } as MatchBoardState;
  assert.equal(shouldReconcileBoardState(bs, 4), true);
});

// ── Integration: deferred event replay after optimistic move ────────

test('deferred event is replayable once optimistic move clears', () => {
  const move = moveOpt({ tokenId: 'red-0' as TokenId, dieValue: 6 });
  const deferredEvent = event({ eventId: 'defer-1', version: 5, boardState: boardStateWithMove(move, 5) });

  // While optimistic move is active, event should be deferred
  assert.equal(shouldDeferEventForOptimisticMove(deferredEvent, move), true);

  // Once optimistic move clears, event should pass version check
  const picked = pickNewestValidEvent([deferredEvent], 4, new Set());
  assert.notEqual(picked, null);
  assert.equal(picked?.eventId, 'defer-1');
});
