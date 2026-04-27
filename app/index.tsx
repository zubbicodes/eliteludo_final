import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/src/theme/colors';
import { spacing, typography } from '@/src/theme/typography';

export default function SplashScreen() {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.center}>
        <Text style={styles.brand}>ELITE</Text>
        <View style={styles.divider} />
        <Text style={styles.brand}>LUDO</Text>
        <Text style={styles.tagline}>ROLL LIKE ROYALTY</Text>
      </View>
      <Text style={styles.footer}>v0.0.1 · Phase 0</Text>
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
  footer: {
    ...typography.caption,
    color: colors.textDim,
    letterSpacing: 2,
  },
});
