import Constants from 'expo-constants';

import { AD_REWARD_COINS } from '@/src/constants/economy';
import { grantAdReward } from '@/src/supabase/transactions';

const adMobExtra = (Constants.expoConfig?.extra?.adMob ?? {}) as {
  homeBannerAdUnitId?: string;
  rewardedAdUnitId?: string;
};

export const homeBannerAdUnitId = adMobExtra.homeBannerAdUnitId ?? 'ca-app-pub-3940256099942544/6300978111';
export const rewardedAdUnitId = adMobExtra.rewardedAdUnitId ?? 'ca-app-pub-3940256099942544/5224354917';

// Safe import of react-native-google-mobile-ads so the app doesn't crash
// when running in Expo Go or when the native module isn't linked.
let nativeMod: any = null;
try {
  nativeMod = require('react-native-google-mobile-ads');
} catch {
  // Native module not available (Expo Go, web, etc.)
}

export const BannerAd = nativeMod?.BannerAd ?? function BannerAdFallback() {
  return null;
};

export const BannerAdSize = nativeMod?.BannerAdSize ?? {
  ANCHORED_ADAPTIVE_BANNER: 'anchored_adaptive_banner',
};

const mobileAds = nativeMod?.default;
const RewardedAd = nativeMod?.RewardedAd;
const AdEventType = nativeMod?.AdEventType;
const RewardedAdEventType = nativeMod?.RewardedAdEventType;
const TestIds = nativeMod?.TestIds ?? {
  BANNER: 'ca-app-pub-3940256099942544/6300978111',
  REWARDED: 'ca-app-pub-3940256099942544/5224354917',
};

let initialized = false;

export async function initializeAds() {
  if (!mobileAds || initialized) return;
  initialized = true;
  await mobileAds().initialize();
}

export async function showRewardedAd(placement: string) {
  if (!RewardedAd || !AdEventType || !RewardedAdEventType) {
    return { success: false, amount: 0, reason: 'ads_not_available' };
  }

  await initializeAds();
  const rewarded = RewardedAd.createForAdRequest(rewardedAdUnitId);

  return new Promise<{ success: boolean; amount: number; reason?: string }>((resolve) => {
    let earned = false;
    const cleanup: (() => void)[] = [];
    const finish = async (loaded: boolean) => {
      cleanup.forEach((fn) => fn());
      if (!loaded || !earned) {
        resolve({ success: false, amount: 0, reason: loaded ? 'ad_closed' : 'ad_failed' });
        return;
      }
      const result = await grantAdReward({
        adUnitId: rewardedAdUnitId,
        rewardAmount: AD_REWARD_COINS,
        placement,
      });
      resolve({
        success: !!result?.success,
        amount: result?.amount ?? AD_REWARD_COINS,
        reason: result?.reason,
      });
    };

    cleanup.push(
      rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      }),
    );
    cleanup.push(
      rewarded.addAdEventListener(AdEventType.LOADED, () => {
        rewarded.show();
      }),
    );
    cleanup.push(
      rewarded.addAdEventListener(AdEventType.CLOSED, () => {
        void finish(true);
      }),
    );
    cleanup.push(
      rewarded.addAdEventListener(AdEventType.ERROR, () => {
        void finish(false);
      }),
    );
    rewarded.load();
  });
}
