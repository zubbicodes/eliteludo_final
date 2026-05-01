import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { getAvatar, getTokenColor } from '@/src/constants/profile';
import { useProfileStore } from '@/src/stores/profile';
import { useWalletStore } from '@/src/stores/wallet';
import { colors } from '@/src/theme/colors';
import { radius, spacing, typography } from '@/src/theme/typography';
import { haptics } from '@/src/utils/haptics';

export default function ProfileScreen() {
  const router = useRouter();

  const profile = useProfileStore((s) => s.profile);
  const hydrated = useProfileStore((s) => s.hydrated);
  const hydrate = useProfileStore((s) => s.hydrate);
  const coins = useWalletStore((s) => s.coins);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const stats = {
    gamesPlayed: 12,
    wins: 8,
    crowns: 150,
    rank: 'Gold',
  };

  const avatar = getAvatar(profile?.avatarId);
  const tokenColor = getTokenColor(profile?.colorId);
  const displayName = profile?.username ?? 'Player';

  const onEdit = () => {
    haptics.tap();
    router.push('/edit-profile');
  };

  const onSettings = () => {
    haptics.tap();
    router.push('/settings');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn.duration(500)} style={styles.profileCard}>
          <View style={[styles.avatarContainer, { backgroundColor: avatar.bg }]}>
            <Ionicons name={avatar.icon} size={42} color={colors.white} />
          </View>
          <Text style={styles.username}>{displayName}</Text>
          <View style={styles.metaRow}>
            <View style={[styles.colorDot, { backgroundColor: tokenColor.value }]} />
            <Text style={styles.metaText}>{tokenColor.label} tokens</Text>
            <View style={styles.metaSep} />
            <Ionicons name="logo-bitcoin" size={14} color={colors.gold} />
            <Text style={styles.metaText}>{coins.toLocaleString()}</Text>
          </View>
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>{stats.rank}</Text>
          </View>
        </Animated.View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.gamesPlayed}</Text>
            <Text style={styles.statLabel}>Games</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.wins}</Text>
            <Text style={styles.statLabel}>Wins</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.crowns}</Text>
            <Text style={styles.statLabel}>Crowns</Text>
          </View>
        </View>

        <View style={styles.menuContainer}>
          <Pressable
            onPress={onEdit}
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          >
            <Ionicons name="person-outline" size={24} color={colors.gold} />
            <Text style={styles.menuText}>Edit Profile</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.gray} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          >
            <Ionicons name="trophy-outline" size={24} color={colors.gold} />
            <Text style={styles.menuText}>Achievements</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.gray} />
          </Pressable>
          <Pressable
            onPress={onSettings}
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          >
            <Ionicons name="cog-outline" size={24} color={colors.gold} />
            <Text style={styles.menuText}>Settings</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.gray} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          >
            <Ionicons name="help-circle-outline" size={24} color={colors.gold} />
            <Text style={styles.menuText}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.gray} />
          </Pressable>
        </View>

        {!profile && hydrated && (
          <Text style={styles.noProfileHint}>
            Tip: tap Edit Profile to set your username, avatar, and token color.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  headerTitle: {
    ...typography.h1,
    fontSize: 28,
    color: colors.gold,
  },
  scroll: { paddingBottom: 40 },
  profileCard: {
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: 20,
    padding: 24,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.gold,
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.white,
    marginTop: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  metaText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  metaSep: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.textDim,
    marginHorizontal: spacing.xs,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  rankBadge: {
    backgroundColor: colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 12,
  },
  rankText: {
    color: colors.bg,
    fontWeight: 'bold',
    fontSize: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    marginHorizontal: 20,
  },
  statItem: { alignItems: 'center' },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.gold,
  },
  statLabel: {
    fontSize: 12,
    color: colors.gray,
    marginTop: 4,
  },
  menuContainer: {
    marginTop: 30,
    marginHorizontal: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  menuItemPressed: {
    opacity: 0.7,
  },
  menuText: {
    flex: 1,
    color: colors.white,
    fontSize: 16,
    marginLeft: 12,
  },
  noProfileHint: {
    ...typography.caption,
    color: colors.textDim,
    textAlign: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
});
