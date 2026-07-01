// Wallet + daily-reward state. Synced with Supabase.
//
// Coins and daily rewards are now server-authoritative via Edge Functions.

import { create } from 'zustand';
import { collectDailyReward, getDailyRewardStatus, type DailyRewardStatus } from '@/src/supabase/transactions';
import { useProfileStore } from './profile';

/** 7-day rotating reward ladder. Day 7 is the bigger bonus. */
export const DAILY_REWARDS = [100, 150, 200, 300, 400, 500, 1000] as const;

export type PendingClaim = { day: number; reward: number };
export type ClaimDailyResult =
  | { success: true; day: number; reward: number }
  | { success: false; reason: string };

type WalletState = {
  coins: number;
  dailyStatus: DailyRewardStatus | null;
  hydrated: boolean;
  loading: boolean;

  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  refreshDailyStatus: () => Promise<void>;
  pendingClaim: () => PendingClaim | null;
  claimDaily: () => Promise<ClaimDailyResult>;
};

export const useWalletStore = create<WalletState>((set, get) => ({
  coins: 0,
  dailyStatus: null,
  hydrated: false,
  loading: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const profileStore = useProfileStore.getState();
    if (!profileStore.hydrated) {
      await profileStore.hydrate();
    }
    const profile = useProfileStore.getState().profile;
    if (profile) {
      set({ coins: profile.coins, hydrated: true });
      await get().refreshDailyStatus();
    } else {
      set({ hydrated: true });
    }
  },

  refresh: async () => {
    const profileStore = useProfileStore.getState();
    await profileStore.refresh();
    const profile = useProfileStore.getState().profile;
    set({ coins: profile?.coins ?? 0, hydrated: true });
    await get().refreshDailyStatus();
  },

  refreshDailyStatus: async () => {
    set({ loading: true });
    const status = await getDailyRewardStatus();
    set({ dailyStatus: status, loading: false });
  },

  pendingClaim: () => {
    const { dailyStatus } = get();
    if (!dailyStatus || !dailyStatus.canCollect) return null;
    const day = dailyStatus.dayNumber;
    return { day, reward: DAILY_REWARDS[day - 1] };
  },

  claimDaily: async () => {
    const pending = get().pendingClaim();
    if (!pending) return { success: false, reason: 'already_collected' };

    const claimedAt = new Date().toISOString();
    set({
      coins: get().coins + pending.reward,
      dailyStatus: {
        dayNumber: Math.min(pending.day + 1, 7),
        lastCollectedAt: claimedAt,
        streakActive: true,
        canCollect: false,
        nextAvailable: null,
      },
    });

    void collectDailyReward()
      .then(async (result) => {
        if (result?.success) {
          set({
            coins: result.balance ?? get().coins,
            dailyStatus: {
              dayNumber: result.dayNumber ? Math.min(result.dayNumber + 1, 7) : Math.min(pending.day + 1, 7),
              lastCollectedAt: claimedAt,
              streakActive: result.streakActive ?? true,
              canCollect: false,
              nextAvailable: result.nextAvailable ?? null,
            },
          });
          return;
        }
        await get().refresh();
      })
      .catch(async () => {
        await get().refresh();
      });

    return { success: true, day: pending.day, reward: pending.reward };
  },
}));
