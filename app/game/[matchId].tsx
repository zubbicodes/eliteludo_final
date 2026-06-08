// Game screen - solo vs-AI and 1v1 multiplayer.
// Solo path (matchId starts with "solo-"): fully client-side, no server calls.
// Multiplayer path: dice via roll-dice Edge Function, board sync via Realtime.
//
// Turn flow handled by independent effects. Each effect schedules at most one
// timer and cleans up on state change to avoid timer-clobber bugs.

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  ImageBackground,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TokenDicePicker } from '@/src/components/TokenDicePicker';
import { getAvatar } from '@/src/constants/profile';
import { BOARD_SIZE, cellForToken } from '@/src/game/board';
import { cellForPerspective, visualCornerForColor } from '@/src/game/perspective';
import { pathCellsForMove } from '@/src/game/rules';
import { assignRuntimeColors, isOppositePair, oppositeColor } from '@/src/game/seating';
import type { Color, MatchPlayer, Player, TokenId } from '@/src/game/types';
import { Images } from '@/src/assets';
import { supabase } from '@/src/supabase/client';
import { getSupabaseErrorMessage } from '@/src/supabase/errors';
import {
  getMatch,
  forfeitMatch,
  moveTokenServer,
  rollDiceServer,
  skipRollTurnServer,
  subscribeMatch,
} from '@/src/supabase/matches';
import { BoardCanvas } from '@/src/skia/Board';
import { Dice } from '@/src/skia/Dice';
import { Particles, type Burst } from '@/src/skia/Particles';
import { Token as TokenView } from '@/src/skia/Token';
import { haptics } from '@/src/utils/haptics';
import { sound } from '@/src/utils/sound';
import { useProfileStore } from '@/src/stores/profile';
import type { Profile } from '@/src/stores/profile';
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
const ROLL_ANIM_MS = 360;
const MP_ROLL_SETTLE_MS = 120;
const ROLL_TIMEOUT_MS = 5000;
const ROLL_TIMER_TICK_MS = 100;
const HOP_MS = 130;
const MIN_MOVE_MS = 220;
const CAPTURE_TAIL_MS = 260;
type MatchPlayerEntry = MatchPlayer & { is_bot?: boolean };

export default function GameScreen() {
  const { matchId, mode, entryFee, citySlug } = useLocalSearchParams<{
    matchId: string;
    mode?: string;
    entryFee?: string;
    citySlug?: string;
  }>();
  const { width, height } = useWindowDimensions();
  const gameMode = mode === '4p' ? '4p' : '2p';

  // Solo = client-only path; multiplayer = server dice + Realtime sync
  const isSoloMatchId = !matchId || matchId.startsWith('solo-');
  const [botBackedMatch, setBotBackedMatch] = useState(false);
  const isLocalBotGame = isSoloMatchId || botBackedMatch;

  const state = useGameStore((s) => s.state);
  const validMoves = useGameStore((s) => s.validMoves);
  const newGame = useGameStore((s) => s.newGame);
  const loadGame = useGameStore((s) => s.loadGame);
  const beginRoll = useGameStore((s) => s.beginRoll);
  const finishRoll = useGameStore((s) => s.finishRoll);
  const skipRollTurn = useGameStore((s) => s.skipRollTurn);
  const selectMove = useGameStore((s) => s.selectMove);
  const finishMoveAnim = useGameStore((s) => s.finishMoveAnim);

  const [pickerForToken, setPickerForToken] = useState<TokenId | null>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [rollTimerRemaining, setRollTimerRemaining] = useState(ROLL_TIMEOUT_MS);
  const [statsPlayer, setStatsPlayer] = useState<Player | null>(null);

  const profile = useProfileStore((s) => s.profile);
  const hydrateProfile = useProfileStore((s) => s.hydrate);

  // ── Multiplayer-specific state ──
  const [myColor, setMyColor] = useState<Color | null>(null);
  // Stable refs to avoid stale closures in Realtime callbacks
  const stateRef = useRef(state);
  const myColorRef = useRef(myColor);
  const matchPlayersRef = useRef<MatchPlayerEntry[]>([]);
  const leavingRef = useRef(false);
  const timeoutInFlightRef = useRef(false);
  const localMovePendingRef = useRef(false);
  const localSeatColorsRef = useRef<Color[] | null>(null);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { myColorRef.current = myColor; }, [myColor]);

  useEffect(() => {
    hydrateProfile();
  }, [hydrateProfile]);

  useEffect(() => {
    localSeatColorsRef.current = null;
  }, [matchId, gameMode]);

  const boardSize = Math.min(
    width - spacing.md * 2,
    height * (Platform.OS === 'android' ? 0.4 : 0.46),
    Platform.OS === 'android' ? 350 : 380,
  );
  const cellPx = boardSize / BOARD_SIZE;
  const tokenSize = cellPx * 0.98;

  const holdLocalMoveCommit = useCallback(() => {
    localMovePendingRef.current = true;
  }, []);

  const releaseLocalMoveCommit = useCallback(() => {
    localMovePendingRef.current = false;
  }, []);

  const shouldHydrateRemoteBoard = useCallback(() => {
    if (localMovePendingRef.current) return false;

    const s = stateRef.current;
    const mc = myColorRef.current;
    if (!mc) return true;

    const myIdx = s.players.findIndex((p) => p.color === mc);
    return !(
      s.currentPlayerIdx === myIdx &&
      (s.status === 'rolling' ||
        s.status === 'awaiting_move' ||
        s.status === 'animating')
    );
  }, []);

  // ── Effect: Solo init - new game when mount or profile settles. ──
  useEffect(() => {
    if (!isSoloMatchId) return;
    const targetCount = gameMode === '2p' ? 2 : 4;
    if (!localSeatColorsRef.current || localSeatColorsRef.current.length !== targetCount) {
      localSeatColorsRef.current = assignRuntimeColors(targetCount);
    }
    const seatColors = localSeatColorsRef.current;
    const humanColor = seatColors[0];
    const human = profile
      ? { name: profile.username, avatarId: profile.avatarId }
      : undefined;
    newGame(humanColor, gameMode === '2p' ? 1 : 3, human, seatColors);
  }, [isSoloMatchId, matchId, gameMode, newGame, profile]);

  // ── Effect: Multiplayer init - load from DB and subscribe to Realtime. ──
  useEffect(() => {
    if (isSoloMatchId || !matchId) return;

    let unsubscribeRealtime: (() => void) | null = null;

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession().catch((error) => {
        console.warn('[game] getSession failed:', getSupabaseErrorMessage(error));
        return { data: { session: null } };
      });
      if (!session) return;
      supabase.realtime.setAuth(session.access_token);

      const match = await getMatch(matchId);
      if (!match) return;

      const me = match.players.find((p) => p.user_id === session.user.id);
      if (!me) return;

      setMyColor(me.color);
      const matchPlayers = match.players as MatchPlayerEntry[];
      matchPlayersRef.current = matchPlayers;
      const isBotBacked = matchPlayers.some((p) => p.is_bot) ||
        match.board_state.players.some((p) => p.isAI);
      setBotBackedMatch(isBotBacked);
      myColorRef.current = me.color;
      loadGame(normalizeMatchBoardState(match.board_state, matchPlayers, me.color));

      if (!isBotBacked) {
        unsubscribeRealtime = subscribeMatch(matchId, (newBoardState) => {
          if (!shouldHydrateRemoteBoard()) return;
          loadGame(normalizeMatchBoardState(newBoardState, matchPlayersRef.current, myColorRef.current));
        });
      }
    };

    init();
    return () => { unsubscribeRealtime?.(); };
  }, [isSoloMatchId, matchId, loadGame, shouldHydrateRemoteBoard]);

  // Realtime should be the fast path, but polling prevents a stuck board if a
  // mobile socket drops or the channel fails to join.
  useEffect(() => {
    if (isSoloMatchId || botBackedMatch || !matchId || !myColor) return;

    let cancelled = false;
    const poll = async () => {
      const match = await getMatch(matchId);
      if (cancelled || !match) return;

      if (!shouldHydrateRemoteBoard()) return;

      loadGame(normalizeMatchBoardState(match.board_state, matchPlayersRef.current, myColorRef.current));
    };

    const interval = setInterval(poll, 1800);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isSoloMatchId, botBackedMatch, matchId, myColor, loadGame, shouldHydrateRemoteBoard]);

  const currentPlayer: Player | undefined = state.players[state.currentPlayerIdx];
  const perspectiveColor = getPerspectiveColor(state, isLocalBotGame, myColor);

  const isMyTurn = isLocalBotGame
    ? !!currentPlayer && !currentPlayer.isAI
    : !!currentPlayer && currentPlayer.color === myColor;

  const shouldRunRollTimer =
    state.status === 'awaiting_roll' &&
    !state.winnerColor &&
    !!currentPlayer &&
    (isLocalBotGame ? isMyTurn : !!matchId && !!myColor);

  // ── Effect: dice tumble has played out - settle the value. ──
  // Solo: use local RNG after a fixed timeout.
  // Multiplayer: call roll-dice EF, wait for response, then settle.
  useEffect(() => {
    if (state.status !== 'rolling') return;
    if (!isLocalBotGame && !isMyTurn) return; // opponent's roll - we'll get it via Realtime

    if (isLocalBotGame) {
      const t = setTimeout(() => {
        finishRoll();
        haptics.medium();
        sound.play('roll');
      }, ROLL_ANIM_MS);
      return () => clearTimeout(t);
    }

    // Multiplayer: server owns the dice and returns the authoritative board state.
    let cancelled = false;
    const startAt = Date.now();
    rollDiceServer(matchId!).then((result) => {
      if (cancelled) return;
      const wait = Math.max(0, MP_ROLL_SETTLE_MS - (Date.now() - startAt));
      setTimeout(() => {
        if (cancelled) return;
        if (!result) {
          loadGame({ ...stateRef.current, status: 'awaiting_roll' });
          Alert.alert('Roll failed', 'Please try again.');
          return;
        }
        if (typeof result.value !== 'number') {
          if (result.boardState) {
            loadGame(normalizeMatchBoardState(result.boardState, matchPlayersRef.current, myColorRef.current));
            return;
          }
          loadGame({ ...stateRef.current, status: 'awaiting_roll' });
          return;
        }
        if (result.boardState) {
          loadGame(normalizeMatchBoardState(result.boardState, matchPlayersRef.current, myColorRef.current));
        } else {
          finishRoll(result.value);
        }
        haptics.medium();
        sound.play('roll');
      }, wait);
    });
    return () => { cancelled = true; };
  }, [state.status, isMyTurn, isLocalBotGame, matchId, finishRoll, loadGame]);

  // ── Effect: roll timer - skip turn if a player does not roll in time. ──
  useEffect(() => {
    timeoutInFlightRef.current = false;
    setRollTimerRemaining(ROLL_TIMEOUT_MS);

    if (!shouldRunRollTimer) return;

    const startedAt = Date.now();
    const turnPlayerIdx = state.currentPlayerIdx;
    const tick = async () => {
      const remaining = Math.max(0, ROLL_TIMEOUT_MS - (Date.now() - startedAt));
      setRollTimerRemaining(remaining);
      if (remaining > 0 || timeoutInFlightRef.current) return;

      timeoutInFlightRef.current = true;
      haptics.warning();
      if (isLocalBotGame) {
        if (isMyTurn) skipRollTurn();
        return;
      }

      if (!matchId) return;
      const result = await skipRollTurnServer(matchId, turnPlayerIdx);
      if (result?.boardState) {
        loadGame(normalizeMatchBoardState(result.boardState, matchPlayersRef.current, myColorRef.current));
      }
    };

    const interval = setInterval(tick, ROLL_TIMER_TICK_MS);
    tick();
    return () => clearInterval(interval);
  }, [
    shouldRunRollTimer,
    state.currentPlayerIdx,
    isLocalBotGame,
    isMyTurn,
    matchId,
    myColor,
    skipRollTurn,
    loadGame,
  ]);

  // ── Effect: AI is awaiting_roll - schedule a roll (solo only). ──
  useEffect(() => {
    if (!isLocalBotGame) return;
    if (state.status !== 'awaiting_roll' || !currentPlayer?.isAI) return;
    if (state.winnerColor) return;
    const t = setTimeout(() => {
      beginRoll();
    }, THINK_MS);
    return () => clearTimeout(t);
  }, [isLocalBotGame, state.status, currentPlayer, state.winnerColor, beginRoll]);

  // ── Effect: AI is awaiting_move - schedule a pick (solo only). ──
  useEffect(() => {
    if (!isLocalBotGame) return;
    if (state.status !== 'awaiting_move' || !currentPlayer?.isAI) return;
    if (state.winnerColor) return;
    const t = setTimeout(() => {
      const pick = chooseMove(state, currentPlayer.color);
      if (pick) selectMove(pick);
    }, THINK_MS);
    return () => clearTimeout(t);
  }, [isLocalBotGame, state, currentPlayer, selectMove]);

  // ── Effect: token movement anim has played - settle into next status. ──
  useEffect(() => {
    if (state.status !== 'animating') return;
    const move = state.lastMove;
    const hops = move ? Math.max(1, hopsForMove(move.from, move.dieValue)) : 1;
    const base = Math.max(MIN_MOVE_MS, hops * HOP_MS);
    const total = base + (move?.captures.length ? CAPTURE_TAIL_MS : 0);
    const landAt = move?.captures.length ? null : setTimeout(() => haptics.light(), base);
    const t = setTimeout(() => {
      if (!isLocalBotGame && isMyTurn && matchId && move) {
        void moveTokenServer(matchId, move.tokenId, move.dieValue).then((result) => {
          if (result?.boardState) {
            loadGame(normalizeMatchBoardState(result.boardState, matchPlayersRef.current, myColorRef.current));
          } else {
            void getMatch(matchId).then((match) => {
              if (match) loadGame(normalizeMatchBoardState(match.board_state, matchPlayersRef.current, myColorRef.current));
            });
          }
          releaseLocalMoveCommit();
        });
        return;
      }
      finishMoveAnim();
    }, total);
    return () => {
      clearTimeout(t);
      if (landAt) clearTimeout(landAt);
    };
  }, [
    state.status,
    state.lastMove,
    isLocalBotGame,
    isMyTurn,
    matchId,
    finishMoveAnim,
    loadGame,
    releaseLocalMoveCommit,
  ]);

  // ── Effect: winner -> celebrate, then navigate to result. ──
  useEffect(() => {
    if (!state.winnerColor) return;
    const winColor = state.winnerColor;
    const humanColor = isLocalBotGame
      ? state.players.find((p) => !p.isAI)?.color
      : myColor;
    const youWon = isLocalBotGame
      ? !state.players.find((p) => p.color === winColor)?.isAI
      : winColor === myColor;
    if (youWon) haptics.success();
    else haptics.warning();
    sound.play('win');
    setBursts((bs) => [
      ...bs,
      {
        id: `win-${Date.now()}`,
        cx: boardSize / 2,
        cy: boardSize / 2,
        color: PLAYER_HEX[winColor],
        kind: 'win',
      },
    ]);
    const t = setTimeout(() => {
      router.replace({
        pathname: '/game/result',
        params: {
          winner: winColor as string,
          matchId: matchId ?? '',
          entryFee: entryFee ?? '0',
          citySlug: citySlug ?? '',
          humanColor: humanColor ?? '',
        },
      });
    }, 1500);
    return () => clearTimeout(t);
  }, [state.winnerColor, state.players, boardSize, isLocalBotGame, myColor, matchId, entryFee, citySlug]);

  // ── Effect: capture -> particle burst. ──
  useEffect(() => {
    const move = state.lastMove;
    if (!move?.captures.length) return;
    const tokens = state.players.flatMap((p) => p.tokens);
    const moving = tokens.find((tt) => tt.id === move.tokenId);
    if (!moving) return;
    const dest = cellForPerspective(cellForToken(moving), perspectiveColor);
    const cx = (dest.col + 0.5) * cellPx;
    const cy = (dest.row + 0.5) * cellPx;
    const arriveMs = Math.max(1, hopsForMove(move.from, move.dieValue)) * HOP_MS;
    const baseId = `cap-${Date.now()}`;
    const captureColors: Color[] = move.captures
      .map((id) => tokens.find((tt) => tt.id === id)?.color)
      .filter((c): c is Color => !!c);
    const t = setTimeout(() => {
      haptics.heavy();
      sound.play('capture');
      setBursts((bs) => [
        ...bs,
        ...captureColors.map((c, i) => ({
          id: `${baseId}-${i}`,
          cx,
          cy,
          color: PLAYER_HEX[c],
          kind: 'capture' as const,
        })),
      ]);
    }, arriveMs);
    return () => clearTimeout(t);
  }, [state.lastMove, state.players, cellPx, perspectiveColor]);

  // ── Effect: prune stale bursts. ──
  useEffect(() => {
    if (bursts.length === 0) return;
    const t = setTimeout(() => setBursts([]), 1600);
    return () => clearTimeout(t);
  }, [bursts]);

  // ── Effect: clear token picker on context change. ──
  useEffect(() => {
    setPickerForToken(null);
  }, [state.currentPlayerIdx, state.dicePool.length, state.status]);

  // ── handlers ──

  function onHumanRoll() {
    if (!isMyTurn || state.status !== 'awaiting_roll') return;
    haptics.tap();
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
    haptics.tap();
    const uniqueValues = Array.from(new Set(opts.map((o) => o.dieValue)));
    if (uniqueValues.length === 1) {
      setPickerForToken(null);
      if (!isLocalBotGame) holdLocalMoveCommit();
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
    if (move) {
      haptics.tap();
      if (!isLocalBotGame) holdLocalMoveCommit();
      selectMove(move);
    }
  }

  // ── derived ──
  async function leaveMatch() {
    if (leavingRef.current) return;
    leavingRef.current = true;
    haptics.tap();

    if (!isLocalBotGame && matchId && !state.winnerColor) {
      await forfeitMatch(matchId);
    }

    router.back();
  }

  function onExitPress() {
    if (isLocalBotGame || state.winnerColor) {
      leaveMatch();
      return;
    }

    Alert.alert(
      'Leave match?',
      'Leaving gives the win to your opponent.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: leaveMatch },
      ],
    );
  }

  const allTokens = useMemo(
    () => state.players.flatMap((p) => p.tokens),
    [state.players],
  );

  const movableTokenIds = useMemo(
    () => new Set(validMoves.map((m) => m.tokenId)),
    [validMoves],
  );

  const moveAnim = useMemo(() => {
    const move = state.lastMove;
    if (!move) return null;
    const movingToken = state.players.flatMap((p) => p.tokens).find((t) => t.id === move.tokenId);
    if (!movingToken) return null;
    const cells = pathCellsForMove(movingToken.color, move.from, move.dieValue);
    const hopPath = cells.map((c) => {
      const visual = cellForPerspective(c, perspectiveColor);
      return {
        cx: (visual.col + 0.5) * cellPx,
        cy: (visual.row + 0.5) * cellPx,
      };
    });
    const captureDelayMs = Math.max(0, hopPath.length - 1) * HOP_MS;
    const capturedIds = new Set(move.captures);
    return { movingTokenId: move.tokenId, hopPath, capturedIds, captureDelayMs };
  }, [state.lastMove, state.players, cellPx, perspectiveColor]);

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
    const cell = cellForPerspective(cellForToken(tok), perspectiveColor);
    return { cx: (cell.col + 0.5) * cellPx, cy: (cell.row + 0.5) * cellPx };
  })();

  const byCorner = seatPlayersByCorner(state.players, perspectiveColor);
  const hint = makeHint(state, isMyTurn, currentPlayer);
  const timerProgress = shouldRunRollTimer ? rollTimerRemaining / ROLL_TIMEOUT_MS : null;
  const timerSeconds = shouldRunRollTimer ? Math.ceil(rollTimerRemaining / 1000) : null;
  const localPlayer = byCorner.bottomLeft;
  const opponentPlayer = byCorner.topRight ?? byCorner.topLeft ?? byCorner.bottomRight;
  const sidePlayers = [byCorner.topLeft, byCorner.bottomRight]
    .filter((p): p is Player => !!p && p.color !== localPlayer?.color && p.color !== opponentPlayer?.color);
  const activeDiceProps = {
    dicePool: state.dicePool,
    displayRoll: state.lastRollByColor[currentPlayer.color] ?? null,
    isRolling: state.status === 'rolling',
    canRoll: isMyTurn && state.status === 'awaiting_roll' && !state.winnerColor,
    onRoll: onHumanRoll,
    timerProgress,
    timerSeconds,
  };

  if (!currentPlayer) return null;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ImageBackground source={Images.bgHome} style={StyleSheet.absoluteFill} resizeMode="cover">
        <View style={styles.tableOverlay} />
      </ImageBackground>

      <TopHud
        gems={profile?.gems ?? 0}
        matchId={matchId ?? 'local'}
        onExit={onExitPress}
      />

      <View style={styles.opponentLayer} pointerEvents="box-none">
        {sidePlayers.map((player, index) => (
          <MiniSeat
            key={player.color}
            player={player}
            active={currentPlayer.color === player.color}
            lastRoll={state.lastRollByColor[player.color] ?? null}
            style={index === 0 ? styles.sideSeatLeft : styles.sideSeatRight}
            onPress={() => setStatsPlayer(player)}
          />
        ))}
        {opponentPlayer && (
          <RemoteSeat
            player={opponentPlayer}
            active={currentPlayer.color === opponentPlayer.color}
            lastRoll={state.lastRollByColor[opponentPlayer.color] ?? null}
            dice={currentPlayer.color === opponentPlayer.color ? activeDiceProps : null}
            onProfilePress={() => setStatsPlayer(opponentPlayer)}
          />
        )}
      </View>

      <View style={styles.boardWrap}>
        <View style={[styles.boardSquare, { width: boardSize, height: boardSize }]}>
          <BoardCanvas size={boardSize} perspectiveColor={perspectiveColor} />
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {allTokens.map((t) => {
              const cell = cellForPerspective(cellForToken(t), perspectiveColor);
              const cx = (cell.col + 0.5) * cellPx;
              const cy = (cell.row + 0.5) * cellPx;
              const movable = isMyTurn && state.status === 'awaiting_move' && movableTokenIds.has(t.id);
              const isMoving = moveAnim?.movingTokenId === t.id;
              const isCaptured = moveAnim?.capturedIds.has(t.id) ?? false;
              return (
                <TokenView
                  key={t.id}
                  color={t.color}
                  cx={cx}
                  cy={cy}
                  size={tokenSize}
                  selectable={movable}
                  highlighted={movable}
                  hopPath={isMoving ? moveAnim?.hopPath : undefined}
                  hopMs={HOP_MS}
                  delayMs={isCaptured ? moveAnim?.captureDelayMs ?? 0 : 0}
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
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Particles width={boardSize} height={boardSize} bursts={bursts} />
          </View>
        </View>
      </View>

      <LocalCommandBar
        player={localPlayer}
        active={!!localPlayer && currentPlayer.color === localPlayer.color}
        lastRoll={localPlayer ? state.lastRollByColor[localPlayer.color] ?? null : null}
        dice={localPlayer && currentPlayer.color === localPlayer.color ? activeDiceProps : null}
        canUndo={state.status === 'awaiting_move' && isMyTurn}
        onProfilePress={() => setStatsPlayer(localPlayer ?? null)}
      />
      <Text style={styles.hint}>{hint}</Text>
      {statsPlayer && (
        <PlayerStatsModal
          player={statsPlayer}
          profile={statsPlayer.color === localPlayer?.color ? profile : null}
          onClose={() => setStatsPlayer(null)}
        />
      )}
    </SafeAreaView>
  );
}

type DiceHudProps = {
  dicePool: number[];
  displayRoll: number | null;
  isRolling: boolean;
  canRoll: boolean;
  onRoll: () => void;
  timerProgress: number | null;
  timerSeconds: number | null;
};

function TopHud({
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

function RemoteSeat({
  player,
  active,
  lastRoll,
  dice,
  onProfilePress,
}: {
  player: Player;
  active: boolean;
  lastRoll: number | null;
  dice: DiceHudProps | null;
  onProfilePress: () => void;
}) {
  return (
    <View style={styles.remoteSeat}>
      <DiceBubble dice={dice} value={lastRoll} active={active} remote />
      <PlayerAvatar player={player} active={active} size={66} onPress={onProfilePress} />
      <Text style={styles.remoteName} numberOfLines={1}>{player.name}</Text>
    </View>
  );
}

function MiniSeat({
  player,
  active,
  lastRoll,
  style,
  onPress,
}: {
  player: Player;
  active: boolean;
  lastRoll: number | null;
  style: ViewStyle;
  onPress: () => void;
}) {
  return (
    <View style={[styles.miniSeat, style]}>
      <PlayerAvatar player={player} active={active} size={44} onPress={onPress} />
      <View style={styles.miniDie}>
        <Text style={styles.miniDieText}>{lastRoll ?? '-'}</Text>
      </View>
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

  return (
    <View style={styles.localBar}>
      <Text style={styles.localName} numberOfLines={1}>{player.name}</Text>
      <View style={styles.localControls}>
        <PlayerAvatar player={player} active={active} size={72} onPress={onProfilePress} />
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
}: {
  dice: DiceHudProps | null;
  value: number | null;
  active: boolean;
  remote?: boolean;
}) {
  const rolling = dice?.isRolling ?? false;
  const diceValue = dice?.displayRoll ?? dice?.dicePool[dice.dicePool.length - 1] ?? value;
  const pool = dice?.dicePool ?? [];
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
        remote && styles.remoteDiceBubble,
        active && styles.diceBubbleActive,
        pressed && dice?.canRoll && !rolling && { transform: [{ scale: 0.96 }] },
      ]}
    >
      {dice && dice.timerProgress !== null && (
        <DiceProgressRing progress={dice.timerProgress} remote={remote} />
      )}
      <View style={styles.dicePointer} />
      <Dice size={remote ? 54 : 58} value={rolling ? null : diceValue} rolling={rolling} />
      {pool.length > 0 && (
        <View style={styles.poolBadge}>
          <Text style={styles.poolBadgeText}>{pool.slice(0, 3).join(' ')}</Text>
        </View>
      )}
      {dice && dice.timerSeconds !== null && <Text style={styles.rollTimerText}>{dice.timerSeconds}s</Text>}
    </Pressable>
  );
}

function DiceProgressRing({
  progress,
  remote,
}: {
  progress: number;
  remote: boolean;
}) {
  const ticks = 28;
  const clamped = Math.max(0, Math.min(1, progress));
  const radius = remote ? 47 : 50;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: ticks }, (_, index) => {
        const active = index / ticks <= clamped;
        return (
          <View
            key={index}
            style={[
              styles.progressTick,
              {
                opacity: active ? 1 : 0.14,
                transform: [
                  { rotate: `${(360 / ticks) * index}deg` },
                  { translateY: -radius },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

function PlayerAvatar({
  player,
  active,
  size,
  onPress,
}: {
  player: Player;
  active: boolean;
  size: number;
  onPress?: () => void;
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
      <View style={[styles.playerColorRing, { backgroundColor: PLAYER_HEX[player.color] }]} />
    </Pressable>
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
            <Text style={styles.statsName} numberOfLines={1}>{player.name}</Text>
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

        <View style={styles.statsFooter}>
          <Pressable style={styles.reportButton}>
            <Ionicons name="warning" size={24} color="#fff" />
          </Pressable>
          <Pressable style={styles.muteButton}>
            <Ionicons name="chatbubble-ellipses" size={20} color="#143400" />
            <Text style={styles.muteText}>MUTE</Text>
          </Pressable>
        </View>
      </View>
    </View>
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

function hopsForMove(from: { kind: string }, dieValue: number): number {
  if (from.kind === 'home') return 1;
  return dieValue;
}

function getPerspectiveColor(
  state: ReturnType<typeof useGameStore.getState>['state'],
  isLocalBotGame: boolean,
  myColor: Color | null,
): Color {
  if (!isLocalBotGame && myColor) return myColor;
  return state.players.find((p) => !p.isAI)?.color ?? state.players[0]?.color ?? 'blue';
}

function seatPlayersByCorner(players: Player[], perspectiveColor: Color) {
  const seats: Partial<Record<'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft', Player>> = {};
  for (const player of players) {
    seats[visualCornerForColor(player.color, perspectiveColor)] = player;
  }
  return seats;
}

function normalizeMatchBoardState(
  boardState: ReturnType<typeof useGameStore.getState>['state'],
  matchPlayers: MatchPlayerEntry[],
  anchorColor?: Color | null,
): ReturnType<typeof useGameStore.getState>['state'] {
  if (matchPlayers.length === 0) return boardState;
  const byColor = new Map(matchPlayers.map((p) => [p.color, p]));
  let changed = false;
  let players = boardState.players.map((player) => {
    const matchPlayer = byColor.get(player.color);
    if (!matchPlayer) return player;
    const isAI = !!matchPlayer.is_bot;
    if (player.isAI === isAI) return player;
    changed = true;
    return { ...player, isAI };
  });

  if (
    players.length === 2 &&
    !isOppositePair(players[0].color, players[1].color)
  ) {
    const localIdx = anchorColor ? players.findIndex((p) => p.color === anchorColor) : -1;
    const humanIdx = players.findIndex((p) => !p.isAI);
    const anchorIdx = localIdx >= 0 ? localIdx : humanIdx >= 0 ? humanIdx : 0;
    const otherIdx = anchorIdx === 0 ? 1 : 0;
    const otherColor = oppositeColor(players[anchorIdx].color);
    players = players.map((player, index) =>
      index === otherIdx ? recolorPlayer(player, otherColor) : player,
    );
    changed = true;
  }

  return changed ? { ...boardState, players, lastRollByColor: remapLastRolls(boardState.lastRollByColor, players) } : boardState;
}

function recolorPlayer(player: Player, color: Color): Player {
  return {
    ...player,
    color,
    tokens: player.tokens.map((token, index) => ({
      ...token,
      id: `${color}-${index}` as TokenId,
      color,
    })) as Player['tokens'],
  };
}

function remapLastRolls(
  rolls: ReturnType<typeof useGameStore.getState>['state']['lastRollByColor'],
  players: Player[],
) {
  const next: ReturnType<typeof useGameStore.getState>['state']['lastRollByColor'] = {};
  for (const player of players) {
    if (rolls[player.color]) next[player.color] = rolls[player.color];
  }
  return next;
}

function makeHint(
  state: ReturnType<typeof useGameStore.getState>['state'],
  isMyTurn: boolean,
  currentPlayer: Player | undefined,
): string {
  if (state.winnerColor) return '';
  if (!currentPlayer) return '';
  if (!isMyTurn) {
    if (state.status === 'awaiting_roll') return `${currentPlayer.name} is about to roll...`;
    if (state.status === 'rolling') return `${currentPlayer.name} is rolling...`;
    if (state.status === 'awaiting_move') return `${currentPlayer.name} is choosing a move...`;
    return ' ';
  }
  if (state.status === 'awaiting_roll') {
    return state.dicePool.length > 0
      ? 'Rolled a six - roll again!'
      : 'Tap ROLL to start your turn.';
  }
  if (state.status === 'rolling') return 'Rolling...';
  if (state.status === 'awaiting_move') {
    return state.dicePool.length > 1
      ? 'Tap a token, then pick which die to use.'
      : 'Tap a highlighted token to move.';
  }
  return ' ';
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050201' },
  tableOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(24,7,28,0.86)',
  },
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
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  hudButtonLabel: {
    position: 'absolute',
    bottom: 7,
    color: colors.text,
    fontSize: 8,
    fontWeight: '900',
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
  hudBadgeText: { color: '#fff', fontSize: 12, fontWeight: '900' },
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
  resourceText: { color: colors.text, fontSize: 14, fontWeight: '900' },
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
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  opponentLayer: {
    minHeight: 118,
    paddingHorizontal: 10,
    paddingTop: 18,
  },
  remoteSeat: {
    position: 'absolute',
    right: 10,
    top: 6,
    alignItems: 'flex-end',
  },
  remoteName: {
    marginTop: 4,
    maxWidth: 150,
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    textShadowColor: '#000',
    textShadowRadius: 4,
  },
  miniSeat: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    opacity: 0.9,
  },
  sideSeatLeft: { left: 10, top: 18 },
  sideSeatRight: { left: 10, top: 72 },
  miniDie: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#E3E5EA',
    borderWidth: 2,
    borderColor: '#705531',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniDieText: { color: '#1E1E24', fontWeight: '900', fontSize: 12 },
  avatarShell: {
    padding: 3,
    borderWidth: 3,
    backgroundColor: '#281035',
    shadowColor: '#000',
    shadowOpacity: 0.32,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
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
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  diceBubble: {
    minWidth: 82,
    minHeight: 78,
    borderRadius: 15,
    backgroundColor: '#7A4B35',
    borderWidth: 4,
    borderColor: '#A75A33',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOpacity: 0.38,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 10,
    overflow: 'visible',
  },
  remoteDiceBubble: {
    position: 'absolute',
    right: 60,
    top: 18,
    minWidth: 76,
    minHeight: 72,
    backgroundColor: '#8B7928',
    borderColor: colors.goldDark,
  },
  diceBubbleActive: {
    borderColor: colors.gold,
    shadowColor: colors.gold,
    shadowOpacity: 0.45,
  },
  dicePointer: {
    position: 'absolute',
    right: -14,
    width: 0,
    height: 0,
    borderTopWidth: 11,
    borderBottomWidth: 11,
    borderLeftWidth: 15,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#A75A33',
  },
  poolBadge: {
    position: 'absolute',
    right: -8,
    top: -9,
    minWidth: 24,
    minHeight: 22,
    borderRadius: 10,
    backgroundColor: '#0E9AC5',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  poolBadgeText: { color: '#fff', fontWeight: '900', fontSize: 11 },
  progressTick: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 3,
    height: 8,
    marginLeft: -1.5,
    marginTop: -4,
    borderRadius: 2,
    backgroundColor: colors.goldLight,
  },
  rollTimerText: {
    position: 'absolute',
    right: 5,
    bottom: 2,
    color: colors.goldLight,
    fontSize: 9,
    fontWeight: '900',
  },
  boardWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 0,
  },
  boardSquare: {
    position: 'relative',
    shadowColor: colors.gold,
    shadowOpacity: 0.42,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 18,
  },
  localBarPlaceholder: { minHeight: 154 },
  localBar: {
    minHeight: 154,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
  },
  localName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 5,
    textShadowColor: '#000',
    textShadowRadius: 4,
  },
  localControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickStack: {
    gap: 5,
    alignItems: 'center',
  },
  quickButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
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
  gemCostText: { color: colors.text, fontWeight: '900', fontSize: 13 },
  chatRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  chatButton: {
    minWidth: 96,
    height: 39,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatButtonText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 100,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    backgroundColor: 'rgba(0,0,0,0.68)',
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
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 24,
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
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
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
    fontSize: 21,
    fontWeight: '900',
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
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  countryText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
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
    fontSize: 20,
    fontWeight: '900',
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
    fontSize: 12,
    fontWeight: '800',
  },
  statValue: {
    marginTop: 3,
    color: '#fff',
    fontSize: 17,
    fontWeight: '900',
  },
  statsFooter: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reportButton: {
    width: 58,
    height: 50,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  muteButton: {
    height: 50,
    minWidth: 126,
    paddingHorizontal: 18,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#79D929',
    borderWidth: 2,
    borderColor: '#B7FF73',
    shadowColor: '#143400',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  muteText: {
    color: '#143400',
    fontSize: 16,
    fontWeight: '900',
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    height: 18,
    paddingHorizontal: spacing.md,
    paddingTop: 1,
    textAlign: 'center',
  },
});
