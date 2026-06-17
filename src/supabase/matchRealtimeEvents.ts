import type { Color, MatchBoardState, MoveOption } from '@/src/game/types';

export const MATCH_BROADCAST_EVENT = 'match_event';

export type MatchRealtimeEventType =
  | 'state_snapshot'
  | 'roll_result'
  | 'move_result'
  | 'turn_skipped'
  | 'match_finished'
  | 'player_left'
  | 'sync_required';

export type MatchRealtimeEvent = {
  eventId: string;
  matchId: string;
  type: MatchRealtimeEventType;
  version: number;
  boardState?: MatchBoardState;
  value?: number;
  move?: MoveOption;
  winnerColor?: Color;
  winnerUserId?: string | null;
  currentTurnUserId?: string | null;
  reason?: string;
};

export function matchChannelTopic(matchId: string) {
  return `match:${matchId}:game`;
}

export function boardVersion(boardState?: Partial<MatchBoardState> | null): number {
  return typeof boardState?.version === 'number' ? boardState.version : 0;
}

export function withBoardVersion<T extends MatchBoardState>(boardState: T): T {
  if (typeof boardState.version === 'number') return boardState;
  return { ...boardState, version: 0 };
}

export function shouldApplyMatchEvent(
  event: MatchRealtimeEvent,
  currentVersion: number,
  seenEventIds: ReadonlySet<string>,
) {
  if (seenEventIds.has(event.eventId)) return false;
  if (event.type !== 'sync_required' && event.version <= currentVersion) return false;
  return true;
}
