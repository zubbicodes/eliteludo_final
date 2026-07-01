import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useRef } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { RoyalCurrencyIcon, RoyalHomeBackdrop } from "@/src/skia/HomeArtwork";
import { DAILY_REWARDS } from "@/src/stores/wallet";
import { fontFamilies } from "@/src/theme/typography";
import { sound } from "@/src/utils/sound";

type Point = {
  x: number;
  y: number;
};

type Props = {
  visible: boolean;
  pendingDay: number;
  onClaim: (origin: Point) => void;
  onClose: () => void;
};

export function DailyRewardModal({ visible, pendingDay, onClaim, onClose }: Props) {
  const viewport = useWindowDimensions();
  const collectRef = useRef<View>(null);
  const todayReward = DAILY_REWARDS[Math.max(0, pendingDay - 1)];
  const panelWidth = Math.min(viewport.width - 28, 398);

  const measureCollectOrigin = useCallback((callback: (point: Point) => void) => {
    collectRef.current?.measureInWindow((x, y, width, height) => {
      callback({ x: x + width * 0.22, y: y + height * 0.5 });
    });
  }, []);

  const handleClaim = () => {
    sound.play("tap");
    sound.play("coin");
    measureCollectOrigin((origin) => onClaim(origin));
  };

  const handleClose = () => {
    sound.play("tap");
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={StyleSheet.absoluteFill}>
          <RoyalHomeBackdrop width={viewport.width} height={viewport.height} />
        </View>
        <View style={styles.backdropTint} />
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        <View style={[styles.panel, { width: panelWidth }]}>
          <LinearGradient
            colors={["rgba(39,26,11,0.98)", "rgba(8,6,4,0.99)"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.innerStroke} />

          <Pressable
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Close daily rewards"
            hitSlop={10}
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={18} color="#F8DE8A" />
          </Pressable>

          <Animated.View entering={FadeIn.delay(60).duration(220)} style={styles.header}>
            <Text style={styles.eyebrow}>DAILY STREAK</Text>
            <Text style={styles.title}>Reward Ready</Text>
            <Text style={styles.subtitle}>Day {pendingDay} of 7</Text>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(110).duration(240)} style={styles.rewardPlate}>
            <View style={styles.coinHalo}>
              <RoyalCurrencyIcon kind="coin" size={62} />
            </View>
            <View style={styles.rewardCopy}>
              <Text style={styles.rewardLabel}>TODAY CLAIM</Text>
              <Text style={styles.rewardValue}>+{todayReward.toLocaleString()}</Text>
            </View>
          </Animated.View>

          <View style={styles.grid}>
            {DAILY_REWARDS.map((amount, index) => {
              const day = index + 1;
              return (
                <RewardDay
                  key={day}
                  day={day}
                  amount={amount}
                  claimed={day < pendingDay}
                  active={day === pendingDay}
                  bonus={day === 7}
                />
              );
            })}
          </View>

          <Animated.View entering={FadeIn.delay(230).duration(240)} style={styles.footer}>
            <Pressable
              ref={collectRef}
              onPress={handleClaim}
              accessibilityRole="button"
              accessibilityLabel={`Collect ${todayReward} coins`}
              style={({ pressed }) => [styles.collectButton, pressed && styles.pressed]}
            >
              <LinearGradient
                colors={["#F7D96C", "#A96B12"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.collectFill}
              >
                <RoyalCurrencyIcon kind="coin" size={34} />
                <Text style={styles.collectText}>COLLECT</Text>
              </LinearGradient>
            </Pressable>

            <Pressable onPress={handleClose} hitSlop={12} style={styles.skipBtn}>
              <Text style={styles.skipText}>Later</Text>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

function RewardDay({
  day,
  amount,
  claimed,
  active,
  bonus,
}: {
  day: number;
  amount: number;
  claimed: boolean;
  active: boolean;
  bonus: boolean;
}) {
  return (
    <Animated.View
      entering={FadeIn.delay(140 + day * 22).duration(200)}
      style={[
        styles.dayCard,
        active && styles.dayCardActive,
        claimed && styles.dayCardClaimed,
        bonus && styles.dayCardBonus,
      ]}
    >
      <Text style={[styles.dayText, active && styles.activeText]}>{day}</Text>
      <View style={styles.dayCoinRow}>
        <RoyalCurrencyIcon kind="coin" size={18} />
        <Text style={[styles.amountText, active && styles.activeText]}>{amount}</Text>
      </View>
      {claimed && <Ionicons name="checkmark" size={13} color="#F8DE8A" style={styles.checkIcon} />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  backdropTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.76)",
  },
  panel: {
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(248,222,138,0.34)",
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 16,
    boxShadow: "0 20px 50px rgba(0,0,0,0.38)",
  },
  innerStroke: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  closeBtn: {
    position: "absolute",
    top: 13,
    right: 13,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.36)",
    borderWidth: 1,
    borderColor: "rgba(248,222,138,0.24)",
    zIndex: 2,
  },
  header: {
    alignItems: "center",
    paddingHorizontal: 42,
  },
  eyebrow: {
    color: "#D8B85C",
    fontFamily: fontFamilies.body,
    fontSize: 10,
    letterSpacing: 2,
  },
  title: {
    color: "#FFF0B5",
    fontFamily: fontFamilies.heading,
    fontSize: 27,
    fontWeight: "400",
    marginTop: 3,
  },
  subtitle: {
    color: "rgba(255,244,210,0.62)",
    fontFamily: fontFamilies.body,
    fontSize: 12,
    marginTop: 3,
  },
  rewardPlate: {
    marginTop: 18,
    minHeight: 104,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.28)",
    borderWidth: 1,
    borderColor: "rgba(248,222,138,0.16)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 14,
  },
  coinHalo: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(212,175,55,0.12)",
    borderWidth: 1,
    borderColor: "rgba(248,222,138,0.18)",
  },
  rewardCopy: {
    flex: 1,
  },
  rewardLabel: {
    color: "rgba(255,244,210,0.48)",
    fontFamily: fontFamilies.body,
    fontSize: 10,
    letterSpacing: 1.4,
  },
  rewardValue: {
    color: "#FFE47D",
    fontFamily: fontFamilies.heading,
    fontSize: 34,
    fontWeight: "400",
    fontVariant: ["tabular-nums"],
    marginTop: 2,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginTop: 16,
  },
  dayCard: {
    width: "22%",
    minWidth: 72,
    height: 68,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  dayCardActive: {
    backgroundColor: "rgba(212,175,55,0.13)",
    borderColor: "#F8DE8A",
  },
  dayCardClaimed: {
    backgroundColor: "rgba(212,175,55,0.08)",
    borderColor: "rgba(248,222,138,0.22)",
  },
  dayCardBonus: {
    width: "47%",
  },
  dayText: {
    color: "rgba(255,244,210,0.5)",
    fontFamily: fontFamilies.heading,
    fontSize: 13,
  },
  dayCoinRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  amountText: {
    color: "rgba(255,244,210,0.7)",
    fontFamily: fontFamilies.body,
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  activeText: {
    color: "#FFE47D",
  },
  checkIcon: {
    position: "absolute",
    top: 6,
    right: 7,
  },
  footer: {
    alignItems: "center",
    marginTop: 16,
    gap: 8,
  },
  collectButton: {
    width: "100%",
    height: 54,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255,241,184,0.5)",
  },
  collectFill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  collectText: {
    color: "#FFFFFF",
    fontFamily: fontFamilies.heading,
    fontSize: 16,
    fontWeight: "400",
    letterSpacing: 1.4,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  skipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  skipText: {
    color: "rgba(255,244,210,0.44)",
    fontFamily: fontFamilies.body,
    fontSize: 12,
  },
});
