// Wallet + daily-reward state. Synced with Supabase.
//
// Coins and daily rewards are now server-authoritative via Edge Functions.

import { create } from 'zustand';
import { collectDailyReward, getDailyRewardStatus, type DailyRewardStatus } from '@/src/supabase/transactions';
import { useProfileStore } from './profile';

/** 7-day rotating reward ladder. Day 7 is the bigger bonus. */
export const DAILY_REWARDS = [100, 150, 200, 300, 400, 500, 1000] as const;

export type PendingClaim = { day: number; reward: number };

type WalletState = {
  coins: number;
  dailyStatus: DailyRewardStatus | null;
  hydrated: boolean;
  loading: boolean;

  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  refreshDailyStatus: () => Promise<void>;
  pendingClaim: () => PendingClaim | null;
  claimDaily: () => Promise<PendingClaim | null>;
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
    if (!pending) return null;

    const result = await collectDailyReward();
    if (result?.success) {
      // Refresh daily status and coins from profile
      await get().refreshDailyStatus();
      const reward = result.rewardAmount ?? pending.reward;
      set((state) => ({ coins: state.coins + reward }));
      return pending;
    }
    return null;
  },
}));
