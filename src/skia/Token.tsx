// Token rendered as a Reanimated.View so it remains visible and tappable while
// movement stays on the UI thread.

import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
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
  const bounce = useSharedValue(0);
  const glow = useSharedValue(highlighted ? 1 : 0);
  const hopKey = hopPath?.map((p) => `${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join('|') ?? '';

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => {
      const timer = setTimeout(fn, ms);
      timers.push(timer);
    };
    const targetX = cx - size / 2;
    const targetY = cy - size / 2;

    if (hopPath && hopPath.length > 1) {
      const stops = hopPath.slice(1);
      const arc = Math.min(10, size * 0.35);
      const half = hopMs / 2;

      stops.forEach((stop, index) => {
        const startAt = delayMs + index * hopMs;
        later(() => {
          tx.value = withTiming(stop.cx - size / 2, { duration: hopMs, easing: Easing.linear });
          ty.value = withTiming(stop.cy - size / 2, { duration: hopMs, easing: Easing.linear });
          bounce.value = withTiming(-arc, { duration: half, easing: Easing.out(Easing.quad) });
        }, startAt);
        later(() => {
          bounce.value = withTiming(0, { duration: half, easing: Easing.in(Easing.quad) });
        }, startAt + half);
      });

      if (onHopComplete) {
        later(onHopComplete, delayMs + stops.length * hopMs);
      }

      return () => {
        timers.forEach(clearTimeout);
      };
    }

    bounce.value = 0;
    later(() => {
      tx.value = withTiming(targetX, { duration: 260 });
      ty.value = withTiming(targetY, { duration: 260 });
    }, delayMs);

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [hopKey, hopPath, cx, cy, size, hopMs, delayMs, tx, ty, bounce, onHopComplete]);

  useEffect(() => {
    glow.value = withTiming(highlighted ? 1 : 0, { duration: 180 });
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
