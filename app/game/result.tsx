import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import type { Color } from "@/src/game/types";
import { ResultCrestCanvas } from "@/src/skia/ResultArtwork";
import { RoyalCurrencyIcon, RoyalHomeBackdrop } from "@/src/skia/HomeArtwork";
import { supabase } from "@/src/supabase/client";
import { getMatch } from "@/src/supabase/matches";
import { awardMatchReward } from "@/src/supabase/transactions";
import { useProfileStore } from "@/src/stores/profile";
import { useWalletStore } from "@/src/stores/wallet";
import { colors } from "@/src/theme/colors";
import { fontFamilies } from "@/src/theme/typography";
import { haptics } from "@/src/utils/haptics";
import { sound } from "@/src/utils/sound";

const PLAYER_HEX: Record<Color, string> = {
  red: colors.red,
  green: colors.green,
  yellow: colors.yellow,
  blue: colors.blue,
};

export default function ResultScreen() {
  const { winner, matchId, entryFee, citySlug, humanColor, mode } = useLocalSearchParams<{
    winner: Color;
    matchId?: string;
    entryFee?: string;
    citySlug?: string;
    humanColor?: Color;
    mode?: string;
  }>();
  const viewport = useWindowDimensions();
  const hydrateProfile = useProfileStore((s) => s.hydrate);
  const refreshWallet = useWalletStore((s) => s.refresh);
  const refreshProfile = useProfileStore((s) => s.refresh);
  const playerColor = humanColor || "red";
  const winnerColor = winner ? PLAYER_HEX[winner] : colors.gold;
  const isHumanWin = winner === playerColor;
  const stake = Number(entryFee ?? 0);
  const reward = isHumanWin && stake > 0 ? stake * 2 : 0;
  const [settled, setSettled] = useState(false);

  const resultCopy = useMemo(
    () =>
      isHumanWin
        ? {
            title: "VICTORY",
            eyebrow: "MATCH COMPLETE",
            subtitle: "Clean finish. Rewards are being settled.",
          }
        : {
            title: "DEFEAT",
            eyebrow: "MATCH COMPLETE",
            subtitle: "Review the table, reset, and run it back.",
          },
    [isHumanWin],
  );

  useEffect(() => {
    hydrateProfile();
  }, [hydrateProfile]);

  useEffect(() => {
    if (isHumanWin) sound.play("coin");
    else sound.play("defeat");
  }, [isHumanWin]);

  useEffect(() => {
    const settle = async () => {
      if (!matchId || matchId.startsWith("solo-") || !winner) return;
      const [{ data: { session } }, match] = await Promise.all([
        supabase.auth.getSession(),
        getMatch(matchId),
      ]);
      if (!session || !match) return;
      const winnerEntry = match.players.find((p) => p.color === winner);
      if (!winnerEntry || winnerEntry.user_id.startsWith("bot-")) return;
      const loserEntry = match.players.find((p) => p.user_id !== winnerEntry.user_id && !p.user_id.startsWith("bot-"));
      await supabase
        .from("matches")
        .update({
          status: "finished",
          winner_user_id: winnerEntry.user_id,
          finished_at: new Date().toISOString(),
        })
        .eq("id", matchId);
      await awardMatchReward({
        matchId,
        winnerUserId: winnerEntry.user_id,
        loserUserId: loserEntry?.user_id,
        entryFee: Number(entryFee ?? match.entry_fee ?? 0),
        citySlug,
      });
      await Promise.all([refreshWallet(), refreshProfile()]);
      setSettled(true);
    };
    settle().catch(() => setSettled(false));
  }, [citySlug, entryFee, matchId, refreshProfile, refreshWallet, winner]);

  const playAgain = () => {
    haptics.tap();
    sound.play("tap");
    router.replace({ pathname: "/game/new", params: { mode } });
  };

  const goHome = () => {
    haptics.tap();
    sound.play("tap");
    router.replace("/");
  };

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}>
        <RoyalHomeBackdrop width={viewport.width} height={viewport.height} />
      </View>
      <View style={styles.tint} />

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <Animated.View entering={FadeIn.duration(220)} style={styles.copyBlock}>
          <Text style={[styles.eyebrow, { color: isHumanWin ? "#F8D976" : "#FFA69E" }]}>{resultCopy.eyebrow}</Text>
          <Text style={[styles.title, { color: isHumanWin ? "#FFF0A8" : "#FFE2DE" }]}>{resultCopy.title}</Text>
          <Text style={styles.subtitle}>{resultCopy.subtitle}</Text>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(110).duration(260)} style={styles.crestWrap}>
          <ResultCrestCanvas width={Math.min(viewport.width - 34, 330)} height={Math.min(viewport.width - 34, 330)} won={isHumanWin} accent={winnerColor} />
        </Animated.View>

        <Animated.View entering={FadeIn.delay(190).duration(260)} style={styles.statusPanel}>
          {winner && (
            <View style={styles.winnerRow}>
              <View style={[styles.colorDot, { backgroundColor: winnerColor }]} />
              <Text style={styles.winnerText}>{winner.toUpperCase()} WINS</Text>
            </View>
          )}

          {reward > 0 ? (
            <View style={styles.rewardRow}>
              <RoyalCurrencyIcon kind="coin" size={42} />
              <Text style={styles.rewardText}>+{reward.toLocaleString()}</Text>
            </View>
          ) : (
            <Text style={styles.panelNote}>{isHumanWin ? "Practice table cleared" : "No reward collected"}</Text>
          )}

          {matchId && !matchId.startsWith("solo-") && (
            <Text style={styles.settleText}>{settled ? "Rewards settled" : "Settling rewards..."}</Text>
          )}
        </Animated.View>

        <Animated.View entering={FadeIn.delay(260).duration(260)} style={styles.actions}>
          <Pressable onPress={playAgain} style={({ pressed }) => [styles.primaryOuter, pressed && styles.pressed]}>
            <LinearGradient
              colors={isHumanWin ? ["#F5D66E", "#A96B12"] : ["#F07266", "#81221E"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.primaryGradient}
            >
              <Text style={styles.primaryText}>PLAY AGAIN</Text>
            </LinearGradient>
          </Pressable>

          <Pressable onPress={goHome} style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}>
            <Text style={styles.secondaryText}>BACK TO MENU</Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,1,1,0.36)",
  },
  safe: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 28,
    paddingBottom: 20,
  },
  crestWrap: {
    width: "100%",
    alignItems: "center",
    marginVertical: 4,
  },
  copyBlock: {
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
  },
  eyebrow: {
    fontFamily: fontFamilies.body,
    fontSize: 10,
    letterSpacing: 2.4,
  },
  title: {
    fontFamily: fontFamilies.heading,
    fontWeight: "400",
    fontSize: 48,
    letterSpacing: 1.6,
    textAlign: "center",
    textShadowColor: "rgba(212,175,55,0.28)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  subtitle: {
    maxWidth: 330,
    color: "rgba(255,244,210,0.68)",
    fontFamily: fontFamilies.body,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
  statusPanel: {
    width: "100%",
    maxWidth: 360,
    minHeight: 112,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(231,194,91,0.28)",
    backgroundColor: "rgba(9,5,2,0.72)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  winnerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
  },
  winnerText: {
    color: "#FFF0B5",
    fontFamily: fontFamilies.heading,
    fontWeight: "400",
    fontSize: 13,
    letterSpacing: 1.6,
  },
  rewardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rewardText: {
    color: "#FFE47D",
    fontFamily: fontFamilies.heading,
    fontWeight: "400",
    fontSize: 28,
    fontVariant: ["tabular-nums"],
  },
  panelNote: {
    color: "rgba(255,244,210,0.58)",
    fontFamily: fontFamilies.body,
    fontSize: 12,
  },
  settleText: {
    color: "rgba(255,232,153,0.58)",
    fontFamily: fontFamilies.body,
    fontSize: 10,
    letterSpacing: 1,
  },
  actions: {
    width: "100%",
    maxWidth: 360,
    gap: 10,
  },
  primaryOuter: {
    height: 56,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,241,184,0.56)",
  },
  primaryGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    color: "#fff",
    fontFamily: fontFamilies.heading,
    fontWeight: "400",
    fontSize: 18,
    letterSpacing: 2.5,
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 2,
  },
  secondaryBtn: {
    height: 50,
    borderWidth: 1,
    borderColor: "rgba(255,232,153,0.24)",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  secondaryText: {
    color: "rgba(255,244,210,0.72)",
    fontFamily: fontFamilies.heading,
    fontWeight: "400",
    fontSize: 14,
    letterSpacing: 1.8,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },
});
