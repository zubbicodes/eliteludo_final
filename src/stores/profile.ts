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
  gems: number;
  wins: number;
  losses: number;
  crownsUnlocked: string[];
  selectedTokenSkin: string;
  selectedDiceSkin: string;
  selectedCrown: string | null;
};

type ProfileInput = Pick<Profile, 'username' | 'avatarId' | 'colorId'> &
  Partial<Omit<Profile, 'username' | 'avatarId' | 'colorId'>>;

type ProfileState = {
  profile: Profile | null;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
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
      gems: number | null;
      wins: number | null;
      losses: number | null;
      crowns_unlocked: string[] | null;
    } | null = null;
    let cosmetics: {
      selected_token_skin: string | null;
      selected_dice_skin: string | null;
      selected_crown: string | null;
      unlocked_crowns: string[] | null;
    } | null = null;

    try {
      const result = await supabase
        .from('profiles')
        .select('username, avatar_id, color_id, coins, gems, wins, losses, crowns_unlocked')
        .eq('id', session.user.id)
        .single();
      data = result.data;

      const cosmeticResult = await supabase
        .from('profile_cosmetics')
        .select('selected_token_skin, selected_dice_skin, selected_crown, unlocked_crowns')
        .eq('user_id', session.user.id)
        .maybeSingle();
      cosmetics = cosmeticResult.data;
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
          gems: Number(data.gems ?? 0),
          wins: Number(data.wins ?? 0),
          losses: Number(data.losses ?? 0),
          crownsUnlocked: cosmetics?.unlocked_crowns ?? data.crowns_unlocked ?? [],
          selectedTokenSkin: cosmetics?.selected_token_skin ?? 'classic',
          selectedDiceSkin: cosmetics?.selected_dice_skin ?? 'classic',
          selectedCrown: cosmetics?.selected_crown ?? null,
        },
        hydrated: true,
      });
    } else {
      set({ hydrated: true });
    }
  },

  refresh: async () => {
    set({ hydrated: false });
    await get().hydrate();
  },

  setProfile: async (p) => {
    const current = get().profile;
    const next: Profile = {
      username: p.username,
      avatarId: p.avatarId,
      colorId: p.colorId,
      coins: p.coins ?? current?.coins ?? 1000,
      gems: p.gems ?? current?.gems ?? 0,
      wins: p.wins ?? current?.wins ?? 0,
      losses: p.losses ?? current?.losses ?? 0,
      crownsUnlocked: p.crownsUnlocked ?? current?.crownsUnlocked ?? [],
      selectedTokenSkin: p.selectedTokenSkin ?? current?.selectedTokenSkin ?? 'classic',
      selectedDiceSkin: p.selectedDiceSkin ?? current?.selectedDiceSkin ?? 'classic',
      selectedCrown: p.selectedCrown ?? current?.selectedCrown ?? null,
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
