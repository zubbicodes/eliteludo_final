import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '@/src/stores/auth';
import { preloadForBoot } from '@/src/startup/preload';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';

const { width: SCREEN_W } = Dimensions.get('window');
const BAR_W = SCREEN_W - 80;
const MIN_SPLASH_MS = 1000;
const PRELOAD_PROGRESS_MS = 280;

export default function SplashScreen() {
  const insets = useSafeAreaInsets();
  const isHydrating = useAuthStore((s) => s.isHydrating);
  const session = useAuthStore((s) => s.session);

  const [bootDone, setBootDone] = useState(false);
  const [tip, setTip] = useState('Loading your kingdom...');

  const progress = useSharedValue(0);
  const glowOpacity = useSharedValue(0.3);

  useEffect(() => {
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.3, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
  }, [glowOpacity]);

  useEffect(() => {
    if (isHydrating) return;

    let cancelled = false;
    const startedAt = Date.now();

    preloadForBoot({
      session,
      onStage: (stage, nextProgress) => {
        if (cancelled) return;
        setTip(stage.label);
        progress.value = withTiming(nextProgress, {
          duration: PRELOAD_PROGRESS_MS,
          easing: Easing.out(Easing.cubic),
        });
      },
    })
      .catch((error) => {
        console.warn('[startup] boot preload failed:', error);
        setTip('Ready to roll!');
      })
      .finally(() => {
        const wait = Math.max(0, MIN_SPLASH_MS - (Date.now() - startedAt));
        setTimeout(() => {
          if (cancelled) return;
          progress.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
          setBootDone(true);
        }, wait);
      });

    return () => {
      cancelled = true;
    };
  }, [isHydrating, progress, session]);

  useEffect(() => {
    if (!bootDone || isHydrating) return;
    router.replace(session ? '/(tabs)/home' : '/auth/login');
  }, [bootDone, isHydrating, session]);

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
      <Animated.View style={[styles.glowOrb, glowStyle]} />

      <Animated.View
        entering={FadeIn.delay(200).duration(800)}
        style={[styles.logoWrap, { marginTop: insets.top + 60 }]}
      >
        <Text style={styles.logoElite}>ELITE</Text>
        <View style={styles.logoDivider} />
        <Text style={styles.logoLudo}>LUDO</Text>
        <Text style={styles.logoTagline}>ROLL LIKE ROYALTY</Text>
      </Animated.View>

      <View style={{ flex: 1 }} />

      <Animated.View
        entering={FadeIn.delay(500).duration(600)}
        style={[styles.bottomWrap, { paddingBottom: insets.bottom + 40 }]}
      >
        <Animated.Text key={tip} entering={FadeIn.duration(180)} style={styles.tipText}>
          {tip}
        </Animated.Text>

        <View style={styles.barTrack}>
          <Animated.View style={[styles.barFill, barStyle]}>
            <LinearGradient
              colors={[colors.goldDark, colors.gold, '#FFF0A0', colors.gold]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.barShine} />
          </Animated.View>
        </View>

        <Text style={styles.edition}>2026 Edition - Elite Season</Text>
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
    fontFamily: fontFamilies.brand,
    fontSize: 58,
    fontWeight: '400',
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
    fontFamily: fontFamilies.brand,
    fontSize: 34,
    fontWeight: '400',
    color: colors.goldLight,
    letterSpacing: 18,
    textShadowColor: 'rgba(212,175,55,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  logoTagline: {
    fontFamily: fontFamilies.heading,
    fontSize: 10,
    fontWeight: '400',
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
    fontFamily: fontFamilies.body,
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
    fontFamily: fontFamilies.body,
    fontWeight: '400',
    fontSize: 10,
    letterSpacing: 2,
  },
});
