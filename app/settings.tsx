import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Images } from '@/src/assets';
import { useProfileStore } from '@/src/stores/profile';
import { useSettingsStore, type Language } from '@/src/stores/settings';
import { supabase } from '@/src/supabase/client';
import { colors } from '@/src/theme/colors';
import { haptics } from '@/src/utils/haptics';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const hydrate = useSettingsStore((s) => s.hydrate);
  const set = useSettingsStore((s) => s.set);
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const musicEnabled = useSettingsStore((s) => s.musicEnabled);
  const vibrationEnabled = useSettingsStore((s) => s.vibrationEnabled);
  const language = useSettingsStore((s) => s.language);
  const clearProfile = useProfileStore((s) => s.clear);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => { hydrate(); }, [hydrate]);

  const onLogout = () => {
    Alert.alert('Sign out', 'You will need to sign in again to play.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out', style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          haptics.warning();
          clearProfile();
          await supabase.auth.signOut();
          router.replace('/auth/login');
        },
      },
    ]);
  };

  const onDelete = () => {
    Alert.alert(
      'Delete account',
      'This permanently removes your profile, coins, and stats. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: () => Alert.alert('Not yet', 'Account deletion lands in a future update.'),
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <ImageBackground source={Images.bgHome} style={StyleSheet.absoluteFill} resizeMode="cover">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,3,1,0.92)' }]} />
      </ImageBackground>

      {/* Header */}
      <Animated.View
        entering={FadeIn.duration(400)}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={colors.gold} />
        </Pressable>
        <Text style={styles.headerTitle}>SETTINGS</Text>
        <View style={{ width: 38 }} />
      </Animated.View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <SectionLabel label="Audio" />
          <View style={styles.card}>
            <SwitchRow
              icon="volume-high-outline"
              label="Sound Effects"
              value={soundEnabled}
              onValueChange={(v) => { haptics.tap(); set({ soundEnabled: v }); }}
              last={false}
            />
            <SwitchRow
              icon="musical-notes-outline"
              label="Music"
              value={musicEnabled}
              onValueChange={(v) => { haptics.tap(); set({ musicEnabled: v }); }}
              last={false}
            />
            <SwitchRow
              icon="phone-portrait-outline"
              label="Vibration"
              value={vibrationEnabled}
              onValueChange={(v) => { haptics.tap(); set({ vibrationEnabled: v }); }}
              last
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(180).duration(400)}>
          <SectionLabel label="Language" />
          <View style={styles.card}>
            <LanguageRow value={language} onChange={(l) => set({ language: l })} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(260).duration(400)}>
          <SectionLabel label="Legal" />
          <View style={styles.card}>
            <LinkRow icon="document-text-outline" label="Privacy Policy" onPress={() => {}} last={false} />
            <LinkRow icon="reader-outline" label="Terms of Service" onPress={() => {}} last />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(340).duration(400)}>
          <SectionLabel label="Support" />
          <View style={styles.card}>
            <LinkRow icon="help-circle-outline" label="Help & Support" onPress={() => {}} last={false} />
            <LinkRow icon="information-circle-outline" label="About" onPress={() => {}} last />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(420).duration(400)}>
          <SectionLabel label="Account" />
          <View style={styles.card}>
            <Pressable
              onPress={onLogout}
              disabled={signingOut}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
            >
              <View style={[styles.iconBadge, { backgroundColor: 'rgba(212,175,55,0.12)' }]}>
                <Ionicons name="log-out-outline" size={18} color={colors.gold} />
              </View>
              <Text style={[styles.rowLabel, { color: colors.gold }]}>Sign out</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.goldDark} />
            </Pressable>
            <View style={styles.rowDivider} />
            <Pressable
              onPress={onDelete}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
            >
              <View style={[styles.iconBadge, { backgroundColor: 'rgba(226,87,76,0.12)' }]}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </View>
              <Text style={[styles.rowLabel, { color: colors.danger }]}>Delete account</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.danger} />
            </Pressable>
          </View>
        </Animated.View>

        <Text style={styles.version}>Elite Ludo · 2026 Edition</Text>
      </ScrollView>
    </View>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <Text style={styles.sectionLabel}>{label.toUpperCase()}</Text>
  );
}

function SwitchRow({
  icon, label, value, onValueChange, last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  last: boolean;
}) {
  return (
    <>
      <View style={styles.row}>
        <View style={[styles.iconBadge, { backgroundColor: 'rgba(212,175,55,0.1)' }]}>
          <Ionicons name={icon} size={18} color={colors.gold} />
        </View>
        <Text style={styles.rowLabel}>{label}</Text>
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: 'rgba(255,255,255,0.08)', true: colors.goldDark }}
          thumbColor={value ? colors.gold : 'rgba(255,255,255,0.4)'}
          ios_backgroundColor="rgba(255,255,255,0.08)"
        />
      </View>
      {!last && <View style={styles.rowDivider} />}
    </>
  );
}

function LinkRow({
  icon, label, onPress, last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  last: boolean;
}) {
  return (
    <>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      >
        <View style={[styles.iconBadge, { backgroundColor: 'rgba(212,175,55,0.1)' }]}>
          <Ionicons name={icon} size={18} color={colors.gold} />
        </View>
        <Text style={styles.rowLabel}>{label}</Text>
        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.25)" />
      </Pressable>
      {!last && <View style={styles.rowDivider} />}
    </>
  );
}

function LanguageRow({ value, onChange }: { value: Language; onChange: (l: Language) => void }) {
  const options: { id: Language; label: string; flag: string }[] = [
    { id: 'en', label: 'English', flag: '🇬🇧' },
    { id: 'ur', label: 'اردو', flag: '🇵🇰' },
  ];
  return (
    <View style={styles.langRow}>
      {options.map((o) => {
        const selected = value === o.id;
        return (
          <Pressable
            key={o.id}
            onPress={() => { haptics.tap(); onChange(o.id); }}
            style={[styles.langChip, selected && styles.langChipSelected]}
          >
            {selected && (
              <LinearGradient
                colors={['rgba(212,175,55,0.15)', 'rgba(212,175,55,0.05)']}
                style={StyleSheet.absoluteFill}
              />
            )}
            <Text style={styles.langFlag}>{o.flag}</Text>
            <Text style={[styles.langText, selected && styles.langTextSelected]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#040301' },

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
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  sectionLabel: {
    color: 'rgba(212,175,55,0.45)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.5,
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },

  card: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.12)',
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 12,
  },
  rowDivider: {
    height: 1,
    marginHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },

  langRow: {
    flexDirection: 'row',
    padding: 8,
    gap: 8,
  },
  langChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  langChipSelected: {
    borderColor: colors.goldDark,
  },
  langFlag: { fontSize: 18 },
  langText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
  },
  langTextSelected: {
    color: colors.gold,
    fontWeight: '700',
  },

  version: {
    color: 'rgba(255,255,255,0.12)',
    fontSize: 11,
    letterSpacing: 1.5,
    textAlign: 'center',
    marginTop: 28,
  },
});
