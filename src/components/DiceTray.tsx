// Active player's dice pool + ROLL button. Sits below the board.
// Shows every value rolled this turn (so [6,6,4] all stay visible until played).
// The leftmost slot tumbles when status === 'rolling'.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Dice } from '@/src/skia/Dice';
import { colors } from '@/src/theme/colors';
import { radius, spacing, typography } from '@/src/theme/typography';

type Props = {
  pool: number[];
  isRolling: boolean;
  /** Show the ROLL/ROLL AGAIN button. */
  canRoll: boolean;
  /** Label for the button — "ROLL" first, "ROLL AGAIN" after a 6. */
  rollLabel: string;
  onRoll: () => void;
  /** Optional caption shown below the tray. */
  hint?: string;
};

export function DiceTray({
  pool,
  isRolling,
  canRoll,
  rollLabel,
  onRoll,
  hint,
}: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Dice size={56} value={isRolling ? null : pool[pool.length - 1] ?? null} rolling={isRolling} />
        <View style={styles.poolStack}>
          {pool.length === 0 && !isRolling ? (
            <Text style={styles.empty}>No dice rolled yet</Text>
          ) : (
            pool.slice(0, -1).map((v, i) => (
              <View key={`${v}-${i}`} style={styles.smallDie}>
                <Text style={styles.smallDieText}>{v}</Text>
              </View>
            ))
          )}
        </View>
        <Pressable
          onPress={onRoll}
          disabled={!canRoll || isRolling}
          style={({ pressed }) => [
            styles.rollBtn,
            (!canRoll || isRolling) && styles.rollBtnDisabled,
            pressed && canRoll && { transform: [{ scale: 0.96 }] },
          ]}
        >
          <Text style={styles.rollText}>{rollLabel}</Text>
        </Pressable>
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : <View style={styles.hintSpacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
    justifyContent: 'space-between',
  },
  poolStack: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 28,
  },
  smallDie: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.gold,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallDieText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  empty: { ...typography.caption, color: colors.textDim },
  rollBtn: {
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    minWidth: 110,
    alignItems: 'center',
  },
  rollBtnDisabled: { opacity: 0.35 },
  rollText: { color: colors.bg, fontWeight: '800', letterSpacing: 1.5, fontSize: 13 },
  hint: { ...typography.caption, color: colors.textMuted, height: 16 },
  hintSpacer: { height: 16 },
});
