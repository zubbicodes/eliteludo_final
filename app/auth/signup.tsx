import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { SocialButton } from '@/src/components/SocialButton';
import { colors } from '@/src/theme/colors';
import { radius, spacing, typography } from '@/src/theme/typography';
import { haptics } from '@/src/utils/haptics';

export default function SignupScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agree, setAgree] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  const stubAuth = (provider: string) => {
    haptics.tap();
    setLoadingProvider(provider);
    setTimeout(() => {
      setLoadingProvider(null);
      router.replace('/auth/onboarding');
    }, 600);
  };

  const onEmailSignup = () => {
    haptics.tap();
    router.replace('/(tabs)/home');
  };

  const canSubmit = name.trim().length > 0 && email.trim().length > 0 && password.length >= 6 && agree;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeIn.duration(500)} style={styles.brandWrap}>
            <Text style={styles.brand}>ELITE</Text>
            <View style={styles.divider} />
            <Text style={styles.brand}>LUDO</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(150).duration(500)} style={styles.headerWrap}>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>Claim your throne in under a minute</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(250).duration(500)} style={styles.providers}>
            <SocialButton
              provider="google"
              onPress={() => stubAuth('google')}
              loading={loadingProvider === 'google'}
              disabled={loadingProvider !== null && loadingProvider !== 'google'}
            />
            <SocialButton
              provider="facebook"
              onPress={() => stubAuth('facebook')}
              loading={loadingProvider === 'facebook'}
              disabled={loadingProvider !== null && loadingProvider !== 'facebook'}
            />
            <SocialButton
              provider="phone"
              onPress={() => stubAuth('phone')}
              loading={loadingProvider === 'phone'}
              disabled={loadingProvider !== null && loadingProvider !== 'phone'}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(350).duration(500)} style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or sign up with email</Text>
            <View style={styles.dividerLine} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(450).duration(500)} style={styles.form}>
            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor={colors.textDim}
                value={name}
                onChangeText={setName}
                autoCapitalize="none"
                autoComplete="username"
              />
            </View>

            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={colors.textDim}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputWrap}>
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={colors.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Password (min 6 characters)"
                placeholderTextColor={colors.textDim}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="password-new"
              />
              <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={8}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>

            <Pressable
              onPress={() => setAgree((a) => !a)}
              style={styles.agreeRow}
              hitSlop={4}
            >
              <View style={[styles.checkbox, agree && styles.checkboxChecked]}>
                {agree && <Ionicons name="checkmark" size={14} color={colors.bg} />}
              </View>
              <Text style={styles.agreeText}>
                I agree to the <Text style={styles.agreeLink}>Terms</Text> and{' '}
                <Text style={styles.agreeLink}>Privacy Policy</Text>
              </Text>
            </Pressable>

            <Pressable
              onPress={onEmailSignup}
              disabled={!canSubmit}
              style={({ pressed }) => [
                styles.primaryBtn,
                { opacity: !canSubmit ? 0.5 : pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={styles.primaryBtnText}>Create account</Text>
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(550).duration(500)} style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/auth/login" replace asChild>
              <Pressable hitSlop={8}>
                <Text style={styles.footerLink}>Sign in</Text>
              </Pressable>
            </Link>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  brandWrap: {
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  brand: {
    ...typography.h1,
    fontSize: 36,
    color: colors.gold,
    letterSpacing: 6,
    textShadowColor: 'rgba(212, 175, 55, 0.35)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  divider: {
    width: 48,
    height: 1,
    backgroundColor: colors.gold,
    opacity: 0.6,
    marginVertical: spacing.xs,
  },
  headerWrap: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
  },
  providers: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    ...typography.caption,
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  form: {
    gap: spacing.sm,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 52,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    color: colors.text,
    ...typography.body,
  },
  agreeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  checkboxChecked: {
    backgroundColor: colors.gold,
  },
  agreeText: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
  },
  agreeLink: {
    color: colors.gold,
    fontWeight: '600',
  },
  primaryBtn: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  primaryBtnText: {
    ...typography.body,
    color: colors.bg,
    fontWeight: '700',
    letterSpacing: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    ...typography.body,
    color: colors.textMuted,
  },
  footerLink: {
    ...typography.body,
    color: colors.gold,
    fontWeight: '600',
  },
});
