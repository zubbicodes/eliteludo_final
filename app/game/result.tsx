import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Color } from '@/src/game/types';
import { colors } from '@/src/theme/colors';
import { radius, spacing, typography } from '@/src/theme/typography';

const PLAYER_HEX: Record<Color, string> = {
  red: colors.red,
  green: colors.green,
  yellow: colors.yellow,
  blue: colors.blue,
};

export default function ResultScreen() {
  const { winner } = useLocalSearchParams<{ winner: Color }>();
  const isHumanWin = winner === 'red';

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.center}>
        <Text style={styles.heading}>{isHumanWin ? 'VICTORY' : 'DEFEAT'}</Text>
        <View
          style={[
            styles.crown,
            { borderColor: winner ? PLAYER_HEX[winner] : colors.gold },
          ]}
        >
          <Text style={[styles.crownText, { color: winner ? PLAYER_HEX[winner] : colors.gold }]}>
            {winner ? winner.toUpperCase() : '—'}
          </Text>
        </View>
        <Text style={styles.subtitle}>
          {isHumanWin ? 'Roll like royalty.' : 'The throne is not yet yours.'}
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}
          onPress={() => router.replace('/game/local')}
        >
          <Text style={styles.primaryText}>PLAY AGAIN</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7 }]}
          onPress={() => router.replace('/')}
        >
          <Text style={styles.secondaryText}>BACK TO MENU</Text>
        </Pressable>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  heading: {
    ...typography.display,
    color: colors.gold,
    textShadowColor: 'rgba(212, 175, 55, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  crown: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
  },
  crownText: { ...typography.h2, letterSpacing: 4 },
  subtitle: { ...typography.tagline, color: colors.textMuted },
  actions: { gap: spacing.md, alignSelf: 'stretch' },
  primary: {
    backgroundColor: colors.gold,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  primaryText: { ...typography.h3, color: colors.bg, letterSpacing: 3 },
  secondary: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  secondaryText: { ...typography.h3, color: colors.textMuted, letterSpacing: 3 },
});
