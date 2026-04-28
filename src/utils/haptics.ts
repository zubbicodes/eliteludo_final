// Thin wrapper around expo-haptics so callers don't have to care about
// platform support or the per-style enum. All calls are fire-and-forget — we
// never block the UI on a haptic completing.
//
// When the designer ships sound files, add an audio call alongside the haptic
// in each helper here (single place to wire) — see `assets/sounds/` (empty).

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const ENABLED = Platform.OS === 'ios' || Platform.OS === 'android';

export const haptics = {
  /** Tap feedback (e.g. selecting a token, pressing roll). */
  tap: () => {
    if (!ENABLED) return;
    Haptics.selectionAsync().catch(() => {});
  },
  /** Token landed on a normal cell, dice settled. */
  light: () => {
    if (!ENABLED) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  /** Dice rolled, token landed after a long hop. */
  medium: () => {
    if (!ENABLED) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },
  /** Capture — opponent token sent home. */
  heavy: () => {
    if (!ENABLED) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  },
  /** Game over: you won. */
  success: () => {
    if (!ENABLED) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  /** Game over: you lost. */
  warning: () => {
    if (!ENABLED) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  },
};
