import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
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
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Images } from '@/src/assets';
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
import { haptics } from '@/src/utils/haptics';

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setProfile = useProfileStore((s) => s.setProfile);

  const [username, setUsername] = useState('');
  const [avatarId, setAvatarId] useState<number | null>(null);
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
    await setProfile({ username: username.trim(), avatarId, colorId });
    setLoading(false);
    haptics.success();
    router.replace('/(tabs)/home');
  };

  return (
    <View style={styles.root}>
      <ImageBackground source={Images.bgHome} style={StyleSheet.absoluteFill} resizeMode="cover">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,3,1,0.92)' }]} />
      </ImageBackground>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeIn.duration(400)} style={styles.headerWrap}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepText}>STEP 1 OF 1</Text>
            </View>
            <Text style={styles.title}>Set up your profile</Text>
            <Text style={styles.subtitle}>This is how other royals will see you</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.section}>
            <Text style={styles.sectionLabel}>USERNAME</Text>
            <View
              style={[
                styles.inputWrap,
                usernameError && styles.inputError,
                usernameOk && styles.inputOk,
              ]}
            >
              <View style={styles.inputIconWrap}>
                <Ionicons name="person-outline" size={18} color={colors.gold} />
              </View>
              <TextInput
                style={styles.input}
                placeholder="e.g. RoyalRoller"
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={username}
                onChangeText={(v) => { setUsername(v); setError(null); }}
                autoCapitalize="none"
                maxLength={USERNAME_MAX}
              />
              {usernameOk && (
                <View style={styles.checkWrap}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.green} />
                </View>
              )}
            </View>
            <Text style={[styles.hint, usernameError && styles.hintError]}>
              {usernameError ?? `${username.trim().length}/${USERNAME_MAX} characters`}
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.section}>
            <Text style={styles.sectionLabel}>PICK AN AVATAR</Text>
            <View style={styles.avatarGrid}>
              {AVATARS.map((a) => {
                const selected = avatarId === a.id;
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => { haptics.tap(); setAvatarId(a.id); }}
                    style={[styles.avatarTile, selected && styles.avatarTileSelected]}
                  >
                    {selected && (
                      <LinearGradient
                        colors={['rgba(212,175,55,0.2)', 'rgba(212,175,55,0.05)']}
                        style={StyleSheet.absoluteFill}
                      />
                    )}
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
            <Text style={styles.sectionLabel}>PICK YOUR COLOR</Text>
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

        <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
          <Pressable
            onPress={onContinue}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.primaryBtn,
              { opacity: !canSubmit ? 0.4 : pressed ? 0.85 : 1 },
            ]}
          >
            <LinearGradient
              colors={[colors.gold, colors.goldDark]}
              style={styles.primaryBtnGradient}
            >
              <Text style={styles.primaryBtnText}>
                {loading ? 'Saving…' : 'Enter the kingdom'}
              </Text>
              {!loading && <Ionicons name="arrow-forward" size={18} color={colors.bg} />}
            </LinearGradient>
          </Pressable>
          <Text style={styles.starter}>You'll receive 1,000 starter coins</Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#040301' },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  headerWrap: {
    marginTop: 20,
    marginBottom: 32,
  },
  stepBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 12,
  },
  stepText: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 14,
    fontWeight: '400',
  },
  section: {
    marginBottom: 28,
  },
  sectionLabel: {
    color: 'rgba(212,175,55,0.5)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 10,
    marginLeft: 4,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    height: 54,
  },
  inputError: { borderColor: 'rgba(226,87,76,0.5)' },
  inputOk: { borderColor: 'rgba(212,175,55,0.4)' },
  inputIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(212,175,55,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(76,175,80,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '500' },
  hint: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 12,
    marginTop: 8,
    marginLeft: 4,
  },
  hintError: { color: 'rgba(226,87,76,0.8)' },
  globalError: {
    color: 'rgba(226,87,76,0.9)',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '500',
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  avatarTile: {
    width: '23%',
    aspectRatio: 1,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  avatarTileSelected: { borderColor: colors.goldDark },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  colorRow: { flexDirection: 'row', justifyContent: 'space-between' },
  colorTile: { alignItems: 'center', flex: 1 },
  colorSwatch: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchSelected: {
    borderColor: colors.gold,
    transform: [{ scale: 1.1 }],
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 8,
  },
  colorLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    marginTop: 8,
    fontWeight: '500',
  },
  colorLabelSelected: {
    color: colors.gold,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212,175,55,0.1)',
    backgroundColor: 'rgba(4,3,1,0.8)',
  },
  primaryBtn: {
    height: 54,
    borderRadius: 16,
    overflow: 'hidden',
  },
  primaryBtnGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryBtnText: {
    color: colors.bg,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },
  starter: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
    letterSpacing: 0.5,
  },
});
