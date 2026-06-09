import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';

const TAB_ITEMS = [
  { key: 'shop', label: 'Shop', icon: 'cart' as const, route: '/shop' as const },
  { key: 'friends', label: 'Friends', icon: 'people' as const, route: '/profile' as const },
  { key: 'home', label: 'Home', icon: 'home' as const, route: '/home' as const, primary: true },
  { key: 'clubs', label: 'Clubs', icon: 'shield' as const, route: '/home' as const },
  { key: 'chest', label: 'Chest', icon: 'briefcase' as const, route: '/shop' as const },
] as const;

function EliteTabBar({ state }: BottomTabBarProps) {
  const router = useRouter();
  const currentRoute = state.routes[state.index]?.name;

  return (
    <View style={styles.tabShell}>
      {TAB_ITEMS.map((item) => {
        const isPrimary = item.key === 'home';
        const focused =
          (item.key === 'home' && currentRoute === 'home') ||
          (item.key === 'friends' && currentRoute === 'profile');

        return (
          <Pressable
            key={item.key}
            onPress={() => router.push(item.route as never)}
            style={[styles.tabItem, isPrimary && styles.homeItem]}
          >
            <View style={[styles.iconPlate, isPrimary && styles.homePlate]}>
              <View style={[styles.sparkle, styles.sparkleTop, focused && styles.sparkleActive]} />
              <View style={[styles.sparkle, styles.sparkleLeft, focused && styles.sparkleActive]} />
              <View style={[styles.sparkle, styles.sparkleRight, focused && styles.sparkleActive]} />
              <Ionicons
                name={item.icon}
                size={isPrimary ? 44 : 30}
                color={focused || isPrimary ? '#FFF1A4' : 'rgba(255,245,212,0.72)'}
              />
            </View>
            <Text style={[styles.tabLabel, (focused || isPrimary) && styles.tabLabelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <EliteTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.3)',
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          href: '/home',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: '/profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabShell: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 96,
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(9,5,2,0.98)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,225,135,0.42)',
    shadowColor: colors.gold,
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
  },
  tabItem: {
    flex: 1,
    height: 74,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  homeItem: {
    height: 104,
  },
  iconPlate: {
    width: 58,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homePlate: {
    width: 86,
    height: 78,
    marginBottom: 1,
  },
  tabLabel: {
    color: 'rgba(255,245,212,0.5)',
    fontFamily: fontFamilies.body,
    fontSize: 11,
    fontWeight: '400',
    marginTop: 2,
  },
  tabLabelActive: {
    color: '#FFF1A4',
    fontFamily: fontFamilies.heading,
    fontSize: 15,
    fontWeight: '400',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 2,
  },
  sparkle: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,225,135,0.55)',
    shadowColor: colors.gold,
    shadowOpacity: 0.7,
    shadowRadius: 5,
  },
  sparkleActive: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFF1A4',
  },
  sparkleTop: {
    top: 1,
    right: 14,
  },
  sparkleLeft: {
    left: 10,
    bottom: 9,
  },
  sparkleRight: {
    right: 8,
    bottom: 16,
  },
});
