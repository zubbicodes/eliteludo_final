import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/src/theme/colors';
import { radius, spacing, typography } from '@/src/theme/typography';

export default function SplashScreen() {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.center}>
        <Text style={styles.brand}>ELITE</Text>
        <View style={styles.divider} />
        <Text style={styles.brand}>LUDO</Text>
        <Text style={styles.tagline}>ROLL LIKE ROYALTY</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={() => router.push('/game/local')}
          style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.primaryText}>PLAY VS COMPUTER</Text>
        </Pressable>
        <Text style={styles.footer}>v0.0.1 · Phase 1</Text>
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
  actions: { alignSelf: 'stretch', alignItems: 'center', gap: spacing.md },
  primary: {
    backgroundColor: colors.gold,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  primaryText: { ...typography.h3, color: colors.bg, letterSpacing: 3 },
  footer: { ...typography.caption, color: colors.textDim, letterSpacing: 2 },
});
