import { Asset } from 'expo-asset';
import type { Session } from '@supabase/supabase-js';

import { Images } from '@/src/assets';
import { useProfileStore } from '@/src/stores/profile';
import { useSettingsStore } from '@/src/stores/settings';
import { useWalletStore } from '@/src/stores/wallet';
import { sound } from '@/src/utils/sound';

export type PreloadStageId =
  | 'settings'
  | 'session'
  | 'profile'
  | 'criticalAssets'
  | 'gameAssets'
  | 'audio'
  | 'ready';

export type PreloadStage = {
  id: PreloadStageId;
  label: string;
};

type PreloadOptions = {
  session: Session | null;
  onStage?: (stage: PreloadStage, progress: number) => void;
  timeoutMs?: number;
};

const PRELOAD_STAGES: PreloadStage[] = [
  { id: 'settings', label: 'Loading settings...' },
  { id: 'session', label: 'Checking your crown...' },
  { id: 'profile', label: 'Preparing your wallet...' },
  { id: 'criticalAssets', label: 'Polishing the golden lobby...' },
  { id: 'gameAssets', label: 'Preparing the royal board...' },
  { id: 'audio', label: 'Tuning the table sounds...' },
  { id: 'ready', label: 'Ready to roll!' },
];

const CRITICAL_ASSETS = [
  Images.bgHome,
  Images.logoEliteLudo,
  Images.coin,
  Images.coinSingle,
  Images.crown,
  Images.clubCrownEmerald,
  Images.clubCrownRoyal,
  Images.clubCrownRuby,
  Images.clubCrownRed,
  Images.clubCrownDesert,
];

const GAME_ASSETS = [
  Images.diceGold,
  Images.diceBlack,
  Images.btnRollDice,
  Images.tokenRed,
  Images.tokenBlue,
  Images.tokenGreen,
  Images.tokenYellow,
];

const DEFERRED_HOME_ASSETS = [
  Images.cityNewDelhi,
  Images.cityLondon,
  Images.cityIstanbul,
  Images.cityDubai,
  Images.cityDoha,
  Images.citySingapore,
  Images.cityTokyo,
  Images.cityParis,
  Images.cityRome,
  Images.cityBerlin,
  Images.giftBox,
  Images.dailyRewardsBanner,
  Images.trophyGold,
  Images.bannerVictory,
  Images.bannerDefeat,
];

let bootPreloadPromise: Promise<void> | null = null;
let deferredPreloadPromise: Promise<void> | null = null;

export async function preloadForBoot(options: PreloadOptions): Promise<void> {
  if (bootPreloadPromise) return bootPreloadPromise;

  bootPreloadPromise = withTimeout(runBootPreload(options), options.timeoutMs ?? 8500);
  return bootPreloadPromise;
}

export function preloadDeferredHomeAssets(): Promise<void> {
  if (!deferredPreloadPromise) {
    deferredPreloadPromise = loadAssets(DEFERRED_HOME_ASSETS).catch((error) => {
      console.warn('[startup] deferred asset preload failed:', error);
    });
  }
  return deferredPreloadPromise;
}

async function runBootPreload({ session, onStage }: PreloadOptions) {
  for (let index = 0; index < PRELOAD_STAGES.length; index += 1) {
    const stage = PRELOAD_STAGES[index];
    const progress = index / Math.max(1, PRELOAD_STAGES.length - 1);
    onStage?.(stage, progress);

    if (stage.id === 'settings') {
      await useSettingsStore.getState().hydrate();
    } else if (stage.id === 'profile' && session) {
      await useProfileStore.getState().hydrate();
      await useWalletStore.getState().hydrate();
    } else if (stage.id === 'criticalAssets') {
      await loadAssets(CRITICAL_ASSETS);
    } else if (stage.id === 'gameAssets') {
      await loadAssets(GAME_ASSETS);
    } else if (stage.id === 'audio') {
      await sound.preload();
    }
  }

  onStage?.(PRELOAD_STAGES[PRELOAD_STAGES.length - 1], 1);
}

async function loadAssets(assets: number[]) {
  await Asset.loadAsync(Array.from(new Set(assets)));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Startup preload timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}
