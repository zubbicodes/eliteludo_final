import assert from 'node:assert/strict';
import test from 'node:test';

import {
  boardVersion,
  matchChannelTopic,
  shouldApplyMatchEvent,
  withBoardVersion,
  type MatchRealtimeEvent,
} from '../src/supabase/matchRealtimeEvents';
import { makeInitialGameState } from '../src/game/rules';

function event(overrides: Partial<MatchRealtimeEvent> = {}): MatchRealtimeEvent {
  return {
    eventId: 'event-1',
    matchId: 'match-1',
    type: 'roll_result',
    version: 1,
    ...overrides,
  };
}

test('match channel topic follows the private game channel convention', () => {
  assert.equal(matchChannelTopic('abc'), 'match:abc:game');
});

test('board version defaults missing persisted states to zero', () => {
  assert.equal(boardVersion(null), 0);
  assert.equal(boardVersion({}), 0);
  assert.equal(boardVersion({ version: 4 }), 4);
});

test('withBoardVersion preserves existing versions and patches old boards', () => {
  const state = makeInitialGameState('red', 1);
  assert.equal(withBoardVersion({ ...state, version: 3 }).version, 3);

  const oldState = { ...state };
  delete (oldState as Partial<typeof state>).version;

  assert.equal(withBoardVersion(oldState).version, 0);
});

test('match events reject duplicates and stale versions', () => {
  assert.equal(shouldApplyMatchEvent(event({ version: 2 }), 1, new Set()), true);
  assert.equal(shouldApplyMatchEvent(event({ version: 1 }), 1, new Set()), false);
  assert.equal(shouldApplyMatchEvent(event({ version: 0 }), 1, new Set()), false);
  assert.equal(shouldApplyMatchEvent(event(), 0, new Set(['event-1'])), false);
});

test('sync-required events can request a snapshot at the current version', () => {
  assert.equal(
    shouldApplyMatchEvent(event({ type: 'sync_required', version: 1 }), 1, new Set()),
    true,
  );
});
