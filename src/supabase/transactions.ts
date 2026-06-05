import { supabase } from './client';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DeductEntryFeeResult = {
  success: boolean;
  deducted?: number;
  remaining?: number;
  queueToken?: string;
  reason?: string;
  current?: number;
  required?: number;
};

export type CollectDailyRewardResult = {
  success: boolean;
  dayNumber?: number;
  rewardAmount?: number;
  streakActive?: boolean;
  nextAvailable?: string;
  reason?: string;
};

export type AwardMatchRewardResult = {
  success: boolean;
  winnerUserId?: string;
  prize?: number;
  winnerNewBalance?: number;
  alreadySettled?: boolean;
  crownUnlocked?: string | null;
};

export type GrantRewardResult = {
  success: boolean;
  amount?: number;
  balance?: number;
  reason?: string;
};

export type ShopPurchaseResult = {
  success: boolean;
  itemId?: string;
  balance?: number;
  reason?: string;
};

export type IapVerifyResult = {
  success: boolean;
  productId?: string;
  amount?: number;
  balance?: number;
  alreadyGranted?: boolean;
  reason?: string;
};

// ── Entry fee deduction ─────────────────────────────────────────────────────────

export async function deductEntryFee(
  entryFee: number,
  metadata?: Record<string, unknown>,
): Promise<DeductEntryFeeResult | null> {
  const { data, error } = await supabase.functions.invoke<DeductEntryFeeResult>(
    'deduct-entry-fee',
    { body: { entryFee, metadata } },
  );
  if (error) {
    console.warn('[transactions] deduct-entry-fee error:', error.message);
    return null;
  }
  return data;
}

// ── Daily reward collection ─────────────────────────────────────────────────────

export async function collectDailyReward(): Promise<CollectDailyRewardResult | null> {
  const { data, error } = await supabase.functions.invoke<CollectDailyRewardResult>(
    'collect-daily-reward',
    { body: {} },
  );
  if (error) {
    console.warn('[transactions] collect-daily-reward error:', error.message);
    return null;
  }
  return data;
}

// ── Get daily reward status ─────────────────────────────────────────────────────

export type DailyRewardStatus = {
  dayNumber: number;
  lastCollectedAt: string | null;
  streakActive: boolean;
  canCollect: boolean;
  nextAvailable: string | null;
};

export async function getDailyRewardStatus(): Promise<DailyRewardStatus | null> {
  const { data, error } = await supabase
    .from('daily_rewards')
    .select('*')
    .single();

  if (error) {
    console.warn('[transactions] get daily rewards error:', error.message);
    return null;
  }

  const now = new Date();
  const lastCollected = data.last_collected_at ? new Date(data.last_collected_at) : null;
  const isSameDay =
    lastCollected &&
    lastCollected.getFullYear() === now.getFullYear() &&
    lastCollected.getMonth() === now.getMonth() &&
    lastCollected.getDate() === now.getDate();

  // Calculate next available time
  let nextAvailable: string | null = null;
  if (isSameDay) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    nextAvailable = tomorrow.toISOString();
  }

  return {
    dayNumber: data.day_number,
    lastCollectedAt: data.last_collected_at,
    streakActive: data.streak_active,
    canCollect: !isSameDay,
    nextAvailable,
  };
}

// ── Get user transactions ───────────────────────────────────────────────────────

export type Transaction = {
  id: string;
  type: string;
  amount: number;
  currency: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export async function getTransactions(limit = 20): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[transactions] get transactions error:', error.message);
    return [];
  }

  return data as Transaction[];
}

// ── Award match reward ───────────────────────────────────────────────────────────

export async function awardMatchReward(params: {
  matchId: string;
  winnerUserId: string;
  loserUserId?: string;
  entryFee: number;
  citySlug?: string;
}): Promise<AwardMatchRewardResult | null> {
  const { data, error } = await supabase.functions.invoke<AwardMatchRewardResult>(
    'award-match-reward',
    { body: params },
  );
  if (error) {
    console.warn('[transactions] award-match-reward error:', error.message);
    return null;
  }
  return data;
}

export async function grantAdReward(params: {
  adUnitId: string;
  rewardAmount?: number;
  placement?: string;
}): Promise<GrantRewardResult | null> {
  const { data, error } = await supabase.functions.invoke<GrantRewardResult>(
    'grant-ad-reward',
    { body: params },
  );
  if (error) {
    console.warn('[transactions] grant-ad-reward error:', error.message);
    return null;
  }
  return data;
}

export async function purchaseShopItem(params: {
  itemId: string;
  price: number;
  currency?: 'coins' | 'gems';
  kind: 'token_skin' | 'dice_skin' | 'crown';
}): Promise<ShopPurchaseResult | null> {
  const { data, error } = await supabase.functions.invoke<ShopPurchaseResult>(
    'purchase-shop-item',
    { body: params },
  );
  if (error) {
    console.warn('[transactions] purchase-shop-item error:', error.message);
    return null;
  }
  return data;
}

export async function verifyIapPurchase(params: {
  productId: string;
  purchaseToken: string;
  platform?: 'android' | 'ios';
}): Promise<IapVerifyResult | null> {
  const { data, error } = await supabase.functions.invoke<IapVerifyResult>(
    'verify-iap-purchase',
    { body: params },
  );
  if (error) {
    console.warn('[transactions] verify-iap-purchase error:', error.message);
    return null;
  }
  return data;
}
