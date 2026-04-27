// Compact player profile card. Shows avatar, name, finished-token count, and
// the player's last-rolled die. The active player gets a gold ring and glow.

import { StyleSheet, Text, View } from 'react-native';

import { tokensFinished } from '@/src/game/rules';
import type { Player } from '@/src/game/types';
import { colors } from '@/src/theme/colors';
import { radius, spacing, typography } from '@/src/theme/typography';

const PLAYER_HEX: Record<string, string> = {
  red: colors.red,
  green: colors.green,
  yellow: colors.yellow,
  blue: colors.blue,
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
        isActive && { borderColor: colors.gold, shadowOpacity: 0.55 },
      ]}
    >
      <View
        style={[
          styles.avatar,
          { backgroundColor: tint, borderColor: isActive ? colors.gold : 'rgba(255,255,255,0.15)' },
        ]}
      >
        <Text style={styles.avatarText}>{player.name.charAt(0)}</Text>
      </View>
      <View style={[styles.body, align === 'right' && styles.bodyRight]}>
        <Text style={styles.name} numberOfLines={1}>
          {player.name}
        </Text>
        <Text style={styles.meta}>
          {finished}/4 home {isActive ? '· playing' : ''}
        </Text>
      </View>
      <MiniDie value={lastRoll} faded={!isActive} tint={tint} />
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
        { borderColor: tint, opacity: faded ? 0.45 : 1 },
      ]}
    >
      <Text style={styles.dieText}>{value ?? '–'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    flex: 1,
    shadowColor: colors.gold,
    shadowOpacity: 0,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  alignRight: { flexDirection: 'row-reverse' },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.text, fontWeight: '800', fontSize: 14 },
  body: { flex: 1 },
  bodyRight: { alignItems: 'flex-end' },
  name: { ...typography.caption, color: colors.text, fontWeight: '700' },
  meta: { fontSize: 11, color: colors.textMuted },
  die: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 1.5,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dieText: { color: colors.text, fontWeight: '700', fontSize: 13 },
});
