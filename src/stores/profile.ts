// Local profile state. Persisted to AsyncStorage.
//
// Stays local-only until phase 3 lands real auth — at that point `hydrate`
// becomes a Supabase `profiles` SELECT and `setProfile` becomes an UPSERT.
// Keep the API tight so the swap is mechanical.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import type { TokenColorId } from '@/src/constants/profile';

const KEY = 'elite-ludo:profile:v1';

export type Profile = {
  username: string;
  avatarId: number;
  colorId: TokenColorId;
};

type ProfileState = {
  profile: Profile | null;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  setProfile: (p: Profile) => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  clear: () => Promise<void>;
};

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const data = JSON.parse(raw) as Profile;
        set({ profile: data, hydrated: true });
      } else {
        set({ hydrated: true });
      }
    } catch {
      set({ hydrated: true });
    }
  },

  setProfile: async (p) => {
    set({ profile: p });
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(p));
    } catch {
      // ignore
    }
  },

  updateProfile: async (patch) => {
    const current = get().profile;
    if (!current) return;
    const next = { ...current, ...patch };
    set({ profile: next });
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  },

  clear: async () => {
    set({ profile: null });
    try {
      await AsyncStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  },
}));
