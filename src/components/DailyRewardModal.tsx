// Daily login reward modal. Shows the 7-day reward ladder with claimed days
// marked, today's day highlighted with a gold ring, and a single CLAIM button.
//
// Pure presentational — the home screen owns the show/hide logic and decides
// when to call the wallet store's `claimDaily()`.

import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { DAILY_REWARDS } from '@/src/stores/wallet';
import { colors } from '@/src/theme/colors';

type Props = {
  visible: boolean;
  /** Day index (1..7) the user is about to claim. */
  pendingDay: number;
  onClaim: () => void;
  onClose: () => void;
};

export function DailyRewardModal({ visible, pendingDay, onClaim, onClose }: Props) {
  const todayReward = DAILY_REWARDS[Math.max(0, pendingDay - 1)];

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(220)} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View entering={ZoomIn.duration(280)} style={styles.card}>
          <Text style={styles.kicker}>WELCOME BACK</Text>
          <Text style={styles.title}>Daily Reward</Text>
          <Text style={styles.subtitle}>Day {pendingDay} of 7 — keep your streak alive</Text>

          <View style={styles.grid}>
            {DAILY_REWARDS.map((amount, i) => {
              const day = i + 1;
              const claimed = day < pendingDay;
              const today = day === pendingDay;
              const bonus = day === 7;
              return (
                <DayCard
                  key={day}
                  day={day}
                  amount={amount}
                  claimed={claimed}
                  today={today}
                  bonus={bonus}
                />
              );
            })}
          </View>

          <Pressable style={({ pressed }) => [styles.claimBtn, pressed && styles.claimBtnPressed]} onPress={onClaim}>
            <Ionicons name="logo-bitcoin" size={22} color={colors.bg} />
            <Text style={styles.claimText}>CLAIM {todayReward}</Text>
          </Pressable>

          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function DayCard({
  day,
  amount,
  claimed,
  today,
  bonus,
}: {
  day: number;
  amount: number;
  claimed: boolean;
  today: boolean;
  bonus: boolean;
}) {
  return (
    <View
      style={[
        styles.dayCard,
        bonus && styles.dayCardBonus,
        today && styles.dayCardToday,
        claimed && styles.dayCardClaimed,
      ]}
    >
      <Text style={[styles.dayLabel, today && styles.dayLabelToday]}>Day {day}</Text>
      {claimed ? (
        <Ionicons name="checkmark-circle" size={26} color={colors.gold} />
      ) : (
        <View style={styles.amountRow}>
          <Ionicons name="logo-bitcoin" size={16} color={colors.gold} />
          <Text style={[styles.amount, bonus && styles.amountBonus]}>{amount}</Text>
        </View>
      )}
      {bonus && !claimed && <Text style={styles.bonusTag}>BONUS</Text>}
    </View>
  );
}

const CARD_W = '23%';

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.bgElevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
  },
  kicker: {
    color: colors.gold,
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: '700',
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
    marginTop: 4,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 6,
    marginBottom: 20,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  dayCard: {
    width: CARD_W,
    aspectRatio: 0.85,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  dayCardClaimed: {
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderColor: 'rgba(212,175,55,0.35)',
  },
  dayCardToday: {
    borderColor: colors.gold,
    borderWidth: 2,
    backgroundColor: 'rgba(212,175,55,0.12)',
  },
  dayCardBonus: {
    width: '48%',
    aspectRatio: 1.7,
    backgroundColor: 'rgba(212,175,55,0.06)',
  },
  dayLabel: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
  },
  dayLabelToday: {
    color: colors.gold,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  amount: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  amountBonus: {
    fontSize: 18,
    color: colors.gold,
  },
  bonusTag: {
    color: colors.gold,
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  claimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.gold,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
    minWidth: 220,
    marginBottom: 12,
  },
  claimBtnPressed: {
    backgroundColor: colors.goldDark,
  },
  claimText: {
    color: colors.bg,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  skip: {
    color: colors.textDim,
    fontSize: 13,
    marginTop: 4,
    textDecorationLine: 'underline',
  },
});
