import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '@/src/stores/auth';
import { useSettingsStore } from '@/src/stores/settings';
import { colors } from '@/src/theme/colors';

const { width: SCREEN_W } = Dimensions.get('window');
const BAR_W = SCREEN_W - 80;
const SPLASH_MS = 3000;
const TIP_MS = 520;

const TIPS = [
  'Loading your kingdom…',
  'Polishing the golden dice…',
  'Preparing the royal board…',
  'Summoning your rivals…',
  'Checking your crown…',
  'Ready to roll!',
];

export default function SplashScreen() {
  const insets = useSafeAreaInsets();
  const hydrateSettings = useSettingsStore((s) => s.hydrate);
  const isHydrating = useAuthStore((s) => s.isHydrating);
  const session = useAuthStore((s) => s.session);

  const [splashDone, setSplashDone] = useState(false);
  const [tipIdx, setTipIdx] = useState(0);
  const tipTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const progress = useSharedValue(0);
  const glowOpacity = useSharedValue(0.3);

  useEffect(() => {
    hydrateSettings();

    progress.value = withTiming(1, {
      duration: SPLASH_MS,
      easing: Easing.out(Easing.cubic),
    }, (done) => { if (done) runOnJS(setSplashDone)(true); });

    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.3, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );

    let i = 0;
    tipTimer.current = setInterval(() => {
      i = Math.min(i + 1, TIPS.length - 1);
      setTipIdx(i);
    }, TIP_MS);

    return () => { if (tipTimer.current) clearInterval(tipTimer.current); };
  }, [glowOpacity, hydrateSettings, progress]);

  useEffect(() => {
    if (!splashDone || isHydrating) return;
    if (tipTimer.current) clearInterval(tipTimer.current);
    router.replace(session ? '/(tabs)/home' : '/auth/login');
  }, [splashDone, isHydrating, session]);

  const barStyle = useAnimatedStyle(() => ({
    width: interpolate(progress.value, [0, 1], [0, BAR_W]),
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <LinearGradient
      colors={['#0A0800', '#120F05', '#0A0800']}
      locations={[0, 0.5, 1]}
      style={styles.root}
    >
      {/* Ambient glow orb behind logo */}
      <Animated.View style={[styles.glowOrb, glowStyle]} />

      {/* Logo */}
      <Animated.View
        entering={FadeIn.delay(200).duration(800)}
        style={[styles.logoWrap, { marginTop: insets.top + 60 }]}
      >
        <Text style={styles.logoElite}>ELITE</Text>
        <View style={styles.logoDivider} />
        <Text style={styles.logoLudo}>LUDO</Text>
        <Text style={styles.logoTagline}>ROLL LIKE ROYALTY</Text>
      </Animated.View>

      {/* Spacer */}
      <View style={{ flex: 1 }} />

      {/* Bottom loading area */}
      <Animated.View
        entering={FadeIn.delay(500).duration(600)}
        style={[styles.bottomWrap, { paddingBottom: insets.bottom + 40 }]}
      >
        {/* Tip text */}
        <Animated.Text key={tipIdx} entering={FadeIn.duration(300)} style={styles.tipText}>
          {TIPS[tipIdx]}
        </Animated.Text>

        {/* Bar track */}
        <View style={styles.barTrack}>
          <Animated.View style={[styles.barFill, barStyle]}>
            <LinearGradient
              colors={[colors.goldDark, colors.gold, '#FFF0A0', colors.gold]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            {/* Leading shine dot */}
            <View style={styles.barShine} />
          </Animated.View>
        </View>

        <Text style={styles.edition}>2026 Edition · Elite Season</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
  },

  glowOrb: {
    position: 'absolute',
    top: '20%',
    alignSelf: 'center',
    width: 320,
    height: 200,
    borderRadius: 160,
    backgroundColor: 'rgba(212,175,55,0.15)',
    transform: [{ scaleX: 1.6 }],
  },

  logoWrap: {
    alignItems: 'center',
    gap: 2,
  },
  logoElite: {
    fontSize: 58,
    fontWeight: '900',
    color: colors.gold,
    letterSpacing: 14,
    textShadowColor: 'rgba(212,175,55,0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 28,
    lineHeight: 66,
  },
  logoDivider: {
    width: 60,
    height: 1.5,
    backgroundColor: colors.gold,
    opacity: 0.65,
    marginVertical: 6,
  },
  logoLudo: {
    fontSize: 34,
    fontWeight: '200',
    color: colors.goldLight,
    letterSpacing: 18,
    textShadowColor: 'rgba(212,175,55,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  logoTagline: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(212,175,55,0.45)',
    letterSpacing: 5,
    marginTop: 14,
  },

  bottomWrap: {
    width: '100%',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 40,
  },
  tipText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 0.3,
    textAlign: 'center',
    minHeight: 18,
  },
  barTrack: {
    width: BAR_W,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(212,175,55,0.1)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
    overflow: 'hidden',
  },
  barShine: {
    position: 'absolute',
    right: 0,
    top: -1,
    width: 5,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  edition: {
    color: 'rgba(255,255,255,0.15)',
    fontSize: 10,
    letterSpacing: 2,
  },
});
