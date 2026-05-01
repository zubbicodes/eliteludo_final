// Local app settings. Persisted to AsyncStorage.
//
// Sound/music toggles are placeholders until designer ships audio. Vibration
// is the live one — `src/utils/haptics.ts` reads `vibrationEnabled` to decide
// whether to fire haptic feedback.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const KEY = 'elite-ludo:settings:v1';

export type Language = 'en' | 'ur';

export type Settings = {
  soundEnabled: boolean;
  musicEnabled: boolean;
  vibrationEnabled: boolean;
  language: Language;
};

const DEFAULTS: Settings = {
  soundEnabled: true,
  musicEnabled: true,
  vibrationEnabled: true,
  language: 'en',
};

type SettingsState = Settings & {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  set: (patch: Partial<Settings>) => Promise<void>;
};

let cached: Settings = { ...DEFAULTS };

/** Synchronous read of the latest persisted settings — used by haptics util. */
export function getCachedSettings(): Settings {
  return cached;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const data = JSON.parse(raw) as Partial<Settings>;
        const merged = { ...DEFAULTS, ...data };
        cached = merged;
        set({ ...merged, hydrated: true });
      } else {
        set({ hydrated: true });
      }
    } catch {
      set({ hydrated: true });
    }
  },

  set: async (patch) => {
    const current: Settings = {
      soundEnabled: get().soundEnabled,
      musicEnabled: get().musicEnabled,
      vibrationEnabled: get().vibrationEnabled,
      language: get().language,
    };
    const next: Settings = { ...current, ...patch };
    cached = next;
    set(next);
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  },
}));
