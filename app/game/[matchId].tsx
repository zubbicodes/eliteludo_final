// Solo-vs-AI game screen. Phase 1 wires together the rules engine, AI bot,
// Skia board, dice, and tokens. Multiplayer arrives in Phase 3.

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

import { BOARD_SIZE, cellForToken } from '@/src/game/board';
import type { Color, MoveOption } from '@/src/game/types';
import { chooseMove, useGameStore } from '@/src/stores/game';
import { BoardCanvas } from '@/src/skia/Board';
import { Dice } from '@/src/skia/Dice';
import { Token as TokenView } from '@/src/skia/Token';
import { colors } from '@/src/theme/colors';
import { spacing, typography } from '@/src/theme/typography';

const PLAYER_HEX: Record<Color, string> = {
  red: colors.red,
  green: colors.green,
  yellow: colors.yellow,
  blue: colors.blue,
};

const TURN_THINK_MS = 700;
const ROLL_ANIM_MS = 600;
const MOVE_ANIM_MS = 400;

export default function GameScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { width } = useWindowDimensions();

  const state = useGameStore((s) => s.state);
  const validMoves = useGameStore((s) => s.validMoves);
  const isRolling = useGameStore((s) => s.isRolling);
  const newGame = useGameStore((s) => s.newGame);
  const beginRollAnim = useGameStore((s) => s.beginRollAnim);
  const roll = useGameStore((s) => s.roll);
  const selectMove = useGameStore((s) => s.selectMove);
  const finishTurn = useGameStore((s) => s.finishTurn);

  const [hint, setHint] = useState<string>('');

  // Layout
  const boardSize = Math.min(width - spacing.md * 2, 420);
  const cellPx = boardSize / BOARD_SIZE;
  const tokenSize = cellPx * 0.78;

  // Init game on mount.
  useEffect(() => {
    newGame('red', 3);
  }, [matchId, newGame]);

  const currentPlayer = state.players[state.currentPlayerIdx];
  const isMyTurn = currentPlayer && !currentPlayer.isAI;

  // ── Effect 1: AI is on idle and needs to start a roll. ──
  useEffect(() => {
    if (!currentPlayer || state.winnerColor || isRolling) return;
    if (state.status !== 'idle' || state.dice !== null) return;
    if (!currentPlayer.isAI) {
      setHint('Tap the dice to roll.');
      return;
    }
    const t = setTimeout(() => beginRollAnim(), TURN_THINK_MS);
    return () => clearTimeout(t);
  }, [
    currentPlayer,
    state.winnerColor,
    state.status,
    state.dice,
    isRolling,
    beginRollAnim,
  ]);

  // ── Effect 2: dice is tumbling — settle it after the anim. ──
  useEffect(() => {
    if (!isRolling) return;
    const t = setTimeout(() => roll(), ROLL_ANIM_MS);
    return () => clearTimeout(t);
  }, [isRolling, roll]);

  // ── Effect 3: dice has settled — auto-skip, AI auto-pick, or wait for human. ──
  useEffect(() => {
    if (!currentPlayer || state.winnerColor || isRolling) return;
    if (state.dice === null) return;
    if (state.status === 'animating' || state.status === 'finished') return;

    if (validMoves.length === 0) {
      setHint(currentPlayer.isAI ? `${currentPlayer.name} skips.` : 'No legal moves — skipping.');
      const rolled = state.dice;
      const t = setTimeout(() => finishTurn(rolled, false), TURN_THINK_MS);
      return () => clearTimeout(t);
    }

    if (state.status !== 'awaiting_move') return;

    if (currentPlayer.isAI) {
      const rolled = state.dice;
      const aiState = state;
      const t = setTimeout(() => {
        const pick = chooseMove(aiState, currentPlayer.color, rolled);
        if (!pick) {
          finishTurn(rolled, false);
          return;
        }
        const captured = pick.captures.length > 0;
        selectMove(pick, {
          afterApply: () => {
            setTimeout(() => finishTurn(rolled, captured), MOVE_ANIM_MS);
          },
        });
      }, TURN_THINK_MS);
      return () => clearTimeout(t);
    }

    setHint('Tap one of your highlighted tokens.');
  }, [
    state,
    validMoves,
    isRolling,
    currentPlayer,
    selectMove,
    finishTurn,
  ]);

  // Watch for winner → result screen
  useEffect(() => {
    if (state.winnerColor) {
      const t = setTimeout(() => {
        router.replace({
          pathname: '/game/result',
          params: { winner: state.winnerColor as string },
        });
      }, 900);
      return () => clearTimeout(t);
    }
  }, [state.winnerColor]);

  function doSelectMove(move: MoveOption) {
    const rolled = state.dice;
    if (rolled === null) return;
    const captured = move.captures.length > 0;
    selectMove(move, {
      afterApply: () => {
        setTimeout(() => finishTurn(rolled, captured), MOVE_ANIM_MS);
      },
    });
  }

  function onHumanRollPress() {
    if (!isMyTurn || state.dice !== null || isRolling) return;
    beginRollAnim();
    setTimeout(() => roll(), ROLL_ANIM_MS);
  }

  function onTokenPress(tokenId: string) {
    const move = validMoves.find((m) => m.tokenId === tokenId);
    if (!move) return;
    if (!isMyTurn) return;
    doSelectMove(move);
  }

  // Flatten token list for rendering.
  const allTokens = useMemo(
    () => state.players.flatMap((p) => p.tokens),
    [state.players],
  );

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
            {currentPlayer.isAI ? `${currentPlayer.name}'s turn` : 'Your turn'}
          </Text>
        </View>
        <Text style={styles.matchId}>#{matchId ?? 'local'}</Text>
      </View>

      <View style={styles.boardWrap}>
        <View style={[styles.boardSquare, { width: boardSize, height: boardSize }]}>
          <BoardCanvas size={boardSize} />
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {allTokens.map((t) => {
              const cell = cellForToken(t);
              const cx = (cell.col + 0.5) * cellPx;
              const cy = (cell.row + 0.5) * cellPx;
              const movable = isMyTurn && validMoves.some((m) => m.tokenId === t.id);
              return (
                <TokenView
                  key={t.id}
                  color={t.color}
                  cx={cx}
                  cy={cy}
                  size={tokenSize}
                  selectable={movable}
                  highlighted={movable}
                  onPress={() => onTokenPress(t.id)}
                />
              );
            })}
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.hint}>{hint}</Text>
        <Pressable
          onPress={onHumanRollPress}
          disabled={!isMyTurn || state.dice !== null || isRolling}
          style={({ pressed }) => [
            styles.diceWrap,
            pressed && isMyTurn && state.dice === null && { transform: [{ scale: 0.96 }] },
          ]}
        >
          <Dice size={72} value={state.dice} rolling={isRolling} />
        </Pressable>
        <Text style={styles.streak}>
          {state.sixStreak > 0 ? `Sixes in a row: ${state.sixStreak}` : ' '}
        </Text>
      </View>
    </SafeAreaView>
  );
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
  boardWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boardSquare: { position: 'relative' },
  footer: {
    alignItems: 'center',
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  hint: { ...typography.caption, color: colors.textMuted, height: 18 },
  diceWrap: {
    padding: spacing.sm,
  },
  streak: { ...typography.caption, color: colors.gold, height: 18 },
});
