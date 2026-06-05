import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Images } from '@/src/assets';
import { supabase } from '@/src/supabase/client';
import { getSupabaseErrorMessage } from '@/src/supabase/errors';
import { colors } from '@/src/theme/colors';
import { spacing, typography } from '@/src/theme/typography';
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
    const { data, error: err } = await supabase.auth
      .signUp({ email: email.trim(), password })
      .catch((caught) => ({ data: { session: null }, error: caught }));
    setLoading(false);
    if (err) { setError(getSupabaseErrorMessage(err)); haptics.warning(); return; }
    if (!data.session) { setPendingConfirm(true); return; }
    haptics.success();
    router.replace('/auth/onboarding');
  };

  if (pendingConfirm) {
    return (
      <ImageBackground source={Images.bgHome} style={styles.root} resizeMode="cover">
        <View style={styles.overlay} />
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.center}>
            <Ionicons name="mail-outline" size={60} color={colors.gold} />
            <Text style={styles.confirmTitle}>Check your inbox</Text>
            <Text style={styles.confirmBody}>
              We sent a confirmation link to{' '}
              <Text style={{ color: colors.gold, fontWeight: '600' }}>{email.trim()}</Text>
              {'. '}Tap it, then come back and sign in.
            </Text>
            <Pressable
              onPress={() => router.replace('/auth/login')}
              style={({ pressed }) => [styles.submitOuter, { opacity: pressed ? 0.85 : 1 }]}
            >
              <LinearGradient
                colors={[colors.gold, colors.goldDark]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.submitGradient}
              >
                <Text style={styles.submitText}>Go to sign in</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </SafeAreaView>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={Images.bgHome} style={styles.root} resizeMode="cover">
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Brand */}
            <Animated.View entering={FadeIn.duration(600)} style={styles.brandWrap}>
              <Text style={styles.brandElite}>ELITE</Text>
              <View style={styles.brandDivider} />
              <Text style={styles.brandLudo}>LUDO</Text>
              <Text style={styles.brandTagline}>ROLL LIKE ROYALTY</Text>
            </Animated.View>

            {/* Card */}
            <Animated.View entering={FadeInDown.delay(200).duration(500)}>
              <LinearGradient colors={['rgba(26,18,8,0.95)', 'rgba(15,12,6,0.98)']} style={styles.card}>
                <LinearGradient
                  colors={[colors.goldDark, colors.gold, colors.goldDark]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.cardTopBorder}
                />

                <Text style={styles.cardTitle}>Create account</Text>
                <Text style={styles.cardSubtitle}>Claim your throne in under a minute</Text>

                {/* Email */}
                <View style={styles.inputWrap}>
                  <Ionicons name="mail-outline" size={18} color={colors.gold} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Email address"
                    placeholderTextColor={colors.textDim}
                    value={email}
                    onChangeText={(v) => { setEmail(v); setError(null); }}
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                  />
                </View>

                {/* Password */}
                <View style={styles.inputWrap}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.gold} style={styles.inputIcon} />
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
                      size={18} color={colors.textMuted}
                    />
                  </Pressable>
                </View>

                {error && <Text style={styles.errorText}>{error}</Text>}

                {/* Terms checkbox */}
                <Pressable onPress={() => setAgree((a) => !a)} style={styles.agreeRow} hitSlop={4}>
                  <View style={[styles.checkbox, agree && styles.checkboxChecked]}>
                    {agree && <Ionicons name="checkmark" size={14} color={colors.bg} />}
                  </View>
                  <Text style={styles.agreeText}>
                    I agree to the <Text style={styles.agreeLink}>Terms</Text> and{' '}
                    <Text style={styles.agreeLink}>Privacy Policy</Text>
                  </Text>
                </Pressable>

                {/* Submit */}
                <Pressable
                  onPress={onEmailSignup}
                  disabled={!canSubmit}
                  style={({ pressed }) => [
                    styles.submitOuter,
                    { opacity: !canSubmit ? 0.45 : pressed ? 0.88 : 1 },
                  ]}
                >
                  <LinearGradient
                    colors={[colors.gold, colors.goldDark]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.submitGradient}
                  >
                    <Text style={styles.submitText}>
                      {loading ? 'Creating account…' : 'Create Account'}
                    </Text>
                  </LinearGradient>
                </Pressable>

                <View style={styles.footer}>
                  <Text style={styles.footerText}>Already have an account? </Text>
                  <Link href="/auth/login" replace asChild>
                    <Pressable hitSlop={8}>
                      <Text style={styles.footerLink}>Sign in</Text>
                    </Pressable>
                  </Link>
                </View>
              </LinearGradient>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  safe: { flex: 1 },
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  confirmTitle: { ...typography.h2, color: colors.text, textAlign: 'center' },
  confirmBody: { ...typography.body, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: spacing.xl,
    justifyContent: 'center',
  },
  brandWrap: { alignItems: 'center', marginBottom: 28, marginTop: 16 },
  brandElite: {
    fontSize: 44,
    fontWeight: '900',
    color: colors.gold,
    letterSpacing: 10,
    textShadowColor: 'rgba(212,175,55,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
    lineHeight: 50,
  },
  brandDivider: {
    width: 48, height: 1.5, backgroundColor: colors.gold, opacity: 0.6, marginVertical: 4,
  },
  brandLudo: {
    fontSize: 28,
    fontWeight: '300',
    color: colors.goldLight,
    letterSpacing: 12,
    textShadowColor: 'rgba(212,175,55,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  brandTagline: {
    fontSize: 10, fontWeight: '600', color: 'rgba(212,175,55,0.55)', letterSpacing: 4, marginTop: 8,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    padding: 22,
    overflow: 'hidden',
  },
  cardTopBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 2 },
  cardTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 4 },
  cardSubtitle: { fontSize: 14, color: colors.textMuted, marginBottom: 20 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 12,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: colors.text, fontSize: 15 },
  errorText: { color: colors.danger, fontSize: 12, marginBottom: 6 },
  agreeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 1.5,
    borderColor: colors.gold, alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  checkboxChecked: { backgroundColor: colors.gold },
  agreeText: { color: colors.textMuted, fontSize: 13, flex: 1 },
  agreeLink: { color: colors.gold, fontWeight: '600' },
  submitOuter: {
    borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', marginBottom: 20,
  },
  submitGradient: { height: 52, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: colors.bg, fontSize: 16, fontWeight: '800', letterSpacing: 1.5 },
  footer: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { color: colors.textMuted, fontSize: 14 },
  footerLink: { color: colors.gold, fontSize: 14, fontWeight: '700' },
});
