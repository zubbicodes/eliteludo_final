import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LiquidGlassDock } from '@/src/skia/LiquidGlassDock';
import { fontFamilies } from '@/src/theme/typography';
import { haptics } from '@/src/utils/haptics';
import { sound } from '@/src/utils/sound';

const TAB_ITEMS = [
  { key: 'shop', label: 'Shop', icon: 'bag-handle' as const, route: '/shop' as const },
  { key: 'home', label: 'Home', icon: 'home' as const, route: '/home' as const },
  { key: 'profile', label: 'Profile', icon: 'person-circle' as const, route: '/profile' as const },
] as const;

function GlassTabItem({
  item,
  focused,
  onPress,
}: {
  item: (typeof TAB_ITEMS)[number];
  focused: boolean;
  onPress: () => void;
}) {
  const focus = useSharedValue(focused ? 1 : 0);
  const pressed = useSharedValue(0);
  const isHome = item.key === 'home';

  useEffect(() => {
    focus.value = withSpring(focused ? 1 : 0, { damping: 17, stiffness: 190 });
  }, [focus, focused]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: (isHome ? -3 : 0) - focus.value * 2 },
      { scale: (isHome ? 1.12 : 1) + focus.value * 0.06 - pressed.value * 0.07 },
    ],
  }));

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={item.label}
      onPress={onPress}
      onPressIn={() => {
        pressed.value = withSpring(1, { damping: 18, stiffness: 260 });
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, { damping: 16, stiffness: 220 });
      }}
      style={styles.tabHitArea}
    >
      <Animated.View style={[styles.tabContent, animatedStyle]}>
        <View style={styles.iconWrap}>
          <Ionicons
            name={focused ? item.icon : `${item.icon}-outline` as typeof item.icon}
            size={isHome ? (focused ? 29 : 27) : focused ? 24 : 22}
            color={focused ? '#FFF2AE' : 'rgba(255,247,221,0.6)'}
          />
        </View>
        <Text style={[styles.tabLabel, isHome && styles.homeLabel, focused && styles.tabLabelActive]}>
          {item.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function EliteTabBar({ state }: BottomTabBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const viewport = useWindowDimensions();
  const currentRoute = state.routes[state.index]?.name;
  const matchedIndex = TAB_ITEMS.findIndex((item) => item.key === currentRoute);
  const homeIndex = TAB_ITEMS.findIndex((item) => item.key === 'home');
  const activeIndex = matchedIndex >= 0 ? matchedIndex : homeIndex;
  const width = Math.min(viewport.width - 20, 520);
  const height = 76;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.tabShell,
        {
          width,
          height,
          bottom: Math.max(8, insets.bottom + 6),
          left: (viewport.width - width) / 2,
        },
      ]}
    >
      <View style={StyleSheet.absoluteFill}>
        <LiquidGlassDock
          width={width}
          height={height}
          activeIndex={activeIndex}
          itemCount={TAB_ITEMS.length}
        />
      </View>
      <View style={styles.tabRow}>
        {TAB_ITEMS.map((item, index) => {
          const focused = index === activeIndex;
          return (
            <GlassTabItem
              key={item.key}
              item={item}
              focused={focused}
              onPress={() => {
                haptics.tap();
                sound.play('tap');
                router.push(item.route as never);
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <EliteTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="home" options={{ href: '/home' }} />
      <Tabs.Screen name="shop" options={{ href: '/shop' }} />
      <Tabs.Screen name="profile" options={{ href: '/profile' }} />
      <Tabs.Screen name="friends" options={{ href: null }} />
      <Tabs.Screen name="clubs" options={{ href: null }} />
      <Tabs.Screen name="chest" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabShell: {
    position: 'absolute',
    zIndex: 30,
    borderRadius: 32,
    overflow: 'visible',
    boxShadow: '0 -8px 30px rgba(0,0,0,0.32)',
  },
  tabRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    paddingTop: 10,
    paddingBottom: 5,
    paddingHorizontal: 2,
  },
  tabHitArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconWrap: {
    width: 38,
    height: 31,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    color: 'rgba(255,247,221,0.5)',
    fontFamily: fontFamilies.body,
    fontSize: 9,
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    color: '#FFF0AA',
    fontFamily: fontFamilies.heading,
    fontSize: 10,
  },
  homeLabel: {
    fontSize: 10,
  },
});
