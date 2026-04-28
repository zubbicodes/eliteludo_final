// Token rendered as a Reanimated.View so we can tap it and animate position
// independently of the Skia board canvas.
//
// Two animation modes:
//  - Default (no `hopPath`): smooth withTiming slide from previous (cx, cy) to
//    the new one. Used for captured tokens being sent home, or any time we
//    just want a clean slide.
//  - `hopPath` mode: a sequence of cells the token visits one cell at a time,
//    with a small vertical arc per hop. Used for the moving token of the
//    current move so each die point reads as one discrete hop.

import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { Color } from '@/src/game/types';
import { colors } from '@/src/theme/colors';

const PLAYER_HEX: Record<Color, string> = {
  red: colors.red,
  green: colors.green,
  yellow: colors.yellow,
  blue: colors.blue,
};

type HopStop = { cx: number; cy: number };

type Props = {
  color: Color;
  /** Center pixel coords (top-left origin). When `hopPath` is set, this is the final cell. */
  cx: number;
  cy: number;
  size: number;
  selectable: boolean;
  highlighted: boolean;
  /** When set, animates through these cells in order (first entry should be the start cell). */
  hopPath?: HopStop[];
  /** Per-hop duration in ms when `hopPath` is set. Default 130. */
  hopMs?: number;
  /** Delay before the move animation starts (used to sequence captures after the attacker arrives). */
  delayMs?: number;
  onPress?: () => void;
};

export function Token({
  color,
  cx,
  cy,
  size,
  selectable,
  highlighted,
  hopPath,
  hopMs = 130,
  delayMs = 0,
  onPress,
}: Props) {
  const tx = useSharedValue(cx - size / 2);
  const ty = useSharedValue(cy - size / 2);
  const bounce = useSharedValue(0);
  const glow = useSharedValue(highlighted ? 1 : 0);

  // Encode hopPath as a stable string so the effect only re-runs when the path actually changes.
  const hopKey = hopPath?.map((p) => `${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join('|') ?? '';

  useEffect(() => {
    const targetX = cx - size / 2;
    const targetY = cy - size / 2;

    if (hopPath && hopPath.length > 1) {
      const stops = hopPath.slice(1);
      const arc = Math.min(10, size * 0.35);
      const half = hopMs / 2;
      const xSeq = stops.map((p) =>
        withTiming(p.cx - size / 2, { duration: hopMs, easing: Easing.linear }),
      );
      const ySeq = stops.map((p) =>
        withTiming(p.cy - size / 2, { duration: hopMs, easing: Easing.linear }),
      );
      const bSeq = stops.flatMap(() => [
        withTiming(-arc, { duration: half, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: half, easing: Easing.in(Easing.quad) }),
      ]);
      tx.value = withDelay(delayMs, withSequence(...xSeq));
      ty.value = withDelay(delayMs, withSequence(...ySeq));
      bounce.value = withDelay(delayMs, withSequence(...bSeq));
      return;
    }

    // No path → smooth slide.
    bounce.value = 0;
    tx.value = withDelay(delayMs, withTiming(targetX, { duration: 320 }));
    ty.value = withDelay(delayMs, withTiming(targetY, { duration: 320 }));
  }, [hopKey, cx, cy, size, hopMs, delayMs]);

  useEffect(() => {
    glow.value = withTiming(highlighted ? 1 : 0, { duration: 200 });
  }, [highlighted, glow]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value + bounce.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: 1 + glow.value * 0.15 }],
  }));

  return (
    <Animated.View
      pointerEvents={selectable ? 'auto' : 'none'}
      style={[styles.container, { width: size, height: size }, containerStyle]}
    >
      <Pressable disabled={!selectable} onPress={onPress} style={styles.fill}>
        <Animated.View
          style={[
            styles.ring,
            { width: size, height: size, borderRadius: size / 2 },
            ringStyle,
          ]}
        />
        <View
          style={[
            styles.dot,
            {
              width: size * 0.7,
              height: size * 0.7,
              borderRadius: (size * 0.7) / 2,
              backgroundColor: PLAYER_HEX[color],
            },
          ]}
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.gold,
  },
  dot: {
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.4)',
  },
});
