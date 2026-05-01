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

import { supabase } from '@/src/supabase/client';
import { colors } from '@/src/theme/colors';
import { radius, spacing, typography } from '@/src/theme/typography';
import { haptics } from '@/src/utils/haptics';

export default function SignupScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length >= 6 && agree && !loading;

  const onEmailSignup = async () => {
    if (!canSubmit) return;
    haptics.tap();
    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (err) {
      setError(err.message);
      haptics.warning();
      return;
    }

    // When email confirmation is enabled, session is null until the user clicks
    // the confirmation link. Show a waiting state instead of routing.
    if (!data.session) {
      setPendingConfirm(true);
      return;
    }

    haptics.success();
    router.replace('/auth/onboarding');
  };

  if (pendingConfirm) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <Ionicons name="mail-outline" size={52} color={colors.gold} />
          <Text style={styles.confirmTitle}>Check your inbox</Text>
          <Text style={styles.confirmBody}>
            We sent a confirmation link to{' '}
            <Text style={styles.confirmEmail}>{email.trim()}</Text>
            {'. '}
            Tap it, then come back and sign in.
          </Text>
          <Pressable
            onPress={() => router.replace('/auth/login')}
            style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={styles.primaryBtnText}>Go to sign in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

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

          <Animated.View entering={FadeInDown.delay(250).duration(500)} style={styles.form}>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={colors.textDim}
                value={email}
                onChangeText={(v) => { setEmail(v); setError(null); }}
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
                onChangeText={(v) => { setPassword(v); setError(null); }}
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

            {error && <Text style={styles.errorText}>{error}</Text>}

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
              <Text style={styles.primaryBtnText}>
                {loading ? 'Creating account…' : 'Create account'}
              </Text>
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(350).duration(500)} style={styles.footer}>
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  confirmTitle: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
  },
  confirmBody: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  confirmEmail: {
    color: colors.gold,
    fontWeight: '600',
  },
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
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
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
