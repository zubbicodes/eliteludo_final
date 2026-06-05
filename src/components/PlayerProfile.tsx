// Ornate in-match player plaque. The board screen is the place where the game
// needs to feel like a premium Ludo table, so this component leans into gold
// trim, leather tones, visible token stacks, and a compact last-roll die.

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { Images } from '@/src/assets';
import { tokensFinished } from '@/src/game/rules';
import type { Player } from '@/src/game/types';
import { colors } from '@/src/theme/colors';

const PLAYER_HEX: Record<string, string> = {
  red: colors.red,
  green: colors.green,
  yellow: colors.yellow,
  blue: colors.blue,
};

const TOKEN_IMAGE: Record<string, ImageSourcePropType> = {
  red: Images.tokenRed,
  green: Images.tokenGreen,
  yellow: Images.tokenYellow,
  blue: Images.tokenBlue,
};

type Props = {
  player: Player;
  isActive: boolean;
  /** Most-recent die rolled by this player, or null if they haven't rolled yet. */
  lastRoll: number | null;
  align: 'left' | 'right';
};

export function PlayerProfile({ player, isActive, lastRoll, align }: Props) {
  const tint = PLAYER_HEX[player.color];
  const finished = tokensFinished(player);

  return (
    <View
      style={[
        styles.card,
        align === 'right' && styles.alignRight,
        isActive && styles.cardActive,
      ]}
    >
      <LinearGradient
        colors={isActive ? ['#5A351C', '#241006'] : ['#2B1710', '#120806']}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.goldEdge, align === 'right' && styles.goldEdgeRight]} />

      <View style={[styles.avatarFrame, { borderColor: isActive ? colors.gold : '#7A5428' }]}>
        <LinearGradient colors={[tint, '#210B06']} style={styles.avatar}>
          <Text style={styles.avatarText}>{player.name.charAt(0)}</Text>
        </LinearGradient>
      </View>

      <View style={[styles.body, align === 'right' && styles.bodyRight]}>
        <Text style={styles.name} numberOfLines={1}>
          {player.name}
        </Text>
        <View style={[styles.tokenStack, align === 'right' && styles.tokenStackRight]}>
          {player.tokens.map((token) => (
            <View
              key={token.id}
              style={[
                styles.stackSlot,
                token.location.kind === 'finished' && styles.stackSlotFinished,
              ]}
            >
              <Image
                source={TOKEN_IMAGE[player.color]}
                style={styles.stackTokenGhost}
                resizeMode="contain"
              />
            </View>
          ))}
        </View>
        <Text style={[styles.meta, isActive && { color: colors.goldLight }]}>
          {finished}/4 home
        </Text>
      </View>

      <MiniDie value={lastRoll} faded={!isActive} tint={tint} />
      {isActive && (
        <View style={styles.activeCrown}>
          <Ionicons name="diamond" size={8} color={colors.bg} />
        </View>
      )}
    </View>
  );
}

function MiniDie({
  value,
  faded,
  tint,
}: {
  value: number | null;
  faded: boolean;
  tint: string;
}) {
  return (
    <View
      style={[
        styles.die,
        { borderColor: faded ? '#62401F' : tint, opacity: faded ? 0.65 : 1 },
      ]}
    >
      <Text style={styles.dieText}>{value ?? '-'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 70,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#7A5428',
    paddingVertical: 8,
    paddingHorizontal: 9,
    flex: 1,
    shadowColor: colors.gold,
    shadowOpacity: 0,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
    overflow: 'hidden',
  },
  alignRight: { flexDirection: 'row-reverse' },
  cardActive: {
    borderColor: colors.gold,
    shadowOpacity: 0.5,
    elevation: 12,
  },
  goldEdge: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.gold,
  },
  goldEdgeRight: {
    left: undefined,
    right: 0,
  },
  avatarFrame: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    padding: 2,
    backgroundColor: '#130802',
  },
  avatar: {
    flex: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.text, fontWeight: '900', fontSize: 16 },
  body: { flex: 1, gap: 3 },
  bodyRight: { alignItems: 'flex-end' },
  name: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  tokenStack: {
    flexDirection: 'row',
    gap: 3,
  },
  tokenStackRight: {
    flexDirection: 'row-reverse',
  },
  stackSlot: {
    width: 13,
    height: 13,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.38)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackSlotFinished: {
    backgroundColor: 'rgba(212,175,55,0.28)',
    borderColor: colors.gold,
  },
  stackTokenGhost: {
    width: 10,
    height: 10,
    opacity: 0.65,
  },
  meta: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  die: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1.5,
    backgroundColor: '#F4D86A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dieText: { color: '#190B02', fontWeight: '900', fontSize: 14 },
  activeCrown: {
    position: 'absolute',
    top: -1,
    alignSelf: 'center',
    width: 18,
    height: 14,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
