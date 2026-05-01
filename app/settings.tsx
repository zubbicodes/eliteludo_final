import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useProfileStore } from '@/src/stores/profile';
import { useSettingsStore, type Language } from '@/src/stores/settings';
import { supabase } from '@/src/supabase/client';
import { colors } from '@/src/theme/colors';
import { radius, spacing, typography } from '@/src/theme/typography';
import { haptics } from '@/src/utils/haptics';

export default function SettingsScreen() {
  const router = useRouter();

  const hydrate = useSettingsStore((s) => s.hydrate);
  const set = useSettingsStore((s) => s.set);
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const musicEnabled = useSettingsStore((s) => s.musicEnabled);
  const vibrationEnabled = useSettingsStore((s) => s.vibrationEnabled);
  const language = useSettingsStore((s) => s.language);

  const clearProfile = useProfileStore((s) => s.clear);

  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const onLogout = () => {
    Alert.alert('Sign out', 'You will need to sign in again to play.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
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
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // TODO: wire to Supabase auth.users delete via Edge Function in phase 3.
            Alert.alert('Not yet', 'Account deletion lands when auth wiring goes in.');
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.gold} />
        </Pressable>
        <Text style={styles.topbarTitle}>Settings</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <SectionHeader label="Audio" />
        <SwitchRow
          icon="volume-high-outline"
          label="Sound effects"
          value={soundEnabled}
          onValueChange={(v) => {
            haptics.tap();
            set({ soundEnabled: v });
          }}
        />
        <SwitchRow
          icon="musical-notes-outline"
          label="Music"
          value={musicEnabled}
          onValueChange={(v) => {
            haptics.tap();
            set({ musicEnabled: v });
          }}
        />
        <SwitchRow
          icon="phone-portrait-outline"
          label="Vibration"
          value={vibrationEnabled}
          onValueChange={(v) => {
            // tap before flipping, so the user feels the last vibration when turning off
            haptics.tap();
            set({ vibrationEnabled: v });
          }}
        />

        <SectionHeader label="Language" />
        <LanguageRow value={language} onChange={(l) => set({ language: l })} />

        <SectionHeader label="Legal" />
        <LinkRow icon="document-text-outline" label="Privacy Policy" onPress={() => {}} />
        <LinkRow icon="reader-outline" label="Terms of Service" onPress={() => {}} />

        <SectionHeader label="Support" />
        <LinkRow icon="help-circle-outline" label="Help & Support" onPress={() => {}} />
        <LinkRow icon="information-circle-outline" label="About" onPress={() => {}} />

        <SectionHeader label="Account" />
        <Pressable
          onPress={onLogout}
          disabled={signingOut}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <Ionicons name="log-out-outline" size={22} color={colors.gold} />
          <Text style={[styles.rowLabel, { color: colors.gold }]}>Sign out</Text>
        </Pressable>
        <Pressable
          onPress={onDelete}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <Ionicons name="trash-outline" size={22} color={colors.danger} />
          <Text style={[styles.rowLabel, { color: colors.danger }]}>Delete account</Text>
        </Pressable>

        <Text style={styles.version}>Elite Ludo · v0.1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ label }: { label: string }) {
  return <Text style={styles.sectionHeader}>{label.toUpperCase()}</Text>;
}

function SwitchRow({
  icon,
  label,
  value,
  onValueChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={22} color={colors.gold} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#3a3a3a', true: colors.goldDark }}
        thumbColor={value ? colors.gold : '#cccccc'}
        ios_backgroundColor="#3a3a3a"
      />
    </View>
  );
}

function LinkRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <Ionicons name={icon} size={22} color={colors.gold} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.gray} />
    </Pressable>
  );
}

function LanguageRow({
  value,
  onChange,
}: {
  value: Language;
  onChange: (l: Language) => void;
}) {
  const options: { id: Language; label: string }[] = [
    { id: 'en', label: 'English' },
    { id: 'ur', label: 'اردو' },
  ];
  return (
    <View style={styles.langRow}>
      {options.map((o) => {
        const selected = value === o.id;
        return (
          <Pressable
            key={o.id}
            onPress={() => {
              haptics.tap();
              onChange(o.id);
            }}
            style={[styles.langChip, selected && styles.langChipSelected]}
          >
            <Text style={[styles.langText, selected && styles.langTextSelected]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
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
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  sectionHeader: {
    ...typography.caption,
    color: colors.textDim,
    letterSpacing: 2,
    fontWeight: '600',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
    gap: spacing.md,
  },
  rowPressed: { opacity: 0.7 },
  rowLabel: {
    flex: 1,
    color: colors.text,
    ...typography.body,
  },
  langRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  langChip: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  langChipSelected: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
  },
  langText: {
    ...typography.body,
    color: colors.textMuted,
  },
  langTextSelected: {
    color: colors.gold,
    fontWeight: '700',
  },
  version: {
    ...typography.caption,
    color: colors.textDim,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
