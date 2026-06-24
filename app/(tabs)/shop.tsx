import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AD_REWARD_COINS, IAP_COIN_PACK_AMOUNT, SHOP_ITEMS } from '@/src/constants/economy';
import { showRewardedAd } from '@/src/services/ads';
import { purchaseCoinPack } from '@/src/services/iap';
import { useProfileStore } from '@/src/stores/profile';
import { useShopStore } from '@/src/stores/shop';
import { useWalletStore } from '@/src/stores/wallet';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';
import { haptics } from '@/src/utils/haptics';
import { sound } from '@/src/utils/sound';

export default function ShopScreen() {
  const router = useRouter();
  const coins = useWalletStore((s) => s.coins);
  const refreshWallet = useWalletStore((s) => s.refresh);
  const profile = useProfileStore((s) => s.profile);
  const refreshProfile = useProfileStore((s) => s.refresh);
  const purchase = useShopStore((s) => s.purchase);
  const loadingItemId = useShopStore((s) => s.loadingItemId);
  const [rewarding, setRewarding] = useState(false);
  const [buyingPack, setBuyingPack] = useState(false);

  useEffect(() => {
    refreshWallet();
    refreshProfile();
  }, [refreshProfile, refreshWallet]);

  const unlocked = new Set([
    profile?.selectedTokenSkin,
    profile?.selectedDiceSkin,
    ...(profile?.crownsUnlocked ?? []),
  ].filter(Boolean));

  const onRewardAd = async () => {
    if (rewarding) return;
    haptics.tap();
    sound.play('tap');
    setRewarding(true);
    const result = await showRewardedAd('shop_reward');
    await refreshWallet();
    setRewarding(false);
    if (result.success) {
      haptics.success();
      sound.play('coin');
    }
    else Alert.alert('Ad not completed', 'Coins are granted after the rewarded ad finishes.');
  };

  const onCoinPack = async () => {
    if (buyingPack) return;
    haptics.tap();
    sound.play('tap');
    setBuyingPack(true);
    try {
      const result = await purchaseCoinPack();
      await refreshWallet();
      if (result.success) {
        haptics.success();
        sound.play('coin');
      }
      else Alert.alert('Purchase pending', result.reason ?? 'The coin pack was not granted yet.');
    } catch {
      Alert.alert('Purchase unavailable', 'Use the rewarded ad or shop coins while IAP is unavailable.');
    } finally {
      setBuyingPack(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => {
          sound.play('tap');
          router.back();
        }} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.gold} />
        </Pressable>
        <Text style={styles.title}>Shop</Text>
        <View style={styles.walletPill}>
          <Ionicons name="ellipse" size={14} color={colors.gold} />
          <Text style={styles.walletText}>{coins.toLocaleString()}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.featureRow}>
          <Pressable onPress={onRewardAd} disabled={rewarding} style={styles.featureCard}>
            <LinearGradient colors={['#245B33', '#102915']} style={StyleSheet.absoluteFill} />
            <Ionicons name="videocam" size={30} color="#D8FFD7" />
            <Text style={styles.featureTitle}>{rewarding ? 'Loading ad...' : `Watch ad +${AD_REWARD_COINS}`}</Text>
          </Pressable>
          <Pressable onPress={onCoinPack} disabled={buyingPack} style={styles.featureCard}>
            <LinearGradient colors={[colors.gold, '#7B4C08']} style={StyleSheet.absoluteFill} />
            <Ionicons name="diamond" size={30} color="#FFF4BE" />
            <Text style={[styles.featureTitle, { color: colors.bg }]}>
              {buyingPack ? 'Opening...' : `Coin pack +${IAP_COIN_PACK_AMOUNT}`}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>Cosmetics</Text>
        {SHOP_ITEMS.map((item) => {
          const owned = unlocked.has(item.id);
          const loading = loadingItemId === item.id;
          return (
            <View key={item.id} style={styles.itemRow}>
              <View style={[styles.swatch, { backgroundColor: item.accent }]}>
                <Ionicons
                  name={item.kind === 'dice_skin' ? 'dice' : item.kind === 'crown' ? 'ribbon' : 'disc'}
                  size={22}
                  color="#fff"
                />
              </View>
              <View style={styles.itemCopy}>
                <Text style={styles.itemTitle}>{item.label}</Text>
                <Text style={styles.itemSub}>{item.kind.replace('_', ' ')}</Text>
              </View>
              <Pressable
                disabled={owned || loading}
                onPress={async () => {
                  haptics.tap();
                  sound.play('tap');
                  const result = await purchase(item.id);
                  if (result.success) haptics.success();
                  else Alert.alert('Purchase failed', result.reason ?? 'Check your balance and try again.');
                }}
                style={[styles.buyBtn, owned && styles.ownedBtn]}
              >
                <Text style={[styles.buyText, owned && styles.ownedText]}>
                  {owned ? 'Owned' : loading ? '...' : item.price.toLocaleString()}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050201' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,175,55,0.16)',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212,175,55,0.1)',
  },
  title: { flex: 1, color: colors.gold, fontFamily: fontFamilies.heading, fontWeight: '400', fontSize: 24, letterSpacing: 1 },
  walletPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  walletText: { color: '#fff', fontFamily: fontFamilies.heading, fontWeight: '400' },
  scroll: { padding: 16, paddingBottom: 32, gap: 12 },
  featureRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  featureCard: {
    flex: 1,
    minHeight: 114,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  featureTitle: { color: '#fff', fontFamily: fontFamilies.heading, fontWeight: '400', textAlign: 'center', paddingHorizontal: 8 },
  sectionLabel: {
    color: 'rgba(212,175,55,0.55)',
    fontFamily: fontFamilies.heading,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  itemRow: {
    minHeight: 78,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.14)',
    backgroundColor: 'rgba(255,255,255,0.035)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 12,
  },
  swatch: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemCopy: { flex: 1 },
  itemTitle: { color: '#fff', fontFamily: fontFamilies.heading, fontWeight: '400', fontSize: 15 },
  itemSub: { color: 'rgba(255,255,255,0.45)', fontFamily: fontFamilies.body, fontWeight: '400', textTransform: 'capitalize' },
  buyBtn: {
    minWidth: 84,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  ownedBtn: { backgroundColor: 'rgba(255,255,255,0.08)' },
  buyText: { color: colors.bg, fontFamily: fontFamilies.heading, fontWeight: '400' },
  ownedText: { color: 'rgba(255,255,255,0.55)' },
});
