// Token rendered as a Reanimated.View so we can tap it and animate position
// independently of the Skia board canvas.

import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
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

type Props = {
  color: Color;
  /** Center pixel coords (top-left origin). */
  cx: number;
  cy: number;
  size: number;
  selectable: boolean;
  highlighted: boolean;
  onPress?: () => void;
};

export function Token({ color, cx, cy, size, selectable, highlighted, onPress }: Props) {
  const tx = useSharedValue(cx - size / 2);
  const ty = useSharedValue(cy - size / 2);
  const glow = useSharedValue(highlighted ? 1 : 0);

  useEffect(() => {
    tx.value = withTiming(cx - size / 2, { duration: 350 });
    ty.value = withTiming(cy - size / 2, { duration: 350 });
  }, [cx, cy, size, tx, ty]);

  useEffect(() => {
    glow.value = withTiming(highlighted ? 1 : 0, { duration: 200 });
  }, [highlighted, glow]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
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
