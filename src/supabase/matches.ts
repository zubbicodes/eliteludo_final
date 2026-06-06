import { supabase } from './client';
import type { Color, MatchBoardState, MatchPlayer } from '../game/types';

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
  reason?: string;
};

export type ForfeitMatchResult = {
  success: boolean;
  winnerUserId?: string;
  winnerColor?: Color;
  reason?: string;
};

export type SkipRollTurnResult = {
  success: boolean;
  boardState?: MatchBoardState;
  currentTurnUserId?: string;
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

export async function pushBoardState(
  matchId: string,
  boardState: MatchBoardState,
  nextTurnUserId: string | null,
): Promise<void> {
  const { error } = await supabase.functions.invoke('sync-board-state', {
    body: { matchId, boardState, nextTurnUserId },
  });
  if (error) {
    console.warn('[matches] sync-board-state error:', error.message);
  }
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

// ── Realtime ──────────────────────────────────────────────────────────────────

export function subscribeMatch(
  matchId: string,
  onUpdate: (boardState: MatchBoardState) => void,
): () => void {
  const channel = supabase
    .channel(`match-${matchId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'matches',
        filter: `id=eq.${matchId}`,
      },
      (payload) => {
        const newState = (payload.new as { board_state?: MatchBoardState })?.board_state;
        if (newState) onUpdate(newState);
      },
    )
    .subscribe((status, error) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[matches] realtime match channel status:', status, error?.message);
      }
    });

  return () => { supabase.removeChannel(channel); };
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
