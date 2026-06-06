import { supabase } from './client';
import { getSupabaseErrorMessage } from './errors';

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
  balance?: number;
  streakActive?: boolean;
  nextAvailable?: string;
  reason?: string;
};

async function readFunctionError(error: unknown): Promise<CollectDailyRewardResult | null> {
  const context = (error as { context?: unknown }).context;
  const response = context as {
    clone?: () => { json?: () => Promise<unknown>; text?: () => Promise<string> };
    json?: () => Promise<unknown>;
    text?: () => Promise<string>;
  } | undefined;

  if (!response) return null;

  const jsonResponse = typeof response.clone === 'function' ? response.clone() : response;
  if (typeof jsonResponse.json === 'function') {
    try {
      const body = await jsonResponse.json();
      if (body && typeof body === 'object' && 'success' in body) {
        return body as CollectDailyRewardResult;
      }
    } catch {
      // Fall through to text parsing below.
    }
  }

  if (typeof response.text === 'function') {
    try {
      const text = await response.text();
      if (text) return { success: false, reason: text };
    } catch {
      return null;
    }
  }

  return null;
}

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
    return data ?? null;
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
    const body = await readFunctionError(error);
    const fallback = getSupabaseErrorMessage(error);
    console.warn('[transactions] collect-daily-reward error:', body?.reason ?? fallback);
    return body ?? { success: false, reason: fallback };
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

function isSameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function nextUtcMidnightIso(from = new Date()): string {
  return new Date(Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate() + 1,
  )).toISOString();
}

export async function getDailyRewardStatus(): Promise<DailyRewardStatus | null> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.warn('[transactions] get daily rewards auth error:', authError?.message ?? 'no session');
    return null;
  }

  const { data, error } = await supabase
    .from('daily_rewards')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.warn('[transactions] get daily rewards error:', error.message);
    return null;
  }

  if (!data) return null;

  const now = new Date();
  const lastCollected = data.last_collected_at ? new Date(data.last_collected_at) : null;
  const isSameDay = !!lastCollected && isSameUtcDay(lastCollected, now);

  return {
    dayNumber: data.day_number,
    lastCollectedAt: data.last_collected_at,
    streakActive: data.streak_active,
    canCollect: !isSameDay,
    nextAvailable: isSameDay ? nextUtcMidnightIso(now) : null,
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
