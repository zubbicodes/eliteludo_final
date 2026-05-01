import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useProfileStore } from '@/src/stores/profile';
import { useSettingsStore } from '@/src/stores/settings';
import { colors } from '@/src/theme/colors';
import { spacing, typography } from '@/src/theme/typography';

export default function SplashScreen() {
  const glow = useSharedValue(0.4);
  const hydrateProfile = useProfileStore((s) => s.hydrate);
  const hydrateSettings = useSettingsStore((s) => s.hydrate);

  useEffect(() => {
    // Warm up persisted stores while the splash is on screen.
    hydrateProfile();
    hydrateSettings();

    glow.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );

    const timer = setTimeout(() => {
      router.replace('/auth/login');
    }, 1800);
    return () => clearTimeout(timer);
  }, [glow, hydrateProfile, hydrateSettings]);

  const dot0 = useAnimatedStyle(() => ({
    opacity: 0.3 + 0.7 * Math.max(0, Math.sin(glow.value * Math.PI)),
  }));
  const dot1 = useAnimatedStyle(() => ({
    opacity: 0.3 + 0.7 * Math.max(0, Math.sin((glow.value + 0.33) * Math.PI)),
  }));
  const dot2 = useAnimatedStyle(() => ({
    opacity: 0.3 + 0.7 * Math.max(0, Math.sin((glow.value + 0.66) * Math.PI)),
  }));

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.center}>
        <Text style={styles.brand}>ELITE</Text>
        <View style={styles.divider} />
        <Text style={styles.brand}>LUDO</Text>
        <Text style={styles.tagline}>ROLL LIKE ROYALTY</Text>
      </View>

      <View style={styles.loaderRow}>
        <Animated.View style={[styles.dot, dot0]} />
        <Animated.View style={[styles.dot, dot1]} />
        <Animated.View style={[styles.dot, dot2]} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  brand: {
    ...typography.display,
    color: colors.gold,
    textShadowColor: 'rgba(212, 175, 55, 0.35)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  divider: {
    width: 64,
    height: 1,
    backgroundColor: colors.gold,
    opacity: 0.6,
    marginVertical: spacing.xs,
  },
  tagline: {
    ...typography.tagline,
    color: colors.textMuted,
    marginTop: spacing.lg,
  },
  loaderRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
  },
});
