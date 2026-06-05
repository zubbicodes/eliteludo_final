import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Images } from '@/src/assets';
import { useProfileStore } from '@/src/stores/profile';
import { colors } from '@/src/theme/colors';

const BOT_FALLBACK_MS = 10_000;

function RadarRing({ delay }: { delay: number }) {
  const scale = useSharedValue(0.3);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const start = () => {
      scale.value = 0.3;
      opacity.value = 0.7;
      scale.value = withRepeat(
        withTiming(2.2, { duration: 2200, easing: Easing.out(Easing.cubic) }),
        -1,
        false,
      );
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.7, { duration: 300 }),
          withTiming(0, { duration: 1900, easing: Easing.out(Easing.quad) }),
        ),
        -1,
        false,
      );
    };
    const t = setTimeout(start, delay);
    return () => clearTimeout(t);
  }, [delay, opacity, scale]);

  const s = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.radarRing, s]} />;
}

export default function MatchmakingScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const insets = useSafeAreaInsets();
  const profile = useProfileStore((s) => s.profile);
  const gameMode = mode === '4p' ? '4p' : '2p';
  const targetPlayerCount = gameMode === '4p' ? 4 : 2;

  const pulseScale = useSharedValue(1);
  const [label, setLabel] = useState('Searching...');
  const [elapsed, setElapsed] = useState(0);
  const navigatedRef = useRef(false);
  const fallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const navigate = useCallback((matchId: string) => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    clearInterval(elapsedRef.current!);
    clearTimeout(fallbackRef.current!);
    setLabel('Match found!');
    setTimeout(() => {
      router.replace({
        pathname: '/game/[matchId]',
        params: { matchId, mode: gameMode },
      } as never);
    }, 350);
  }, [gameMode, router]);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 950, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 950, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );

    elapsedRef.current = setInterval(() => setElapsed((n) => n + 1), 1000);

    fallbackRef.current = setTimeout(() => {
      setLabel('Matching with computer...');
      navigate(`solo-${Date.now()}`);
    }, BOT_FALLBACK_MS);

    return () => {
      clearInterval(elapsedRef.current!);
      clearTimeout(fallbackRef.current!);
    };
  }, [navigate, pulseScale]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const username = profile?.username ?? 'You';
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  const playerSlots = Array.from({ length: targetPlayerCount }, (_, index) => ({
    id: index,
    name: index === 0 ? username : '???',
    status: index === 0 ? 'READY' : 'SEARCHING',
    ready: index === 0,
  }));

  return (
    <View style={styles.root}>
      <ImageBackground source={Images.bgHome} style={StyleSheet.absoluteFill} resizeMode="cover">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,3,1,0.88)' }]} />
      </ImageBackground>

      {/* Header */}
      <Animated.View
        entering={FadeIn.duration(400)}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={20} color={colors.gold} />
        </Pressable>
        <Text style={styles.headerTitle}>MATCHMAKING</Text>
        <View style={{ width: 38 }} />
      </Animated.View>

      {/* Main content */}
      <Animated.View entering={FadeInDown.delay(150).duration(500)} style={styles.content}>

        <View style={styles.playerCountBadge}>
          <Ionicons name="people" size={14} color={colors.gold} />
          <Text style={styles.playerCountText}>{targetPlayerCount} PLAYERS</Text>
        </View>

        <View style={styles.matchTable}>
          <View style={styles.radarWrap}>
            <RadarRing delay={0} />
            <RadarRing delay={700} />
            <RadarRing delay={1400} />
            <Animated.View style={[styles.radarCenter, pulseStyle]}>
              <LinearGradient
                colors={[colors.goldDark, '#7A5A1A', '#3A2800']}
                style={styles.radarCenterGradient}
              >
                <Text style={styles.vsText}>VS</Text>
              </LinearGradient>
            </Animated.View>
          </View>

          <View style={styles.playersGrid}>
            {playerSlots.map((slot) => (
              <View key={slot.id} style={styles.playerCard}>
                <LinearGradient
                  colors={slot.ready ? ['#2B1A0A', '#100900'] : ['#1A1A2A', '#0A0A15']}
                  style={styles.avatarWrap}
                >
                  <View style={[styles.avatarInner, !slot.ready && styles.avatarUnknown]}>
                    <Ionicons
                      name={slot.ready ? 'person' : 'help'}
                      size={slot.ready ? 34 : 30}
                      color={slot.ready ? colors.gold : 'rgba(255,255,255,0.2)'}
                    />
                  </View>
                </LinearGradient>
                <Text style={styles.playerName} numberOfLines={1}>{slot.name}</Text>
                <View style={styles.readyBadge}>
                  <View
                    style={[
                      styles.readyDot,
                      { backgroundColor: slot.ready ? colors.green : colors.gold },
                    ]}
                  />
                  <Text
                    style={[
                      styles.readyText,
                      { color: slot.ready ? colors.green : colors.gold },
                    ]}
                  >
                    {slot.status}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Status */}
        <View style={styles.statusBox}>
          <View style={styles.statusDivider} />
          <Text style={styles.statusLabel}>{label}</Text>
          <View style={styles.statusDivider} />
        </View>

        <Text style={styles.timer}>{mm}:{ss}</Text>
        <Text style={styles.fallbackHint}>Computer match starts after 10 seconds</Text>

        {/* Token decoration */}
        <View style={styles.tokensRow}>
          {[Images.tokenRed, Images.tokenBlue, Images.tokenGreen, Images.tokenYellow].map((src, i) => (
            <Image key={i} source={src} style={styles.tokenImg} resizeMode="contain" />
          ))}
        </View>

      </Animated.View>

      {/* Cancel button */}
      <Animated.View
        entering={FadeIn.delay(400).duration(400)}
        style={[styles.cancelWrap, { paddingBottom: insets.bottom + 20 }]}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.cancelText}>CANCEL</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#040301' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.gold,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 4,
    textShadowColor: 'rgba(212,175,55,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },

  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 18,
  },

  playerCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  playerCountText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  matchTable: {
    gap: 16,
    width: '100%',
    alignItems: 'center',
  },
  playersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
  },

  playerCard: {
    width: '46%',
    alignItems: 'center',
    gap: 8,
  },
  avatarWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: colors.goldDark,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 10,
  },
  avatarInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarUnknown: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    borderStyle: 'dashed',
  },
  playerName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    maxWidth: 100,
    textAlign: 'center',
  },
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  readyDot: { width: 5, height: 5, borderRadius: 3 },
  readyText: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },

  // Radar
  radarWrap: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1.5,
    borderColor: colors.gold,
  },
  radarCenter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: colors.gold,
    overflow: 'hidden',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 18,
    elevation: 14,
  },
  radarCenterGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsText: {
    color: colors.gold,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
    textShadowColor: 'rgba(212,175,55,0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },

  // Status
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    alignSelf: 'stretch',
  },
  statusDivider: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(212,175,55,0.2)',
  },
  statusLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  timer: {
    color: colors.gold,
    fontSize: 32,
    fontWeight: '200',
    letterSpacing: 4,
    textShadowColor: 'rgba(212,175,55,0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  fallbackHint: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 11,
    letterSpacing: 0.5,
    marginTop: -8,
  },

  tokensRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  tokenImg: { width: 28, height: 28 },

  // Cancel
  cancelWrap: {
    paddingHorizontal: 24,
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 3,
  },
});
