// Token rendered as a Reanimated.View so it remains visible and tappable while
// movement stays on the UI thread.

import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import type { Color } from '@/src/game/types';
import { OrnateTokenCanvas } from '@/src/skia/OrnateToken';
import { colors } from '@/src/theme/colors';

type HopStop = { cx: number; cy: number };

type Props = {
  color: Color;
  cx: number;
  cy: number;
  size: number;
  selectable: boolean;
  highlighted: boolean;
  hopPath?: HopStop[];
  hopMs?: number;
  delayMs?: number;
  onPress?: () => void;
  onHopComplete?: () => void;
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
  onHopComplete,
}: Props) {
  const tx = useSharedValue(cx - size / 2);
  const ty = useSharedValue(cy - size / 2);
  const pathProgress = useSharedValue(0);
  const glow = useSharedValue(highlighted ? 1 : 0);
  const hopKey = hopPath?.map((p) => `${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join('|') ?? '';
  const pathPoints = useMemo(
    () =>
      hopPath?.map((point) => ({
        x: point.cx - size / 2,
        y: point.cy - size / 2,
      })) ?? [],
    [hopPath, size],
  );

  const animatedX = useDerivedValue(() => {
    if (pathPoints.length < 2) return tx.value;
    const maxIndex = pathPoints.length - 1;
    const current = Math.min(Math.max(pathProgress.value, 0), maxIndex);
    const index = Math.min(Math.floor(current), maxIndex - 1);
    const t = current - index;
    return pathPoints[index].x + (pathPoints[index + 1].x - pathPoints[index].x) * t;
  });

  const animatedY = useDerivedValue(() => {
    if (pathPoints.length < 2) return ty.value;
    const maxIndex = pathPoints.length - 1;
    const current = Math.min(Math.max(pathProgress.value, 0), maxIndex);
    const index = Math.min(Math.floor(current), maxIndex - 1);
    const t = current - index;
    const arc = Math.min(10, size * 0.35);
    const hop = -4 * arc * t * (1 - t);
    return pathPoints[index].y + (pathPoints[index + 1].y - pathPoints[index].y) * t + hop;
  });

  useEffect(() => {
    const targetX = cx - size / 2;
    const targetY = cy - size / 2;
    cancelAnimation(pathProgress);
    cancelAnimation(tx);
    cancelAnimation(ty);

    if (pathPoints.length > 1) {
      tx.value = pathPoints[0].x;
      ty.value = pathPoints[0].y;
      pathProgress.value = 0;
      pathProgress.value = withDelay(
        delayMs,
        withTiming(pathPoints.length - 1, {
          duration: Math.max(1, pathPoints.length - 1) * hopMs,
          easing: Easing.linear,
        }, (finished) => {
          if (finished && onHopComplete) {
            runOnJS(onHopComplete)();
          }
        }),
      );
      return;
    }

    pathProgress.value = 0;
    tx.value = withDelay(delayMs, withTiming(targetX, { duration: 260 }));
    ty.value = withDelay(delayMs, withTiming(targetY, { duration: 260 }));
  }, [hopKey, cx, cy, size, hopMs, delayMs, tx, ty, pathProgress, pathPoints, onHopComplete]);

  useEffect(() => {
    glow.value = withTiming(highlighted ? 1 : 0, { duration: 180 });
  }, [highlighted, glow]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: animatedX.value }, { translateY: animatedY.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: 1 + glow.value * 0.15 }],
  }));

  return (
    <Animated.View
      pointerEvents={selectable ? 'auto' : 'none'}
      style={[
        styles.container,
        { width: size, height: size, zIndex: hopPath ? 40 : highlighted ? 30 : 10 },
        containerStyle,
      ]}
    >
      <Pressable disabled={!selectable} onPress={onPress} style={styles.fill}>
        <Animated.View
          style={[
            styles.ring,
            { width: size, height: size, borderRadius: size / 2 },
            ringStyle,
          ]}
        />
        <OrnateTokenCanvas color={color} size={size} />
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
});
