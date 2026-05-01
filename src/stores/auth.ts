import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase } from '@/src/supabase/client';

type AuthState = {
  session: Session | null;
  user: User | null;
  isHydrating: boolean;
  setSession: (session: Session | null) => void;
  initialize: () => () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isHydrating: true,
  setSession: (session) => set({ session, user: session?.user ?? null }),

  initialize: () => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      set({ session, user: session?.user ?? null, isHydrating: false });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null, isHydrating: false });
    });

    return () => subscription.unsubscribe();
  },
}));
