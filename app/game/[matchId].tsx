// Solo-vs-AI game screen for the dice-pool turn machine.
// Layout: header → top profiles → board → bottom profiles → dice tray.
//
// Turn flow handled by 5 independent effects (see comments below). Each effect
// schedules at most one timer and cleans it up on state change, avoiding the
// timer-clobber bug from chaining setTimeout + setState in a single effect.

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DiceTray } from '@/src/components/DiceTray';
import { PlayerProfile } from '@/src/components/PlayerProfile';
import { TokenDicePicker } from '@/src/components/TokenDicePicker';
import { BOARD_SIZE, cellForToken } from '@/src/game/board';
import type { Color, Player, TokenId } from '@/src/game/types';
import { BoardCanvas } from '@/src/skia/Board';
import { Token as TokenView } from '@/src/skia/Token';
import { chooseMove, useGameStore } from '@/src/stores/game';
import { colors } from '@/src/theme/colors';
import { spacing, typography } from '@/src/theme/typography';

const PLAYER_HEX: Record<Color, string> = {
  red: colors.red,
  green: colors.green,
  yellow: colors.yellow,
  blue: colors.blue,
};

const THINK_MS = 700;
const ROLL_ANIM_MS = 600;
const MOVE_ANIM_MS = 400;

export default function GameScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { width } = useWindowDimensions();

  const state = useGameStore((s) => s.state);
  const validMoves = useGameStore((s) => s.validMoves);
  const newGame = useGameStore((s) => s.newGame);
  const beginRoll = useGameStore((s) => s.beginRoll);
  const finishRoll = useGameStore((s) => s.finishRoll);
  const selectMove = useGameStore((s) => s.selectMove);
  const finishMoveAnim = useGameStore((s) => s.finishMoveAnim);

  const [pickerForToken, setPickerForToken] = useState<TokenId | null>(null);

  // Layout
  const boardSize = Math.min(width - spacing.md * 2, 380);
  const cellPx = boardSize / BOARD_SIZE;
  const tokenSize = cellPx * 0.78;

  // Init game on mount
  useEffect(() => {
    newGame('red', 3);
  }, [matchId, newGame]);

  const currentPlayer: Player | undefined = state.players[state.currentPlayerIdx];
  const isMyTurn = !!currentPlayer && !currentPlayer.isAI;

  // ── Effect: dice tumble has played out — settle the value. ──
  useEffect(() => {
    if (state.status !== 'rolling') return;
    const t = setTimeout(() => finishRoll(), ROLL_ANIM_MS);
    return () => clearTimeout(t);
  }, [state.status, finishRoll]);

  // ── Effect: AI is awaiting_roll — schedule a roll. ──
  useEffect(() => {
    if (state.status !== 'awaiting_roll' || !currentPlayer?.isAI) return;
    if (state.winnerColor) return;
    const t = setTimeout(() => beginRoll(), THINK_MS);
    return () => clearTimeout(t);
  }, [state.status, currentPlayer, state.winnerColor, beginRoll]);

  // ── Effect: AI is awaiting_move — schedule a pick. ──
  useEffect(() => {
    if (state.status !== 'awaiting_move' || !currentPlayer?.isAI) return;
    if (state.winnerColor) return;
    const t = setTimeout(() => {
      const pick = chooseMove(state, currentPlayer.color);
      if (pick) selectMove(pick);
    }, THINK_MS);
    return () => clearTimeout(t);
  }, [state, currentPlayer, selectMove]);

  // ── Effect: token movement anim has played — settle into next status. ──
  useEffect(() => {
    if (state.status !== 'animating') return;
    const t = setTimeout(() => finishMoveAnim(), MOVE_ANIM_MS);
    return () => clearTimeout(t);
  }, [state.status, finishMoveAnim]);

  // ── Effect: winner → navigate to result. ──
  useEffect(() => {
    if (!state.winnerColor) return;
    const t = setTimeout(() => {
      router.replace({
        pathname: '/game/result',
        params: { winner: state.winnerColor as string },
      });
    }, 900);
    return () => clearTimeout(t);
  }, [state.winnerColor]);

  // ── Effect: clear picker when context changes. ──
  useEffect(() => {
    setPickerForToken(null);
  }, [state.currentPlayerIdx, state.dicePool.length, state.status]);

  // ── handlers ──
  function onHumanRoll() {
    if (!isMyTurn || state.status !== 'awaiting_roll') return;
    beginRoll();
  }

  function onTokenTap(tokenId: TokenId) {
    if (!isMyTurn || state.status !== 'awaiting_move') return;
    if (pickerForToken === tokenId) {
      setPickerForToken(null);
      return;
    }
    const opts = validMoves.filter((m) => m.tokenId === tokenId);
    if (opts.length === 0) return;
    const uniqueValues = Array.from(new Set(opts.map((o) => o.dieValue)));
    if (uniqueValues.length === 1) {
      setPickerForToken(null);
      selectMove(opts[0]);
      return;
    }
    setPickerForToken(tokenId);
  }

  function onPickerSelect(value: number) {
    if (!pickerForToken) return;
    const move = validMoves.find(
      (m) => m.tokenId === pickerForToken && m.dieValue === value,
    );
    setPickerForToken(null);
    if (move) selectMove(move);
  }

  // ── derived ──
  const allTokens = useMemo(
    () => state.players.flatMap((p) => p.tokens),
    [state.players],
  );

  const movableTokenIds = useMemo(
    () => new Set(validMoves.map((m) => m.tokenId)),
    [validMoves],
  );

  const pickerValues = pickerForToken
    ? Array.from(
        new Set(
          validMoves.filter((m) => m.tokenId === pickerForToken).map((m) => m.dieValue),
        ),
      ).sort((a, b) => b - a)
    : [];

  const pickerCenter = (() => {
    if (!pickerForToken) return null;
    const tok = allTokens.find((t) => t.id === pickerForToken);
    if (!tok) return null;
    const cell = cellForToken(tok);
    return { cx: (cell.col + 0.5) * cellPx, cy: (cell.row + 0.5) * cellPx };
  })();

  const byColor = new Map<Color, Player>(state.players.map((p) => [p.color, p]));

  const rollLabel = state.dicePool.length > 0 ? 'ROLL AGAIN' : 'ROLL';
  const hint = makeHint(state, isMyTurn, currentPlayer);

  if (!currentPlayer) return null;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>← Exit</Text>
        </Pressable>
        <View style={styles.turnBadge}>
          <View
            style={[styles.dot, { backgroundColor: PLAYER_HEX[currentPlayer.color] }]}
          />
          <Text style={styles.turnText}>
            {isMyTurn ? 'Your turn' : `${currentPlayer.name}'s turn`}
          </Text>
        </View>
        <Text style={styles.matchId}>#{matchId ?? 'local'}</Text>
      </View>

      <ProfileRow
        left={byColor.get('red')}
        right={byColor.get('green')}
        currentColor={currentPlayer.color}
        lastRollByColor={state.lastRollByColor}
      />

      <View style={styles.boardWrap}>
        <View style={[styles.boardSquare, { width: boardSize, height: boardSize }]}>
          <BoardCanvas size={boardSize} />
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {allTokens.map((t) => {
              const cell = cellForToken(t);
              const cx = (cell.col + 0.5) * cellPx;
              const cy = (cell.row + 0.5) * cellPx;
              const movable = isMyTurn && state.status === 'awaiting_move' && movableTokenIds.has(t.id);
              return (
                <TokenView
                  key={t.id}
                  color={t.color}
                  cx={cx}
                  cy={cy}
                  size={tokenSize}
                  selectable={movable}
                  highlighted={movable}
                  onPress={() => onTokenTap(t.id)}
                />
              );
            })}
            {pickerForToken && pickerCenter && pickerValues.length > 0 && (
              <TokenDicePicker
                cx={pickerCenter.cx}
                cy={pickerCenter.cy}
                offset={tokenSize / 2}
                values={pickerValues}
                onPick={onPickerSelect}
              />
            )}
          </View>
        </View>
      </View>

      <ProfileRow
        left={byColor.get('blue')}
        right={byColor.get('yellow')}
        currentColor={currentPlayer.color}
        lastRollByColor={state.lastRollByColor}
      />

      <DiceTray
        pool={state.dicePool}
        isRolling={state.status === 'rolling'}
        canRoll={isMyTurn && state.status === 'awaiting_roll' && !state.winnerColor}
        rollLabel={rollLabel}
        onRoll={onHumanRoll}
        hint={hint}
      />
    </SafeAreaView>
  );
}

function ProfileRow({
  left,
  right,
  currentColor,
  lastRollByColor,
}: {
  left?: Player;
  right?: Player;
  currentColor: Color;
  lastRollByColor: Partial<Record<Color, number>>;
}) {
  return (
    <View style={styles.row}>
      {left ? (
        <PlayerProfile
          player={left}
          isActive={currentColor === left.color}
          lastRoll={lastRollByColor[left.color] ?? null}
          align="left"
        />
      ) : (
        <View style={styles.rowSpacer} />
      )}
      {right ? (
        <PlayerProfile
          player={right}
          isActive={currentColor === right.color}
          lastRoll={lastRollByColor[right.color] ?? null}
          align="right"
        />
      ) : (
        <View style={styles.rowSpacer} />
      )}
    </View>
  );
}

function makeHint(
  state: ReturnType<typeof useGameStore.getState>['state'],
  isMyTurn: boolean,
  currentPlayer: Player | undefined,
): string {
  if (state.winnerColor) return '';
  if (!currentPlayer) return '';
  if (!isMyTurn) {
    if (state.status === 'awaiting_roll') return `${currentPlayer.name} is about to roll…`;
    if (state.status === 'rolling') return `${currentPlayer.name} is rolling…`;
    if (state.status === 'awaiting_move') return `${currentPlayer.name} is choosing a move…`;
    return ' ';
  }
  if (state.status === 'awaiting_roll') {
    return state.dicePool.length > 0
      ? 'Rolled a six — roll again!'
      : 'Tap ROLL to start your turn.';
  }
  if (state.status === 'rolling') return 'Rolling…';
  if (state.status === 'awaiting_move') {
    return state.dicePool.length > 1
      ? 'Tap a token, then pick which die to use.'
      : 'Tap a highlighted token to move.';
  }
  return ' ';
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  back: { ...typography.body, color: colors.gold },
  turnBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  turnText: { ...typography.caption, color: colors.text },
  matchId: { ...typography.caption, color: colors.textDim },
  row: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  rowSpacer: { flex: 1 },
  boardWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boardSquare: { position: 'relative' },
});
