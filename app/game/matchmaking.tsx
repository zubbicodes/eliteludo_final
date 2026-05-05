import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
import { supabase } from '@/src/supabase/client';
import { findMatch, subscribeQueue } from '@/src/supabase/matches';
import { useAuthStore } from '@/src/stores/auth';
import { colors } from '@/src/theme/colors';

const BOT_FALLBACK_MS = 12_000;
const POLL_INTERVAL_MS = 4_000;

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
  }, []);

  const s = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.radarRing, s]} />;
}

export default function MatchmakingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);

  const pulseScale = useSharedValue(1);
  const [label, setLabel] = useState('Searching…');
  const [elapsed, setElapsed] = useState(0);
  const navigatedRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const navigate = (matchId: string) => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    clearInterval(pollRef.current!);
    clearInterval(elapsedRef.current!);
    clearTimeout(fallbackRef.current!);
    unsubRef.current?.();
    setLabel('Match found!');
    setTimeout(() => router.replace(`/game/${matchId}` as never), 350);
  };

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 950, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 950, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );

    elapsedRef.current = setInterval(() => setElapsed((n) => n + 1), 1000);

    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.back(); return; }

      unsubRef.current = subscribeQueue(session.user.id, navigate);

      const r0 = await findMatch({ entryFee: 0, botFallback: false });
      if (r0?.matchId) { navigate(r0.matchId); return; }

      pollRef.current = setInterval(async () => {
        const r = await findMatch({ entryFee: 0, botFallback: false });
        if (r?.matchId) navigate(r.matchId);
      }, POLL_INTERVAL_MS);

      fallbackRef.current = setTimeout(async () => {
        clearInterval(pollRef.current!);
        const r = await findMatch({ entryFee: 0, botFallback: true });
        if (r?.matchId) navigate(r.matchId);
      }, BOT_FALLBACK_MS);
    };

    run();

    return () => {
      clearInterval(pollRef.current!);
      clearInterval(elapsedRef.current!);
      clearTimeout(fallbackRef.current!);
      unsubRef.current?.();
    };
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const username = profile?.username ?? 'You';
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

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

        {/* Radar + VS row */}
        <View style={styles.versusRow}>

          {/* Left: Player card */}
          <View style={styles.playerCard}>
            <LinearGradient
              colors={['#2B1A0A', '#100900']}
              style={styles.avatarWrap}
            >
              <View style={styles.avatarInner}>
                <Ionicons name="person" size={36} color={colors.gold} />
              </View>
            </LinearGradient>
            <Text style={styles.playerName} numberOfLines={1}>{username}</Text>
            <View style={styles.readyBadge}>
              <View style={[styles.readyDot, { backgroundColor: colors.green }]} />
              <Text style={[styles.readyText, { color: colors.green }]}>READY</Text>
            </View>
          </View>

          {/* Center: radar pulse */}
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

          {/* Right: Opponent card */}
          <View style={styles.playerCard}>
            <LinearGradient
              colors={['#1A1A2A', '#0A0A15']}
              style={styles.avatarWrap}
            >
              <View style={[styles.avatarInner, styles.avatarUnknown]}>
                <Ionicons name="help" size={32} color="rgba(255,255,255,0.2)" />
              </View>
            </LinearGradient>
            <Text style={styles.playerName}>???</Text>
            <View style={styles.readyBadge}>
              <View style={[styles.readyDot, { backgroundColor: colors.gold }]} />
              <Text style={[styles.readyText, { color: colors.gold }]}>SEARCHING</Text>
            </View>
          </View>

        </View>

        {/* Status */}
        <View style={styles.statusBox}>
          <View style={styles.statusDivider} />
          <Text style={styles.statusLabel}>{label}</Text>
          <View style={styles.statusDivider} />
        </View>

        <Text style={styles.timer}>{mm}:{ss}</Text>
        <Text style={styles.fallbackHint}>Falls back to AI after 12 seconds</Text>

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

  versusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    width: '100%',
  },

  playerCard: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  avatarWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
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
    width: 74,
    height: 74,
    borderRadius: 37,
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
