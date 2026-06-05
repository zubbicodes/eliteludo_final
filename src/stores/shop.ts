import { create } from 'zustand';

import { SHOP_ITEMS } from '@/src/constants/economy';
import { purchaseShopItem } from '@/src/supabase/transactions';
import { useProfileStore } from '@/src/stores/profile';
import { useWalletStore } from '@/src/stores/wallet';

type ShopState = {
  loadingItemId: string | null;
  purchase: (itemId: string) => Promise<{ success: boolean; reason?: string }>;
};

export const useShopStore = create<ShopState>((set) => ({
  loadingItemId: null,

  purchase: async (itemId) => {
    const item = SHOP_ITEMS.find((candidate) => candidate.id === itemId);
    if (!item) return { success: false, reason: 'missing_item' };
    set({ loadingItemId: itemId });
    const result = await purchaseShopItem({
      itemId: item.id,
      price: item.price,
      currency: item.currency,
      kind: item.kind,
    });
    if (result?.success) {
      await Promise.all([
        useProfileStore.getState().refresh(),
        useWalletStore.getState().refresh(),
      ]);
    }
    set({ loadingItemId: null });
    return { success: !!result?.success, reason: result?.reason };
  },
}));
