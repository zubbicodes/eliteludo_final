import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import {
    Image,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
    type ImageSourcePropType,
} from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { getAvatar } from '@/src/constants/profile';
import type { Player } from '@/src/game/types';
import { Dice } from '@/src/skia/Dice';
import type { Profile } from '@/src/stores/profile';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';

import { PLAYER_HEX } from './helpers';

export type DiceHudProps = {
  dicePool: number[];
  displayRoll: number | null;
  isRolling: boolean;
  canRoll: boolean;
  onRoll: () => void;
  timerProgress: SharedValue<number> | null;
};

type Props = {
  showTopHud?: boolean;
  gems: number;
  matchId: string;
  boardSize: number;
  localPlayer?: Player;
  cornerPlayers: { corner: 'topLeft' | 'topRight' | 'bottomRight'; player: Player }[];
  currentPlayerColor: Player['color'];
  lastRollByColor: Partial<Record<Player['color'], number>>;
  activeDiceProps: DiceHudProps;
  canUndo: boolean;
  menuOpen: boolean;
  statsPlayer: Player | null;
  localProfile: Profile | null;
  online: boolean;
  onExit: () => void;
  onCloseMenu: () => void;
  onQuit: () => void;
  onOpenStats: (player: Player | null) => void;
  onCloseStats: () => void;
};

export const GameHud = memo(function GameHud({
  showTopHud = true,
  gems,
  matchId,
  boardSize,
  localPlayer,
  cornerPlayers,
  currentPlayerColor,
  lastRollByColor,
  activeDiceProps,
  canUndo,
  menuOpen,
  statsPlayer,
  localProfile,
  online,
  onExit,
  onCloseMenu,
  onQuit,
  onOpenStats,
  onCloseStats,
}: Props) {
  return (
    <>
      {showTopHud && <TopHud gems={gems} matchId={matchId} onExit={onExit} />}
      <View style={[styles.opponentLayer, { width: boardSize, height: boardSize }]} pointerEvents="box-none">
        {cornerPlayers.map(({ corner, player }) => {
          const playerDice = currentPlayerColor === player.color ? activeDiceProps : null;
          return (
            <CornerSeat
              key={player.color}
              corner={corner}
              player={player}
              active={currentPlayerColor === player.color}
              lastRoll={lastRollByColor[player.color] ?? null}
              dice={playerDice}
              onProfilePress={() => onOpenStats(player)}
            />
          );
        })}
      </View>
      <LocalCommandBar
        player={localPlayer}
        active={!!localPlayer && currentPlayerColor === localPlayer.color}
        lastRoll={localPlayer ? lastRollByColor[localPlayer.color] ?? null : null}
        dice={localPlayer && currentPlayerColor === localPlayer.color ? activeDiceProps : null}
        canUndo={canUndo}
        onProfilePress={() => onOpenStats(localPlayer ?? null)}
      />
      {statsPlayer && (
        <PlayerStatsModal
          player={statsPlayer}
          profile={statsPlayer.color === localPlayer?.color ? localProfile : null}
          onClose={onCloseStats}
        />
      )}
      <GameMenuModal
        visible={menuOpen}
        online={online}
        onResume={onCloseMenu}
        onQuit={onQuit}
      />
    </>
  );
});

export function TopHud({
  gems,
  matchId,
  onExit,
}: {
  gems: number;
  matchId: string;
  onExit: () => void;
}) {
  return (
    <View style={styles.topHud}>
      <View style={styles.topButtons}>
        <HudButton icon="menu" onPress={onExit} />
        <HudButton icon="people" />
        <HudButton icon="trophy" label="WIN" />
      </View>
      <View style={styles.resources}>
        <ResourcePill icon="flash" value="2" />
        <ResourcePill icon="diamond" value={gems.toLocaleString()} plus />
      </View>
      <Text style={styles.matchChip}>#{matchId.slice(-6)}</Text>
    </View>
  );
}

function HudButton({
  icon,
  label,
  badge,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label?: string;
  badge?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.hudButton, pressed && { opacity: 0.78 }]}>
      <Ionicons name={icon} size={24} color="rgba(255,255,255,0.82)" />
      {label && <Text style={styles.hudButtonLabel}>{label}</Text>}
      {badge && (
        <View style={styles.hudBadge}>
          <Text style={styles.hudBadgeText}>{badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

function ResourcePill({
  icon,
  image,
  value,
  plus,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  image?: ImageSourcePropType;
  value: string;
  plus?: boolean;
}) {
  return (
    <View style={styles.resourcePill}>
      {image ? (
        <Image source={image} style={styles.resourceImage} resizeMode="contain" />
      ) : (
        <Ionicons name={icon ?? 'diamond'} size={24} color={colors.goldLight} />
      )}
      <Text style={styles.resourceText}>{value}</Text>
      {plus && (
        <View style={styles.plusBadge}>
          <Ionicons name="add" size={12} color="#fff" />
        </View>
      )}
    </View>
  );
}

function CornerSeat({
  corner,
  player,
  active,
  lastRoll,
  dice,
  onProfilePress,
}: {
  corner: 'topLeft' | 'topRight' | 'bottomRight';
  player: Player;
  active: boolean;
  lastRoll: number | null;
  dice: DiceHudProps | null;
  onProfilePress: () => void;
}) {
  const pool = dice?.dicePool ?? [];
  const align = corner === 'topLeft' ? 'left' : 'right';
  return (
    <View style={[styles.cornerSeat, cornerSeatStyle(corner), align === 'left' && styles.cornerSeatLeft]}>
      <DiceBubble dice={dice} value={lastRoll} active={active} remote align={align} />
      <PlayerAvatar player={player} active={active} size={52} onPress={onProfilePress} timerProgress={dice?.timerProgress ?? null} />
      {pool.length > 0 ? (
        <DicePoolRow values={pool} compact />
      ) : (
        <Text style={[styles.remoteName, align === 'left' && styles.remoteNameLeft]} numberOfLines={1}>
          {player.name}
        </Text>
      )}
    </View>
  );
}

function LocalCommandBar({
  player,
  active,
  lastRoll,
  dice,
  canUndo,
  onProfilePress,
}: {
  player?: Player;
  active: boolean;
  lastRoll: number | null;
  dice: DiceHudProps | null;
  canUndo: boolean;
  onProfilePress: () => void;
}) {
  if (!player) return <View style={styles.localBarPlaceholder} />;
  const pool = dice?.dicePool ?? [];

  return (
    <View style={styles.localBar}>
      {pool.length > 0 ? (
        <DicePoolRow values={pool} />
      ) : (
        <Text style={styles.localName} numberOfLines={1}>
          {player.name}
        </Text>
      )}
      <View style={styles.localControls}>
        <PlayerAvatar player={player} active={active} size={58} onPress={onProfilePress} timerProgress={dice?.timerProgress ?? null} />
        <DiceBubble dice={dice} value={lastRoll} active={active} />
        <View style={styles.quickStack}>
          <Pressable disabled={!canUndo} style={[styles.quickButton, !canUndo && styles.quickButtonDisabled]}>
            <Ionicons name="arrow-undo" size={25} color="#fff" />
          </Pressable>
          <View style={styles.gemCost}>
            <Ionicons name="diamond" size={19} color="#35E46F" />
            <Text style={styles.gemCostText}>2</Text>
          </View>
        </View>
      </View>
      <View style={styles.chatRow}>
        <Pressable style={styles.chatButton}>
          <Text style={styles.chatButtonText}>EMOJI</Text>
        </Pressable>
        <Pressable style={styles.chatButton}>
          <Text style={styles.chatButtonText}>CHAT</Text>
        </Pressable>
      </View>
    </View>
  );
}

function DiceBubble({
  dice,
  value,
  active,
  remote = false,
  align = 'right',
}: {
  dice: DiceHudProps | null;
  value: number | null;
  active: boolean;
  remote?: boolean;
  align?: 'left' | 'right';
}) {
  const rolling = dice?.isRolling ?? false;
  const diceValue = dice?.displayRoll ?? dice?.dicePool[dice.dicePool.length - 1] ?? value;
  const shouldShow = !!dice || value !== null || active;
  if (!shouldShow) return null;

  return (
    <Pressable
      disabled={rolling}
      hitSlop={10}
      onPress={() => {
        if (dice?.canRoll) dice.onRoll();
      }}
      style={({ pressed }) => [
        styles.diceBubble,
        remote && (align === 'left' ? styles.remoteDiceBubbleLeft : styles.remoteDiceBubble),
        active && styles.diceBubbleActive,
        pressed && dice?.canRoll && !rolling && { transform: [{ scale: 0.96 }] },
      ]}
    >
      <View style={[styles.dicePointer, align === 'left' && styles.dicePointerLeft]} />
      <Dice size={remote ? 36 : 40} value={rolling ? null : diceValue} rolling={rolling} />
    </Pressable>
  );
}

function DicePoolRow({ values, compact = false }: { values: number[]; compact?: boolean }) {
  return (
    <View style={[styles.poolDiceRow, compact && styles.poolDiceRowCompact]}>
      {values.slice(0, 4).map((die, index) => (
        <View key={`${die}-${index}`} style={[styles.poolDieChip, compact && styles.poolDieChipCompact]}>
          <Dice size={compact ? 17 : 20} value={die} rolling={false} />
        </View>
      ))}
    </View>
  );
}

function PlayerAvatar({
  player,
  active,
  size,
  onPress,
  timerProgress = null,
}: {
  player: Player;
  active: boolean;
  size: number;
  onPress?: () => void;
  timerProgress?: SharedValue<number> | null;
}) {
  const avatar = getAvatar(player.avatarId);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      hitSlop={8}
      style={[
        styles.avatarShell,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: active ? colors.gold : PLAYER_HEX[player.color],
        },
      ]}
    >
      <View style={[styles.avatarFace, { backgroundColor: avatar.bg, borderRadius: size / 2 }]}>
        <Ionicons name={avatar.icon} size={size * 0.46} color="#fff" />
      </View>
      {timerProgress && <AvatarProgressRing progress={timerProgress} size={size} />}
      <View style={[styles.playerColorRing, { backgroundColor: PLAYER_HEX[player.color] }]} />
    </Pressable>
  );
}

function AvatarProgressRing({ progress, size }: { progress: SharedValue<number>; size: number }) {
  return (
    <View pointerEvents="none" style={styles.avatarProgressRing}>
      {Array.from({ length: 32 }, (_, index) => (
        <AvatarProgressTick key={index} index={index} size={size} progress={progress} />
      ))}
    </View>
  );
}

function AvatarProgressTick({
  index,
  size,
  progress,
}: {
  index: number;
  size: number;
  progress: SharedValue<number>;
}) {
  const radius = size / 2 + 5;
  const threshold = index / 32;
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: threshold <= progress.value ? 1 : 0.14,
  }));

  return (
    <Animated.View
      style={[
        styles.progressTick,
        animatedStyle,
        {
          transform: [
            { rotate: `${(360 / 32) * index}deg` },
            { translateY: -radius },
          ],
        },
      ]}
    />
  );
}

function PlayerStatsModal({
  player,
  profile,
  onClose,
}: {
  player: Player;
  profile: Profile | null;
  onClose: () => void;
}) {
  const wins = profile?.wins ?? 0;
  const losses = profile?.losses ?? 0;
  const games = wins + losses;
  const winRate = games > 0 ? Math.round((wins / games) * 100) : 0;
  const finished = player.tokens.filter((token) => token.location.kind === 'finished').length;
  const league = wins >= 50 ? 'Elite' : wins >= 25 ? 'Gold' : wins >= 10 ? 'Silver' : 'Bronze';

  return (
    <View style={styles.modalOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.statsCard}>
        <Pressable onPress={onClose} hitSlop={10} style={styles.closeButton}>
          <Ionicons name="close" size={26} color="#fff" />
        </Pressable>
        <View style={styles.statsHeader}>
          <PlayerAvatar player={player} active size={78} />
          <View style={styles.statsIdentity}>
            <Text style={styles.statsName} numberOfLines={1}>
              {player.name}
            </Text>
            <View style={styles.countryRow}>
              <Text style={styles.flagText}>PK</Text>
              <Text style={styles.countryText}>Pakistan</Text>
            </View>
          </View>
          <View style={[styles.statsColorDot, { backgroundColor: PLAYER_HEX[player.color] }]} />
        </View>
        <View style={styles.featureBadge}>
          <Dice size={70} value={null} rolling={false} />
          <Text style={styles.featureText}>ELITE</Text>
        </View>
        <View style={styles.statsGrid}>
          <StatBox label="Coins" value={profile ? profile.coins.toLocaleString() : 'Hidden'} />
          <StatBox label="Gems" value={profile ? profile.gems.toLocaleString() : 'Hidden'} />
          <StatBox label="Games" value={games > 0 ? games.toLocaleString() : 'N/A'} />
          <StatBox label="Wins" value={wins > 0 ? wins.toLocaleString() : 'N/A'} />
          <StatBox label="Win Rate" value={games > 0 ? `${winRate}%` : 'N/A'} />
          <StatBox label="Losses" value={losses > 0 ? losses.toLocaleString() : 'N/A'} />
          <StatBox label="Tokens Home" value={`${finished}/4`} />
          <StatBox label="League" value={profile ? league : 'Rival'} />
        </View>
      </View>
    </View>
  );
}

function GameMenuModal({
  visible,
  online,
  onResume,
  onQuit,
}: {
  visible: boolean;
  online: boolean;
  onResume: () => void;
  onQuit: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onResume}>
      <View style={styles.menuOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onResume} />
        <View style={styles.menuCard}>
          <Text style={styles.menuTitle}>Game Menu</Text>
          <Text style={styles.menuSubtitle}>
            {online ? 'Leaving gives the win to your opponent.' : 'Pause or leave this table.'}
          </Text>
          <Pressable onPress={onResume} style={({ pressed }) => [styles.menuButton, pressed && styles.menuButtonPressed]}>
            <Ionicons name="play" size={20} color={colors.bg} />
            <Text style={styles.menuButtonText}>RESUME</Text>
          </Pressable>
          <Pressable onPress={onQuit} style={({ pressed }) => [styles.menuQuitButton, pressed && styles.menuButtonPressed]}>
            <Ionicons name="exit-outline" size={20} color="#fff" />
            <Text style={styles.menuQuitText}>QUIT GAME</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function cornerSeatStyle(corner: 'topLeft' | 'topRight' | 'bottomRight') {
  switch (corner) {
    case 'topLeft':
      return styles.cornerSeatTopLeft;
    case 'topRight':
      return styles.cornerSeatTopRight;
    case 'bottomRight':
      return styles.cornerSeatBottomRight;
  }
}

const styles = StyleSheet.create({
  topHud: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.36)',
    backgroundColor: 'rgba(33,12,39,0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  topButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  hudButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudButtonLabel: {
    position: 'absolute',
    bottom: 7,
    color: colors.text,
    fontFamily: fontFamilies.heading,
    fontSize: 8,
    letterSpacing: 0.2,
  },
  hudBadge: {
    position: 'absolute',
    top: -6,
    right: -5,
    minWidth: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: '#E21D2D',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudBadgeText: { color: '#fff', fontFamily: fontFamilies.heading, fontSize: 12 },
  resources: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    justifyContent: 'flex-end',
    minWidth: 0,
  },
  resourcePill: {
    minWidth: 44,
    height: 32,
    borderRadius: 18,
    paddingLeft: 6,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(26,10,33,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  resourceImage: { width: 22, height: 22 },
  resourceText: { color: colors.text, fontFamily: fontFamilies.heading, fontSize: 14 },
  plusBadge: {
    position: 'absolute',
    left: 18,
    top: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#27C94E',
    borderWidth: 1,
    borderColor: '#BEFFB5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchChip: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -16,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.38)',
    fontFamily: fontFamilies.heading,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  opponentLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 8,
    alignSelf: 'center',
  },
  cornerSeat: {
    position: 'absolute',
    width: 136,
    right: 10,
    top: -92,
    alignItems: 'flex-end',
  },
  cornerSeatLeft: {
    alignItems: 'flex-start',
  },
  cornerSeatTopLeft: {
    left: 10,
    right: undefined,
    top: -92,
  },
  cornerSeatTopRight: {
    right: 10,
    top: -92,
  },
  cornerSeatBottomRight: {
    right: 10,
    top: '100%',
    marginTop: 8,
  },
  remoteName: {
    height: 18,
    marginTop: 8,
    maxWidth: 126,
    color: '#fff',
    fontFamily: fontFamilies.heading,
    fontSize: 12,
  },
  remoteNameLeft: {
    textAlign: 'left',
  },
  avatarShell: {
    padding: 2,
    borderWidth: 2,
    backgroundColor: '#281035',
  },
  avatarFace: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  playerColorRing: {
    position: 'absolute',
    right: 1,
    bottom: 3,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  diceBubble: {
    minWidth: 60,
    minHeight: 52,
    borderRadius: 13,
    backgroundColor: '#A47E1A',
    borderWidth: 2,
    borderColor: '#C89A2B',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  remoteDiceBubble: {
    position: 'absolute',
    right: 64,
    top: 8,
    minWidth: 54,
    minHeight: 48,
  },
  remoteDiceBubbleLeft: {
    position: 'absolute',
    left: 64,
    top: 8,
    minWidth: 54,
    minHeight: 48,
  },
  diceBubbleActive: {
    borderColor: colors.gold,
  },
  dicePointer: {
    position: 'absolute',
    right: -11,
    width: 0,
    height: 0,
    borderTopWidth: 9,
    borderBottomWidth: 9,
    borderLeftWidth: 12,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#C89A2B',
  },
  dicePointerLeft: {
    left: -11,
    right: undefined,
    borderLeftWidth: 0,
    borderLeftColor: 'transparent',
    borderRightWidth: 12,
    borderRightColor: '#C89A2B',
  },
  poolDiceRow: {
    flexDirection: 'row',
    gap: 5,
    height: 25,
    alignItems: 'center',
  },
  poolDiceRowCompact: {
    marginTop: 8,
    gap: 3,
  },
  poolDieChip: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#4B3377',
    borderWidth: 1,
    borderColor: '#E7D5FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  poolDieChipCompact: {
    width: 20,
    height: 20,
    borderRadius: 5,
  },
  avatarProgressRing: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'visible',
  },
  progressTick: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 3,
    height: 7,
    marginLeft: -1.5,
    marginTop: -3.5,
    borderRadius: 2,
    backgroundColor: '#33F083',
  },
  localBarPlaceholder: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '100%',
    height: 132,
  },
  localBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '100%',
    height: 132,
    paddingHorizontal: 10,
    paddingTop: 2,
    paddingBottom: 4,
  },
  localName: {
    color: '#fff',
    fontFamily: fontFamilies.heading,
    fontSize: 14,
    height: 25,
  },
  localControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 6,
  },
  quickStack: {
    gap: 3,
    alignItems: 'center',
  },
  quickButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickButtonDisabled: { opacity: 0.58 },
  gemCost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  gemCostText: { color: colors.text, fontFamily: fontFamilies.heading, fontSize: 12 },
  chatRow: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 5,
  },
  chatButton: {
    minWidth: 78,
    height: 32,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatButtonText: {
    color: '#fff',
    fontFamily: fontFamilies.heading,
    fontSize: 13,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    backgroundColor: 'rgba(0,0,0,0.68)',
  },
  menuOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  menuCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(212,175,55,0.55)',
    backgroundColor: 'rgba(29,9,31,0.97)',
    padding: 18,
  },
  menuTitle: {
    color: colors.goldLight,
    fontFamily: fontFamilies.heading,
    fontSize: 24,
    letterSpacing: 1,
    textAlign: 'center',
  },
  menuSubtitle: {
    color: 'rgba(255,255,255,0.62)',
    fontFamily: fontFamilies.body,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 18,
  },
  menuButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  menuQuitButton: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(226,87,76,0.24)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  menuButtonPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.86,
  },
  menuButtonText: {
    color: colors.bg,
    fontFamily: fontFamilies.heading,
    fontSize: 15,
    letterSpacing: 1.5,
  },
  menuQuitText: {
    color: '#fff',
    fontFamily: fontFamilies.heading,
    fontSize: 15,
    letterSpacing: 1.5,
  },
  statsCard: {
    width: '100%',
    maxWidth: 390,
    maxHeight: '86%',
    borderRadius: 24,
    padding: 16,
    paddingTop: 18,
    backgroundColor: '#2A0827',
    borderWidth: 3,
    borderColor: colors.gold,
  },
  closeButton: {
    position: 'absolute',
    right: -10,
    top: -13,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E92B35',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsHeader: {
    minHeight: 90,
    borderRadius: 18,
    padding: 10,
    paddingRight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  statsIdentity: {
    flex: 1,
    minWidth: 0,
  },
  statsName: {
    color: '#fff',
    fontFamily: fontFamilies.heading,
    fontSize: 21,
  },
  countryRow: {
    marginTop: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  flagText: {
    minWidth: 25,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    color: '#fff',
    backgroundColor: '#0A7B36',
    fontFamily: fontFamilies.heading,
    fontSize: 11,
    textAlign: 'center',
  },
  countryText: {
    color: colors.text,
    fontFamily: fontFamilies.heading,
    fontSize: 14,
    textTransform: 'uppercase',
  },
  statsColorDot: {
    position: 'absolute',
    right: 14,
    top: 18,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
  },
  featureBadge: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
    width: 132,
    minHeight: 118,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  featureText: {
    marginTop: 7,
    color: colors.goldLight,
    fontFamily: fontFamilies.heading,
    fontSize: 20,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    padding: 11,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statBox: {
    width: '48%',
    minHeight: 58,
    borderRadius: 11,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(12,2,20,0.54)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontFamily: fontFamilies.body,
    fontSize: 12,
  },
  statValue: {
    marginTop: 3,
    color: '#fff',
    fontFamily: fontFamilies.heading,
    fontSize: 17,
  },
});
