import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  fetchProducts,
  finishTransaction,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  type Purchase,
} from 'expo-iap';

import { IAP_COIN_PACK_AMOUNT } from '@/src/constants/economy';
import { verifyIapPurchase } from '@/src/supabase/transactions';

const iapExtra = (Constants.expoConfig?.extra?.iap ?? {}) as {
  coinPackProductId?: string;
};

export const coinPackProductId = iapExtra.coinPackProductId ?? 'elite_ludo_coin_pack_1000';

let connected = false;

async function ensureConnection() {
  if (connected) return;
  await initConnection();
  connected = true;
}

export async function loadCoinPack() {
  await ensureConnection();
  const products = await fetchProducts({ skus: [coinPackProductId], type: 'in-app' });
  return products?.[0] ?? null;
}

export async function purchaseCoinPack() {
  await ensureConnection();

  const purchase = await new Promise<Purchase>((resolve, reject) => {
    const okSub = purchaseUpdatedListener((event) => {
      cleanup();
      resolve(event);
    });
    const errSub = purchaseErrorListener((error) => {
      cleanup();
      reject(error);
    });
    const cleanup = () => {
      okSub.remove();
      errSub.remove();
    };
    requestPurchase({
      request: {
        apple: { sku: coinPackProductId },
        google: { skus: [coinPackProductId] },
      },
      type: 'in-app',
    }).catch((error) => {
      cleanup();
      reject(error);
    });
  });

  const purchaseToken = purchase.purchaseToken ?? purchase.transactionId ?? `${coinPackProductId}-${Date.now()}`;

  const result = await verifyIapPurchase({
    productId: coinPackProductId,
    purchaseToken,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
  });
  await finishTransaction({ purchase, isConsumable: true });
  return {
    success: !!result?.success,
    amount: result?.amount ?? IAP_COIN_PACK_AMOUNT,
    alreadyGranted: result?.alreadyGranted,
    reason: result?.reason,
  };
}
