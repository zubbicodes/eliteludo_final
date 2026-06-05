// Profile store. Reads from and writes to Supabase `profiles` table.
// The trigger on auth.users auto-creates the row on signup, so setProfile
// always does an UPDATE (never INSERT).

import { create } from 'zustand';

import type { TokenColorId } from '@/src/constants/profile';
import { supabase } from '@/src/supabase/client';
import { getSupabaseErrorMessage } from '@/src/supabase/errors';

export type Profile = {
  username: string;
  avatarId: number;
  colorId: TokenColorId;
  coins: number;
};

type ProfileInput = Omit<Profile, 'coins'> & Partial<Pick<Profile, 'coins'>>;

type ProfileState = {
  profile: Profile | null;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  setProfile: (p: ProfileInput) => Promise<void>;
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
    } = await supabase.auth.getSession().catch((error) => {
      console.warn('[profile] getSession failed:', getSupabaseErrorMessage(error));
      return { data: { session: null } };
    });
    if (!session) {
      set({ hydrated: true });
      return;
    }
    let data: {
      username: string;
      avatar_id: number | null;
      color_id: string | null;
      coins: number | null;
    } | null = null;

    try {
      const result = await supabase
        .from('profiles')
        .select('username, avatar_id, color_id, coins')
        .eq('id', session.user.id)
        .single();
      data = result.data;
    } catch (error) {
      console.warn('[profile] hydrate failed:', getSupabaseErrorMessage(error));
    }
    if (data) {
      set({
        profile: {
          username: data.username,
          avatarId: data.avatar_id ?? 0,
          colorId: (data.color_id as TokenColorId) ?? 'red',
          coins: Number(data.coins ?? 1000),
        },
        hydrated: true,
      });
    } else {
      set({ hydrated: true });
    }
  },

  setProfile: async (p) => {
    const current = get().profile;
    const next: Profile = {
      username: p.username,
      avatarId: p.avatarId,
      colorId: p.colorId,
      coins: p.coins ?? current?.coins ?? 1000,
    };
    set({ profile: next });
    const {
      data: { session },
    } = await supabase.auth.getSession().catch((error) => {
      console.warn('[profile] getSession failed:', getSupabaseErrorMessage(error));
      return { data: { session: null } };
    });
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
