import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { Images } from '@/src/assets';
import { DAILY_REWARDS } from '@/src/stores/wallet';
import { colors } from '@/src/theme/colors';
import { sound } from '@/src/utils/sound';

type Props = {
  visible: boolean;
  pendingDay: number;
  onClaim: () => void;
  onClose: () => void;
};

export function DailyRewardModal({ visible, pendingDay, onClaim, onClose }: Props) {
  const todayReward = DAILY_REWARDS[Math.max(0, pendingDay - 1)];

  const handleClaim = () => {
    sound.play('tap');
    sound.play('coin');
    onClaim();
  };

  const handleClose = () => {
    sound.play('tap');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={handleClose}>
      <Animated.View entering={FadeIn.duration(220)} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        <Animated.View entering={ZoomIn.delay(80).duration(300)} style={styles.container}>
          {/* Gift box header — sits above the card */}
          <View style={styles.giftWrap}>
            <Image source={Images.giftBox} style={styles.giftBox} resizeMode="contain" />
          </View>

          {/* Main card */}
          <LinearGradient
            colors={['#1A1208', '#0F0C06']}
            style={styles.card}
          >
            {/* Gold top border accent */}
            <LinearGradient
              colors={[colors.goldDark, colors.gold, colors.goldDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.goldTopBorder}
            />

            {/* Banner */}
            <Image
              source={Images.dailyRewardsBanner}
              style={styles.bannerImg}
              resizeMode="contain"
            />

            <Text style={styles.streakText}>Day {pendingDay} of 7 — keep your streak alive</Text>

            {/* Day grid */}
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

            {/* Collect button */}
            <Pressable
              onPress={handleClaim}
              style={({ pressed }) => [styles.collectOuter, pressed && { opacity: 0.85 }]}
            >
              <LinearGradient
                colors={['#3EC55A', '#2D8C3E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.collectGradient}
              >
                <Image source={Images.coinSingle} style={styles.collectCoin} />
                <Text style={styles.collectText}>Collect {todayReward}</Text>
              </LinearGradient>
            </Pressable>

            <Pressable onPress={handleClose} hitSlop={12} style={{ marginTop: 8 }}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function DayCard({
  day, amount, claimed, today, bonus,
}: {
  day: number; amount: number; claimed: boolean; today: boolean; bonus: boolean;
}) {
  return (
    <View style={[
      styles.dayCard,
      bonus && styles.dayCardBonus,
      today && styles.dayCardToday,
      claimed && styles.dayCardClaimed,
    ]}>
      {today && (
        <LinearGradient
          colors={['rgba(212,175,55,0.18)', 'rgba(212,175,55,0.06)']}
          style={StyleSheet.absoluteFill}
        />
      )}
      <Text style={[styles.dayLabel, today && styles.dayLabelToday, bonus && styles.dayLabelBonus]}>
        {bonus ? 'Day 7' : today ? 'Today' : `Day ${day}`}
      </Text>
      {claimed ? (
        <Ionicons name="checkmark-circle" size={26} color={colors.gold} />
      ) : (
        <View style={styles.amountRow}>
          <Image source={Images.coinSingle} style={{ width: 18, height: 18 }} />
          <Text style={[styles.amountText, bonus && styles.amountBonus]}>{amount}</Text>
        </View>
      )}
      {bonus && !claimed && (
        <View style={styles.bonusTag}>
          <Text style={styles.bonusTagText}>BONUS</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  container: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
  },
  giftWrap: {
    zIndex: 2,
    marginBottom: -40,
  },
  giftBox: {
    width: 120,
    height: 120,
  },
  card: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.4)',
    paddingTop: 52,
    paddingBottom: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    overflow: 'hidden',
  },
  goldTopBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  bannerImg: {
    width: '90%',
    height: 56,
    marginBottom: 8,
  },
  streakText: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 16,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
    width: '100%',
  },
  dayCard: {
    width: '22%',
    aspectRatio: 0.82,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 5,
    overflow: 'hidden',
  },
  dayCardClaimed: {
    borderColor: 'rgba(212,175,55,0.3)',
    backgroundColor: 'rgba(212,175,55,0.06)',
  },
  dayCardToday: {
    borderColor: colors.gold,
    borderWidth: 1.5,
  },
  dayCardBonus: {
    width: '47%',
    aspectRatio: 1.8,
    borderColor: 'rgba(212,175,55,0.4)',
    backgroundColor: 'rgba(212,175,55,0.05)',
  },
  dayLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  dayLabelToday: { color: colors.gold },
  dayLabelBonus: { color: colors.goldLight, fontSize: 11 },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  amountText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  amountBonus: { fontSize: 18, color: colors.gold },
  bonusTag: {
    backgroundColor: 'rgba(212,175,55,0.2)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  bonusTagText: {
    color: colors.gold,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
  },
  collectOuter: {
    width: '88%',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.5)',
    elevation: 6,
  },
  collectGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    gap: 8,
  },
  collectCoin: { width: 22, height: 22, resizeMode: 'contain' },
  collectText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  skipText: {
    color: colors.textDim,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
