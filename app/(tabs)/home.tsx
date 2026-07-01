import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
    Alert,
    Dimensions,
    Image,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
    type ImageSourcePropType,
} from "react-native";
import Animated, {
    Extrapolation,
    FadeIn,
    FadeInDown,
    interpolate,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Images } from "@/src/assets";
import { CoinFlyAnimation } from "@/src/components/CoinFlyAnimation";
import { DailyRewardModal } from "@/src/components/DailyRewardModal";
import { BannerAd, BannerAdSize, homeBannerAdUnitId } from "@/src/services/ads";
import {
    HomeModeCanvas,
    RoyalAvatarIcon,
    RoyalCornerActionCanvas,
    RoyalCurrencyIcon,
    RoyalHomeBackdrop,
    RoyalSettingsIcon,
} from "@/src/skia/HomeArtwork";
import { OrnateTokenCanvas } from "@/src/skia/OrnateToken";
import { useProfileStore } from "@/src/stores/profile";
import { useWalletStore } from "@/src/stores/wallet";
import { colors } from "@/src/theme/colors";
import { fontFamilies } from "@/src/theme/typography";
import { haptics } from "@/src/utils/haptics";
import { sound } from "@/src/utils/sound";

const { width: W, height: H } = Dimensions.get("window");

const COMPACT_CLUB = H < 820 || W < 430;
const CLUB_W = Math.min(W - (COMPACT_CLUB ? 56 : 64), COMPACT_CLUB ? 318 : 326);
const CLUB_H = COMPACT_CLUB ? 348 : 386;
const CLUB_GAP = 18;
const SIDE_INSET = (W - CLUB_W) / 2;
const WORLD_CUP_END = new Date(2026, 6, 19);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type HomeView = "modes" | "clubs";
type ModeId = "2p" | "4p" | "private" | "friends" | "ai";
type OfflinePlayerCount = 2 | 3 | 4;
type Point = { x: number; y: number };

type Mode = {
  id: ModeId;
  label: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
  colors: [string, string];
  size: "large" | "small";
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
  {
    id: "2p",
    label: "2 Player",
    sub: "Classic duel",
    icon: "dice",
    colors: ["#F4BA22", "#A75A08"],
    size: "large",
  },
  {
    id: "4p",
    label: "4 Player",
    sub: "Royal table",
    icon: "people",
    colors: ["#8260DE", "#432A98"],
    size: "large",
  },
  {
    id: "private",
    label: "Private Table",
    sub: "Invite code",
    icon: "heart",
    colors: ["#7A4FD0", "#392070"],
    size: "small",
  },
  {
    id: "friends",
    label: "Team Up Friends",
    sub: "Party table",
    icon: "chatbubbles",
    colors: ["#7A4FD0", "#392070"],
    size: "small",
  },
  {
    id: "ai",
    label: "Offline",
    sub: "Vs computer",
    icon: "game-controller",
    colors: ["#4C8C55", "#1E572A"],
    size: "small",
  },
];

const CITIES: City[] = [
  {
    id: "newdelhi",
    name: "NEW DELHI",
    subtitle: "Starter Club",
    entry: 250,
    prize: 600,
    online: 12_560,
    accentColor: "#E06030",
    background: Images.cityNewDelhi,
    crown: Images.clubCrownEmerald,
  },
  {
    id: "london",
    name: "LONDON",
    subtitle: "Royal Club",
    entry: 500,
    prize: 1_000,
    online: 8_420,
    accentColor: "#4CAF50",
    background: Images.cityLondon,
    crown: Images.clubCrownRoyal,
  },
  {
    id: "istanbul",
    name: "ISTANBUL",
    subtitle: "Bosphorus Club",
    entry: 750,
    prize: 1_800,
    online: 7_890,
    accentColor: "#D4884A",
    background: Images.cityIstanbul,
    crown: Images.clubCrownDesert,
  },
  {
    id: "dubai",
    name: "DUBAI",
    subtitle: "Marina Elite",
    entry: 1_000,
    prize: 2_500,
    online: 6_234,
    accentColor: "#1A9ED4",
    background: Images.cityDubai,
    crown: Images.clubCrownRuby,
  },
  {
    id: "doha",
    name: "DOHA",
    subtitle: "Gulf Premier",
    entry: 1_500,
    prize: 4_000,
    online: 5_100,
    accentColor: "#D4AF37",
    background: Images.cityDoha,
    crown: Images.clubCrownRed,
  },
  {
    id: "singapore",
    name: "SINGAPORE",
    subtitle: "Marina Bay",
    entry: 2_000,
    prize: 5_000,
    online: 4_560,
    accentColor: "#0E9ABF",
    background: Images.citySingapore,
    crown: Images.clubCrownEmerald,
  },
  {
    id: "tokyo",
    name: "TOKYO",
    subtitle: "Sakura Grand",
    entry: 3_000,
    prize: 8_000,
    online: 3_120,
    accentColor: "#E05080",
    background: Images.cityTokyo,
    crown: Images.clubCrownRoyal,
  },
  {
    id: "paris",
    name: "PARIS",
    subtitle: "Eiffel Elite",
    entry: 5_000,
    prize: 12_000,
    online: 2_870,
    accentColor: "#9C6FD4",
    background: Images.cityParis,
    crown: Images.clubCrownRuby,
  },
  {
    id: "rome",
    name: "ROME",
    subtitle: "Colosseum VIP",
    entry: 7_500,
    prize: 20_000,
    online: 1_840,
    accentColor: "#D44A1A",
    background: Images.cityRome,
    crown: Images.clubCrownRed,
  },
  {
    id: "berlin",
    name: "BERLIN",
    subtitle: "Grand Master",
    entry: 10_000,
    prize: 30_000,
    online: 980,
    accentColor: "#4A9ED4",
    background: Images.cityBerlin,
    crown: Images.clubCrownDesert,
  },
];

function rewardErrorMessage(reason: string) {
  if (reason === "already_collected") {
    return "You already collected today's reward. Come back tomorrow for the next one.";
  }
  if (/collect_daily_reward_for_user|function/i.test(reason)) {
    return "Daily rewards are not deployed correctly yet. Apply the latest Supabase migration and redeploy the reward function.";
  }
  if (/unauthorized|jwt|session/i.test(reason)) {
    return "Your session expired. Please sign in again and try collecting the reward.";
  }
  if (/network|fetch|reach supabase|internet|dns/i.test(reason)) {
    return "Cannot reach Supabase. Check your connection and Supabase project URL.";
  }
  return reason;
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 1 : 0)}K`;
  return `${n}`;
}

function daysUntil(target: Date) {
  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const targetStart = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  );
  return Math.max(
    0,
    Math.round((targetStart.getTime() - todayStart.getTime()) / 86_400_000),
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const viewport = useWindowDimensions();
  const coins = useWalletStore((s) => s.coins);
  const hydrated = useWalletStore((s) => s.hydrated);
  const dailyStatus = useWalletStore((s) => s.dailyStatus);
  const hydrateWallet = useWalletStore((s) => s.hydrate);
  const refreshWallet = useWalletStore((s) => s.refresh);
  const claimDaily = useWalletStore((s) => s.claimDaily);
  const pendingClaim = useWalletStore((s) => s.pendingClaim);
  const profile = useProfileStore((s) => s.profile);
  const hydrateProfile = useProfileStore((s) => s.hydrate);

  const [view, setView] = useState<HomeView>("modes");
  const [offlinePickerOpen, setOfflinePickerOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<ModeId>("2p");
  const [activeClub, setActiveClub] = useState(0);
  const [rewardOpen, setRewardOpen] = useState(false);
  const [pendingDay, setPendingDay] = useState(1);
  const [dismissedRewardDay, setDismissedRewardDay] = useState<number | null>(
    null,
  );
  const [claiming, setClaiming] = useState(false);
  const [coinTarget, setCoinTarget] = useState<Point | null>(null);
  const [coinFlightStart, setCoinFlightStart] = useState<Point | null>(null);
  const [coinFlightId, setCoinFlightId] = useState<number | null>(null);
  const [eventDaysLeft, setEventDaysLeft] = useState(() =>
    daysUntil(WORLD_CUP_END),
  );
  const scrollX = useSharedValue(0);

  useEffect(() => {
    hydrateWallet();
    hydrateProfile();
  }, [hydrateWallet, hydrateProfile]);

  useEffect(() => {
    const timer = setInterval(() => {
      setEventDaysLeft(daysUntil(WORLD_CUP_END));
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!hydrated || rewardOpen) return;
    const p = pendingClaim();
    if (p && dismissedRewardDay !== p.day) {
      setPendingDay(p.day);
      setRewardOpen(true);
    }
  }, [
    dailyStatus?.canCollect,
    dailyStatus?.dayNumber,
    dismissedRewardDay,
    hydrated,
    pendingClaim,
    rewardOpen,
  ]);

  const openMode = useCallback(
    (mode: ModeId) => {
      haptics.tap();
      sound.play('tap');
      if (mode === "ai") {
        setOfflinePickerOpen(true);
        return;
      }
      if (mode === "private") {
        router.push("/game/private" as never);
        return;
      }
      setSelectedMode(mode);
      setView("clubs");
      setActiveClub(0);
    },
    [router],
  );

  const startOfflineGame = useCallback(
    (playerCount: OfflinePlayerCount) => {
      haptics.tap();
      sound.play('tap');
      setOfflinePickerOpen(false);
      router.push({
        pathname: "/game/new",
        params: { mode: `${playerCount}p` },
      } as never);
    },
    [router],
  );

  const playClub = useCallback(
    async (city: City) => {
      haptics.tap();
      sound.play('tap');
      if (selectedMode === "ai") {
        router.push({ pathname: "/game/new", params: { mode: "4p" } } as never);
        return;
      }
      await refreshWallet();
      const serverCoins = useWalletStore.getState().coins;
      if (serverCoins < city.entry) {
        Alert.alert(
          "Not enough coins",
          `This table needs ${city.entry.toLocaleString()} coins. Your current balance is ${serverCoins.toLocaleString()}.`,
        );
        return;
      }
      router.push({
        pathname: "/game/matchmaking",
        params: {
          mode: selectedMode,
          entryFee: String(city.entry),
          citySlug: city.id,
        },
      } as never);
    },
    [refreshWallet, router, selectedMode],
  );

  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  const onClubMomentumEnd = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / (CLUB_W + CLUB_GAP));
    setActiveClub(Math.max(0, Math.min(idx, CITIES.length - 1)));
  };

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}>
        <RoyalHomeBackdrop width={viewport.width} height={viewport.height} />
      </View>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Image
          source={Images.bgHome}
          resizeMode="cover"
          style={styles.homeTreeOverlay}
        />
      </View>

      <Header
        top={insets.top}
        coins={coins}
        username={profile?.username ?? "Player"}
        onProfile={() => {
          haptics.tap();
          sound.play('tap');
          router.push("/profile" as never);
        }}
        onSettings={() => {
          haptics.tap();
          sound.play('tap');
          router.push("/settings");
        }}
        onCoinTarget={setCoinTarget}
      />
      {view === "modes" ? (
        <>
          <HomeCornerRails
            top={insets.top}
            eventDaysLeft={eventDaysLeft}
            onReward={() => {
              const p = pendingClaim();
              if (!p) {
                Alert.alert(
                  "Reward already collected",
                  "Come back tomorrow for the next daily reward.",
                );
                return;
              }
              setPendingDay(p.day);
              setRewardOpen(true);
            }}
            onDiceSkins={() => {
            haptics.tap();
            sound.play('tap');
            router.push("/shop" as never);
          }}
          onShop={() => {
            haptics.tap();
            sound.play('tap');
            router.push("/shop" as never);
          }}
          />
          <ModesHome bottom={insets.bottom} onMode={openMode} />
        </>
      ) : (
        <ClubSlides
          bottom={insets.bottom}
          selectedMode={selectedMode}
          activeClub={activeClub}
          scrollX={scrollX}
          onBack={() => {
            haptics.tap();
            sound.play('tap');
            setView("modes");
          }}
          onPlay={playClub}
          onScroll={scrollHandler}
          onMomentumEnd={onClubMomentumEnd}
        />
      )}

      <DailyRewardModal
        visible={rewardOpen}
        pendingDay={pendingDay}
        onClaim={async (origin) => {
          if (claiming) return;
          setClaiming(true);
          const r = await claimDaily();
          if (r.success) {
            haptics.success();
            setDismissedRewardDay(r.day);
            setCoinFlightStart(origin);
            setRewardOpen(false);
            setCoinFlightId(Date.now());
          } else {
            Alert.alert("Reward not collected", rewardErrorMessage(r.reason));
          }
          setClaiming(false);
        }}
        onClose={() => {
          setDismissedRewardDay(pendingDay);
          setRewardOpen(false);
        }}
      />
      <OfflinePlayerPicker
        visible={offlinePickerOpen}
        onClose={() => setOfflinePickerOpen(false)}
        onSelect={startOfflineGame}
      />
      <View style={[styles.bannerAdWrap, { bottom: insets.bottom + 84 }]}>
        <BannerAd
          unitId={homeBannerAdUnitId}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        />
      </View>
      {coinFlightId !== null && (
        <CoinFlyAnimation
          id={coinFlightId}
          start={coinFlightStart ?? { x: viewport.width / 2, y: viewport.height * 0.6 }}
          end={coinTarget ?? { x: viewport.width / 2 - 42, y: insets.top + 22 }}
          onDone={() => {
            setCoinFlightId(null);
            setCoinFlightStart(null);
          }}
        />
      )}
    </View>
  );
}

function OfflinePlayerPicker({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (count: OfflinePlayerCount) => void;
}) {
  const handleClose = () => {
    sound.play('tap');
    onClose();
  };
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.offlineModalRoot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close offline game options"
          onPress={handleClose}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.offlinePanel}>
          <LinearGradient
            colors={["rgba(63,31,12,0.98)", "rgba(20,8,4,0.99)"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.offlinePanelInset} />
          <Pressable
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={10}
            style={styles.offlineClose}
          >
            <Ionicons name="close" size={20} color="#FFF1BE" />
          </Pressable>

          <Text style={styles.offlineEyebrow}>OFFLINE TABLE</Text>
          <Text style={styles.offlineTitle}>CHOOSE PLAYERS</Text>
          <Text style={styles.offlineSubtitle}>You’ll play against royal computer rivals.</Text>

          <View style={styles.offlineOptions}>
            {([2, 3, 4] as const).map((count) => (
              <Pressable
                key={count}
                onPress={() => onSelect(count)}
                accessibilityRole="button"
                accessibilityLabel={`${count} players, you and ${count - 1} computer ${count === 2 ? "opponent" : "opponents"}`}
                style={({ pressed }) => [
                  styles.offlineOption,
                  pressed && styles.offlineOptionPressed,
                ]}
              >
                <OfflineTokenCluster count={count} />
                <Text style={styles.offlineCount}>{count}</Text>
                <Text style={styles.offlinePlayersLabel}>PLAYERS</Text>
                <View style={styles.offlineBotPill}>
                  <Ionicons name="hardware-chip" size={11} color="#EACB6A" />
                  <Text style={styles.offlineBotText}>{count - 1} {count === 2 ? "BOT" : "BOTS"}</Text>
                </View>
              </Pressable>
            ))}
          </View>
          <Text style={styles.offlineHint}>No internet or coins required</Text>
        </View>
      </View>
    </Modal>
  );
}

function OfflineTokenCluster({ count }: { count: OfflinePlayerCount }) {
  const tokenSize = count === 4 ? 25 : 32;
  const overlap = count === 4 ? -10 : -8;

  return (
    <View style={styles.offlinePlayerGlyphs}>
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.offlineToken,
            {
              width: tokenSize,
              height: tokenSize,
              marginLeft: index === 0 ? 0 : overlap,
              zIndex: count - index,
            },
          ]}
        >
          <OrnateTokenCanvas
            color={(["red", "green", "yellow", "blue"] as const)[index]}
            size={tokenSize}
          />
        </View>
      ))}
    </View>
  );
}

function Header({
  top,
  coins,
  username,
  onProfile,
  onSettings,
  onCoinTarget,
}: {
  top: number;
  coins: number;
  username: string;
  onProfile: () => void;
  onSettings: () => void;
  onCoinTarget: (point: Point) => void;
}) {
  const coinRef = useRef<View>(null);
  const measureCoin = useCallback(() => {
    requestAnimationFrame(() => {
      coinRef.current?.measureInWindow((x, y, width, height) => {
        onCoinTarget({ x: x + width * 0.24, y: y + height * 0.5 });
      });
    });
  }, [onCoinTarget]);

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[styles.header, { marginTop: top + 4 }]}
      onLayout={measureCoin}
    >
      <Pressable
        onPress={onProfile}
        accessibilityRole="button"
        accessibilityLabel="Open profile"
        hitSlop={8}
        style={styles.avatarWrap}
      >
        <RoyalAvatarIcon initial={username.charAt(0).toUpperCase()} size={66} />
        <View style={styles.levelBadge}>
          <Ionicons name="star" size={11} color="#FFF2A6" />
          <Text style={styles.levelText}>180</Text>
        </View>
      </Pressable>

      <View style={styles.walletRow}>
        <CurrencyPill kind="coin" value={fmt(coins)} pillRef={coinRef} onLayout={measureCoin} />
        <CurrencyPill kind="gem" value="0" />
      </View>

      <Pressable onPress={onSettings} style={styles.settingsBtn} hitSlop={8}>
        <RoyalSettingsIcon size={36} />
      </Pressable>
    </Animated.View>
  );
}

function HomeCornerRails({
  top,
  eventDaysLeft,
  onReward,
  onDiceSkins,
  onShop,
}: {
  top: number;
  eventDaysLeft: number;
  onReward: () => void;
  onDiceSkins: () => void;
  onShop: () => void;
}) {
  return (
    <>
      <Animated.View
        entering={FadeInDown.delay(70).duration(320)}
        style={[styles.cornerRail, styles.leftRail, { top: top + 72 }]}
      >
        <CornerAction
          kind="video"
          label="Free"
          badge="Ad"
          onPress={onReward}
        />
        <CornerAction kind="dice" label="Dice" onPress={onDiceSkins} />
      </Animated.View>
      <Animated.View
        entering={FadeInDown.delay(110).duration(320)}
        style={[styles.cornerRail, styles.rightRail, { top: top + 72 }]}
      >
        <CornerAction kind="shop" label="Shop" onPress={onShop} />
        <CornerAction
          kind="event"
          label="World Cup"
          badge={`${eventDaysLeft}d`}
        />
      </Animated.View>
    </>
  );
}

function CornerAction({
  kind,
  label,
  badge,
  onPress,
}: {
  kind: "video" | "dice" | "shop" | "event";
  label: string;
  badge?: string;
  onPress?: () => void;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
      onPressIn={() => {
        scale.value = withSpring(0.94, { damping: 18, stiffness: 260 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 210 });
      }}
      style={[styles.cornerAction, animatedStyle]}
    >
      <RoyalCornerActionCanvas kind={kind} label={label} badge={badge} />
    </AnimatedPressable>
  );
}

function CurrencyPill({
  kind,
  value,
  pillRef,
  onLayout,
}: {
  kind: "coin" | "gem";
  value: string;
  pillRef?: RefObject<View | null>;
  onLayout?: () => void;
}) {
  return (
    <View ref={pillRef} onLayout={onLayout} style={styles.currencyPill}>
      {kind === "coin" ? (
        <View style={styles.coinPillEdge}>
          <RoyalCurrencyIcon kind="coin" size={36} />
        </View>
      ) : (
        <View style={styles.gemPillEdge}>
          <RoyalCurrencyIcon kind="gem" size={34} />
        </View>
      )}
      <Text style={styles.currencyText}>{value}</Text>
      <View style={styles.plusBubble}>
        <Ionicons name="add" size={14} color="#fff" />
      </View>
    </View>
  );
}

function ModesHome({
  bottom,
  onMode,
}: {
  bottom: number;
  onMode: (mode: ModeId) => void;
}) {
  const large = MODES.filter((m) => m.size === "large");
  const small = MODES.filter((m) => m.size === "small");

  return (
    <View style={[styles.modeScreen, { paddingBottom: bottom + 130 }]}>
      <View style={styles.cardStack}>
        <Animated.View
          entering={FadeInDown.delay(80).duration(360)}
          style={styles.royalBrand}
        >
          <Image
            source={require("../../assets/crowns/Crown9.png")}
            style={styles.brandCrown}
            resizeMode="cover"
          />
          <Text style={styles.brandName}>ELITE LUDO</Text>
          <Text style={styles.brandTag}>PLAY LIKE ROYALTY</Text>
        </Animated.View>
        <Animated.View
          entering={FadeInDown.delay(120).duration(360)}
          style={styles.largeGrid}
        >
          {large.map((mode) => (
            <ModeCard
              key={mode.id}
              mode={mode}
              onPress={() => onMode(mode.id)}
            />
          ))}
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(180).duration(360)}
          style={styles.smallGrid}
        >
          {small.map((mode) => (
            <ModeCard
              key={mode.id}
              mode={mode}
              onPress={() => onMode(mode.id)}
            />
          ))}
        </Animated.View>
      </View>
    </View>
  );
}

function ModeCard({ mode, onPress }: { mode: Mode; onPress: () => void }) {
  const isLarge = mode.size === "large";
  const artworkMode = mode.id === "ai" ? "offline" : mode.id;
  const scale = useSharedValue(1);
  const [layout, setLayout] = useState({
    width: isLarge ? 170 : 112,
    height: isLarge ? 172 : 112,
  });
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${mode.label}, ${mode.sub}`}
      onPressIn={() => {
        scale.value = withSpring(0.96, { damping: 18, stiffness: 260 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 210 });
      }}
      onLayout={(event) => setLayout(event.nativeEvent.layout)}
      style={[
        isLarge ? styles.modeCardLarge : styles.modeCardSmall,
        animatedStyle,
      ]}
    >
      <HomeModeCanvas
        width={layout.width}
        height={layout.height}
        mode={artworkMode}
      />
    </AnimatedPressable>
  );
}

function ClubMedal({
  accentColor,
  crown,
}: {
  accentColor: string;
  crown: ImageSourcePropType;
}) {
  return (
    <View style={styles.clubMedal}>
      <View
        style={[styles.clubMedalGlow, { backgroundColor: `${accentColor}44` }]}
      />
      <Image
        source={crown}
        style={styles.clubCrownImage}
        resizeMode="contain"
      />
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
  onPlay: (city: City) => void;
  onScroll: ReturnType<typeof useAnimatedScrollHandler>;
  onMomentumEnd: (event: any) => void;
}) {
  const mode = MODES.find((m) => m.id === selectedMode) ?? MODES[0];
  const activeCity = CITIES[activeClub];

  return (
    <View
      style={[
        styles.clubsRoot,
        { paddingBottom: bottom + (COMPACT_CLUB ? 6 : 68) },
      ]}
    >
      <View style={styles.clubsTop}>
        <Pressable onPress={onBack} style={styles.roundClose}>
          <Ionicons name="chevron-back" size={24} color={colors.gold} />
        </Pressable>
        <View style={styles.modeTitleWrap}>
          <Ionicons
            name={mode.icon}
            size={COMPACT_CLUB ? 28 : 42}
            color={colors.gold}
          />
          <Text style={styles.modeTitle}>{mode.label.toUpperCase()}</Text>
        </View>
        <Pressable onPress={onBack} style={styles.roundCloseRed}>
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.ruleTabs}>
        {["CLASSIC", "ARROW", "BLITZ"].map((label, i) => (
          <View
            key={label}
            style={[styles.ruleTab, i === 0 && styles.ruleTabActive]}
          >
            <Ionicons
              name={i === 0 ? "star" : i === 1 ? "navigate" : "flash"}
              size={COMPACT_CLUB ? 15 : 18}
              color={i === 0 ? colors.bg : colors.gold}
            />
            <Text
              style={[styles.ruleTabText, i === 0 && styles.ruleTabTextActive]}
            >
              {label}
            </Text>
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
          <ClubCard
            city={item}
            index={index}
            scrollX={scrollX}
            onPlay={onPlay}
          />
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
                ? [
                    styles.dotActive,
                    { backgroundColor: activeCity.accentColor },
                  ]
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
  onPlay: (city: City) => void;
}) {
  const cardStyle = useAnimatedStyle(() => {
    const offset = index * (CLUB_W + CLUB_GAP);
    const dist = Math.abs(scrollX.value - offset);
    const scale = interpolate(
      dist,
      [0, CLUB_W + CLUB_GAP],
      [1, 0.88],
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(
      dist,
      [0, CLUB_W + CLUB_GAP],
      [0, 26],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      dist,
      [0, CLUB_W + CLUB_GAP],
      [1, 0.55],
      Extrapolation.CLAMP,
    );
    return { transform: [{ scale }, { translateY }], opacity };
  });

  return (
    <Pressable
      onPress={() => onPlay(city)}
      style={{ width: CLUB_W, marginHorizontal: CLUB_GAP / 2 }}
    >
      <Animated.View style={[styles.clubCard, cardStyle]}>
        <Image
          source={city.background}
          style={styles.clubBgImage}
          resizeMode="cover"
        />
        <LinearGradient
          colors={[
            `${city.accentColor}22`,
            "rgba(104,39,14,0.7)",
            "rgba(17,5,4,0.96)",
          ]}
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
              <RoyalCurrencyIcon kind="coin" size={COMPACT_CLUB ? 34 : 44} />
              <Text style={styles.prizeValue}>{fmt(city.prize)}</Text>
            </View>
          </View>
          <View style={styles.chestArt}>
            <PrizeChest />
          </View>
        </View>

        <View style={styles.clubPerks}>
          <View style={styles.perkPill}>
            <Ionicons
              name="star"
              size={COMPACT_CLUB ? 16 : 18}
              color={colors.gold}
            />
            <Text style={styles.perkText}>30</Text>
          </View>
          <View style={styles.perkPill}>
            <Ionicons
              name="diamond"
              size={COMPACT_CLUB ? 16 : 18}
              color="#78D8FF"
            />
            <Text style={styles.perkText}>34</Text>
          </View>
          <View style={styles.doubleTicket}>
            <Text style={styles.doubleText}>x2</Text>
          </View>
        </View>

        <View style={styles.cardBottomBlock}>
          <Pressable onPress={() => onPlay(city)} style={styles.entryBtn}>
            <LinearGradient
              colors={["#7FEA21", "#32A010"]}
              style={styles.entryGradient}
            >
              <View style={styles.entryGloss} />
              <RoyalCurrencyIcon kind="coin" size={COMPACT_CLUB ? 26 : 30} />
              <Text style={styles.entryText}>{fmt(city.entry)}</Text>
            </LinearGradient>
          </Pressable>

          <View style={styles.onlineRow}>
            <View
              style={[styles.onlineDot, { backgroundColor: city.accentColor }]}
            />
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
        <LinearGradient
          colors={["#79D7FF", "#2989C7"]}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View style={styles.prizeChestBody}>
        <LinearGradient
          colors={["#48B8F0", "#176CA5"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.prizeChestLock} />
      </View>
      <View style={styles.prizeChestBand} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#080104" },
  homeTreeOverlay: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
    opacity: 0.5,
  },
  offlineModalRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    backgroundColor: "rgba(5,1,2,0.82)",
  },
  offlinePanel: {
    width: "100%",
    maxWidth: 390,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: "#D7AB43",
    overflow: "hidden",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 30,
    paddingBottom: 24,
    boxShadow: "0 18px 42px rgba(0, 0, 0, 0.7)",
  },
  offlinePanelInset: {
    ...StyleSheet.absoluteFillObject,
    margin: 6,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "rgba(255,230,151,0.2)",
  },
  offlineClose: {
    position: "absolute",
    top: 13,
    right: 13,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(122,25,28,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,184,139,0.58)",
    zIndex: 2,
  },
  offlineEyebrow: {
    color: "#D9B65C",
    fontFamily: fontFamilies.body,
    fontSize: 9,
    letterSpacing: 3.4,
  },
  offlineTitle: {
    color: "#FFF0B5",
    fontFamily: fontFamilies.heading,
    fontSize: COMPACT_CLUB ? 21 : 24,
    letterSpacing: 1.1,
    paddingTop: 7,
    textShadowColor: "rgba(226,175,55,0.42)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  offlineSubtitle: {
    color: "rgba(255,244,210,0.62)",
    fontFamily: fontFamilies.body,
    fontSize: 10,
    textAlign: "center",
    paddingTop: 7,
  },
  offlineOptions: {
    width: "100%",
    flexDirection: "row",
    gap: 8,
    paddingTop: 22,
  },
  offlineOption: {
    flex: 1,
    minWidth: 0,
    height: COMPACT_CLUB ? 146 : 158,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(225,181,73,0.55)",
    backgroundColor: "rgba(75,34,13,0.7)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
  },
  offlineOptionPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.96 }],
    backgroundColor: "rgba(116,65,20,0.82)",
  },
  offlinePlayerGlyphs: {
    height: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  offlineToken: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  offlineCount: {
    color: "#FFE47D",
    fontFamily: fontFamilies.heading,
    fontSize: 38,
    lineHeight: 43,
    paddingTop: 5,
  },
  offlinePlayersLabel: {
    color: "#FFF1C4",
    fontFamily: fontFamilies.heading,
    fontSize: 9,
    letterSpacing: 1,
  },
  offlineBotPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 4,
    marginTop: 9,
    backgroundColor: "rgba(4,2,1,0.42)",
  },
  offlineBotText: {
    color: "#EACB6A",
    fontFamily: fontFamilies.body,
    fontSize: 8,
    letterSpacing: 0.5,
  },
  offlineHint: {
    color: "rgba(255,243,205,0.42)",
    fontFamily: fontFamilies.body,
    fontSize: 9,
    letterSpacing: 0.8,
    paddingTop: 17,
  },
  bgTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(9,5,2,0.86)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 2,
    gap: 8,
    zIndex: 5,
  },
  avatarWrap: {
    width: 68,
    height: 68,
    justifyContent: "center",
  },
  levelBadge: {
    position: "absolute",
    left: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 10,
    backgroundColor: "#7D163F",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)",
  },
  levelText: {
    color: "#fff",
    fontFamily: fontFamilies.heading,
    fontWeight: "400",
    fontSize: 10,
  },
  walletRow: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
  },
  currencyPill: {
    height: 30,
    minWidth: 78,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(14,8,3,0.72)",
    borderWidth: 1,
    borderColor: "rgba(231,194,91,0.48)",
    paddingLeft: 2,
    paddingRight: 7,
    gap: 4,
  },
  currencyText: {
    color: "#FFF4CF",
    fontFamily: fontFamilies.heading,
    fontWeight: "400",
    fontSize: 13,
  },
  coinPillEdge: {
    width: 36,
    height: 36,
    marginLeft: -9,
    marginRight: -1,
    zIndex: 2,
    transform: [{ rotate: "-11deg" }, { scale: 1.05 }],
  },
  gemPillEdge: {
    width: 34,
    height: 34,
    marginLeft: -9,
    marginRight: -1,
    zIndex: 2,
    transform: [{ rotate: "-11deg" }, { scale: 1.05 }],
  },
  plusBubble: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: "#9A6A16",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#F9DB7A",
  },
  settingsBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  modeScreen: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 0,
    justifyContent: "flex-start",
  },
  cornerRail: {
    position: "absolute",
    gap: 8,
    zIndex: 4,
  },
  leftRail: {
    left: 7,
  },
  rightRail: {
    right: 7,
  },
  cornerAction: {
    width: COMPACT_CLUB ? 78 : 86,
    height: COMPACT_CLUB ? 78 : 84,
  },
  cardStack: {
    width: "100%",
    marginTop: "auto",
  },
  royalBrand: {
    width: 280,
    height: 122,
    opacity: 0.5,
    alignItems: "center",
    justifyContent: "flex-start",
    alignSelf: "center",
    marginBottom: COMPACT_CLUB ? 10 : 12,
    transform: [{ translateY: COMPACT_CLUB ? -16 : -20 }],
  },
  brandCrown: {
    width: 140,
    height: 86,
    opacity: 0.76,
    marginBottom: 2,
  },
  brandName: {
    color: "#F4D77B",
    fontFamily: fontFamilies.heading,
    fontSize: COMPACT_CLUB ? 24 : 27,
    letterSpacing: 3,
    lineHeight: COMPACT_CLUB ? 28 : 31,
    opacity: 0.74,
    textShadowColor: "rgba(217,169,62,0.42)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 7,
  },
  brandTag: {
    color: "#D1B66D",
    fontFamily: fontFamilies.body,
    fontSize: 8,
    letterSpacing: 3.2,
    opacity: 0.52,
  },
  logoWatermark: {
    position: "absolute",
    top: COMPACT_CLUB ? 46 : 58,
    width: COMPACT_CLUB ? 150 : 178,
    height: COMPACT_CLUB ? 150 : 178,
    opacity: 0.1,
  },
  largeGrid: {
    flexDirection: "row",
    gap: 10,
    marginTop: COMPACT_CLUB ? 8 : 12,
  },
  smallGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: COMPACT_CLUB ? 20 : 22,
    width: "100%",
    alignSelf: "stretch",
  },
  modeCardLarge: {
    flex: 1,
    height: COMPACT_CLUB ? 150 : 172,
    borderRadius: 14,
    borderWidth: 0,
    backgroundColor: "transparent",
    overflow: "hidden",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 0,
    shadowColor: colors.gold,
    shadowOpacity: 0.38,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  modeCardSmall: {
    flex: 1,
    minWidth: 0,
    height: COMPACT_CLUB ? 96 : 112,
    borderRadius: 12,
    borderWidth: 0,
    backgroundColor: "transparent",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 0,
  },
  modeCardImage: {
    width: "100%",
    height: "100%",
    transform: [{ scale: 1.08 }],
  },
  modeGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  modeTopSheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "42%",
    backgroundColor: "rgba(255,255,255,0.13)",
  },
  smallModeBadge: {
    position: "absolute",
    top: 16,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  modeIconOrb: {
    position: "absolute",
    top: 8,
    width: 92,
    height: 76,
  },
  modeSceneLarge: {
    position: "absolute",
    top: 8,
    width: 174,
    height: 134,
  },
  modeSceneSmall: {
    position: "absolute",
    top: 8,
    width: 96,
    height: 84,
  },
  ludoPlate: {
    position: "absolute",
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "#FFF0A0",
    backgroundColor: "#FBF5CC",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
  },
  ludoPlateRow: {
    flexDirection: "row",
  },
  ludoPlateTile: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
  },
  ludoPlateCenter: {
    position: "absolute",
    left: "37%",
    top: "37%",
    width: "26%",
    height: "26%",
    borderRadius: 5,
    backgroundColor: "#FFF4C6",
    borderWidth: 1.5,
    borderColor: "rgba(0,0,0,0.18)",
  },
  tokenDisc: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFE974",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 4,
  },
  diceBlock: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.2)",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 5,
  },
  diceDot: {
    position: "absolute",
    backgroundColor: "#160604",
  },
  modeNumberBig: {
    position: "absolute",
    right: 0,
    top: 6,
    color: "#FFE45C",
    fontFamily: fontFamilies.heading,
    fontSize: 96,
    fontWeight: "400",
    opacity: 0.82,
    includeFontPadding: false,
    textShadowColor: "#7A1500",
    textShadowOffset: { width: 3, height: 4 },
    textShadowRadius: 0,
  },
  modeNumberSmall: {
    position: "absolute",
    right: -4,
    top: -4,
    color: "#FFE45C",
    fontFamily: fontFamilies.heading,
    fontSize: 56,
    fontWeight: "400",
    opacity: 0.72,
    includeFontPadding: false,
    textShadowColor: "#7A1500",
    textShadowOffset: { width: 2, height: 3 },
    textShadowRadius: 0,
  },
  smallModeIconCenter: {
    position: "absolute",
    left: 29,
    top: 36,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  modeLabelPlateLarge: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    minHeight: 49,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 5,
    backgroundColor: "rgba(5,5,4,0.78)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.18)",
  },
  modeLabelPlateSmall: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    minHeight: COMPACT_CLUB ? 38 : 42,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 8,
    backgroundColor: "rgba(5,5,4,0.78)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.14)",
  },
  modeLabelLarge: {
    color: "#F8E5A1",
    fontFamily: fontFamilies.heading,
    fontSize: 20,
    fontWeight: "400",
    textShadowColor: "rgba(0,0,0,0.75)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 2,
  },
  modeLabelSmall: {
    color: "#F8E5A1",
    fontFamily: fontFamilies.heading,
    fontSize: COMPACT_CLUB ? 11 : 12,
    fontWeight: "400",
    textAlign: "center",
    lineHeight: COMPACT_CLUB ? 13 : 15,
    textShadowColor: "rgba(0,0,0,0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  modeSub: {
    color: "rgba(255,255,255,0.72)",
    fontFamily: fontFamilies.body,
    fontWeight: "400",
    fontSize: 11,
  },
  modeSubLabel: {
    color: "rgba(255,255,255,0.48)",
    fontFamily: fontFamilies.body,
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  clubsRoot: {
    flex: 1,
    paddingTop: COMPACT_CLUB ? 0 : 6,
  },
  clubsTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
  },
  roundClose: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.36)",
    borderWidth: 1.5,
    borderColor: "rgba(212,175,55,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  roundCloseRed: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#D9322E",
    borderWidth: 2,
    borderColor: "#FF9E84",
    alignItems: "center",
    justifyContent: "center",
  },
  modeTitleWrap: { alignItems: "center", gap: 4 },
  modeTitle: {
    color: "#F5B3DC",
    fontFamily: fontFamilies.heading,
    fontWeight: "400",
    fontSize: COMPACT_CLUB ? 18 : 22,
    letterSpacing: 1,
    textShadowColor: "rgba(255,78,190,0.45)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  ruleTabs: {
    alignSelf: "center",
    marginTop: COMPACT_CLUB ? 6 : 16,
    flexDirection: "row",
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.2)",
    overflow: "hidden",
  },
  ruleTab: {
    width: COMPACT_CLUB ? 88 : 96,
    height: COMPACT_CLUB ? 40 : 58,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  ruleTabActive: { backgroundColor: colors.gold },
  ruleTabText: {
    color: colors.gold,
    fontFamily: fontFamilies.heading,
    fontWeight: "400",
    fontSize: COMPACT_CLUB ? 10 : 12,
  },
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
    borderColor: "#FFB27E",
    overflow: "hidden",
    alignItems: "center",
    backgroundColor: "#5B1A16",
    shadowColor: "#FFB27E",
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 14,
  },
  clubBgImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
    opacity: 0.42,
  },
  clubCardHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: COMPACT_CLUB ? 94 : 118,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  clubCardInset: {
    position: "absolute",
    top: COMPACT_CLUB ? 8 : 10,
    left: COMPACT_CLUB ? 8 : 10,
    right: COMPACT_CLUB ? 8 : 10,
    bottom: COMPACT_CLUB ? 8 : 10,
    borderRadius: COMPACT_CLUB ? 18 : 20,
    borderWidth: 1,
    borderColor: "rgba(255,232,172,0.16)",
  },
  clubMedal: {
    width: COMPACT_CLUB ? 124 : 142,
    height: COMPACT_CLUB ? 68 : 80,
    alignItems: "center",
    justifyContent: "center",
    marginTop: COMPACT_CLUB ? 8 : 9,
    marginBottom: COMPACT_CLUB ? -2 : -1,
    shadowColor: colors.gold,
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 10,
  },
  clubMedalGlow: {
    position: "absolute",
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
    width: "100%",
    height: "100%",
  },
  clubName: {
    color: "#FFD1A5",
    fontFamily: fontFamilies.heading,
    fontWeight: "400",
    fontSize: COMPACT_CLUB ? 24 : 28,
    letterSpacing: 1,
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  clubSub: {
    color: "rgba(255,255,255,0.68)",
    fontFamily: fontFamilies.body,
    fontWeight: "400",
    letterSpacing: 1,
    fontSize: COMPACT_CLUB ? 10 : 11,
    marginTop: COMPACT_CLUB ? -1 : -2,
  },
  winShelf: {
    marginTop: COMPACT_CLUB ? 8 : 10,
    width: COMPACT_CLUB ? "80%" : "80%",
    height: COMPACT_CLUB ? 72 : 78,
    borderRadius: COMPACT_CLUB ? 16 : 18,
    backgroundColor: "rgba(255,196,132,0.16)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  prizeBlock: { alignItems: "center" },
  winLabel: {
    color: "#fff",
    fontFamily: fontFamilies.heading,
    fontWeight: "400",
    fontSize: COMPACT_CLUB ? 11 : 12,
    marginBottom: COMPACT_CLUB ? 3 : 5,
  },
  prizeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  prizeValue: {
    color: "#fff",
    fontFamily: fontFamilies.heading,
    fontWeight: "400",
    fontSize: COMPACT_CLUB ? 22 : 24,
  },
  chestArt: {
    width: COMPACT_CLUB ? 54 : 60,
    height: COMPACT_CLUB ? 54 : 60,
    borderRadius: COMPACT_CLUB ? 15 : 17,
    backgroundColor: "rgba(45,147,204,0.22)",
    borderWidth: 1.5,
    borderColor: "rgba(132,219,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  prizeChest: {
    width: 48,
    height: 42,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  prizeChestLid: {
    position: "absolute",
    top: 2,
    width: 38,
    height: 17,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderWidth: 2,
    borderColor: "#A8ECFF",
    overflow: "hidden",
  },
  prizeChestBody: {
    width: 48,
    height: 28,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#A8ECFF",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  prizeChestBand: {
    position: "absolute",
    top: 12,
    width: 8,
    height: 30,
    borderRadius: 4,
    backgroundColor: "#F7BE43",
    borderWidth: 1,
    borderColor: "#FFE699",
  },
  prizeChestLock: {
    width: 12,
    height: 9,
    borderRadius: 3,
    backgroundColor: "#FFD76A",
    borderWidth: 1,
    borderColor: "#8A5C08",
  },
  clubPerks: {
    marginTop: COMPACT_CLUB ? 8 : 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  perkPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minWidth: COMPACT_CLUB ? 56 : 64,
    borderRadius: COMPACT_CLUB ? 12 : 14,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: COMPACT_CLUB ? 8 : 10,
    paddingVertical: COMPACT_CLUB ? 5 : 7,
  },
  perkText: {
    color: "#fff",
    fontFamily: fontFamilies.heading,
    fontWeight: "400",
    fontSize: COMPACT_CLUB ? 13 : 14,
  },
  doubleTicket: {
    width: COMPACT_CLUB ? 50 : 56,
    height: COMPACT_CLUB ? 32 : 38,
    borderRadius: COMPACT_CLUB ? 12 : 12,
    backgroundColor: "#11B9EF",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-8deg" }],
    borderWidth: 2,
    borderColor: "#9EF1FF",
  },
  doubleText: {
    color: "#fff",
    fontFamily: fontFamilies.heading,
    fontWeight: "400",
    fontSize: COMPACT_CLUB ? 17 : 20,
  },
  cardBottomBlock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: COMPACT_CLUB ? 12 : 14,
    alignItems: "center",
  },
  entryBtn: {
    marginBottom: COMPACT_CLUB ? 6 : 7,
    width: COMPACT_CLUB ? 164 : 188,
    height: COMPACT_CLUB ? 44 : 52,
    borderRadius: COMPACT_CLUB ? 15 : 18,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.28)",
  },
  entryGradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  entryGloss: {
    position: "absolute",
    top: 4,
    left: 12,
    right: 12,
    height: 16,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  entryText: {
    color: "#fff",
    fontFamily: fontFamilies.heading,
    fontWeight: "400",
    fontSize: COMPACT_CLUB ? 20 : 24,
  },
  onlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 16,
  },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  onlineText: {
    color: "rgba(255,255,255,0.72)",
    fontFamily: fontFamilies.body,
    fontWeight: "400",
    fontSize: COMPACT_CLUB ? 11 : 12,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 7,
    marginTop: COMPACT_CLUB ? 4 : 10,
  },
  dot: { borderRadius: 4 },
  dotActive: { width: 22, height: 7 },
  dotIdle: { width: 7, height: 7, backgroundColor: "rgba(255,255,255,0.24)" },
  bannerAdWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
});
