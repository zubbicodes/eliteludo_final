import { supabase } from './client';
import type { MatchBoardState, MatchPlayer } from '../game/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export type FindMatchResult = {
  matchId: string | null;
  matched: boolean;
  isBot?: boolean;
};

export type MatchRow = {
  id: string;
  board_state: MatchBoardState;
  current_turn_user_id: string;
  status: string;
  players: MatchPlayer[];
};

// ── Matchmaking ───────────────────────────────────────────────────────────────

export async function findMatch(params: {
  entryFee: number;
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

// ── Match data ────────────────────────────────────────────────────────────────

export async function getMatch(matchId: string): Promise<MatchRow | null> {
  const { data, error } = await supabase
    .from('matches')
    .select('id, board_state, current_turn_user_id, status, players')
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
  const patch: Record<string, unknown> = { board_state: boardState };
  if (nextTurnUserId) patch.current_turn_user_id = nextTurnUserId;
  await supabase.from('matches').update(patch).eq('id', matchId);
}

// ── Server dice roll ──────────────────────────────────────────────────────────

export async function rollDiceServer(
  matchId: string,
): Promise<{ value: number } | null> {
  const { data, error } = await supabase.functions.invoke<{ value: number }>(
    'roll-dice',
    { body: { matchId } },
  );
  if (error) {
    console.warn('[matches] roll-dice error:', error.message);
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
    .subscribe();

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
