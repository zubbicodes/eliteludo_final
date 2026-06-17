import { supabase } from './client';
import type { Color, MatchBoardState, MatchPlayer } from '../game/types';
import {
  subscribeMatchBroadcast,
  type MatchPresence,
  type MatchRealtimeEvent,
  type MatchRealtimeStatus,
} from './matchRealtime';

// ── Types ─────────────────────────────────────────────────────────────────────

export type FindMatchResult = {
  matchId: string | null;
  matched: boolean;
  isBot?: boolean;
  roomCode?: string;
  refunded?: number;
  reason?: string;
};

export type MatchRow = {
  id: string;
  board_state: MatchBoardState;
  current_turn_user_id: string;
  status: string;
  players: MatchPlayer[];
  entry_fee: number;
  city_slug?: string | null;
  winner_user_id?: string | null;
  finished_at?: string | null;
};

export type RollDiceResult = {
  success?: boolean;
  value?: number;
  boardState?: MatchBoardState;
  event?: MatchRealtimeEvent;
  reason?: string;
};

export type ForfeitMatchResult = {
  success: boolean;
  winnerUserId?: string;
  winnerColor?: Color;
  event?: MatchRealtimeEvent;
  reason?: string;
};

export type PresenceForfeitResult = {
  success: boolean;
  winnerUserId?: string;
  winnerColor?: Color;
  boardState?: MatchBoardState;
  event?: MatchRealtimeEvent;
  reason?: string;
};

export type SkipRollTurnResult = {
  success: boolean;
  boardState?: MatchBoardState;
  currentTurnUserId?: string;
  event?: MatchRealtimeEvent;
  reason?: string;
};

export type MoveTokenResult = {
  success: boolean;
  move?: {
    tokenId: string;
    dieValue: number;
    from: unknown;
    to: unknown;
    captures: string[];
  };
  boardState?: MatchBoardState;
  currentTurnUserId?: string;
  event?: MatchRealtimeEvent;
  reason?: string;
};

export type SyncBoardStateResult = {
  success: boolean;
  boardState?: MatchBoardState;
  currentTurnUserId?: string;
  event?: MatchRealtimeEvent;
  reason?: string;
};

// ── Matchmaking ───────────────────────────────────────────────────────────────

export async function findMatch(params: {
  entryFee: number;
  mode?: '1v1' | '4p';
  citySlug?: string;
  botFallback: boolean;
}): Promise<FindMatchResult | null> {
  const { data, error } = await supabase.functions.invoke<FindMatchResult>(
    'find-match',
    { body: params },
  );
  if (error) {
    console.warn('[matches] find-match error:', error.message);
    return null;
  }
  return data;
}

export async function cancelMatchmaking(params: {
  entryFee: number;
  mode?: '1v1' | '4p';
}): Promise<FindMatchResult | null> {
  const { data, error } = await supabase.functions.invoke<FindMatchResult>(
    'find-match',
    { body: { ...params, cancel: true } },
  );
  if (error) {
    console.warn('[matches] cancel matchmaking error:', error.message);
    return null;
  }
  return data;
}

export async function createPrivateRoom(params: {
  entryFee: number;
  citySlug?: string;
}): Promise<FindMatchResult | null> {
  const { data, error } = await supabase.functions.invoke<FindMatchResult>(
    'find-match',
    { body: { ...params, mode: 'private', privateAction: 'create' } },
  );
  if (error) {
    console.warn('[matches] create private room error:', error.message);
    return null;
  }
  return data;
}

export async function joinPrivateRoom(params: {
  roomCode: string;
  entryFee: number;
}): Promise<FindMatchResult | null> {
  const { data, error } = await supabase.functions.invoke<FindMatchResult>(
    'find-match',
    { body: { ...params, mode: 'private', privateAction: 'join' } },
  );
  if (error) {
    console.warn('[matches] join private room error:', error.message);
    return null;
  }
  return data;
}

// ── Match data ────────────────────────────────────────────────────────────────

export async function getMatch(matchId: string): Promise<MatchRow | null> {
  const { data, error } = await supabase
    .from('matches')
    .select('id, board_state, current_turn_user_id, status, players, entry_fee, city_slug, winner_user_id, finished_at')
    .eq('id', matchId)
    .single();
  if (error) return null;
  return data as MatchRow;
}

// ── Server dice roll ──────────────────────────────────────────────────────────

export async function rollDiceServer(
  matchId: string,
): Promise<RollDiceResult | null> {
  const { data, error } = await supabase.functions.invoke<RollDiceResult>(
    'roll-dice',
    { body: { matchId } },
  );
  if (error) {
    console.warn('[matches] roll-dice error:', error.message);
    return null;
  }
  return data;
}

export async function forfeitMatch(
  matchId: string,
): Promise<ForfeitMatchResult | null> {
  const { data, error } = await supabase.functions.invoke<ForfeitMatchResult>(
    'forfeit-match',
    { body: { matchId } },
  );
  if (error) {
    console.warn('[matches] forfeit-match error:', error.message);
    return null;
  }
  return data;
}

export async function claimOpponentLeft(
  matchId: string,
  missingUserId?: string,
): Promise<PresenceForfeitResult | null> {
  const { data, error } = await supabase.functions.invoke<PresenceForfeitResult>(
    'claim-opponent-left',
    { body: { matchId, missingUserId } },
  );
  if (error) {
    console.warn('[matches] claim-opponent-left error:', error.message);
    return null;
  }
  return data;
}

export async function skipRollTurnServer(
  matchId: string,
  expectedPlayerIdx?: number,
): Promise<SkipRollTurnResult | null> {
  const { data, error } = await supabase.functions.invoke<SkipRollTurnResult>(
    'skip-roll-turn',
    { body: { matchId, expectedPlayerIdx } },
  );
  if (error) {
    console.warn('[matches] skip-roll-turn error:', error.message);
    return null;
  }
  return data;
}

export async function moveTokenServer(
  matchId: string,
  tokenId: string,
  dieValue: number,
): Promise<MoveTokenResult | null> {
  const { data, error } = await supabase.functions.invoke<MoveTokenResult>(
    'move-token',
    { body: { matchId, tokenId, dieValue } },
  );
  if (error) {
    console.warn('[matches] move-token error:', error.message);
    return null;
  }
  return data;
}

export async function syncBoardStateServer(
  matchId: string,
  boardState: MatchBoardState,
): Promise<SyncBoardStateResult | null> {
  const { data, error } = await supabase.functions.invoke<SyncBoardStateResult>(
    'sync-board-state',
    { body: { matchId, boardState } },
  );
  if (error) {
    console.warn('[matches] sync-board-state error:', error.message);
    return null;
  }
  return data;
}

// ── Realtime ──────────────────────────────────────────────────────────────────

export function subscribeMatch(
  matchId: string,
  onEvent: (event: MatchRealtimeEvent) => void,
  onStatus?: (status: MatchRealtimeStatus) => void,
  presence?: {
    self: Omit<MatchPresence, 'joinedAt'>;
    onPresence: (presence: MatchPresence[]) => void;
  },
): () => void {
  const subscription = subscribeMatchBroadcast({
    matchId,
    onEvent,
    onStatus,
    presence: presence?.self,
    onPresence: presence?.onPresence,
  });
  return subscription.unsubscribe;
}

export function subscribeQueue(
  userId: string,
  onMatchFound: (matchId: string) => void,
): () => void {
  const channel = supabase
    .channel(`queue-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'match_queue',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const matchId = (payload.new as { match_id?: string })?.match_id;
        if (matchId) onMatchFound(matchId);
      },
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}
