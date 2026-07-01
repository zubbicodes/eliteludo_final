import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ImageBackground,
    Platform,
    StyleSheet,
    View,
    useWindowDimensions,
} from 'react-native';
import {
    Easing,
    cancelAnimation,
    runOnJS,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Images } from '@/src/assets';
import { botThinkDelay } from '@/src/game/bots';
import type { Color, MatchBoardState, Player, TokenId } from '@/src/game/types';
import { boardGeometry } from '@/src/skia/Board';
import type { Burst } from '@/src/skia/Particles';
import { chooseMove, useGameStore } from '@/src/stores/game';
import type { Profile } from '@/src/stores/profile';
import { useProfileStore } from '@/src/stores/profile';
import { supabase } from '@/src/supabase/client';
import { getSupabaseErrorMessage } from '@/src/supabase/errors';
import {
    claimOpponentLeft,
    forfeitMatch,
    getMatch,
    moveTokenServer,
    rollDiceServer,
    skipRollTurnServer,
    subscribeMatch,
    syncBoardStateServer,
} from '@/src/supabase/matches';
import {
    boardVersion,
    type MatchPresence,
    type MatchRealtimeEvent,
} from '@/src/supabase/matchRealtime';
import { spacing } from '@/src/theme/typography';
import { haptics } from '@/src/utils/haptics';
import { sound } from '@/src/utils/sound';

import {
    CAPTURE_TAIL_MS,
    HOP_MS,
    MIN_MOVE_MS,
    MP_ROLL_SETTLE_MS,
    OPPONENT_ABSENCE_GRACE_MS,
    ROLL_ANIM_MS,
    ROLL_TIMEOUT_MS,
} from './constants';
import { GameBoardSurface } from './GameBoardSurface';
import { GameHud, TopHud } from './GameHud';
import {
    MatchPlayerEntry,
    PLAYER_HEX,
    buildMoveAnimation,
    buildTokenCenters,
    citySourceForSlug,
    createSeatColors,
    getPerspectiveColor,
    normalizeMatchBoardState,
    seatPlayersByCorner,
    shouldLoadBoardState,
    type MoveAnimation
} from './helpers';
import { useRealtimeBoardQueue } from './useRealtimeBoardQueue';

type Props = {
  matchId: string;
  mode?: string;
  entryFee?: string;
  citySlug?: string;
};

export function GameSessionController({ matchId, mode, entryFee, citySlug }: Props) {
  const { width, height } = useWindowDimensions();
  const gameMode = mode === '3p' ? '3p' : mode === '4p' ? '4p' : '2p';
  const isSoloMatchId = !matchId || matchId.startsWith('solo-');
  const [botBackedMatch, setBotBackedMatch] = useState(false);
  const isLocalBotGame = isSoloMatchId;
  const [localUserId, setLocalUserId] = useState<string | null>(null);
  const [botDriverUserId, setBotDriverUserId] = useState<string | null>(null);
  const [pickerForToken, setPickerForToken] = useState<TokenId | null>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [statsPlayer, setStatsPlayer] = useState<Player | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [requiresRoomPresence, setRequiresRoomPresence] = useState(false);
  const [roomReady, setRoomReady] = useState(true);
  const [matchCitySlug, setMatchCitySlug] = useState<string | null>(null);
  const [myColor, setMyColor] = useState<Color | null>(null);
  const rollTimerProgress = useSharedValue(0);

  const profile = useProfileStore((store) => store.profile);
  const hydrateProfile = useProfileStore((store) => store.hydrate);
  const state = useGameStore((store) => store.state);
  const validMoves = useGameStore((store) => store.validMoves);
  const newGame = useGameStore((store) => store.newGame);
  const loadGame = useGameStore((store) => store.loadGame);
  const beginRoll = useGameStore((store) => store.beginRoll);
  const finishRoll = useGameStore((store) => store.finishRoll);
  const skipRollTurn = useGameStore((store) => store.skipRollTurn);
  const selectMove = useGameStore((store) => store.selectMove);
  const finishMoveAnim = useGameStore((store) => store.finishMoveAnim);

  const stateRef = useRef(state);
  const myColorRef = useRef(myColor);
  const matchPlayersRef = useRef<MatchPlayerEntry[]>([]);
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const leavingRef = useRef(false);
  const timeoutInFlightRef = useRef(false);
  const opponentWasPresentRef = useRef(false);
  const opponentForfeitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opponentForfeitInFlightRef = useRef(false);
  const localSeatColorsRef = useRef<Color[] | null>(null);
  const localUserIdRef = useRef<string | null>(null);
  const botDriverUserIdRef = useRef<string | null>(null);
  const isMyTurnRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    myColorRef.current = myColor;
  }, [myColor]);
  useEffect(() => {
    botDriverUserIdRef.current = botDriverUserId;
  }, [botDriverUserId]);

  useEffect(() => {
    hydrateProfile();
  }, [hydrateProfile]);

  useEffect(() => {
    localSeatColorsRef.current = null;
    seenEventIdsRef.current.clear();
    opponentWasPresentRef.current = false;
    opponentForfeitInFlightRef.current = false;
    if (opponentForfeitTimerRef.current) clearTimeout(opponentForfeitTimerRef.current);
    opponentForfeitTimerRef.current = null;
    setRequiresRoomPresence(false);
    setRoomReady(true);
    setMatchCitySlug(typeof citySlug === 'string' ? citySlug : null);
    setBotDriverUserId(null);
    setLocalUserId(null);
    setMyColor(null);
    setBotBackedMatch(false);
    setPickerForToken(null);
    rollTimerProgress.value = 0;
  }, [citySlug, gameMode, matchId, rollTimerProgress]);

  const boardSize = Math.min(
    width - spacing.xs,
    height * (Platform.OS === 'android' ? 0.48 : 0.5),
    430,
  );
  const { inset: boardInset, cell: cellPx } = boardGeometry(boardSize);
  const tokenSize = cellPx * 0.98;

  const perspectiveColor = getPerspectiveColor(state, myColor);
  const currentPlayer: Player | undefined = state.players[state.currentPlayerIdx];
  const isDrivenBotTurn =
    !isSoloMatchId &&
    !!botBackedMatch &&
    !!currentPlayer?.isAI &&
    !!localUserId &&
    localUserId === botDriverUserId;
  const isMyTurn = isLocalBotGame
    ? !!currentPlayer && !currentPlayer.isAI
    : !!currentPlayer &&
      !currentPlayer.isAI &&
      currentPlayer.color === myColor &&
      (!requiresRoomPresence || roomReady);
  isMyTurnRef.current = isMyTurn;

  const shouldRunRollTimer =
    state.status === 'awaiting_roll' &&
    !state.winnerColor &&
    !!currentPlayer &&
    !currentPlayer.isAI &&
    (isLocalBotGame ? isMyTurn : !!matchId && !!myColor && (!requiresRoomPresence || roomReady));

  const allTokens = useMemo(() => state.players.flatMap((player) => player.tokens), [state.players]);
  const tokenCenters = useMemo(
    () => buildTokenCenters(allTokens, perspectiveColor, boardInset, cellPx, tokenSize),
    [allTokens, boardInset, cellPx, perspectiveColor, tokenSize],
  );
  const moveAnimation = useMemo<MoveAnimation | null>(
    () =>
      buildMoveAnimation(state, perspectiveColor, boardInset, cellPx, HOP_MS, CAPTURE_TAIL_MS, MIN_MOVE_MS),
    [boardInset, cellPx, perspectiveColor, state],
  );
  const optimisticMove = !isLocalBotGame && state.status === 'animating' ? state.lastMove : null;
  const movableTokenIds = useMemo(() => new Set(validMoves.map((move) => move.tokenId)), [validMoves]);

  const pickerValues = pickerForToken
    ? Array.from(
        new Set(validMoves.filter((move) => move.tokenId === pickerForToken).map((move) => move.dieValue)),
      ).sort((left, right) => right - left)
    : [];
  const pickerCenter = pickerForToken
    ? tokenCenters.get(pickerForToken) ?? null
    : null;

  const applyAuthoritativeBoard = useCallback((boardState: MatchBoardState | undefined | null) => {
    if (!boardState) return;
    const normalized = normalizeMatchBoardState(boardState, matchPlayersRef.current, myColorRef.current);
    if (shouldLoadBoardState(normalized, boardVersion(stateRef.current))) {
      loadGame(normalized);
    }
  }, [loadGame]);

  const reloadMatchSnapshot = useCallback(async () => {
    if (!matchId || isSoloMatchId) return;
    const match = await getMatch(matchId);
    if (!match) return;
    setMatchCitySlug(match.city_slug ?? null);
    const remote = normalizeMatchBoardState(match.board_state, matchPlayersRef.current, myColorRef.current);
    if (boardVersion(remote) >= boardVersion(stateRef.current)) {
      loadGame(remote);
    }
  }, [isSoloMatchId, loadGame, matchId]);

  const realtimeQueue = useRealtimeBoardQueue({
    currentVersion: boardVersion(state),
    optimisticMove,
    seenEventIdsRef,
    onApplyBoardState: (boardState) => {
      loadGame(normalizeMatchBoardState(boardState, matchPlayersRef.current, myColorRef.current));
    },
    onReloadSnapshot: () => {
      void reloadMatchSnapshot();
    },
  });

  const clearOpponentForfeitTimer = useCallback(() => {
    if (opponentForfeitTimerRef.current) clearTimeout(opponentForfeitTimerRef.current);
    opponentForfeitTimerRef.current = null;
  }, []);

  const handleRoomPresence = useCallback((presence: MatchPresence[]) => {
    const localId = localUserIdRef.current;
    const humanPlayers = matchPlayersRef.current.filter(
      (player) => !player.is_bot && !player.user_id.startsWith('bot-'),
    );
    if (!matchId || humanPlayers.length !== 2 || !localId || stateRef.current.winnerColor) {
      setRoomReady(true);
      clearOpponentForfeitTimer();
      return;
    }

    const opponent = humanPlayers.find((player) => player.user_id !== localId);
    if (!opponent) {
      setRoomReady(false);
      clearOpponentForfeitTimer();
      return;
    }

    const onlineIds = new Set(presence.map((item) => item.userId));
    const selfOnline = onlineIds.has(localId);
    const opponentOnline = onlineIds.has(opponent.user_id);
    const bothPresent = selfOnline && opponentOnline;
    if (opponentOnline) opponentWasPresentRef.current = true;
    setRoomReady(bothPresent);

    if (bothPresent || leavingRef.current || stateRef.current.winnerColor) {
      clearOpponentForfeitTimer();
      return;
    }

    if (
      selfOnline &&
      opponentWasPresentRef.current &&
      !opponentOnline &&
      !opponentForfeitTimerRef.current &&
      !opponentForfeitInFlightRef.current
    ) {
      opponentForfeitTimerRef.current = setTimeout(() => {
        opponentForfeitTimerRef.current = null;
        if (leavingRef.current || stateRef.current.winnerColor || opponentForfeitInFlightRef.current) return;
        opponentForfeitInFlightRef.current = true;
        void claimOpponentLeft(matchId, opponent.user_id).then((result) => {
          opponentForfeitInFlightRef.current = false;
          applyAuthoritativeBoard(result?.boardState);
        });
      }, OPPONENT_ABSENCE_GRACE_MS);
    }
  }, [applyAuthoritativeBoard, clearOpponentForfeitTimer, matchId]);

  useEffect(() => {
    if (!isSoloMatchId) return;
    const seatColors = localSeatColorsRef.current ?? createSeatColors(gameMode);
    localSeatColorsRef.current = seatColors;
    const humanColor = seatColors[0];
    const human = profile ? { name: profile.username, avatarId: profile.avatarId } : undefined;
    newGame(humanColor, seatColors.length - 1, human, seatColors);
  }, [gameMode, isSoloMatchId, newGame, profile]);

  useEffect(() => {
    if (isSoloMatchId || !matchId) return;

    let unsubscribeRealtime: (() => void) | null = null;
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession().catch((error) => {
        console.warn('[game] getSession failed:', getSupabaseErrorMessage(error));
        return { data: { session: null } };
      });
      if (!session) return;
      localUserIdRef.current = session.user.id;
      setLocalUserId(session.user.id);
      supabase.realtime.setAuth(session.access_token);

      const match = await getMatch(matchId);
      if (!match) return;
      setMatchCitySlug(match.city_slug ?? null);

      const me = match.players.find((player) => player.user_id === session.user.id);
      if (!me) return;

      setMyColor(me.color);
      const matchPlayers = match.players as MatchPlayerEntry[];
      matchPlayersRef.current = matchPlayers;
      const isBotBacked =
        matchPlayers.some((player) => player.is_bot) || match.board_state.players.some((player) => player.isAI);
      const onlineHumanCount = matchPlayers.filter((player) => !player.is_bot && !player.user_id.startsWith('bot-')).length;
      const shouldRequirePresence = !isBotBacked && gameMode === '2p' && onlineHumanCount === 2;
      const firstHuman = matchPlayers.find((player) => !player.is_bot && !player.user_id.startsWith('bot-'));
      setBotBackedMatch(isBotBacked);
      setBotDriverUserId(firstHuman?.user_id ?? null);
      setRequiresRoomPresence(shouldRequirePresence);
      setRoomReady(!shouldRequirePresence);
      loadGame(normalizeMatchBoardState(match.board_state, matchPlayers, me.color));

      unsubscribeRealtime = subscribeMatch(
        matchId,
        (event: MatchRealtimeEvent) => {
          if (event.matchId !== matchId) return;
          realtimeQueue.enqueueEvent(event);
        },
        (status) => {
          if (status === 'subscribed') void reloadMatchSnapshot();
          if (status === 'error' || status === 'timed_out') {
            console.warn('[game] match broadcast status:', status);
          }
        },
        shouldRequirePresence
          ? {
              self: {
                userId: session.user.id,
                color: me.color,
                username: profile?.username,
              },
              onPresence: handleRoomPresence,
            }
          : undefined,
      );
    };

    void init();
    return () => {
      clearOpponentForfeitTimer();
      unsubscribeRealtime?.();
    };
  }, [
    clearOpponentForfeitTimer,
    gameMode,
    handleRoomPresence,
    isSoloMatchId,
    loadGame,
    matchId,
    profile?.username,
    realtimeQueue,
    reloadMatchSnapshot,
  ]);

  useEffect(() => {
    if (state.status !== 'rolling') return;
    if (!isLocalBotGame && !isMyTurn && !isDrivenBotTurn) return;

    if (isLocalBotGame || isDrivenBotTurn) {
      const timeout = setTimeout(() => {
        finishRoll();
        haptics.medium();
        sound.play('roll');
        if (isDrivenBotTurn && matchId) {
          setTimeout(() => {
            const nextState = useGameStore.getState().state;
            const nextPlayer = nextState.players[nextState.currentPlayerIdx];
            if (nextState.status !== 'awaiting_move' || !nextPlayer?.isAI) {
              void syncBoardStateServer(matchId, nextState).then((result) => {
                applyAuthoritativeBoard(result?.boardState);
              });
            }
          }, 0);
        }
      }, ROLL_ANIM_MS);
      return () => clearTimeout(timeout);
    }

    let cancelled = false;
    const startedAt = Date.now();
    void rollDiceServer(matchId).then((result) => {
      if (cancelled) return;
      const wait = Math.max(0, MP_ROLL_SETTLE_MS - (Date.now() - startedAt));
      setTimeout(() => {
        if (cancelled) return;
        if (!result) {
          loadGame({ ...stateRef.current, status: 'awaiting_roll' });
          return;
        }
        if (typeof result.value !== 'number') {
          applyAuthoritativeBoard(result.boardState);
          if (!result.boardState) loadGame({ ...stateRef.current, status: 'awaiting_roll' });
          return;
        }
        applyAuthoritativeBoard(result.boardState);
        if (!result.boardState) finishRoll(result.value);
        haptics.medium();
        sound.play('roll');
      }, wait);
    });
    return () => {
      cancelled = true;
    };
  }, [
    applyAuthoritativeBoard,
    finishRoll,
    isDrivenBotTurn,
    isLocalBotGame,
    isMyTurn,
    loadGame,
    matchId,
    state.status,
  ]);

  const onRollTimerExpired = useCallback(async (turnPlayerIdx: number) => {
    if (timeoutInFlightRef.current) return;
    timeoutInFlightRef.current = true;
    haptics.warning();
    if (isLocalBotGame) {
      if (isMyTurnRef.current) skipRollTurn();
      return;
    }
    if (!matchId) return;
    const result = await skipRollTurnServer(matchId, turnPlayerIdx);
    applyAuthoritativeBoard(result?.boardState);
  }, [applyAuthoritativeBoard, isLocalBotGame, matchId, skipRollTurn]);

  useEffect(() => {
    timeoutInFlightRef.current = false;
    cancelAnimation(rollTimerProgress);
    rollTimerProgress.value = 0;
    if (!shouldRunRollTimer) return;

    const turnPlayerIdx = state.currentPlayerIdx;
    rollTimerProgress.value = 1;
    rollTimerProgress.value = withTiming(
      0,
      { duration: ROLL_TIMEOUT_MS, easing: Easing.linear },
      (finished) => {
        if (finished) runOnJS(onRollTimerExpired)(turnPlayerIdx);
      },
    );
    return () => {
      cancelAnimation(rollTimerProgress);
    };
  }, [onRollTimerExpired, rollTimerProgress, shouldRunRollTimer, state.currentPlayerIdx]);

  useEffect(() => {
    if (!isLocalBotGame && !isDrivenBotTurn) return;
    if (state.status !== 'awaiting_roll' || !currentPlayer?.isAI || state.winnerColor) return;
    const timeout = setTimeout(() => {
      beginRoll();
    }, botThinkDelay());
    return () => clearTimeout(timeout);
  }, [beginRoll, currentPlayer, isDrivenBotTurn, isLocalBotGame, state.status, state.winnerColor]);

  useEffect(() => {
    if (!isLocalBotGame && !isDrivenBotTurn) return;
    if (state.status !== 'awaiting_move' || !currentPlayer?.isAI || state.winnerColor) return;
    const timeout = setTimeout(() => {
      const pick = chooseMove(state, currentPlayer.color);
      if (pick) selectMove(pick);
    }, botThinkDelay());
    return () => clearTimeout(timeout);
  }, [currentPlayer, isDrivenBotTurn, isLocalBotGame, selectMove, state]);

  const handleMoveAnimationComplete = useCallback(() => {
    const move = useGameStore.getState().state.lastMove;
    if (!move) return;
    if (!isLocalBotGame && isMyTurn && matchId) {
      void moveTokenServer(matchId, move.tokenId, move.dieValue).then((result) => {
        if (result?.boardState) {
          applyAuthoritativeBoard(result.boardState);
          return;
        }
        void reloadMatchSnapshot();
      });
      return;
    }
    if (!isLocalBotGame && isDrivenBotTurn && matchId) {
      finishMoveAnim();
      setTimeout(() => {
        const nextState = useGameStore.getState().state;
        void syncBoardStateServer(matchId, nextState).then((result) => {
          applyAuthoritativeBoard(result?.boardState);
        });
      }, 0);
      return;
    }
    finishMoveAnim();
  }, [
    applyAuthoritativeBoard,
    finishMoveAnim,
    isDrivenBotTurn,
    isLocalBotGame,
    isMyTurn,
    matchId,
    reloadMatchSnapshot,
  ]);

  useEffect(() => {
    if (!moveAnimation || !state.lastMove?.captures.length) return;
    const moving = allTokens.find((token) => token.id === state.lastMove?.tokenId);
    if (!moving) return;
    const center = tokenCenters.get(moving.id);
    if (!center) return;
    const baseId = `cap-${Date.now()}`;
    const captureColors = state.lastMove.captures
      .map((id) => allTokens.find((token) => token.id === id)?.color)
      .filter((color): color is Color => !!color);
    const timeout = setTimeout(() => {
      haptics.heavy();
      sound.play('capture');
      setBursts(
        captureColors.map((color, index) => ({
          id: `${baseId}-${index}`,
          cx: center.cx,
          cy: center.cy,
          color: PLAYER_HEX[color],
          kind: 'capture' as const,
        })),
      );
    }, moveAnimation.captureDelayMs);
    return () => clearTimeout(timeout);
  }, [allTokens, moveAnimation, state.lastMove, tokenCenters]);

  useEffect(() => {
    if (!moveAnimation || state.lastMove?.to.kind !== 'finished') return;
    const timeout = setTimeout(() => {
      sound.play('finish');
    }, moveAnimation.baseDurationMs);
    return () => clearTimeout(timeout);
  }, [moveAnimation, state.lastMove]);

  useEffect(() => {
    if (bursts.length === 0) return;
    const timeout = setTimeout(() => setBursts([]), 1600);
    return () => clearTimeout(timeout);
  }, [bursts]);

  useEffect(() => {
    if (!state.winnerColor) return;
    const winColor = state.winnerColor;
    const humanColor = isLocalBotGame
      ? state.players.find((player) => !player.isAI)?.color
      : myColor;
    const youWon = isLocalBotGame
      ? !state.players.find((player) => player.color === winColor)?.isAI
      : winColor === myColor;
    if (youWon) haptics.success();
    else haptics.warning();
    sound.play(youWon ? 'victory' : 'defeat');
    setBursts([
      {
        id: `win-${Date.now()}`,
        cx: boardSize / 2,
        cy: boardSize / 2,
        color: PLAYER_HEX[winColor],
        kind: 'win',
      },
    ]);
    const timeout = setTimeout(() => {
      router.replace({
        pathname: '/game/result',
        params: {
          winner: winColor as string,
          matchId: matchId ?? '',
          entryFee: entryFee ?? '0',
          citySlug: citySlug ?? '',
          humanColor: humanColor ?? '',
          mode: gameMode,
        },
      });
    }, 1500);
    return () => clearTimeout(timeout);
  }, [boardSize, citySlug, entryFee, gameMode, isLocalBotGame, matchId, myColor, state.players, state.winnerColor]);

  useEffect(() => {
    setPickerForToken(null);
  }, [state.currentPlayerIdx, state.dicePool.length, state.status]);

  const onHumanRoll = useCallback(() => {
    if (!isMyTurn || state.status !== 'awaiting_roll') return;
    haptics.tap();
    sound.play('roll');
    beginRoll();
  }, [beginRoll, isMyTurn, state.status]);

  const onTokenTap = useCallback((tokenId: TokenId) => {
    if (!isMyTurn || state.status !== 'awaiting_move') return;
    if (pickerForToken === tokenId) {
      setPickerForToken(null);
      return;
    }
    const options = validMoves.filter((move) => move.tokenId === tokenId);
    if (options.length === 0) return;
    haptics.tap();
    const uniqueValues = Array.from(new Set(options.map((move) => move.dieValue)));
    if (uniqueValues.length === 1) {
      setPickerForToken(null);
      selectMove(options[0]);
      return;
    }
    setPickerForToken(tokenId);
  }, [isMyTurn, pickerForToken, selectMove, state.status, validMoves]);

  const onPickerSelect = useCallback((value: number) => {
    if (!pickerForToken) return;
    const move = validMoves.find(
      (candidate) => candidate.tokenId === pickerForToken && candidate.dieValue === value,
    );
    setPickerForToken(null);
    if (move) {
      haptics.tap();
      selectMove(move);
    }
  }, [pickerForToken, selectMove, validMoves]);

  const leaveMatch = useCallback(async () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    haptics.tap();
    setMenuOpen(false);
    if (!isLocalBotGame && matchId && !state.winnerColor) {
      await forfeitMatch(matchId);
    }
    router.replace('/(tabs)/home');
  }, [isLocalBotGame, matchId, state.winnerColor]);

  const byCorner = seatPlayersByCorner(state.players, perspectiveColor);
  const localPlayer = byCorner.bottomLeft;
  const cornerPlayers = (['topLeft', 'topRight', 'bottomRight'] as const)
    .map((corner) => ({ corner, player: byCorner[corner] }))
    .filter((seat): seat is { corner: 'topLeft' | 'topRight' | 'bottomRight'; player: Player } => !!seat.player && seat.player.color !== localPlayer?.color);
  const activeDiceProps = {
    dicePool: state.dicePool,
    displayRoll: currentPlayer ? state.lastRollByColor[currentPlayer.color] ?? null : null,
    isRolling: state.status === 'rolling',
    canRoll: isMyTurn && state.status === 'awaiting_roll' && !state.winnerColor,
    onRoll: onHumanRoll,
    timerProgress: shouldRunRollTimer ? rollTimerProgress : null,
  };
  const cityTableSource = citySourceForSlug(matchCitySlug ?? citySlug) ?? Images.bgHome;

  if (!currentPlayer) return null;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ImageBackground source={cityTableSource} style={StyleSheet.absoluteFill} resizeMode="cover">
        <View style={styles.tableOverlay} />
      </ImageBackground>

      <TopHud gems={profile?.gems ?? 0} matchId={matchId ?? 'local'} onExit={() => setMenuOpen(true)} />

      <View style={styles.playArea} pointerEvents="box-none">
        <View style={[styles.boardAnchor, { width: boardSize, height: boardSize }]} pointerEvents="box-none">
          <GameBoardSurface
            boardSize={boardSize}
            cityTableSource={cityTableSource}
            perspectiveColor={perspectiveColor}
            tokens={allTokens}
            tokenCenters={tokenCenters}
            movableTokenIds={isMyTurn && state.status === 'awaiting_move' ? movableTokenIds : new Set<TokenId>()}
            moveAnimation={moveAnimation}
            pickerForToken={pickerForToken}
            pickerValues={pickerValues}
            pickerCenter={pickerCenter}
            bursts={bursts}
            onTokenTap={onTokenTap}
            onPickerSelect={onPickerSelect}
            onMoveAnimationComplete={handleMoveAnimationComplete}
          />
          <GameHud
            showTopHud={false}
            gems={profile?.gems ?? 0}
            matchId={matchId ?? 'local'}
            boardSize={boardSize}
            localPlayer={localPlayer}
            cornerPlayers={cornerPlayers}
            currentPlayerColor={currentPlayer.color}
            lastRollByColor={state.lastRollByColor}
            activeDiceProps={activeDiceProps}
            canUndo={state.status === 'awaiting_move' && isMyTurn}
            menuOpen={menuOpen}
            statsPlayer={statsPlayer}
            localProfile={profile as Profile | null}
            online={!isLocalBotGame && !state.winnerColor}
            onExit={() => setMenuOpen(true)}
            onCloseMenu={() => setMenuOpen(false)}
            onQuit={leaveMatch}
            onOpenStats={setStatsPlayer}
            onCloseStats={() => setStatsPlayer(null)}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#050201',
  },
  tableOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(12,4,18,0.48)',
  },
  playArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  boardAnchor: {
    position: 'relative',
    overflow: 'visible',
  },
});
