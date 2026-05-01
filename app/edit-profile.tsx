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
import Animated, { FadeInDown } from 'react-native-reanimated';

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

export default function EditProfileScreen() {
  const router = useRouter();
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
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.topbar}>
          <Pressable onPress={onCancel} hitSlop={12} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={26} color={colors.gold} />
          </Pressable>
          <Text style={styles.topbarTitle}>Edit Profile</Text>
          <View style={styles.iconBtn} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.delay(50).duration(300)} style={styles.section}>
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
                onChangeText={setUsername}
                autoCapitalize="none"
                maxLength={USERNAME_MAX}
              />
              {usernameOk && <Ionicons name="checkmark-circle" size={20} color={colors.success} />}
            </View>
            <Text style={[styles.hint, usernameError && styles.hintError]}>
              {usernameError ?? `${username.trim().length}/${USERNAME_MAX} characters`}
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>Avatar</Text>
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
            <Text style={styles.sectionTitle}>Token Color</Text>
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

        <View style={styles.footer}>
          <Pressable
            onPress={onSave}
            disabled={!canSave}
            style={({ pressed }) => [
              styles.primaryBtn,
              { opacity: !canSave ? 0.4 : pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.primaryBtnText}>{dirty ? 'Save changes' : 'No changes'}</Text>
          </Pressable>
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
  topbarTitle: {
    ...typography.h3,
    color: colors.text,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  section: { marginBottom: spacing.xl },
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
  colorLabelSelected: { color: colors.gold, fontWeight: '600' },
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
});
