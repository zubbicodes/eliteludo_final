// Active player's dice pool + ROLL button. Sits below the board.
// Shows every value rolled this turn (so [6,6,4] all stay visible until played).
// The leftmost slot tumbles when status === 'rolling'.

import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Dice } from '@/src/skia/Dice';
import { colors } from '@/src/theme/colors';
import { spacing, typography } from '@/src/theme/typography';

type Props = {
  pool: number[];
  isRolling: boolean;
  /** Last settled roll to keep visible even when no moves were playable. */
  displayValue?: number | null;
  /** Show the ROLL/ROLL AGAIN button. */
  canRoll: boolean;
  /** Label for the button - "ROLL" first, "ROLL AGAIN" after a 6. */
  rollLabel: string;
  onRoll: () => void;
  /** Optional caption shown below the tray. */
  hint?: string;
};

export function DiceTray({
  pool,
  isRolling,
  displayValue = null,
  canRoll,
  rollLabel,
  onRoll,
  hint,
}: Props) {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(83,48,21,0.96)', 'rgba(28,13,5,0.98)']}
        style={styles.tray}
      >
        <View style={styles.ornamentLeft} />
        <View style={styles.diceCup}>
          <Dice
            size={58}
            value={isRolling ? null : displayValue ?? pool[pool.length - 1] ?? null}
            rolling={isRolling}
          />
        </View>
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
          <LinearGradient
            colors={canRoll && !isRolling ? ['#4D2B0E', '#1B0A03'] : ['#2D2116', '#120A06']}
            style={styles.rollGradient}
          >
            <View style={styles.rollGloss} />
            <Text style={styles.rollText}>{rollLabel}</Text>
          </LinearGradient>
        </Pressable>
        <View style={styles.ornamentRight} />
      </LinearGradient>
      {hint ? <Text style={styles.hint}>{hint}</Text> : <View style={styles.hintSpacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    alignItems: 'center',
    gap: spacing.xs,
  },
  tray: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    minHeight: 88,
    justifyContent: 'space-between',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 12,
    shadowColor: colors.gold,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
    overflow: 'hidden',
  },
  ornamentLeft: {
    position: 'absolute',
    left: 10,
    top: 8,
    width: 52,
    height: 1,
    backgroundColor: 'rgba(212,175,55,0.5)',
  },
  ornamentRight: {
    position: 'absolute',
    right: 10,
    bottom: 8,
    width: 52,
    height: 1,
    backgroundColor: 'rgba(212,175,55,0.45)',
  },
  diceCup: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: '#180904',
    borderWidth: 2,
    borderColor: colors.goldDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  poolStack: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 28,
    paddingHorizontal: 8,
  },
  smallDie: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#5B2A16',
    backgroundColor: '#F5D96E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallDieText: { color: '#190B02', fontWeight: '900', fontSize: 13 },
  empty: { ...typography.caption, color: colors.textDim },
  rollBtn: {
    width: 126,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rollGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderRadius: 16,
  },
  rollGloss: {
    position: 'absolute',
    top: 4,
    left: 10,
    right: 10,
    height: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  rollBtnDisabled: { opacity: 0.35 },
  rollText: {
    color: '#FFF2B0',
    fontWeight: '900',
    letterSpacing: 1.4,
    fontSize: 13,
    textShadowColor: '#2A0C05',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  hint: { ...typography.caption, color: colors.textMuted, height: 16 },
  hintSpacer: { height: 16 },
});
