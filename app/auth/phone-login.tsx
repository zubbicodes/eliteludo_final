import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { supabase } from '@/src/supabase/client';
import { colors } from '@/src/theme/colors';
import { radius, spacing, typography } from '@/src/theme/typography';
import { haptics } from '@/src/utils/haptics';

type Step = 'enter_phone' | 'enter_otp';

export default function PhoneLoginScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('enter_phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const otpRef = useRef<TextInput>(null);

  const onSendOtp = async () => {
    if (phone.trim().length < 7) return;
    haptics.tap();
    setLoading(true);
    setError(null);
    // Phone must be in E.164 format: +1234567890
    const normalized = phone.trim().startsWith('+') ? phone.trim() : `+${phone.trim()}`;
    const { error: err } = await supabase.auth.signInWithOtp({ phone: normalized });
    setLoading(false);
    if (err) {
      setError(err.message);
      haptics.warning();
    } else {
      haptics.success();
      setPhone(normalized);
      setStep('enter_otp');
      setTimeout(() => otpRef.current?.focus(), 300);
    }
  };

  const onVerifyOtp = async () => {
    if (otp.length !== 6) return;
    haptics.tap();
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: 'sms',
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      haptics.warning();
    } else {
      haptics.success();
      // New user: trigger creates profile row, send to onboarding.
      // Returning user: go home. Distinguish by checking if created_at ≈ now.
      const createdAt = data.user?.created_at ? new Date(data.user.created_at) : null;
      const isNew = createdAt && Date.now() - createdAt.getTime() < 10_000;
      router.replace(isNew ? '/auth/onboarding' : '/(tabs)/home');
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.topbar}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={26} color={colors.gold} />
          </Pressable>
          <Text style={styles.topbarTitle}>
            {step === 'enter_phone' ? 'Phone sign-in' : 'Enter code'}
          </Text>
          <View style={styles.iconBtn} />
        </View>

        <View style={styles.body}>
          {step === 'enter_phone' ? (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.section}>
              <Text style={styles.label}>Your phone number</Text>
              <Text style={styles.hint}>Include country code, e.g. +92 300 1234567</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="call-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="+1 (555) 000-0000"
                  placeholderTextColor={colors.textDim}
                  value={phone}
                  onChangeText={(v) => { setPhone(v); setError(null); }}
                  keyboardType="phone-pad"
                  autoFocus
                />
              </View>
              {error && <Text style={styles.errorText}>{error}</Text>}
              <Pressable
                onPress={onSendOtp}
                disabled={phone.trim().length < 7 || loading}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { opacity: phone.trim().length < 7 || loading ? 0.5 : pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={styles.primaryBtnText}>
                  {loading ? 'Sending…' : 'Send code'}
                </Text>
              </Pressable>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.section}>
              <Text style={styles.label}>6-digit code</Text>
              <Text style={styles.hint}>
                Sent to <Text style={styles.phoneHighlight}>{phone}</Text>
              </Text>
              <View style={styles.inputWrap}>
                <Ionicons name="keypad-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  ref={otpRef}
                  style={[styles.input, styles.otpInput]}
                  placeholder="000000"
                  placeholderTextColor={colors.textDim}
                  value={otp}
                  onChangeText={(v) => { setOtp(v.replace(/\D/g, '').slice(0, 6)); setError(null); }}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>
              {error && <Text style={styles.errorText}>{error}</Text>}
              <Pressable
                onPress={onVerifyOtp}
                disabled={otp.length !== 6 || loading}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { opacity: otp.length !== 6 || loading ? 0.5 : pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={styles.primaryBtnText}>
                  {loading ? 'Verifying…' : 'Verify'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => { setStep('enter_phone'); setOtp(''); setError(null); }}
                hitSlop={8}
                style={styles.resendBtn}
              >
                <Text style={styles.resendText}>Wrong number? Go back</Text>
              </Pressable>
            </Animated.View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topbarTitle: { ...typography.h3, color: colors.text },
  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  section: { gap: spacing.sm },
  label: { ...typography.h3, color: colors.text },
  hint: { ...typography.caption, color: colors.textMuted },
  phoneHighlight: { color: colors.gold, fontWeight: '600' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 52,
    marginTop: spacing.sm,
  },
  inputIcon: { marginRight: spacing.sm },
  input: { flex: 1, color: colors.text, ...typography.body },
  otpInput: { letterSpacing: 8, fontSize: 22 },
  errorText: { ...typography.caption, color: colors.danger },
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
  resendBtn: { alignItems: 'center', marginTop: spacing.md },
  resendText: { ...typography.caption, color: colors.gold },
});
