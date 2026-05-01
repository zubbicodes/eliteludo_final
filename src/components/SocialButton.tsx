import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/theme/colors';
import { radius, spacing, typography } from '@/src/theme/typography';

type Provider = 'google' | 'facebook' | 'phone';

const PROVIDER_CONFIG: Record<
  Provider,
  { label: string; icon: keyof typeof Ionicons.glyphMap; bg: string; fg: string; border?: string }
> = {
  google: {
    label: 'Continue with Google',
    icon: 'logo-google',
    bg: colors.white,
    fg: '#1A1A1A',
  },
  facebook: {
    label: 'Continue with Facebook',
    icon: 'logo-facebook',
    bg: '#1877F2',
    fg: colors.white,
  },
  phone: {
    label: 'Continue with Phone',
    icon: 'call',
    bg: 'transparent',
    fg: colors.gold,
    border: colors.gold,
  },
};

type Props = {
  provider: Provider;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export function SocialButton({ provider, onPress, loading, disabled }: Props) {
  const cfg = PROVIDER_CONFIG[provider];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: cfg.bg,
          borderColor: cfg.border ?? cfg.bg,
          opacity: isDisabled ? 0.6 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.iconWrap}>
        {loading ? (
          <ActivityIndicator color={cfg.fg} size="small" />
        ) : (
          <Ionicons name={cfg.icon} size={20} color={cfg.fg} />
        )}
      </View>
      <Text style={[styles.label, { color: cfg.fg }]}>{cfg.label}</Text>
      <View style={styles.iconWrap} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
  },
  iconWrap: {
    width: 24,
    alignItems: 'center',
  },
  label: {
    ...typography.body,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
});
