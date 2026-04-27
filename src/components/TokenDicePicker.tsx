// Floating dice picker shown above a tapped token when the player has multiple
// dice values that could move it. Tap a value to apply that die.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/typography';

type Props = {
  /** Pixel center of the token this picker belongs to. */
  cx: number;
  cy: number;
  /** Vertical offset above the token (positive moves up). */
  offset: number;
  /** Distinct die values available for this token. */
  values: number[];
  onPick: (value: number) => void;
};

const DIE = 30;
const GAP = 6;

export function TokenDicePicker({ cx, cy, offset, values, onPick }: Props) {
  const totalWidth = values.length * DIE + (values.length - 1) * GAP;
  const left = cx - totalWidth / 2;
  const top = cy - offset - DIE - 6;

  return (
    <View
      style={[styles.container, { left, top, width: totalWidth, height: DIE }]}
      pointerEvents="box-none"
    >
      {values.map((v, i) => (
        <Pressable
          key={`${v}-${i}`}
          onPress={() => onPick(v)}
          style={({ pressed }) => [
            styles.die,
            { left: i * (DIE + GAP) },
            pressed && { transform: [{ scale: 0.92 }] },
          ]}
        >
          <Text style={styles.dieText}>{v}</Text>
        </Pressable>
      ))}
      {/* tail/arrow pointing down at the token */}
      <View style={[styles.arrow, { left: totalWidth / 2 - 5 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute' },
  die: {
    position: 'absolute',
    top: 0,
    width: DIE,
    height: DIE,
    borderRadius: radius.sm,
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: colors.goldDark,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold,
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 8,
  },
  dieText: { color: colors.bg, fontWeight: '900', fontSize: 16 },
  arrow: {
    position: 'absolute',
    bottom: -6,
    width: 10,
    height: 10,
    backgroundColor: colors.gold,
    transform: [{ rotate: '45deg' }],
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.goldDark,
  },
});
