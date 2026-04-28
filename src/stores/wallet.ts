// Local wallet + daily-reward streak state. Persisted to AsyncStorage.
//
// This is intentionally local-only for now — we'll mirror it to Supabase in
// phase 4 (economy). Keeping the API tight so the swap is mechanical: only
// `hydrate` and `claimDaily` would need to call the network.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const KEY = 'elite-ludo:wallet:v1';

/** 7-day rotating reward ladder. Day 7 is the bigger bonus. */
export const DAILY_REWARDS = [50, 75, 100, 150, 200, 250, 500] as const;

export type PendingClaim = { day: number; reward: number };

type WalletState = {
  coins: number;
  /** Last claimed day index in the 7-day cycle (1..7), or 0 if no claim yet. */
  streak: number;
  /** YYYY-MM-DD of the last claim, in local time. */
  lastClaimDate: string | null;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  pendingClaim: () => PendingClaim | null;
  claimDaily: () => PendingClaim | null;
};

export const useWalletStore = create<WalletState>((set, get) => ({
  coins: 0,
  streak: 0,
  lastClaimDate: null,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const data = JSON.parse(raw) as Partial<WalletState>;
        set({
          coins: data.coins ?? 0,
          streak: data.streak ?? 0,
          lastClaimDate: data.lastClaimDate ?? null,
          hydrated: true,
        });
      } else {
        set({ hydrated: true });
      }
    } catch {
      set({ hydrated: true });
    }
  },

  pendingClaim: () => {
    const { lastClaimDate, streak, hydrated } = get();
    if (!hydrated) return null;
    const today = todayStr();
    if (lastClaimDate === today) return null;
    const continuing = lastClaimDate === yesterdayStr();
    const day = continuing ? (streak >= 7 ? 1 : streak + 1) : 1;
    return { day, reward: DAILY_REWARDS[day - 1] };
  },

  claimDaily: () => {
    const pending = get().pendingClaim();
    if (!pending) return null;
    const today = todayStr();
    const next = {
      coins: get().coins + pending.reward,
      streak: pending.day,
      lastClaimDate: today,
    };
    set(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
    return pending;
  },
}));

function todayStr(): string {
  return ymd(new Date());
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return ymd(d);
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
