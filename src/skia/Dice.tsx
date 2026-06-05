// Dice with 6 face states and a tumble animation.
// The face is drawn with plain Views (cheap, easy to read); the tumble uses
// Reanimated rotate. Skia could draw this too but 6 dot-grids are trivial in RN.

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
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

const SPARKLES = [
  { x: -0.08, y: 0.12, size: 0.13 },
  { x: 0.18, y: -0.10, size: 0.09 },
  { x: 0.66, y: -0.08, size: 0.12 },
  { x: 0.94, y: 0.22, size: 0.08 },
  { x: 0.84, y: 0.76, size: 0.11 },
  { x: 0.52, y: 0.98, size: 0.08 },
  { x: 0.12, y: 0.84, size: 0.10 },
  { x: -0.10, y: 0.52, size: 0.07 },
];

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
      {SPARKLES.map((sparkle, index) => (
        <DiceSparkle
          key={index}
          active={rolling || value !== null}
          index={index}
          rolling={rolling}
          size={size}
          x={sparkle.x}
          y={sparkle.y}
          sparkleSize={sparkle.size}
        />
      ))}
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

function DiceSparkle({
  active,
  index,
  rolling,
  size,
  x,
  y,
  sparkleSize,
}: {
  active: boolean;
  index: number;
  rolling: boolean;
  size: number;
  x: number;
  y: number;
  sparkleSize: number;
}) {
  const twinkle = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      twinkle.value = withTiming(0, { duration: 160 });
      return;
    }

    const delay = index * (rolling ? 55 : 160);
    const upMs = rolling ? 130 : 520;
    const downMs = rolling ? 260 : 900;
    twinkle.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: upMs }),
          withTiming(0.15, { duration: downMs }),
        ),
        -1,
        true,
      ),
    );
  }, [active, index, rolling, twinkle]);

  const sparkleStyle = useAnimatedStyle(() => ({
    opacity: twinkle.value,
    transform: [
      { rotate: '45deg' },
      { scale: 0.45 + twinkle.value * (rolling ? 0.95 : 0.55) },
    ],
  }));

  const pixelSize = size * sparkleSize;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.sparkle,
        {
          left: size * x,
          top: size * y,
          width: pixelSize,
          height: pixelSize,
          borderRadius: pixelSize * 0.18,
        },
        sparkleStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  face: {
    backgroundColor: '#F4D64C',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#5B2A16',
    shadowColor: colors.gold,
    shadowOpacity: 0.55,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
    overflow: 'visible',
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
    backgroundColor: '#130703',
  },
  sparkle: {
    position: 'absolute',
    backgroundColor: '#FFF7C8',
    borderWidth: 1,
    borderColor: colors.gold,
    shadowColor: colors.gold,
    shadowOpacity: 0.95,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 9,
    zIndex: 4,
  },
});
