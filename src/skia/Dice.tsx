// Dice with 6 face states and a tumble animation.
// The face is drawn with plain Views (cheap, easy to read); the tumble uses
// Reanimated rotate. Skia could draw this too but 6 dot-grids are trivial in RN.

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/src/theme/colors';

type Props = {
  size: number;
  value: number | null; // 1..6, or null if not yet rolled
  rolling: boolean;
};

const FACES: Record<number, [boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean]> = {
  // 9 cells in a 3x3 grid. true means dot at this position.
  1: [false, false, false, false, true, false, false, false, false],
  2: [true, false, false, false, false, false, false, false, true],
  3: [true, false, false, false, true, false, false, false, true],
  4: [true, false, true, false, false, false, true, false, true],
  5: [true, false, true, false, true, false, true, false, true],
  6: [true, false, true, true, false, true, true, false, true],
};

export function Dice({ size, value, rolling }: Props) {
  const rot = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (rolling) {
      rot.value = 0;
      rot.value = withTiming(720, { duration: 600 });
      scale.value = withTiming(1.15, { duration: 200 }, () => {
        scale.value = withTiming(1, { duration: 200 });
      });
    }
  }, [rolling, rot, scale]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }, { scale: scale.value }],
  }));

  const dots = value && !rolling ? FACES[value] : null;

  return (
    <Animated.View
      style={[
        styles.face,
        { width: size, height: size, borderRadius: size * 0.18 },
        containerStyle,
      ]}
    >
      {dots ? (
        <View style={styles.grid}>
          {dots.map((on, i) => (
            <View key={i} style={styles.cell}>
              {on ? (
                <View
                  style={[
                    styles.dot,
                    {
                      width: size * 0.18,
                      height: size * 0.18,
                      borderRadius: (size * 0.18) / 2,
                    },
                  ]}
                />
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.cell} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  face: {
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 6,
  },
  cell: {
    width: '33.33%',
    height: '33.33%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    backgroundColor: colors.bg,
  },
});
