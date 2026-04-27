import { useRouter } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/theme/colors';
import { useEffect } from 'react';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

const GAME_MODES = [
  { id: '1v1', title: 'Play 1 on 1', icon: 'people', color: colors.gold },
  { id: '4player', title: '4 Player', icon: 'people-circle', color: colors.green },
  { id: 'vs-ai', title: 'Vs Computer', icon: 'desktop', color: colors.red },
  { id: 'private', title: 'Private Room', icon: 'key', color: colors.blue },
];

export default function HomeScreen() {
  const router = useRouter();

  const startGame = (mode: string) => {
    if (mode === 'vs-ai') {
      router.push('/game/new');
    } else {
      router.push('/game/matchmaking');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.settingsBtn}>
          <Ionicons name="settings-outline" size={24} color={colors.gold} />
        </TouchableOpacity>
        <View style={styles.coinsContainer}>
          <Ionicons name="logo-bitcoin" size={20} color={colors.gold} />
          <Text style={styles.coinsText}>1,000</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Animated.View entering={FadeIn.delay(200).duration(500)} style={styles.logoContainer}>
          <Text style={styles.logoText}>ELITE</Text>
          <Text style={styles.logoSubtext}>LUDO</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(500)} style={styles.modesContainer}>
          <Text style={styles.sectionTitle}>Choose Game Mode</Text>
          {GAME_MODES.map((mode, index) => (
            <TouchableOpacity
              key={mode.id}
              style={[styles.modeCard, { borderColor: mode.color }]}
              onPress={() => startGame(mode.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: mode.color }]}>
                <Ionicons name={mode.icon as any} size={28} color={colors.bg} />
              </View>
              <Text style={styles.modeTitle}>{mode.title}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.gray} />
            </TouchableOpacity>
          ))}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  settingsBtn: {
    padding: 8,
  },
  coinsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  coinsText: {
    color: colors.gold,
    fontWeight: 'bold',
    marginLeft: 6,
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  logoContainer: {
    alignItems: 'center',
    marginVertical: 30,
  },
  logoText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.gold,
    letterSpacing: 8,
  },
  logoSubtext: {
    fontSize: 32,
    fontWeight: '300',
    color: colors.gold,
    letterSpacing: 4,
  },
  modesContainer: {
    marginTop: 20,
  },
  sectionTitle: {
    color: colors.gray,
    fontSize: 14,
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modeTitle: {
    flex: 1,
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
});