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
  /** Board side length, used to keep edge pickers fully visible. */
  boardSize: number;
  /** Distinct die values available for this token. */
  values: number[];
  onPick: (value: number) => void;
};

const DIE = 30;
const GAP = 6;

export function TokenDicePicker({ cx, cy, offset, boardSize, values, onPick }: Props) {
  const totalWidth = values.length * DIE + (values.length - 1) * GAP;
  const left = Math.max(4, Math.min(boardSize - totalWidth - 4, cx - totalWidth / 2));
  const preferredTop = cy - offset - DIE - 6;
  const placeBelow = preferredTop < 4;
  const top = placeBelow ? cy + offset + 6 : preferredTop;
  const arrowLeft = Math.max(4, Math.min(totalWidth - 14, cx - left - 5));

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
      <View
        style={[
          styles.arrow,
          placeBelow ? styles.arrowUp : styles.arrowDown,
          { left: arrowLeft },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', zIndex: 100, elevation: 30 },
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
    width: 10,
    height: 10,
    backgroundColor: colors.gold,
    transform: [{ rotate: '45deg' }],
  },
  arrowDown: {
    bottom: -6,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.goldDark,
  },
  arrowUp: {
    top: -6,
    borderLeftWidth: 2,
    borderTopWidth: 2,
    borderColor: colors.goldDark,
  },
});
