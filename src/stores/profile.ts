// Profile store. Reads from and writes to Supabase `profiles` table.
// The trigger on auth.users auto-creates the row on signup, so setProfile
// always does an UPDATE (never INSERT).

import { create } from 'zustand';

import type { TokenColorId } from '@/src/constants/profile';
import { supabase } from '@/src/supabase/client';

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
  clear: () => void;
};

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      set({ hydrated: true });
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('username, avatar_id, color_id')
      .eq('id', session.user.id)
      .single();
    if (data) {
      set({
        profile: {
          username: data.username,
          avatarId: data.avatar_id ?? 0,
          colorId: (data.color_id as TokenColorId) ?? 'red',
        },
        hydrated: true,
      });
    } else {
      set({ hydrated: true });
    }
  },

  setProfile: async (p) => {
    set({ profile: p });
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    await supabase
      .from('profiles')
      .update({ username: p.username, avatar_id: p.avatarId, color_id: p.colorId })
      .eq('id', session.user.id);
  },

  updateProfile: async (patch) => {
    const current = get().profile;
    if (!current) return;
    const next = { ...current, ...patch };
    await get().setProfile(next);
  },

  clear: () => {
    set({ profile: null, hydrated: false });
  },
}));
