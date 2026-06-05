import type { ImageSourcePropType } from 'react-native';

import { Images } from '@/src/assets';

export type CityClub = {
  id: string;
  name: string;
  entry: number;
  prize: number;
  winsToUnlock: number;
  crown: ImageSourcePropType;
};

export const CITY_CLUBS: CityClub[] = [
  { id: 'newdelhi', name: 'New Delhi', entry: 250, prize: 600, winsToUnlock: 1, crown: Images.clubCrownEmerald },
  { id: 'london', name: 'London', entry: 500, prize: 1000, winsToUnlock: 3, crown: Images.clubCrownRoyal },
  { id: 'istanbul', name: 'Istanbul', entry: 750, prize: 1800, winsToUnlock: 5, crown: Images.clubCrownDesert },
  { id: 'dubai', name: 'Dubai', entry: 1000, prize: 2500, winsToUnlock: 7, crown: Images.clubCrownRuby },
  { id: 'doha', name: 'Doha', entry: 1500, prize: 4000, winsToUnlock: 10, crown: Images.clubCrownRed },
];

export type ShopItem = {
  id: string;
  label: string;
  kind: 'token_skin' | 'dice_skin' | 'crown';
  price: number;
  currency: 'coins' | 'gems';
  accent: string;
};

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'token_royal_gold', label: 'Royal Gold Tokens', kind: 'token_skin', price: 800, currency: 'coins', accent: '#D4AF37' },
  { id: 'token_emerald', label: 'Emerald Tokens', kind: 'token_skin', price: 1200, currency: 'coins', accent: '#3DB45A' },
  { id: 'dice_obsidian', label: 'Obsidian Dice', kind: 'dice_skin', price: 1000, currency: 'coins', accent: '#262626' },
  { id: 'dice_sapphire', label: 'Sapphire Dice', kind: 'dice_skin', price: 1800, currency: 'coins', accent: '#3F92D2' },
  { id: 'crown_starter', label: 'Starter Crown', kind: 'crown', price: 2500, currency: 'coins', accent: '#E2574C' },
];

export const AD_REWARD_COINS = 100;
export const IAP_COIN_PACK_AMOUNT = 1000;
