// Game screen - solo vs-AI and 1v1 multiplayer.
// Solo path (matchId starts with "solo-"): fully client-side, no server calls.
// Multiplayer path: dice via roll-dice Edge Function, board sync via Realtime.
//
// Turn flow handled by independent effects. Each effect schedules at most one
// timer and cleans up on state change to avoid timer-clobber bugs.

import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DiceTray } from '@/src/components/DiceTray';
import { PlayerProfile } from '@/src/components/PlayerProfile';
import { TokenDicePicker } from '@/src/components/TokenDicePicker';
import { BOARD_SIZE, cellForToken } from '@/src/game/board';
import { pathCellsForMove } from '@/src/game/rules';
import type { Color, MatchPlayer, Player, TokenId } from '@/src/game/types';
import { Images } from '@/src/assets';
import { supabase } from '@/src/supabase/client';
import { getSupabaseErrorMessage } from '@/src/supabase/errors';
import {
  getMatch,
  forfeitMatch,
  moveTokenServer,
  pushBoardState,
  rollDiceServer,
  skipRollTurnServer,
  subscribeMatch,
} from '@/src/supabase/matches';
import { BoardCanvas } from '@/src/skia/Board';
import { Particles, type Burst } from '@/src/skia/Particles';
import { Token as TokenView } from '@/src/skia/Token';
import { haptics } from '@/src/utils/haptics';
import { sound } from '@/src/utils/sound';
import { useProfileStore } from '@/src/stores/profile';
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
const LOCAL_MOVE_COMMIT_GRACE_MS = 5000;
const HOP_MS = 130;
const MIN_MOVE_MS = 220;
const CAPTURE_TAIL_MS = 260;

export default function GameScreen() {
  const { matchId, mode, entryFee, citySlug } = useLocalSearchParams<{
    matchId: string;
    mode?: string;
    entryFee?: string;
    citySlug?: string;
  }>();
  const { width } = useWindowDimensions();
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
  const [displayDiceValue, setDisplayDiceValue] = useState<number | null>(null);
  const [rollTimerRemaining, setRollTimerRemaining] = useState(ROLL_TIMEOUT_MS);

  const profile = useProfileStore((s) => s.profile);
  const hydrateProfile = useProfileStore((s) => s.hydrate);

  // ── Multiplayer-specific state ──
  const [myColor, setMyColor] = useState<Color | null>(null);
  // Stable refs to avoid stale closures in Realtime callbacks
  const stateRef = useRef(state);
  const myColorRef = useRef(myColor);
  const mpPlayersRef = useRef<MatchPlayer[] | null>(null);
  const prevPlayerIdxRef = useRef(-1);
  const prevStatusRef = useRef(state.status);
  const leavingRef = useRef(false);
  const suppressNextSyncRef = useRef(false);
  const timeoutInFlightRef = useRef(false);
  const localMovePendingRef = useRef(false);
  const localMoveReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { myColorRef.current = myColor; }, [myColor]);

  useEffect(() => {
    hydrateProfile();
  }, [hydrateProfile]);

  const boardSize = Math.min(width - spacing.md * 2, 380);
  const cellPx = boardSize / BOARD_SIZE;
  const tokenSize = cellPx * 0.98;

  const holdLocalMoveCommit = useCallback(() => {
    localMovePendingRef.current = true;
    if (localMoveReleaseTimerRef.current) clearTimeout(localMoveReleaseTimerRef.current);
    localMoveReleaseTimerRef.current = setTimeout(() => {
      localMovePendingRef.current = false;
      localMoveReleaseTimerRef.current = null;
    }, LOCAL_MOVE_COMMIT_GRACE_MS);
  }, []);

  const releaseLocalMoveCommit = useCallback(() => {
    localMovePendingRef.current = false;
    if (localMoveReleaseTimerRef.current) {
      clearTimeout(localMoveReleaseTimerRef.current);
      localMoveReleaseTimerRef.current = null;
    }
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

  useEffect(() => () => {
    if (localMoveReleaseTimerRef.current) clearTimeout(localMoveReleaseTimerRef.current);
  }, []);

  // ── Effect: Solo init - new game when mount or profile settles. ──
  useEffect(() => {
    if (!isSoloMatchId) return;
    const humanColor = (profile?.colorId as Color | undefined) ?? 'red';
    const human = profile
      ? { name: profile.username, avatarId: profile.avatarId }
      : undefined;
    newGame(humanColor, gameMode === '2p' ? 1 : 3, human);
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
      setBotBackedMatch(match.players.some((p: MatchPlayer & { is_bot?: boolean }) => p.is_bot) ||
        match.board_state.players.some((p) => p.isAI));
      myColorRef.current = me.color;
      mpPlayersRef.current = match.players;
      prevPlayerIdxRef.current = match.board_state.currentPlayerIdx;
      loadGame(match.board_state);

      unsubscribeRealtime = subscribeMatch(matchId, (newBoardState) => {
        if (!shouldHydrateRemoteBoard()) return;
        loadGame(newBoardState);
      });
    };

    init();
    return () => { unsubscribeRealtime?.(); };
  }, [isSoloMatchId, matchId, loadGame, shouldHydrateRemoteBoard]);

  // Realtime should be the fast path, but polling prevents a stuck board if a
  // mobile socket drops or the channel fails to join.
  useEffect(() => {
    if (isSoloMatchId || !matchId || !myColor) return;

    let cancelled = false;
    const poll = async () => {
      const match = await getMatch(matchId);
      if (cancelled || !match) return;

      if (!shouldHydrateRemoteBoard()) return;

      loadGame(match.board_state);
    };

    const interval = setInterval(poll, 1800);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isSoloMatchId, matchId, myColor, loadGame, shouldHydrateRemoteBoard]);

  const currentPlayer: Player | undefined = state.players[state.currentPlayerIdx];

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
        const value = finishRoll();
        setDisplayDiceValue(value);
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
            suppressNextSyncRef.current = true;
            prevPlayerIdxRef.current = result.boardState.currentPlayerIdx;
            prevStatusRef.current = result.boardState.status;
            loadGame(result.boardState);
            return;
          }
          loadGame({ ...stateRef.current, status: 'awaiting_roll' });
          return;
        }
        setDisplayDiceValue(result.value);
        if (result.boardState) {
          suppressNextSyncRef.current = true;
          prevPlayerIdxRef.current = result.boardState.currentPlayerIdx;
          prevStatusRef.current = result.boardState.status;
          loadGame(result.boardState);
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
        suppressNextSyncRef.current = true;
        prevPlayerIdxRef.current = result.boardState.currentPlayerIdx;
        prevStatusRef.current = result.boardState.status;
        loadGame(result.boardState);
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
      setDisplayDiceValue(null);
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
            suppressNextSyncRef.current = true;
            prevPlayerIdxRef.current = result.boardState.currentPlayerIdx;
            prevStatusRef.current = result.boardState.status;
            loadGame(result.boardState);
          } else {
            void getMatch(matchId).then((match) => {
              if (match) loadGame(match.board_state);
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
    const dest = cellForToken(moving);
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
  }, [state.lastMove, state.players, cellPx]);

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

  // ── Effect (multiplayer): push board state to DB when my turn ends. ──
  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = state.status;

    if (isLocalBotGame || !matchId || !myColor) return;
    if (suppressNextSyncRef.current) {
      suppressNextSyncRef.current = false;
      prevPlayerIdxRef.current = state.currentPlayerIdx;
      return;
    }
    if (
      state.status !== 'awaiting_roll' &&
      state.status !== 'awaiting_move' &&
      state.status !== 'finished'
    ) {
      return;
    }

    const myIdx = state.players.findIndex((p) => p.color === myColor);
    const prev = prevPlayerIdxRef.current;
    prevPlayerIdxRef.current = state.currentPlayerIdx;

    const completedLocalMove = prevStatus === 'animating' && prev === myIdx;

    // Push after every local move settles, and when my turn ends.
    if (prev === myIdx && (state.currentPlayerIdx !== myIdx || completedLocalMove)) {
      const nextColor = state.players[state.currentPlayerIdx].color;
      const nextEntry = mpPlayersRef.current?.find((p) => p.color === nextColor);
      void pushBoardStateWithRetry(matchId, state, nextEntry?.user_id ?? null)
        .then((synced) => {
          if (synced) releaseLocalMoveCommit();
        });
    }
  }, [state, isLocalBotGame, matchId, myColor, releaseLocalMoveCommit]);

  // ── handlers ──

  function onHumanRoll() {
    if (!isMyTurn || state.status !== 'awaiting_roll') return;
    haptics.tap();
    setDisplayDiceValue(null);
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
    const hopPath = cells.map((c) => ({
      cx: (c.col + 0.5) * cellPx,
      cy: (c.row + 0.5) * cellPx,
    }));
    const captureDelayMs = Math.max(0, hopPath.length - 1) * HOP_MS;
    const capturedIds = new Set(move.captures);
    return { movingTokenId: move.tokenId, hopPath, capturedIds, captureDelayMs };
  }, [state.lastMove, state.players, cellPx]);

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
  const isTwoPlayerGame = state.players.length <= 2;
  const topLeft = isTwoPlayerGame ? state.players[0] : byColor.get('red');
  const topRight = isTwoPlayerGame ? state.players[1] : byColor.get('green');
  const bottomLeft = isTwoPlayerGame ? undefined : byColor.get('blue');
  const bottomRight = isTwoPlayerGame ? undefined : byColor.get('yellow');
  const rollLabel = state.dicePool.length > 0 ? 'ROLL AGAIN' : 'ROLL';
  const hint = makeHint(state, isMyTurn, currentPlayer);
  const timerProgress = shouldRunRollTimer ? rollTimerRemaining / ROLL_TIMEOUT_MS : null;
  const timerSeconds = shouldRunRollTimer ? Math.ceil(rollTimerRemaining / 1000) : null;

  if (!currentPlayer) return null;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ImageBackground source={Images.bgHome} style={StyleSheet.absoluteFill} resizeMode="cover">
        <View style={styles.tableOverlay} />
      </ImageBackground>

      <View style={styles.header}>
        <Pressable onPress={onExitPress} hitSlop={12} style={styles.exitBtn}>
          <Text style={styles.back}>EXIT</Text>
        </Pressable>
        <View style={styles.turnBadge}>
          <View
            style={[styles.dot, { backgroundColor: PLAYER_HEX[currentPlayer.color] }]}
          />
          <Text style={styles.turnText}>
            {isMyTurn ? 'Your turn' : `${currentPlayer.name}'s turn`}
          </Text>
        </View>
        <Text style={styles.matchId}>#{(matchId ?? 'local').slice(-6)}</Text>
      </View>

      <LinearGradient
        colors={['rgba(212,175,55,0.22)', 'rgba(212,175,55,0.03)', 'rgba(212,175,55,0.22)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.titlePlaque}
      >
        <Text style={styles.titleText}>ELITE LUDO</Text>
      </LinearGradient>

      <ProfileRow
        left={topLeft}
        right={topRight}
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

      {(bottomLeft || bottomRight) && (
        <ProfileRow
          left={bottomLeft}
          right={bottomRight}
          currentColor={currentPlayer.color}
          lastRollByColor={state.lastRollByColor}
        />
      )}

      <DiceTray
        pool={state.dicePool}
        isRolling={state.status === 'rolling'}
        displayValue={displayDiceValue}
        canRoll={isMyTurn && state.status === 'awaiting_roll' && !state.winnerColor}
        rollLabel={rollLabel}
        onRoll={onHumanRoll}
        timerProgress={timerProgress}
        timerSeconds={timerSeconds}
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

function hopsForMove(from: { kind: string }, dieValue: number): number {
  if (from.kind === 'home') return 1;
  return dieValue;
}

async function pushBoardStateWithRetry(
  matchId: string,
  state: ReturnType<typeof useGameStore.getState>['state'],
  nextTurnUserId: string | null,
): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const synced = await pushBoardState(matchId, state, nextTurnUserId);
    if (synced) return true;
    await delay(350 * (attempt + 1));
  }
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    backgroundColor: 'rgba(5,2,1,0.78)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: 4,
    paddingBottom: 6,
  },
  exitBtn: {
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  back: { color: colors.gold, fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  turnBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(25,10,4,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 999,
    shadowColor: colors.gold,
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 8,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  turnText: { ...typography.caption, color: colors.text, fontWeight: '800' },
  matchId: { ...typography.caption, color: 'rgba(212,175,55,0.55)' },
  titlePlaque: {
    alignSelf: 'center',
    minWidth: 190,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    paddingVertical: 6,
    paddingHorizontal: 26,
    marginBottom: 3,
  },
  titleText: {
    color: colors.gold,
    textAlign: 'center',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 4,
    textShadowColor: 'rgba(212,175,55,0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    gap: 10,
  },
  rowSpacer: { flex: 1 },
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
});
