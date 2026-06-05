import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DailyRewardModal } from '@/src/components/DailyRewardModal';
import { Images } from '@/src/assets';
import { useProfileStore } from '@/src/stores/profile';
import { useWalletStore } from '@/src/stores/wallet';
import { colors } from '@/src/theme/colors';
import { haptics } from '@/src/utils/haptics';

const { width: W, height: H } = Dimensions.get('window');

const COMPACT_CLUB = H < 820 || W < 430;
const CLUB_W = Math.min(W - (COMPACT_CLUB ? 56 : 64), COMPACT_CLUB ? 318 : 326);
const CLUB_H = COMPACT_CLUB ? 348 : 386;
const CLUB_GAP = 18;
const SIDE_INSET = (W - CLUB_W) / 2;

type HomeView = 'modes' | 'clubs';
type ModeId = '2p' | '4p' | 'private' | 'team' | 'friends' | 'ai';

type Mode = {
  id: ModeId;
  label: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
  colors: [string, string];
  size: 'large' | 'small';
};

type City = {
  id: string;
  name: string;
  subtitle: string;
  entry: number;
  prize: number;
  online: number;
  accentColor: string;
  background: ImageSourcePropType;
  crown: ImageSourcePropType;
};

const MODES: Mode[] = [
  { id: '2p', label: '2 Player', sub: 'Classic duel', icon: 'dice', colors: ['#F4BA22', '#A75A08'], size: 'large' },
  { id: '4p', label: '4 Player', sub: 'Royal table', icon: 'people', colors: ['#8260DE', '#432A98'], size: 'large' },
  { id: 'private', label: 'Private Table', sub: 'Invite code', icon: 'heart', colors: ['#7A4FD0', '#392070'], size: 'small' },
  { id: 'team', label: 'Team Up', sub: 'Online', icon: 'globe', colors: ['#7A4FD0', '#392070'], size: 'small' },
  { id: 'friends', label: 'Friends', sub: 'Party table', icon: 'chatbubbles', colors: ['#7A4FD0', '#392070'], size: 'small' },
  { id: 'ai', label: 'Practice', sub: 'Vs computer', icon: 'desktop', colors: ['#4C8C55', '#1E572A'], size: 'small' },
];

const CITIES: City[] = [
  { id: 'newdelhi', name: 'NEW DELHI', subtitle: 'Starter Club', entry: 250, prize: 600, online: 12_560, accentColor: '#E06030', background: Images.cityNewDelhi, crown: Images.clubCrownEmerald },
  { id: 'london', name: 'LONDON', subtitle: 'Royal Club', entry: 500, prize: 1_000, online: 8_420, accentColor: '#4CAF50', background: Images.cityLondon, crown: Images.clubCrownRoyal },
  { id: 'istanbul', name: 'ISTANBUL', subtitle: 'Bosphorus Club', entry: 750, prize: 1_800, online: 7_890, accentColor: '#D4884A', background: Images.cityIstanbul, crown: Images.clubCrownDesert },
  { id: 'dubai', name: 'DUBAI', subtitle: 'Marina Elite', entry: 1_000, prize: 2_500, online: 6_234, accentColor: '#1A9ED4', background: Images.cityDubai, crown: Images.clubCrownRuby },
  { id: 'doha', name: 'DOHA', subtitle: 'Gulf Premier', entry: 1_500, prize: 4_000, online: 5_100, accentColor: '#D4AF37', background: Images.cityDoha, crown: Images.clubCrownRed },
  { id: 'singapore', name: 'SINGAPORE', subtitle: 'Marina Bay', entry: 2_000, prize: 5_000, online: 4_560, accentColor: '#0E9ABF', background: Images.citySingapore, crown: Images.clubCrownEmerald },
  { id: 'tokyo', name: 'TOKYO', subtitle: 'Sakura Grand', entry: 3_000, prize: 8_000, online: 3_120, accentColor: '#E05080', background: Images.cityTokyo, crown: Images.clubCrownRoyal },
  { id: 'paris', name: 'PARIS', subtitle: 'Eiffel Elite', entry: 5_000, prize: 12_000, online: 2_870, accentColor: '#9C6FD4', background: Images.cityParis, crown: Images.clubCrownRuby },
  { id: 'rome', name: 'ROME', subtitle: 'Colosseum VIP', entry: 7_500, prize: 20_000, online: 1_840, accentColor: '#D44A1A', background: Images.cityRome, crown: Images.clubCrownRed },
  { id: 'berlin', name: 'BERLIN', subtitle: 'Grand Master', entry: 10_000, prize: 30_000, online: 980, accentColor: '#4A9ED4', background: Images.cityBerlin, crown: Images.clubCrownDesert },
];

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 1 : 0)}K`;
  return `${n}`;
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const coins = useWalletStore((s) => s.coins);
  const hydrated = useWalletStore((s) => s.hydrated);
  const hydrateWallet = useWalletStore((s) => s.hydrate);
  const claimDaily = useWalletStore((s) => s.claimDaily);
  const pendingClaim = useWalletStore((s) => s.pendingClaim);
  const profile = useProfileStore((s) => s.profile);
  const hydrateProfile = useProfileStore((s) => s.hydrate);

  const [view, setView] = useState<HomeView>('modes');
  const [selectedMode, setSelectedMode] = useState<ModeId>('2p');
  const [activeClub, setActiveClub] = useState(0);
  const [rewardOpen, setRewardOpen] = useState(false);
  const [pendingDay, setPendingDay] = useState(1);
  const [claiming, setClaiming] = useState(false);
  const scrollX = useSharedValue(0);

  useEffect(() => {
    hydrateWallet();
    hydrateProfile();
  }, [hydrateWallet, hydrateProfile]);

  useEffect(() => {
    if (!hydrated || rewardOpen) return;
    const p = pendingClaim();
    if (p) {
      setPendingDay(p.day);
      setRewardOpen(true);
    }
  }, [hydrated, pendingClaim, rewardOpen]);

  const openMode = useCallback((mode: ModeId) => {
    haptics.tap();
    if (mode === 'ai') {
      router.push('/game/new');
      return;
    }
    setSelectedMode(mode);
    setView('clubs');
    setActiveClub(0);
  }, [router]);

  const playClub = useCallback(() => {
    haptics.tap();
    if (selectedMode === 'ai') {
      router.push({ pathname: '/game/new', params: { mode: '4p' } } as never);
      return;
    }
    router.push({ pathname: '/game/matchmaking', params: { mode: selectedMode } } as never);
  }, [router, selectedMode]);

  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  const onClubMomentumEnd = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / (CLUB_W + CLUB_GAP));
    setActiveClub(Math.max(0, Math.min(idx, CITIES.length - 1)));
  };

  return (
    <View style={styles.root}>
      <ImageBackground source={Images.bgHome} style={StyleSheet.absoluteFill} resizeMode="cover">
        <View style={styles.bgTint} />
      </ImageBackground>

      <Header
        top={insets.top}
        coins={coins}
        username={profile?.username ?? 'Player'}
        onSettings={() => {
          haptics.tap();
          router.push('/settings');
        }}
      />

      {view === 'modes' ? (
        <ModesHome
          bottom={insets.bottom}
          onMode={openMode}
          onReward={() => setRewardOpen(true)}
          coins={coins}
        />
      ) : (
        <ClubSlides
          bottom={insets.bottom}
          selectedMode={selectedMode}
          activeClub={activeClub}
          scrollX={scrollX}
          onBack={() => {
            haptics.tap();
            setView('modes');
          }}
          onPlay={playClub}
          onScroll={scrollHandler}
          onMomentumEnd={onClubMomentumEnd}
        />
      )}

      <DailyRewardModal
        visible={rewardOpen}
        pendingDay={pendingDay}
        onClaim={async () => {
          if (claiming) return;
          setClaiming(true);
          const r = await claimDaily();
          if (r) haptics.success();
          setClaiming(false);
          setRewardOpen(false);
        }}
        onClose={() => setRewardOpen(false)}
      />
    </View>
  );
}

function Header({
  top,
  coins,
  username,
  onSettings,
}: {
  top: number;
  coins: number;
  username: string;
  onSettings: () => void;
}) {
  return (
    <Animated.View entering={FadeIn.duration(300)} style={[styles.header, { paddingTop: top + 10 }]}>
      <View style={styles.avatarWrap}>
        <LinearGradient colors={['#5A351C', '#130602']} style={styles.avatarRing}>
          <Text style={styles.avatarInitial}>{username.charAt(0).toUpperCase()}</Text>
        </LinearGradient>
        <View style={styles.levelBadge}>
          <Ionicons name="star" size={11} color="#FFF2A6" />
          <Text style={styles.levelText}>180</Text>
        </View>
      </View>

      <View style={styles.walletRow}>
        <CurrencyPill kind="coin" value={fmt(coins)} />
        <CurrencyPill kind="gem" value="0" />
      </View>

      <Pressable onPress={onSettings} style={styles.settingsBtn} hitSlop={8}>
        <Ionicons name="settings-sharp" size={24} color={colors.white} />
      </Pressable>
    </Animated.View>
  );
}

function CurrencyPill({ kind, value }: { kind: 'coin' | 'gem'; value: string }) {
  return (
    <View style={styles.currencyPill}>
      {kind === 'coin' ? (
        <CoinIcon size={34} />
      ) : (
        <LinearGradient colors={['#6CFF65', '#1AA83C']} style={styles.gemIcon}>
          <Ionicons name="diamond" size={18} color="#E8FFE8" />
        </LinearGradient>
      )}
      <Text style={styles.currencyText}>{value}</Text>
      <View style={styles.plusBubble}>
        <Ionicons name="add" size={14} color="#fff" />
      </View>
    </View>
  );
}

function CoinIcon({ size = 34 }: { size?: number }) {
  const inner = size * 0.74;
  return (
    <View style={[styles.coinIcon, { width: size, height: size, borderRadius: size / 2 }]}>
      <LinearGradient
        colors={['#FFF3A4', '#F6C531', '#B86E09']}
        start={{ x: 0.18, y: 0.08 }}
        end={{ x: 0.86, y: 0.92 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.coinIconInner,
          { width: inner, height: inner, borderRadius: inner / 2, left: (size - inner) / 2, top: (size - inner) / 2 },
        ]}
      />
      <View style={[styles.coinShine, { width: size * 0.28, height: size * 0.12, left: size * 0.2, top: size * 0.18 }]} />
    </View>
  );
}

function ModesHome({
  bottom,
  onMode,
  onReward,
  coins,
}: {
  bottom: number;
  onMode: (mode: ModeId) => void;
  onReward: () => void;
  coins: number;
}) {
  const large = MODES.filter((m) => m.size === 'large');
  const small = MODES.filter((m) => m.size === 'small');

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.modeScroll, { paddingBottom: bottom + 96 }]}
    >
      <Animated.View entering={FadeInDown.delay(80).duration(360)} style={styles.brandArea}>
        <Image source={Images.logo} style={styles.logoWatermark} resizeMode="contain" />
        <View style={styles.eventRow}>
          <QuickTile icon="play" label="Free" badge="6" onPress={onReward} />
          <QuickTile icon="shield" label="Mega Win" badge="2h" />
          <QuickTile icon="gift" label="Invite" badge="5" />
        </View>
        <LinearGradient
          colors={['#4B270C', '#171006']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.passBanner}
        >
          <View style={styles.passTrophy}>
            <Ionicons name="ribbon" size={42} color="#FFF1A4" />
          </View>
          <View style={styles.passCopy}>
            <Text style={styles.passTitle}>ELITE ROAD</Text>
            <Text style={styles.passSub}>Win clubs, unlock royal rewards</Text>
          </View>
          <View style={styles.passBtn}>
            <Text style={styles.passBtnText}>{fmt(coins)}</Text>
          </View>
        </LinearGradient>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(160).duration(360)} style={styles.largeGrid}>
        {large.map((mode) => (
          <ModeCard key={mode.id} mode={mode} onPress={() => onMode(mode.id)} />
        ))}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(220).duration(360)} style={styles.smallGrid}>
        {small.map((mode) => (
          <ModeCard key={mode.id} mode={mode} onPress={() => onMode(mode.id)} />
        ))}
      </Animated.View>
    </ScrollView>
  );
}

function QuickTile({
  icon,
  label,
  badge,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  badge: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.quickTile}>
      <Ionicons name={icon} size={28} color={colors.gold} />
      <Text style={styles.quickLabel}>{label}</Text>
      <View style={styles.redBadge}>
        <Text style={styles.redBadgeText}>{badge}</Text>
      </View>
    </Pressable>
  );
}

function ModeCard({ mode, onPress }: { mode: Mode; onPress: () => void }) {
  const isLarge = mode.size === 'large';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        isLarge ? styles.modeCardLarge : styles.modeCardSmall,
        pressed && { transform: [{ scale: 0.97 }] },
      ]}
    >
      <LinearGradient colors={mode.colors} style={StyleSheet.absoluteFill} />
      <View style={styles.modeGlow} />
      <View style={styles.modeTopSheen} />
      <ModeScene mode={mode} />
      {!isLarge && (
        <View style={styles.smallModeBadge}>
          <Ionicons name={mode.icon} size={22} color="#fff" />
        </View>
      )}
      <View style={isLarge ? styles.modeLabelPlateLarge : styles.modeLabelPlateSmall}>
        <Text style={isLarge ? styles.modeLabelLarge : styles.modeLabelSmall}>{mode.label}</Text>
        <Text style={styles.modeSub}>{mode.sub}</Text>
      </View>
    </Pressable>
  );
}

function ModeScene({ mode }: { mode: Mode }) {
  const large = mode.size === 'large';
  if (mode.id === '2p') {
    return (
      <View style={large ? styles.modeSceneLarge : styles.modeSceneSmall}>
        <Text style={large ? styles.modeNumberBig : styles.modeNumberSmall}>2</Text>
        <LudoPlate
          size={large ? 104 : 64}
          x={large ? 24 : 8}
          y={large ? 28 : 14}
          rotate="-8deg"
          colors={['#2F9BFF', '#3CC857', '#E64758', '#F5D245']}
        />
        <TokenDisc color="#2E9EFF" x={large ? 18 : 8} y={large ? 38 : 19} size={large ? 48 : 32} />
        <TokenDisc color="#E54558" x={large ? 96 : 54} y={large ? 38 : 20} size={large ? 48 : 32} />
        <DiceBlock x={large ? 60 : 34} y={large ? 78 : 45} size={large ? 54 : 36} value={2} />
      </View>
    );
  }
  if (mode.id === '4p') {
    return (
      <View style={large ? styles.modeSceneLarge : styles.modeSceneSmall}>
        <Text style={large ? styles.modeNumberBig : styles.modeNumberSmall}>4</Text>
        <LudoPlate
          size={large ? 108 : 66}
          x={large ? 22 : 8}
          y={large ? 34 : 18}
          rotate="-4deg"
          colors={['#2F9BFF', '#35C858', '#F4D33B', '#E9505E']}
        />
        <DiceBlock x={large ? 22 : 9} y={large ? 64 : 39} size={large ? 48 : 32} value={5} color="#37B5FF" />
        <DiceBlock x={large ? 76 : 43} y={large ? 54 : 30} size={large ? 58 : 38} value={4} color="#44C64A" />
        <DiceBlock x={large ? 126 : 72} y={large ? 80 : 49} size={large ? 46 : 30} value={3} color="#F4CE3A" />
      </View>
    );
  }
  return (
    <View style={styles.modeIconOrb}>
      <TokenDisc color="#F5CE3C" x={10} y={26} size={36} />
      <TokenDisc color="#4DD268" x={42} y={26} size={36} />
      <View style={styles.smallModeIconCenter}>
        <Ionicons name={mode.icon} size={28} color="#fff" />
      </View>
    </View>
  );
}

function LudoPlate({
  size,
  x,
  y,
  rotate,
  colors: plateColors,
}: {
  size: number;
  x: number;
  y: number;
  rotate: string;
  colors: [string, string, string, string];
}) {
  const half = size / 2;
  return (
    <View
      style={[
        styles.ludoPlate,
        {
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius: size * 0.13,
          transform: [{ rotate }],
        },
      ]}
    >
      <View style={styles.ludoPlateRow}>
        <View style={[styles.ludoPlateTile, { width: half, height: half, backgroundColor: plateColors[0] }]} />
        <View style={[styles.ludoPlateTile, { width: half, height: half, backgroundColor: plateColors[1] }]} />
      </View>
      <View style={styles.ludoPlateRow}>
        <View style={[styles.ludoPlateTile, { width: half, height: half, backgroundColor: plateColors[2] }]} />
        <View style={[styles.ludoPlateTile, { width: half, height: half, backgroundColor: plateColors[3] }]} />
      </View>
      <View style={styles.ludoPlateCenter} />
    </View>
  );
}

function TokenDisc({ color, x, y, size }: { color: string; x: number; y: number; size: number }) {
  return (
    <View style={[styles.tokenDisc, { left: x, top: y, width: size, height: size, borderRadius: size / 2 }]}>
      <LinearGradient colors={[color, '#371006']} style={StyleSheet.absoluteFill} />
      <Ionicons name="star" size={size * 0.42} color="#FFF6C8" />
    </View>
  );
}

function DiceBlock({
  x,
  y,
  size,
  value,
  color = '#F3F0E7',
}: {
  x: number;
  y: number;
  size: number;
  value: number;
  color?: string;
}) {
  const dots = diceDots(value);
  return (
    <View style={[styles.diceBlock, { left: x, top: y, width: size, height: size, borderRadius: size * 0.22, backgroundColor: color }]}>
      {dots.map((dot, i) => (
        <View
          key={i}
          style={[
            styles.diceDot,
            {
              left: dot[0] * size,
              top: dot[1] * size,
              width: size * 0.13,
              height: size * 0.13,
              borderRadius: size * 0.065,
            },
          ]}
        />
      ))}
    </View>
  );
}

function diceDots(value: number): [number, number][] {
  const map: Record<number, [number, number][]> = {
    1: [[0.43, 0.43]],
    2: [[0.24, 0.24], [0.62, 0.62]],
    3: [[0.22, 0.22], [0.43, 0.43], [0.64, 0.64]],
    4: [[0.22, 0.22], [0.64, 0.22], [0.22, 0.64], [0.64, 0.64]],
    5: [[0.22, 0.22], [0.64, 0.22], [0.43, 0.43], [0.22, 0.64], [0.64, 0.64]],
    6: [[0.22, 0.2], [0.64, 0.2], [0.22, 0.43], [0.64, 0.43], [0.22, 0.66], [0.64, 0.66]],
  };
  return map[value] ?? map[1];
}

function ClubMedal({ accentColor, crown }: { accentColor: string; crown: ImageSourcePropType }) {
  return (
    <View style={styles.clubMedal}>
      <View style={[styles.clubMedalGlow, { backgroundColor: `${accentColor}44` }]} />
      <Image source={crown} style={styles.clubCrownImage} resizeMode="contain" />
    </View>
  );
}

function ClubSlides({
  bottom,
  selectedMode,
  activeClub,
  scrollX,
  onBack,
  onPlay,
  onScroll,
  onMomentumEnd,
}: {
  bottom: number;
  selectedMode: ModeId;
  activeClub: number;
  scrollX: ReturnType<typeof useSharedValue<number>>;
  onBack: () => void;
  onPlay: () => void;
  onScroll: ReturnType<typeof useAnimatedScrollHandler>;
  onMomentumEnd: (event: any) => void;
}) {
  const mode = MODES.find((m) => m.id === selectedMode) ?? MODES[0];
  const activeCity = CITIES[activeClub];

  return (
    <View style={[styles.clubsRoot, { paddingBottom: bottom + (COMPACT_CLUB ? 6 : 68) }]}>
      <View style={styles.clubsTop}>
        <Pressable onPress={onBack} style={styles.roundClose}>
          <Ionicons name="chevron-back" size={24} color={colors.gold} />
        </Pressable>
        <View style={styles.modeTitleWrap}>
          <Ionicons name={mode.icon} size={COMPACT_CLUB ? 28 : 42} color={colors.gold} />
          <Text style={styles.modeTitle}>{mode.label.toUpperCase()}</Text>
        </View>
        <Pressable onPress={onBack} style={styles.roundCloseRed}>
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.ruleTabs}>
        {['CLASSIC', 'ARROW', 'BLITZ'].map((label, i) => (
          <View key={label} style={[styles.ruleTab, i === 0 && styles.ruleTabActive]}>
            <Ionicons
              name={i === 0 ? 'star' : i === 1 ? 'navigate' : 'flash'}
              size={COMPACT_CLUB ? 15 : 18}
              color={i === 0 ? colors.bg : colors.gold}
            />
            <Text style={[styles.ruleTabText, i === 0 && styles.ruleTabTextActive]}>{label}</Text>
          </View>
        ))}
      </View>

      <Animated.FlatList
        data={CITIES}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CLUB_W + CLUB_GAP}
        decelerationRate="fast"
        keyExtractor={(city) => city.id}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onMomentumEnd}
        contentContainerStyle={{ paddingHorizontal: SIDE_INSET - CLUB_GAP / 2 }}
        renderItem={({ item, index }) => (
          <ClubCard city={item} index={index} scrollX={scrollX} onPlay={onPlay} />
        )}
        style={styles.clubList}
      />

      <View style={styles.dots}>
        {CITIES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === activeClub
                ? [styles.dotActive, { backgroundColor: activeCity.accentColor }]
                : styles.dotIdle,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function ClubCard({
  city,
  index,
  scrollX,
  onPlay,
}: {
  city: City;
  index: number;
  scrollX: ReturnType<typeof useSharedValue<number>>;
  onPlay: () => void;
}) {
  const cardStyle = useAnimatedStyle(() => {
    const offset = index * (CLUB_W + CLUB_GAP);
    const dist = Math.abs(scrollX.value - offset);
    const scale = interpolate(dist, [0, CLUB_W + CLUB_GAP], [1, 0.88], Extrapolation.CLAMP);
    const translateY = interpolate(dist, [0, CLUB_W + CLUB_GAP], [0, 26], Extrapolation.CLAMP);
    const opacity = interpolate(dist, [0, CLUB_W + CLUB_GAP], [1, 0.55], Extrapolation.CLAMP);
    return { transform: [{ scale }, { translateY }], opacity };
  });

  return (
    <Pressable onPress={onPlay} style={{ width: CLUB_W, marginHorizontal: CLUB_GAP / 2 }}>
      <Animated.View style={[styles.clubCard, cardStyle]}>
        <Image source={city.background} style={styles.clubBgImage} resizeMode="cover" />
        <LinearGradient
          colors={[`${city.accentColor}22`, 'rgba(104,39,14,0.7)', 'rgba(17,5,4,0.96)']}
          locations={[0, 0.46, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.clubCardHighlight} />
        <View style={styles.clubCardInset} />
        <ClubMedal accentColor={city.accentColor} crown={city.crown} />
        <Text style={styles.clubName}>{city.name}</Text>
        <Text style={styles.clubSub}>{city.subtitle}</Text>

        <View style={styles.winShelf}>
          <View style={styles.prizeBlock}>
            <Text style={styles.winLabel}>WIN</Text>
            <View style={styles.prizeRow}>
              <CoinIcon size={COMPACT_CLUB ? 34 : 44} />
              <Text style={styles.prizeValue}>{fmt(city.prize)}</Text>
            </View>
          </View>
          <View style={styles.chestArt}>
            <PrizeChest />
          </View>
        </View>

        <View style={styles.clubPerks}>
          <View style={styles.perkPill}>
            <Ionicons name="star" size={COMPACT_CLUB ? 16 : 18} color={colors.gold} />
            <Text style={styles.perkText}>30</Text>
          </View>
          <View style={styles.perkPill}>
            <Ionicons name="diamond" size={COMPACT_CLUB ? 16 : 18} color="#78D8FF" />
            <Text style={styles.perkText}>34</Text>
          </View>
          <View style={styles.doubleTicket}>
            <Text style={styles.doubleText}>x2</Text>
          </View>
        </View>

        <View style={styles.cardBottomBlock}>
          <Pressable onPress={onPlay} style={styles.entryBtn}>
            <LinearGradient colors={['#7FEA21', '#32A010']} style={styles.entryGradient}>
              <View style={styles.entryGloss} />
              <CoinIcon size={COMPACT_CLUB ? 26 : 30} />
              <Text style={styles.entryText}>{fmt(city.entry)}</Text>
            </LinearGradient>
          </Pressable>

          <View style={styles.onlineRow}>
            <View style={[styles.onlineDot, { backgroundColor: city.accentColor }]} />
            <Text style={styles.onlineText}>{fmt(city.online)} online</Text>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

function PrizeChest() {
  return (
    <View style={styles.prizeChest}>
      <View style={styles.prizeChestLid}>
        <LinearGradient colors={['#79D7FF', '#2989C7']} style={StyleSheet.absoluteFill} />
      </View>
      <View style={styles.prizeChestBody}>
        <LinearGradient colors={['#48B8F0', '#176CA5']} style={StyleSheet.absoluteFill} />
        <View style={styles.prizeChestLock} />
      </View>
      <View style={styles.prizeChestBand} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080104' },
  bgTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16,2,6,0.82)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 8,
    gap: 12,
    zIndex: 5,
  },
  avatarWrap: {
    width: 88,
    height: 88,
    justifyContent: 'center',
  },
  avatarRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
  },
  levelBadge: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 12,
    backgroundColor: '#7D163F',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
  },
  levelText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  walletRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  currencyPill: {
    height: 38,
    minWidth: 92,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.36)',
    paddingLeft: 3,
    paddingRight: 12,
    gap: 5,
  },
  coinIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFF0A1',
    shadowColor: '#F8C83B',
    shadowOpacity: 0.55,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
  },
  coinIconInner: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(174,95,5,0.2)',
  },
  coinShine: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.7)',
    transform: [{ rotate: '-24deg' }],
  },
  gemIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#B8FFBB',
    transform: [{ rotate: '-10deg' }],
  },
  currencyText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  plusBubble: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#43C33C',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#C9FFD0',
  },
  settingsBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeScroll: {
    paddingHorizontal: 18,
    paddingTop: 6,
  },
  brandArea: {
    minHeight: 232,
    alignItems: 'center',
  },
  logoWatermark: {
    position: 'absolute',
    top: 64,
    width: 190,
    height: 190,
    opacity: 0.1,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    marginTop: 10,
  },
  quickTile: {
    width: 92,
    height: 82,
    borderRadius: 18,
    backgroundColor: 'rgba(212,175,55,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { color: '#fff', fontWeight: '900', marginTop: 3 },
  redBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    minWidth: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: '#E91B25',
    borderWidth: 2,
    borderColor: '#FFE2D5',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  redBadgeText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  passBanner: {
    width: '94%',
    minHeight: 82,
    marginTop: 28,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  passTrophy: {
    width: 66,
    height: 66,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212,175,55,0.16)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,236,158,0.45)',
    marginRight: 10,
  },
  passCopy: { flex: 1 },
  passTitle: { color: '#FFE37A', fontWeight: '900', fontSize: 22, letterSpacing: 1 },
  passSub: { color: 'rgba(255,255,255,0.7)', fontWeight: '700', fontSize: 12 },
  passBtn: {
    backgroundColor: '#72D01D',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
  passBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  largeGrid: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 18,
  },
  smallGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 14,
  },
  modeCardLarge: {
    flex: 1,
    height: 190,
    borderRadius: 20,
    borderWidth: 2.5,
    borderColor: 'rgba(255,231,121,0.72)',
    overflow: 'hidden',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 0,
    shadowColor: colors.gold,
    shadowOpacity: 0.38,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  modeCardSmall: {
    width: (W - 60) / 3,
    height: 138,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,230,120,0.34)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 0,
  },
  modeGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  modeTopSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '42%',
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  smallModeBadge: {
    position: 'absolute',
    top: 16,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeIconOrb: {
    position: 'absolute',
    top: 8,
    width: 92,
    height: 76,
  },
  modeSceneLarge: {
    position: 'absolute',
    top: 8,
    width: 174,
    height: 134,
  },
  modeSceneSmall: {
    position: 'absolute',
    top: 8,
    width: 96,
    height: 84,
  },
  ludoPlate: {
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#FFF0A0',
    backgroundColor: '#FBF5CC',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
  },
  ludoPlateRow: {
    flexDirection: 'row',
  },
  ludoPlateTile: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  ludoPlateCenter: {
    position: 'absolute',
    left: '37%',
    top: '37%',
    width: '26%',
    height: '26%',
    borderRadius: 5,
    backgroundColor: '#FFF4C6',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.18)',
  },
  tokenDisc: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFE974',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 4,
  },
  diceBlock: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.2)',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 5,
  },
  diceDot: {
    position: 'absolute',
    backgroundColor: '#160604',
  },
  modeNumberBig: {
    position: 'absolute',
    right: 0,
    top: 6,
    color: '#FFE45C',
    fontSize: 96,
    fontWeight: '900',
    opacity: 0.82,
    includeFontPadding: false,
    textShadowColor: '#7A1500',
    textShadowOffset: { width: 3, height: 4 },
    textShadowRadius: 0,
  },
  modeNumberSmall: {
    position: 'absolute',
    right: -4,
    top: -4,
    color: '#FFE45C',
    fontSize: 56,
    fontWeight: '900',
    opacity: 0.72,
    includeFontPadding: false,
    textShadowColor: '#7A1500',
    textShadowOffset: { width: 2, height: 3 },
    textShadowRadius: 0,
  },
  smallModeIconCenter: {
    position: 'absolute',
    left: 29,
    top: 36,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeLabelPlateLarge: {
    width: '100%',
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 12,
    backgroundColor: 'rgba(34,8,4,0.34)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.18)',
  },
  modeLabelPlateSmall: {
    width: '100%',
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 8,
    backgroundColor: 'rgba(28,7,4,0.28)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.14)',
  },
  modeLabelLarge: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 2,
  },
  modeLabelSmall: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  modeSub: { color: 'rgba(255,255,255,0.72)', fontWeight: '800', fontSize: 11 },
  clubsRoot: {
    flex: 1,
    paddingTop: COMPACT_CLUB ? 0 : 6,
  },
  clubsTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  roundClose: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.36)',
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundCloseRed: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#D9322E',
    borderWidth: 2,
    borderColor: '#FF9E84',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTitleWrap: { alignItems: 'center', gap: 4 },
  modeTitle: {
    color: '#F5B3DC',
    fontWeight: '900',
    fontSize: COMPACT_CLUB ? 18 : 22,
    letterSpacing: 1,
    textShadowColor: 'rgba(255,78,190,0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  ruleTabs: {
    alignSelf: 'center',
    marginTop: COMPACT_CLUB ? 6 : 16,
    flexDirection: 'row',
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    overflow: 'hidden',
  },
  ruleTab: {
    width: COMPACT_CLUB ? 88 : 96,
    height: COMPACT_CLUB ? 40 : 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  ruleTabActive: { backgroundColor: colors.gold },
  ruleTabText: { color: colors.gold, fontWeight: '900', fontSize: COMPACT_CLUB ? 10 : 12 },
  ruleTabTextActive: { color: colors.bg },
  clubList: {
    flexGrow: 0,
    marginTop: COMPACT_CLUB ? 7 : 16,
    height: CLUB_H + (COMPACT_CLUB ? 8 : 28),
  },
  clubCard: {
    width: CLUB_W,
    height: CLUB_H,
    borderRadius: COMPACT_CLUB ? 24 : 26,
    borderWidth: 2.5,
    borderColor: '#FFB27E',
    overflow: 'hidden',
    alignItems: 'center',
    backgroundColor: '#5B1A16',
    shadowColor: '#FFB27E',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 14,
  },
  clubBgImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: 0.42,
  },
  clubCardHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: COMPACT_CLUB ? 94 : 118,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  clubCardInset: {
    position: 'absolute',
    top: COMPACT_CLUB ? 8 : 10,
    left: COMPACT_CLUB ? 8 : 10,
    right: COMPACT_CLUB ? 8 : 10,
    bottom: COMPACT_CLUB ? 8 : 10,
    borderRadius: COMPACT_CLUB ? 18 : 20,
    borderWidth: 1,
    borderColor: 'rgba(255,232,172,0.16)',
  },
  clubMedal: {
    width: COMPACT_CLUB ? 124 : 142,
    height: COMPACT_CLUB ? 68 : 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: COMPACT_CLUB ? 8 : 9,
    marginBottom: COMPACT_CLUB ? -2 : -1,
    shadowColor: colors.gold,
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 10,
  },
  clubMedalGlow: {
    position: 'absolute',
    bottom: 2,
    width: COMPACT_CLUB ? 74 : 86,
    height: COMPACT_CLUB ? 32 : 38,
    borderRadius: COMPACT_CLUB ? 39 : 47,
    opacity: 0.65,
    shadowColor: colors.gold,
    shadowOpacity: 0.7,
    shadowRadius: 16,
  },
  clubCrownImage: {
    width: '100%',
    height: '100%',
  },
  clubName: {
    color: '#FFD1A5',
    fontWeight: '900',
    fontSize: COMPACT_CLUB ? 24 : 28,
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  clubSub: {
    color: 'rgba(255,255,255,0.68)',
    fontWeight: '800',
    letterSpacing: 1,
    fontSize: COMPACT_CLUB ? 10 : 11,
    marginTop: COMPACT_CLUB ? -1 : -2,
  },
  winShelf: {
    marginTop: COMPACT_CLUB ? 8 : 10,
    width: COMPACT_CLUB ? '80%' : '80%',
    height: COMPACT_CLUB ? 72 : 78,
    borderRadius: COMPACT_CLUB ? 16 : 18,
    backgroundColor: 'rgba(255,196,132,0.16)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  prizeBlock: { alignItems: 'center' },
  winLabel: { color: '#fff', fontWeight: '900', fontSize: COMPACT_CLUB ? 11 : 12, marginBottom: COMPACT_CLUB ? 3 : 5 },
  prizeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  prizeValue: { color: '#fff', fontSize: COMPACT_CLUB ? 22 : 24, fontWeight: '900' },
  chestArt: {
    width: COMPACT_CLUB ? 54 : 60,
    height: COMPACT_CLUB ? 54 : 60,
    borderRadius: COMPACT_CLUB ? 15 : 17,
    backgroundColor: 'rgba(45,147,204,0.22)',
    borderWidth: 1.5,
    borderColor: 'rgba(132,219,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prizeChest: {
    width: 48,
    height: 42,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  prizeChestLid: {
    position: 'absolute',
    top: 2,
    width: 38,
    height: 17,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderWidth: 2,
    borderColor: '#A8ECFF',
    overflow: 'hidden',
  },
  prizeChestBody: {
    width: 48,
    height: 28,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#A8ECFF',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prizeChestBand: {
    position: 'absolute',
    top: 12,
    width: 8,
    height: 30,
    borderRadius: 4,
    backgroundColor: '#F7BE43',
    borderWidth: 1,
    borderColor: '#FFE699',
  },
  prizeChestLock: {
    width: 12,
    height: 9,
    borderRadius: 3,
    backgroundColor: '#FFD76A',
    borderWidth: 1,
    borderColor: '#8A5C08',
  },
  clubPerks: {
    marginTop: COMPACT_CLUB ? 8 : 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  perkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minWidth: COMPACT_CLUB ? 56 : 64,
    borderRadius: COMPACT_CLUB ? 12 : 14,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: COMPACT_CLUB ? 8 : 10,
    paddingVertical: COMPACT_CLUB ? 5 : 7,
  },
  perkText: { color: '#fff', fontWeight: '900', fontSize: COMPACT_CLUB ? 13 : 14 },
  doubleTicket: {
    width: COMPACT_CLUB ? 50 : 56,
    height: COMPACT_CLUB ? 32 : 38,
    borderRadius: COMPACT_CLUB ? 12 : 12,
    backgroundColor: '#11B9EF',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-8deg' }],
    borderWidth: 2,
    borderColor: '#9EF1FF',
  },
  doubleText: { color: '#fff', fontWeight: '900', fontSize: COMPACT_CLUB ? 17 : 20 },
  cardBottomBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: COMPACT_CLUB ? 12 : 14,
    alignItems: 'center',
  },
  entryBtn: {
    marginBottom: COMPACT_CLUB ? 6 : 7,
    width: COMPACT_CLUB ? 164 : 188,
    height: COMPACT_CLUB ? 44 : 52,
    borderRadius: COMPACT_CLUB ? 15 : 18,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  entryGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  entryGloss: {
    position: 'absolute',
    top: 4,
    left: 12,
    right: 12,
    height: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  entryText: { color: '#fff', fontWeight: '900', fontSize: COMPACT_CLUB ? 20 : 24 },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 16,
  },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  onlineText: { color: 'rgba(255,255,255,0.72)', fontWeight: '800', fontSize: COMPACT_CLUB ? 11 : 12 },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 7,
    marginTop: COMPACT_CLUB ? 4 : 10,
  },
  dot: { borderRadius: 4 },
  dotActive: { width: 22, height: 7 },
  dotIdle: { width: 7, height: 7, backgroundColor: 'rgba(255,255,255,0.24)' },
});
