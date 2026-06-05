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

import { SocialButton } from '@/src/components/SocialButton';
import { Images } from '@/src/assets';
import { supabase } from '@/src/supabase/client';
import { getSupabaseErrorMessage } from '@/src/supabase/errors';
import { signInWithGoogle } from '@/src/supabase/oauth';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/typography';
import { haptics } from '@/src/utils/haptics';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onEmailLogin = async () => {
    if (!email.trim() || !password) return;
    haptics.tap();
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth
      .signInWithPassword({
        email: email.trim(),
        password,
      })
      .catch((caught) => ({ error: caught }));
    setLoading(false);
    if (err) { setError(getSupabaseErrorMessage(err)); haptics.warning(); }
    else { haptics.success(); router.replace('/(tabs)/home'); }
  };

  const onPhoneOtp = () => {
    haptics.tap();
    router.push('/auth/phone-login' as any);
  };

  const onGoogleLogin = async () => {
    haptics.tap();
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      haptics.success();
      router.replace('/(tabs)/home');
    } catch (caught) {
      setError(getSupabaseErrorMessage(caught));
      haptics.warning();
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = email.trim().length > 0 && password.length >= 6;

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
                {/* Gold top border */}
                <LinearGradient
                  colors={[colors.goldDark, colors.gold, colors.goldDark]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.cardTopBorder}
                />

                <Text style={styles.cardTitle}>Welcome back</Text>
                <Text style={styles.cardSubtitle}>Sign in to your account</Text>

                {/* Social buttons */}
                <View style={styles.socialRow}>
                  <SocialButton provider="google" onPress={onGoogleLogin} />
                  <SocialButton provider="phone" onPress={onPhoneOtp} />
                </View>

                {/* Divider */}
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or email</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Email input */}
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

                {/* Password input */}
                <View style={styles.inputWrap}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.gold} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor={colors.textDim}
                    value={password}
                    onChangeText={(v) => { setPassword(v); setError(null); }}
                    secureTextEntry={!showPassword}
                    autoComplete="password"
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

                <Pressable hitSlop={8} style={styles.forgotWrap}>
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </Pressable>

                {/* Sign in button */}
                <Pressable
                  onPress={onEmailLogin}
                  disabled={!canSubmit || loading}
                  style={({ pressed }) => [
                    styles.submitOuter,
                    { opacity: !canSubmit || loading ? 0.45 : pressed ? 0.88 : 1 },
                  ]}
                >
                  <LinearGradient
                    colors={[colors.gold, colors.goldDark]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.submitGradient}
                  >
                    <Text style={styles.submitText}>
                      {loading ? 'Signing in…' : 'Sign In'}
                    </Text>
                  </LinearGradient>
                </Pressable>

                {/* Footer */}
                <View style={styles.footer}>
                  <Text style={styles.footerText}>New here? </Text>
                  <Link href="/auth/signup" replace asChild>
                    <Pressable hitSlop={8}>
                      <Text style={styles.footerLink}>Create account</Text>
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
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: spacing.xl,
    justifyContent: 'center',
  },

  // Brand
  brandWrap: { alignItems: 'center', marginBottom: 32, marginTop: 20 },
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
    width: 48,
    height: 1.5,
    backgroundColor: colors.gold,
    opacity: 0.6,
    marginVertical: 4,
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
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(212,175,55,0.55)',
    letterSpacing: 4,
    marginTop: 8,
  },

  // Card
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    padding: 22,
    overflow: 'hidden',
  },
  cardTopBorder: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 20,
  },

  socialRow: { gap: 10, marginBottom: 18 },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    gap: 10,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  dividerText: { color: colors.textDim, fontSize: 12, letterSpacing: 1 },

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

  forgotWrap: { alignSelf: 'flex-end', marginBottom: 18 },
  forgotText: { color: colors.gold, fontSize: 13 },

  submitOuter: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.4)',
    marginBottom: 20,
  },
  submitGradient: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    color: colors.bg,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.5,
  },

  footer: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { color: colors.textMuted, fontSize: 14 },
  footerLink: { color: colors.gold, fontSize: 14, fontWeight: '700' },
});
