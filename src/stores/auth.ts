import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';

type AuthState = {
  session: Session | null;
  user: User | null;
  isHydrating: boolean;
  setSession: (session: Session | null) => void;
  setHydrating: (value: boolean) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isHydrating: true,
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setHydrating: (value) => set({ isHydrating: value }),
}));
