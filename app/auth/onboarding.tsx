import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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

import {
  AVATARS,
  TOKEN_COLORS,
  USERNAME_MAX,
  type TokenColorId,
  isUsernameValid,
  validateUsername,
} from '@/src/constants/profile';
import { useProfileStore } from '@/src/stores/profile';
import { colors } from '@/src/theme/colors';
import { radius, spacing, typography } from '@/src/theme/typography';
import { haptics } from '@/src/utils/haptics';

export default function OnboardingScreen() {
  const router = useRouter();
  const setProfile = useProfileStore((s) => s.setProfile);

  const [username, setUsername] = useState('');
  const [avatarId, setAvatarId] = useState<number | null>(null);
  const [colorId, setColorId] = useState<TokenColorId | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usernameError = validateUsername(username);
  const usernameOk = isUsernameValid(username);
  const canSubmit = usernameOk && avatarId !== null && colorId !== null && !loading;

  const onContinue = async () => {
    if (!canSubmit || avatarId === null || colorId === null) return;
    haptics.tap();
    setLoading(true);
    setError(null);
    // setProfile does a Supabase UPDATE — trigger already inserted the row.
    await setProfile({ username: username.trim(), avatarId, colorId });
    setLoading(false);
    haptics.success();
    router.replace('/(tabs)/home');
  };

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
          <Animated.View entering={FadeIn.duration(400)} style={styles.headerWrap}>
            <Text style={styles.eyebrow}>STEP 1 OF 1</Text>
            <Text style={styles.title}>Set up your profile</Text>
            <Text style={styles.subtitle}>This is how other royals will see you</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>Username</Text>
            <View
              style={[
                styles.inputWrap,
                usernameError && styles.inputError,
                usernameOk && styles.inputOk,
              ]}
            >
              <Ionicons
                name="person-outline"
                size={18}
                color={colors.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="e.g. RoyalRoller"
                placeholderTextColor={colors.textDim}
                value={username}
                onChangeText={(v) => { setUsername(v); setError(null); }}
                autoCapitalize="none"
                maxLength={USERNAME_MAX}
              />
              {usernameOk && <Ionicons name="checkmark-circle" size={20} color={colors.success} />}
            </View>
            <Text style={[styles.hint, usernameError && styles.hintError]}>
              {usernameError ?? `${username.trim().length}/${USERNAME_MAX} characters`}
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>Pick an avatar</Text>
            <View style={styles.avatarGrid}>
              {AVATARS.map((a) => {
                const selected = avatarId === a.id;
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => { haptics.tap(); setAvatarId(a.id); }}
                    style={[styles.avatarTile, selected && styles.avatarTileSelected]}
                  >
                    <View style={[styles.avatarCircle, { backgroundColor: a.bg }]}>
                      <Ionicons name={a.icon} size={28} color={colors.white} />
                    </View>
                    {selected && (
                      <View style={styles.avatarCheck}>
                        <Ionicons name="checkmark" size={12} color={colors.bg} />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>Pick your color</Text>
            <View style={styles.colorRow}>
              {TOKEN_COLORS.map((c) => {
                const selected = colorId === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => { haptics.tap(); setColorId(c.id); }}
                    style={styles.colorTile}
                  >
                    <View
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: c.value },
                        selected && styles.colorSwatchSelected,
                      ]}
                    >
                      {selected && <Ionicons name="checkmark" size={22} color={colors.white} />}
                    </View>
                    <Text style={[styles.colorLabel, selected && styles.colorLabelSelected]}>
                      {c.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          {error && (
            <Text style={styles.globalError}>{error}</Text>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={onContinue}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.primaryBtn,
              { opacity: !canSubmit ? 0.4 : pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.primaryBtnText}>
              {loading ? 'Saving…' : 'Enter the kingdom'}
            </Text>
            {!loading && <Ionicons name="arrow-forward" size={18} color={colors.bg} />}
          </Pressable>
          <Text style={styles.starter}>You'll receive 1,000 starter coins</Text>
        </View>
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
    paddingBottom: spacing.lg,
  },
  headerWrap: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.gold,
    letterSpacing: 2,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
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
  inputError: { borderColor: colors.danger },
  inputOk: { borderColor: colors.gold },
  inputIcon: { marginRight: spacing.sm },
  input: { flex: 1, color: colors.text, ...typography.body },
  hint: {
    ...typography.caption,
    color: colors.textDim,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },
  hintError: { color: colors.danger },
  globalError: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  avatarTile: {
    width: '23%',
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarTileSelected: { borderColor: colors.gold },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorRow: { flexDirection: 'row', justifyContent: 'space-between' },
  colorTile: { alignItems: 'center', flex: 1 },
  colorSwatch: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchSelected: {
    borderColor: colors.gold,
    transform: [{ scale: 1.08 }],
  },
  colorLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  colorLabelSelected: {
    color: colors.gold,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  primaryBtn: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryBtnText: {
    ...typography.body,
    color: colors.bg,
    fontWeight: '700',
    letterSpacing: 1,
  },
  starter: {
    ...typography.caption,
    color: colors.textDim,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
