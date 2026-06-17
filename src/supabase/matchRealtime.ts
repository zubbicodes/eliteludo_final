import type { RealtimeChannel } from '@supabase/supabase-js';

import type { Color } from '@/src/game/types';
import { supabase } from './client';
import { MATCH_BROADCAST_EVENT, matchChannelTopic, type MatchRealtimeEvent } from './matchRealtimeEvents';

export {
  MATCH_BROADCAST_EVENT,
  boardVersion,
  matchChannelTopic,
  shouldApplyMatchEvent,
  withBoardVersion,
  type MatchRealtimeEvent,
  type MatchRealtimeEventType,
} from './matchRealtimeEvents';

export type MatchRealtimeStatus = 'subscribed' | 'closed' | 'error' | 'timed_out';

export type MatchPresence = {
  userId: string;
  color: Color;
  username?: string;
  joinedAt: string;
  onlineAt?: string;
};

export type MatchRealtimeSubscription = {
  channel: RealtimeChannel;
  unsubscribe: () => void;
};

function isColor(value: unknown): value is Color {
  return value === 'red' || value === 'green' || value === 'yellow' || value === 'blue';
}

function flattenPresenceState(state: Record<string, unknown[]>): MatchPresence[] {
  return Object.values(state)
    .flat()
    .filter((presence): presence is MatchPresence => {
      const p = presence as Partial<MatchPresence>;
      return typeof p.userId === 'string' && isColor(p.color);
    });
}

export function subscribeMatchBroadcast(params: {
  matchId: string;
  presence?: Omit<MatchPresence, 'joinedAt'>;
  onEvent: (event: MatchRealtimeEvent) => void;
  onPresence?: (presence: MatchPresence[]) => void;
  onStatus?: (status: MatchRealtimeStatus) => void;
}): MatchRealtimeSubscription {
  const channel = supabase
    .channel(matchChannelTopic(params.matchId), {
      config: {
        private: true,
        broadcast: { self: false, ack: false },
        presence: params.presence ? { key: params.presence.userId } : undefined,
      },
    })
    .on('broadcast', { event: MATCH_BROADCAST_EVENT }, ({ payload }) => {
      params.onEvent(payload as MatchRealtimeEvent);
    });

  if (params.onPresence) {
    channel
      .on('presence', { event: 'sync' }, () => {
        params.onPresence?.(flattenPresenceState(channel.presenceState()));
      })
      .on('presence', { event: 'join' }, () => {
        params.onPresence?.(flattenPresenceState(channel.presenceState()));
      })
      .on('presence', { event: 'leave' }, () => {
        params.onPresence?.(flattenPresenceState(channel.presenceState()));
      });
  }

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      params.onStatus?.('subscribed');
      if (params.presence) {
        void channel.track({
          ...params.presence,
          joinedAt: new Date().toISOString(),
          onlineAt: new Date().toISOString(),
        });
      }
    }
    if (status === 'CHANNEL_ERROR') params.onStatus?.('error');
    if (status === 'TIMED_OUT') params.onStatus?.('timed_out');
    if (status === 'CLOSED') params.onStatus?.('closed');
  });

  return {
    channel,
    unsubscribe: () => {
      void channel.untrack();
      supabase.removeChannel(channel);
    },
  };
}
