// Thin wrapper around expo-haptics so callers don't have to care about
// platform support or the per-style enum. All calls are fire-and-forget — we
// never block the UI on a haptic completing.
//
// Reads `vibrationEnabled` from the cached settings each call, so toggling
// the Settings switch takes effect on the next haptic without re-importing.
//
// When the designer ships sound files, add an audio call alongside the haptic
// in each helper here (single place to wire) — see `assets/sounds/` (empty).

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { getCachedSettings } from '@/src/stores/settings';

const PLATFORM_OK = Platform.OS === 'ios' || Platform.OS === 'android';

function enabled(): boolean {
  return PLATFORM_OK && getCachedSettings().vibrationEnabled;
}

export const haptics = {
  /** Tap feedback (e.g. selecting a token, pressing roll). */
  tap: () => {
    if (!enabled()) return;
    Haptics.selectionAsync().catch(() => {});
  },
  /** Token landed on a normal cell, dice settled. */
  light: () => {
    if (!enabled()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  /** Dice rolled, token landed after a long hop. */
  medium: () => {
    if (!enabled()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },
  /** Capture — opponent token sent home. */
  heavy: () => {
    if (!enabled()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  },
  /** Game over: you won. */
  success: () => {
    if (!enabled()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  /** Game over: you lost. */
  warning: () => {
    if (!enabled()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  },
};
