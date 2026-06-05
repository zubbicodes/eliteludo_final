import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Images } from '@/src/assets';
import { getAvatar, getTokenColor } from '@/src/constants/profile';
import { useProfileStore } from '@/src/stores/profile';
import { useWalletStore } from '@/src/stores/wallet';
import { colors } from '@/src/theme/colors';
import { haptics } from '@/src/utils/haptics';

const MENU_ITEMS = [
  { label: 'Edit Profile', icon: 'person-outline' as const, route: '/edit-profile' },
  { label: 'Shop', icon: 'storefront-outline' as const, route: '/shop' },
  { label: 'Achievements', icon: 'trophy-outline' as const, route: null },
  { label: 'Settings', icon: 'cog-outline' as const, route: '/settings' },
  { label: 'Help & Support', icon: 'help-circle-outline' as const, route: null },
] as const;

export default function ProfileScreen() {
  const router = useRouter();
  const profile = useProfileStore((s) => s.profile);
  const hydrated = useProfileStore((s) => s.hydrated);
  const hydrate = useProfileStore((s) => s.hydrate);
  const coins = useWalletStore((s) => s.coins);

  useEffect(() => { hydrate(); }, [hydrate]);

  const wins = profile?.wins ?? 0;
  const losses = profile?.losses ?? 0;
  const stats = {
    gamesPlayed: wins + losses,
    wins,
    crowns: profile?.crownsUnlocked.length ?? 0,
    rank: wins >= 25 ? 'Elite' : wins >= 10 ? 'Gold' : 'Bronze',
  };
  const avatar = getAvatar(profile?.avatarId);
  const tokenColor = getTokenColor(profile?.colorId);
  const displayName = profile?.username ?? 'Player';

  return (
    <ImageBackground source={Images.bgHome} style={styles.root} resizeMode="cover">
      <View style={styles.overlay} />

      {/* Header */}
      <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.coinBadge}>
          <Image source={Images.coinSingle} style={styles.coinIcon} />
          <Text style={styles.coinText}>{coins.toLocaleString()}</Text>
        </View>
      </Animated.View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Profile card */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <LinearGradient
            colors={['rgba(212,175,55,0.12)', 'rgba(212,175,55,0.04)']}
            style={styles.profileCard}
          >
            {/* Gold top accent */}
            <LinearGradient
              colors={[colors.goldDark, colors.gold, colors.goldDark]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.cardTopBorder}
            />

            {/* Crown above avatar */}
            <Image source={Images.crown} style={styles.crownImg} resizeMode="contain" />

            {/* Avatar */}
            <View style={[styles.avatarRing, { borderColor: colors.gold }]}>
              <View style={[styles.avatarInner, { backgroundColor: avatar.bg }]}>
                <Ionicons name={avatar.icon} size={40} color="#fff" />
              </View>
            </View>

            <Text style={styles.username}>{displayName}</Text>

            {/* Rank badge */}
            <LinearGradient
              colors={[colors.gold, colors.goldDark]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.rankBadge}
            >
              <Text style={styles.rankText}>{stats.rank} Rank</Text>
            </LinearGradient>

            {/* Token color */}
            <View style={styles.metaRow}>
              <View style={[styles.tokenDot, { backgroundColor: tokenColor.value }]} />
              <Text style={styles.metaText}>{tokenColor.label} tokens</Text>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Stats row */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.statsRow}>
          {[
            { label: 'Games', value: stats.gamesPlayed },
            { label: 'Wins', value: stats.wins },
            { label: 'Crowns', value: stats.crowns },
          ].map((s) => (
            <View key={s.label} style={styles.statCard}>
              <LinearGradient
                colors={['rgba(212,175,55,0.1)', 'rgba(212,175,55,0.03)']}
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient
                colors={[colors.goldDark, colors.gold, colors.goldDark]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.statTopBorder}
              />
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* Menu */}
        <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.menuSection}>
          {MENU_ITEMS.map((item, idx) => (
            <Pressable
              key={item.label}
              onPress={() => {
                haptics.tap();
                if (item.route) router.push(item.route as any);
              }}
              style={({ pressed }) => [
                styles.menuItem,
                idx === 0 && styles.menuItemFirst,
                idx === MENU_ITEMS.length - 1 && styles.menuItemLast,
                pressed && { opacity: 0.75 },
              ]}
            >
              <View style={styles.menuIconWrap}>
                <Ionicons name={item.icon} size={20} color={colors.gold} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
            </Pressable>
          ))}
        </Animated.View>

        {!profile && hydrated && (
          <Text style={styles.hint}>
            Tip: tap Edit Profile to set your username, avatar, and token color.
          </Text>
        )}
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.62)' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 16,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.gold,
    letterSpacing: 2,
    textShadowColor: 'rgba(212,175,55,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  coinIcon: { width: 18, height: 18, resizeMode: 'contain' },
  coinText: { color: colors.gold, fontWeight: '700', fontSize: 14 },
  scroll: { paddingHorizontal: 16, paddingBottom: 100 },

  // Profile card
  profileCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    padding: 24,
    alignItems: 'center',
    marginBottom: 14,
    overflow: 'hidden',
    paddingTop: 18,
  },
  cardTopBorder: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
  },
  crownImg: { width: 48, height: 48, marginBottom: -10, zIndex: 1 },
  avatarRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2.5,
    padding: 3,
    marginBottom: 12,
  },
  avatarInner: {
    flex: 1,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  username: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  rankBadge: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 5,
    marginBottom: 10,
  },
  rankText: { color: colors.bg, fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tokenDot: { width: 10, height: 10, borderRadius: 5 },
  metaText: { color: colors.textMuted, fontSize: 13 },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    paddingVertical: 16,
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(20,20,22,0.7)',
  },
  statTopBorder: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.gold,
    textShadowColor: 'rgba(212,175,55,0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  statLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2, letterSpacing: 0.5 },

  // Menu
  menuSection: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    overflow: 'hidden',
    backgroundColor: 'rgba(14,12,8,0.85)',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  menuItemFirst: {},
  menuItemLast: { borderBottomWidth: 0 },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(212,175,55,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuLabel: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '500' },
  hint: {
    color: colors.textDim,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 16,
  },
});
