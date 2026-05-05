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

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useProfileStore((s) => s.profile);
  const setProfile = useProfileStore((s) => s.setProfile);

  const [username, setUsername] = useState(profile?.username ?? '');
  const [avatarId, setAvatarId] = useState<number>(profile?.avatarId ?? 0);
  const [colorId, setColorId] = useState<TokenColorId>(profile?.colorId ?? 'red');

  const usernameError = validateUsername(username);
  const usernameOk = isUsernameValid(username);

  const dirty =
    !profile ||
    username.trim() !== profile.username ||
    avatarId !== profile.avatarId ||
    colorId !== profile.colorId;

  const canSave = usernameOk && dirty;

  const onSave = async () => {
    if (!canSave) return;
    haptics.success();
    await setProfile({ username: username.trim(), avatarId, colorId });
    router.back();
  };

  const onCancel = () => {
    haptics.tap();
    router.back();
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
        <Animated.View
          entering={FadeIn.duration(400)}
          style={[styles.header, { paddingTop: insets.top + 12 }]}
        >
          <Pressable onPress={onCancel} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={20} color={colors.gold} />
          </Pressable>
          <Text style={styles.headerTitle}>EDIT PROFILE</Text>
          <View style={{ width: 38 }} />
        </Animated.View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.delay(50).duration(300)} style={styles.section}>
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
                onChangeText={setUsername}
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

          <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.section}>
            <Text style={styles.sectionLabel}>AVATAR</Text>
            <View style={styles.avatarGrid}>
              {AVATARS.map((a) => {
                const selected = avatarId === a.id;
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => {
                      haptics.tap();
                      setAvatarId(a.id);
                    }}
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

          <Animated.View entering={FadeInDown.delay(150).duration(300)} style={styles.section}>
            <Text style={styles.sectionLabel}>TOKEN COLOR</Text>
            <View style={styles.colorRow}>
              {TOKEN_COLORS.map((c) => {
                const selected = colorId === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => {
                      haptics.tap();
                      setColorId(c.id);
                    }}
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
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
          <Pressable
            onPress={onSave}
            disabled={!canSave}
            style={({ pressed }) => [
              styles.primaryBtn,
              { opacity: !canSave ? 0.4 : pressed ? 0.85 : 1 },
            ]}
          >
            <LinearGradient
              colors={[colors.gold, colors.goldDark]}
              style={styles.primaryBtnGradient}
            >
              <Text style={styles.primaryBtnText}>{dirty ? 'Save changes' : 'No changes'}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#040301' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,175,55,0.12)',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.gold,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 4,
    textShadowColor: 'rgba(212,175,55,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  section: { marginBottom: 28 },
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: colors.bg,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
