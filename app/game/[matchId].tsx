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
  Image,
  ImageBackground,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TokenDicePicker } from '@/src/components/TokenDicePicker';
import { getAvatar } from '@/src/constants/profile';
import { botThinkDelay } from '@/src/game/bots';
import { cellForToken, type Cell } from '@/src/game/board';
import { cellForPerspective, visualCornerForColor, type VisualCorner } from '@/src/game/perspective';
import { pathCellsForMove } from '@/src/game/rules';
import { assignRuntimeColors, isOppositePair, oppositeColor } from '@/src/game/seating';
import type { Color, MatchPlayer, Player, Token as GameToken, TokenId } from '@/src/game/types';
import { Images } from '@/src/assets';
import { supabase } from '@/src/supabase/client';
import { getSupabaseErrorMessage } from '@/src/supabase/errors';
import {
  claimOpponentLeft,
  getMatch,
  forfeitMatch,
  moveTokenServer,
  rollDiceServer,
  skipRollTurnServer,
  subscribeMatch,
  syncBoardStateServer,
} from '@/src/supabase/matches';
import {
  boardVersion,
  shouldApplyMatchEvent,
  withBoardVersion,
  type MatchPresence,
  type MatchRealtimeEvent,
} from '@/src/supabase/matchRealtime';
import { BoardCanvas, boardGeometry } from '@/src/skia/Board';
import { Dice } from '@/src/skia/Dice';
import { Particles, type Burst } from '@/src/skia/Particles';
import { Token as TokenView } from '@/src/skia/Token';
import { haptics } from '@/src/utils/haptics';
import { sound } from '@/src/utils/sound';
import { useProfileStore } from '@/src/stores/profile';
import type { Profile } from '@/src/stores/profile';
import { chooseMove, useGameStore } from '@/src/stores/game';
import { colors } from '@/src/theme/colors';
import { fontFamilies, spacing } from '@/src/theme/typography';

const PLAYER_HEX: Record<Color, string> = {
  red: colors.red,
  green: colors.green,
  yellow: colors.yellow,
  blue: colors.blue,
};

const CITY_BACKGROUNDS: Record<string, ImageSourcePropType> = {
  newdelhi: Images.cityNewDelhi,
  'new-delhi': Images.cityNewDelhi,
  delhi: Images.cityNewDelhi,
  dehli: Images.cityNewDelhi,
  london: Images.cityLondon,
  istanbul: Images.cityIstanbul,
  dubai: Images.cityDubai,
  doha: Images.cityDoha,
  singapore: Images.citySingapore,
  tokyo: Images.cityTokyo,
  paris: Images.cityParis,
  rome: Images.cityRome,
  berlin: Images.cityBerlin,
  brazil: Images.cityBrazil,
};

const ROLL_ANIM_MS = 360;
const MP_ROLL_SETTLE_MS = 120;
const ROLL_TIMEOUT_MS = 5000;
const ROLL_TIMER_TICK_MS = 250;
const OPPONENT_ABSENCE_GRACE_MS = 12_000;
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
  const gameMode = mode === '3p' ? '3p' : mode === '4p' ? '4p' : '2p';

  // Solo = client-only path; multiplayer = server dice + Realtime sync
  const isSoloMatchId = !matchId || matchId.startsWith('solo-');
  const [botBackedMatch, setBotBackedMatch] = useState(false);
  const isLocalBotGame = isSoloMatchId;
  const [localUserId, setLocalUserId] = useState<string | null>(null);
  const [botDriverUserId, setBotDriverUserId] = useState<string | null>(null);

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [requiresRoomPresence, setRequiresRoomPresence] = useState(false);
  const [roomReady, setRoomReady] = useState(true);
  const [matchCitySlug, setMatchCitySlug] = useState<string | null>(null);

  const profile = useProfileStore((s) => s.profile);
  const hydrateProfile = useProfileStore((s) => s.hydrate);

  // ── Multiplayer-specific state ──
  const [myColor, setMyColor] = useState<Color | null>(null);
  // Stable refs to avoid stale closures in Realtime callbacks
  const stateRef = useRef(state);
  const myColorRef = useRef(myColor);
  const localUserIdRef = useRef<string | null>(null);
  const botDriverUserIdRef = useRef<string | null>(null);
  const matchPlayersRef = useRef<MatchPlayerEntry[]>([]);
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const leavingRef = useRef(false);
  const timeoutInFlightRef = useRef(false);
  const opponentWasPresentRef = useRef(false);
  const opponentForfeitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opponentForfeitInFlightRef = useRef(false);
  const localSeatColorsRef = useRef<Color[] | null>(null);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { myColorRef.current = myColor; }, [myColor]);
  useEffect(() => { botDriverUserIdRef.current = botDriverUserId; }, [botDriverUserId]);

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
  }, [matchId, gameMode, citySlug]);

  const boardSize = Math.min(
    width - spacing.xs,
    height * (Platform.OS === 'android' ? 0.48 : 0.5),
    430,
  );
  const { inset: boardInset, cell: cellPx } = boardGeometry(boardSize);
  const tokenSize = cellPx * 0.98;

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

  const applyRealtimeEvent = useCallback((event: MatchRealtimeEvent) => {
    if (event.matchId !== matchId) return;
    const currentVersion = boardVersion(stateRef.current);
    if (!shouldApplyMatchEvent(event, currentVersion, seenEventIdsRef.current)) return;
    seenEventIdsRef.current.add(event.eventId);

    if (event.type === 'sync_required' || !event.boardState) {
      void reloadMatchSnapshot();
      return;
    }

    loadGame(normalizeMatchBoardState(event.boardState, matchPlayersRef.current, myColorRef.current));
  }, [loadGame, matchId, reloadMatchSnapshot]);

  const clearOpponentForfeitTimer = useCallback(() => {
    if (opponentForfeitTimerRef.current) clearTimeout(opponentForfeitTimerRef.current);
    opponentForfeitTimerRef.current = null;
  }, []);

  const handleRoomPresence = useCallback((presence: MatchPresence[]) => {
    const localUserId = localUserIdRef.current;
    const humanPlayers = matchPlayersRef.current.filter(
      (p) => !p.is_bot && !p.user_id.startsWith('bot-'),
    );
    if (!matchId || humanPlayers.length !== 2 || !localUserId || stateRef.current.winnerColor) {
      setRoomReady(true);
      clearOpponentForfeitTimer();
      return;
    }

    const opponent = humanPlayers.find((p) => p.user_id !== localUserId);
    if (!opponent) {
      setRoomReady(false);
      clearOpponentForfeitTimer();
      return;
    }

    const onlineIds = new Set(presence.map((p) => p.userId));
    const selfOnline = onlineIds.has(localUserId);
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
          if (result?.boardState) {
            loadGame(normalizeMatchBoardState(result.boardState, matchPlayersRef.current, myColorRef.current));
          }
        });
      }, OPPONENT_ABSENCE_GRACE_MS);
    }
  }, [clearOpponentForfeitTimer, loadGame, matchId]);

  // ── Effect: Solo init - new game when mount or profile settles. ──
  useEffect(() => {
    if (!isSoloMatchId) return;
    const targetCount = gameMode === '2p' ? 2 : gameMode === '3p' ? 3 : 4;
    if (!localSeatColorsRef.current || localSeatColorsRef.current.length !== targetCount) {
      localSeatColorsRef.current = assignRuntimeColors(targetCount);
    }
    const seatColors = localSeatColorsRef.current;
    const humanColor = seatColors[0];
    const human = profile
      ? { name: profile.username, avatarId: profile.avatarId }
      : undefined;
    newGame(humanColor, targetCount - 1, human, seatColors);
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
      localUserIdRef.current = session.user.id;
      setLocalUserId(session.user.id);
      supabase.realtime.setAuth(session.access_token);

      const match = await getMatch(matchId);
      if (!match) return;
      setMatchCitySlug(match.city_slug ?? null);

      const me = match.players.find((p) => p.user_id === session.user.id);
      if (!me) return;

      setMyColor(me.color);
      const matchPlayers = match.players as MatchPlayerEntry[];
      matchPlayersRef.current = matchPlayers;
      const isBotBacked = matchPlayers.some((p) => p.is_bot) ||
        match.board_state.players.some((p) => p.isAI);
      const onlineHumanCount = matchPlayers.filter((p) => !p.is_bot && !p.user_id.startsWith('bot-')).length;
      const shouldRequirePresence = !isBotBacked && gameMode === '2p' && onlineHumanCount === 2;
      const firstHuman = matchPlayers.find((p) => !p.is_bot && !p.user_id.startsWith('bot-'));
      setBotBackedMatch(isBotBacked);
      setBotDriverUserId(firstHuman?.user_id ?? null);
      setRequiresRoomPresence(shouldRequirePresence);
      setRoomReady(!shouldRequirePresence);
      myColorRef.current = me.color;
      loadGame(normalizeMatchBoardState(match.board_state, matchPlayers, me.color));

      unsubscribeRealtime = subscribeMatch(matchId, applyRealtimeEvent, (status) => {
        if (status === 'subscribed') void reloadMatchSnapshot();
        if (status === 'error' || status === 'timed_out') {
          console.warn('[game] match broadcast status:', status);
        }
      }, shouldRequirePresence ? {
        self: {
          userId: session.user.id,
          color: me.color,
          username: profile?.username,
        },
        onPresence: handleRoomPresence,
      } : undefined);
    };

    init();
    return () => {
      clearOpponentForfeitTimer();
      unsubscribeRealtime?.();
    };
  }, [
    applyRealtimeEvent,
    clearOpponentForfeitTimer,
    gameMode,
    handleRoomPresence,
    isSoloMatchId,
    loadGame,
    matchId,
    profile?.username,
    reloadMatchSnapshot,
  ]);

  const currentPlayer: Player | undefined = state.players[state.currentPlayerIdx];
  const perspectiveColor = getPerspectiveColor(state, myColor);
  const isDrivenBotTurn =
    !isSoloMatchId &&
    !!botBackedMatch &&
    !!currentPlayer?.isAI &&
    !!localUserId &&
    localUserId === botDriverUserId;

  const isMyTurn = isLocalBotGame
    ? !!currentPlayer && !currentPlayer.isAI
    : !!currentPlayer && !currentPlayer.isAI && currentPlayer.color === myColor && (!requiresRoomPresence || roomReady);

  const shouldRunRollTimer =
    state.status === 'awaiting_roll' &&
    !state.winnerColor &&
    !!currentPlayer &&
    !currentPlayer.isAI &&
    (isLocalBotGame ? isMyTurn : !!matchId && !!myColor && (!requiresRoomPresence || roomReady));

  // ── Effect: dice tumble has played out - settle the value. ──
  // Solo: use local RNG after a fixed timeout.
  // Multiplayer: call roll-dice EF, wait for response, then settle.
  useEffect(() => {
    if (state.status !== 'rolling') return;
    if (!isLocalBotGame && !isMyTurn && !isDrivenBotTurn) return; // opponent's roll - we'll get it via Realtime

    if (isLocalBotGame || isDrivenBotTurn) {
      const t = setTimeout(() => {
        finishRoll();
        haptics.medium();
        sound.play('roll');
        if (isDrivenBotTurn && matchId) {
          setTimeout(() => {
            const nextState = useGameStore.getState().state;
            const nextPlayer = nextState.players[nextState.currentPlayerIdx];
            if (nextState.status !== 'awaiting_move' || !nextPlayer?.isAI) {
              void syncBoardStateServer(matchId, nextState).then((result) => {
                if (result?.boardState) {
                  loadGame(normalizeMatchBoardState(result.boardState, matchPlayersRef.current, myColorRef.current));
                }
              });
            }
          }, 0);
        }
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
  }, [state.status, isMyTurn, isLocalBotGame, isDrivenBotTurn, matchId, finishRoll, loadGame]);

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
    if (!isLocalBotGame && !isDrivenBotTurn) return;
    if (state.status !== 'awaiting_roll' || !currentPlayer?.isAI) return;
    if (state.winnerColor) return;
    const t = setTimeout(() => {
      beginRoll();
    }, botThinkDelay());
    return () => clearTimeout(t);
  }, [isLocalBotGame, isDrivenBotTurn, state.status, currentPlayer, state.winnerColor, beginRoll]);

  // ── Effect: AI is awaiting_move - schedule a pick (solo only). ──
  useEffect(() => {
    if (!isLocalBotGame && !isDrivenBotTurn) return;
    if (state.status !== 'awaiting_move' || !currentPlayer?.isAI) return;
    if (state.winnerColor) return;
    const t = setTimeout(() => {
      const pick = chooseMove(state, currentPlayer.color);
      if (pick) selectMove(pick);
    }, botThinkDelay());
    return () => clearTimeout(t);
  }, [isLocalBotGame, isDrivenBotTurn, state, currentPlayer, selectMove]);

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
        });
        return;
      }
      if (!isLocalBotGame && isDrivenBotTurn && matchId) {
        finishMoveAnim();
        setTimeout(() => {
          const nextState = useGameStore.getState().state;
          void syncBoardStateServer(matchId, nextState).then((result) => {
            if (result?.boardState) {
              loadGame(normalizeMatchBoardState(result.boardState, matchPlayersRef.current, myColorRef.current));
            }
          });
        }, 0);
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
    isDrivenBotTurn,
    isMyTurn,
    matchId,
    finishMoveAnim,
    loadGame,
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
    sound.play(youWon ? 'victory' : 'defeat');
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
          mode: gameMode,
        },
      });
    }, 1500);
    return () => clearTimeout(t);
  }, [state.winnerColor, state.players, boardSize, isLocalBotGame, myColor, matchId, entryFee, citySlug, gameMode]);

  // ── Effect: capture -> particle burst. ──
  useEffect(() => {
    const move = state.lastMove;
    if (!move?.captures.length) return;
    const tokens = state.players.flatMap((p) => p.tokens);
    const moving = tokens.find((tt) => tt.id === move.tokenId);
    if (!moving) return;
    const dest = cellForPerspective(cellForToken(moving), perspectiveColor);
    const cx = boardInset + (dest.col + 0.5) * cellPx;
    const cy = boardInset + (dest.row + 0.5) * cellPx;
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
  }, [state.lastMove, state.players, boardInset, cellPx, perspectiveColor]);

  // ── Effect: token finish -> sound. ──
  useEffect(() => {
    const move = state.lastMove;
    if (!move) return;
    if (move.to.kind === 'finished') {
      const arriveMs = Math.max(1, hopsForMove(move.from, move.dieValue)) * HOP_MS;
      const t = setTimeout(() => {
        sound.play('finish');
      }, arriveMs);
      return () => clearTimeout(t);
    }
  }, [state.lastMove]);

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
    sound.play('roll');
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
      selectMove(move);
    }
  }

  // ── derived ──
  async function leaveMatch() {
    if (leavingRef.current) return;
    leavingRef.current = true;
    haptics.tap();
    setMenuOpen(false);

    if (!isLocalBotGame && matchId && !state.winnerColor) {
      await forfeitMatch(matchId);
    }

    router.replace('/(tabs)/home');
  }

  function onExitPress() {
    haptics.tap();
    setMenuOpen(true);
  }

  const allTokens = useMemo(
    () => state.players.flatMap((p) => p.tokens),
    [state.players],
  );

  const tokenCenters = useMemo(
    () => buildTokenCenters(allTokens, perspectiveColor, boardInset, cellPx, tokenSize),
    [allTokens, perspectiveColor, boardInset, cellPx, tokenSize],
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
        cx: boardInset + (visual.col + 0.5) * cellPx,
        cy: boardInset + (visual.row + 0.5) * cellPx,
      };
    });
    const captureDelayMs = Math.max(0, hopPath.length - 1) * HOP_MS;
    const capturedIds = new Set(move.captures);
    return { movingTokenId: move.tokenId, hopPath, capturedIds, captureDelayMs };
  }, [state.lastMove, state.players, boardInset, cellPx, perspectiveColor]);

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
    return tokenCenters.get(tok.id) ?? null;
  })();

  const byCorner = seatPlayersByCorner(state.players, perspectiveColor);
  const timerProgress = shouldRunRollTimer ? rollTimerRemaining / ROLL_TIMEOUT_MS : null;
  const localPlayer = byCorner.bottomLeft;
  const cornerPlayers = (['topLeft', 'topRight', 'bottomRight'] as const)
    .map((corner) => ({ corner, player: byCorner[corner] }))
    .filter((seat): seat is { corner: Exclude<VisualCorner, 'bottomLeft'>; player: Player } =>
      !!seat.player && seat.player.color !== localPlayer?.color,
    );
  const activeDiceProps = {
    dicePool: state.dicePool,
    displayRoll: state.lastRollByColor[currentPlayer.color] ?? null,
    isRolling: state.status === 'rolling',
    canRoll: isMyTurn && state.status === 'awaiting_roll' && !state.winnerColor,
    onRoll: onHumanRoll,
    timerProgress,
  };
  const cityTableSource = citySourceForSlug(matchCitySlug ?? citySlug);

  if (!currentPlayer) return null;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ImageBackground source={cityTableSource ?? Images.bgHome} style={StyleSheet.absoluteFill} resizeMode="cover">
        <View style={styles.tableOverlay} />
      </ImageBackground>

      <TopHud
        gems={profile?.gems ?? 0}
        matchId={matchId ?? 'local'}
        onExit={onExitPress}
      />

      <View style={styles.playArea} pointerEvents="box-none">
        <View style={[styles.boardAnchor, { width: boardSize, height: boardSize }]} pointerEvents="box-none">
          <View style={styles.opponentLayer} pointerEvents="box-none">
            {cornerPlayers.map(({ corner, player }) => (
              <CornerSeat
                key={player.color}
                corner={corner}
                player={player}
                active={currentPlayer.color === player.color}
                lastRoll={state.lastRollByColor[player.color] ?? null}
                dice={currentPlayer.color === player.color ? activeDiceProps : null}
                onProfilePress={() => setStatsPlayer(player)}
              />
            ))}
          </View>

          <View style={[styles.boardWrap, { width: boardSize, height: boardSize }]}>
            <View style={[styles.boardSquare, { width: boardSize, height: boardSize }]}>
              <ImageBackground
                source={cityTableSource ?? Images.bgHome}
                style={[StyleSheet.absoluteFill, styles.boardSurface]}
                imageStyle={styles.boardCityImage}
                resizeMode="cover"
              >
                <View style={styles.boardCityTint} />
                <BoardCanvas size={boardSize} perspectiveColor={perspectiveColor} />
              </ImageBackground>
              <View style={[StyleSheet.absoluteFill, styles.tokenLayer]} pointerEvents="box-none">
                {allTokens.map((t) => {
                  const center = tokenCenters.get(t.id);
                  if (!center) return null;
                  const movable = isMyTurn && state.status === 'awaiting_move' && movableTokenIds.has(t.id);
                  const isMoving = moveAnim?.movingTokenId === t.id;
                  const isCaptured = moveAnim?.capturedIds.has(t.id) ?? false;
                  return (
                    <TokenView
                      key={t.id}
                      color={t.color}
                      cx={center.cx}
                      cy={center.cy}
                      size={center.size}
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
                    offset={pickerCenter.size / 2}
                    boardSize={boardSize}
                    values={pickerValues}
                    onPick={onPickerSelect}
                  />
                )}
              </View>
              <View style={[StyleSheet.absoluteFill, styles.particleLayer]} pointerEvents="none">
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
        </View>
      </View>
      {statsPlayer && (
        <PlayerStatsModal
          player={statsPlayer}
          profile={statsPlayer.color === localPlayer?.color ? profile : null}
          onClose={() => setStatsPlayer(null)}
        />
      )}
      <GameMenuModal
        visible={menuOpen}
        online={!isLocalBotGame && !state.winnerColor}
        onResume={() => setMenuOpen(false)}
        onQuit={leaveMatch}
      />
    </SafeAreaView>
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
          <Pressable
            onPress={onResume}
            style={({ pressed }) => [styles.menuButton, pressed && styles.menuButtonPressed]}
          >
            <Ionicons name="play" size={20} color={colors.bg} />
            <Text style={styles.menuButtonText}>RESUME</Text>
          </Pressable>
          <Pressable
            onPress={onQuit}
            style={({ pressed }) => [styles.menuQuitButton, pressed && styles.menuButtonPressed]}
          >
            <Ionicons name="exit-outline" size={20} color="#fff" />
            <Text style={styles.menuQuitText}>QUIT GAME</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

type DiceHudProps = {
  dicePool: number[];
  displayRoll: number | null;
  isRolling: boolean;
  canRoll: boolean;
  onRoll: () => void;
  timerProgress: number | null;
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

function CornerSeat({
  corner,
  player,
  active,
  lastRoll,
  dice,
  onProfilePress,
}: {
  corner: Exclude<VisualCorner, 'bottomLeft'>;
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
        <Text style={[styles.remoteName, align === 'left' && styles.remoteNameLeft]} numberOfLines={1}>{player.name}</Text>
      )}
    </View>
  );
}

function cornerSeatStyle(corner: Exclude<VisualCorner, 'bottomLeft'>) {
  switch (corner) {
    case 'topLeft':
      return styles.cornerSeatTopLeft;
    case 'topRight':
      return styles.cornerSeatTopRight;
    case 'bottomRight':
      return styles.cornerSeatBottomRight;
  }
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
        <Text style={styles.localName} numberOfLines={1}>{player.name}</Text>
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

function AvatarProgressRing({ progress, size }: { progress: number; size: number }) {
  const ticks = 32;
  const clamped = Math.max(0, Math.min(1, progress));
  const radius = size / 2 + 5;

  return (
    <View pointerEvents="none" style={styles.avatarProgressRing}>
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
  timerProgress = null,
}: {
  player: Player;
  active: boolean;
  size: number;
  onPress?: () => void;
  timerProgress?: number | null;
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
      {timerProgress !== null && <AvatarProgressRing progress={timerProgress} size={size} />}
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
  myColor: Color | null,
): Color {
  if (myColor) return myColor;
  return state.players.find((p) => !p.isAI)?.color ?? state.players[0]?.color ?? 'blue';
}

function citySourceForSlug(slug?: string | string[] | null): ImageSourcePropType | undefined {
  const value = Array.isArray(slug) ? slug[0] : slug;
  if (!value) return undefined;
  const normalized = value.toLowerCase().replace(/[\s_]+/g, '-');
  return CITY_BACKGROUNDS[normalized] ?? CITY_BACKGROUNDS[normalized.replace(/-/g, '')];
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
  const versionedBoardState = withBoardVersion(boardState);
  if (matchPlayers.length === 0) return versionedBoardState;
  const byColor = new Map(matchPlayers.map((p) => [p.color, p]));
  let changed = false;
  let players = versionedBoardState.players.map((player) => {
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

  return changed
    ? { ...versionedBoardState, players, lastRollByColor: remapLastRolls(versionedBoardState.lastRollByColor, players) }
    : versionedBoardState;
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

function buildTokenCenters(
  tokens: GameToken[],
  perspectiveColor: Color,
  boardInset: number,
  cellPx: number,
  tokenSize: number,
): Map<TokenId, { cx: number; cy: number; size: number }> {
  const grouped = new Map<string, { token: GameToken; cell: Cell }[]>();

  for (const token of tokens) {
    const cell = visualCellForToken(token, perspectiveColor);
    const key = token.location.kind === 'finished'
      ? `finished:${token.color}`
      : `${cell.col.toFixed(2)}:${cell.row.toFixed(2)}`;
    const group = grouped.get(key) ?? [];
    group.push({ token, cell });
    grouped.set(key, group);
  }

  const centers = new Map<TokenId, { cx: number; cy: number; size: number }>();
  for (const group of grouped.values()) {
    const sorted = [...group].sort((a, b) => a.token.id.localeCompare(b.token.id));
    sorted.forEach(({ token, cell }, index) => {
      const size = stackedTokenSize(tokenSize, sorted.length);
      const offset = token.location.kind === 'finished'
        ? finishedStackOffset(token.color, perspectiveColor, index, sorted.length, size)
        : stackOffset(index, sorted.length, size);
      centers.set(token.id, {
        cx: boardInset + (cell.col + 0.5) * cellPx + offset.dx,
        cy: boardInset + (cell.row + 0.5) * cellPx + offset.dy,
        size,
      });
    });
  }

  return centers;
}

function visualCellForToken(token: GameToken, perspectiveColor: Color): Cell {
  if (token.location.kind === 'finished') {
    return finishedCellForColor(token.color, perspectiveColor);
  }
  return cellForPerspective(cellForToken(token), perspectiveColor);
}

function finishedCellForColor(color: Color, perspectiveColor: Color): Cell {
  switch (sideForVisualCorner(visualCornerForColor(color, perspectiveColor))) {
    case 'top':
      return { col: 7, row: 6.34 };
    case 'right':
      return { col: 7.66, row: 7 };
    case 'bottom':
      return { col: 7, row: 7.66 };
    case 'left':
      return { col: 6.34, row: 7 };
  }
}

function stackedTokenSize(tokenSize: number, count: number): number {
  if (count <= 1) return tokenSize;
  if (count === 2) return tokenSize * 0.86;
  if (count === 3) return tokenSize * 0.76;
  return tokenSize * 0.68;
}

function stackOffset(index: number, count: number, tokenSize: number) {
  if (count <= 1) return { dx: 0, dy: 0 };
  const step = tokenSize * 0.13;
  const middle = (count - 1) / 2;
  const amount = (index - middle) * step;
  return { dx: amount, dy: -amount * 0.62 };
}

function finishedStackOffset(
  color: Color,
  perspectiveColor: Color,
  index: number,
  count: number,
  tokenSize: number,
) {
  if (count <= 1) return { dx: 0, dy: 0 };
  const base = stackOffset(index, count, tokenSize);
  const nudge = (index - (count - 1) / 2) * tokenSize * 0.1;
  switch (sideForVisualCorner(visualCornerForColor(color, perspectiveColor))) {
    case 'top':
      return { dx: base.dx, dy: nudge };
    case 'right':
      return { dx: -nudge, dy: base.dy };
    case 'bottom':
      return { dx: base.dx, dy: -nudge };
    case 'left':
      return { dx: nudge, dy: base.dy };
  }
}

function sideForVisualCorner(corner: VisualCorner): 'top' | 'right' | 'bottom' | 'left' {
  switch (corner) {
    case 'topLeft':
      return 'left';
    case 'topRight':
      return 'top';
    case 'bottomRight':
      return 'right';
    case 'bottomLeft':
      return 'bottom';
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050201' },
  tableOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(12,4,18,0.48)',
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
    fontFamily: fontFamilies.heading,
    fontSize: 8,
    fontWeight: '400',
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
  hudBadgeText: { color: '#fff', fontFamily: fontFamilies.heading, fontWeight: '400', fontSize: 12 },
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
  resourceText: { color: colors.text, fontFamily: fontFamilies.heading, fontWeight: '400', fontSize: 14 },
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
    fontWeight: '400',
    letterSpacing: 1.5,
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
  opponentLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 8,
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
    fontWeight: '400',
    textShadowColor: '#000',
    textShadowRadius: 4,
  },
  remoteNameLeft: {
    textAlign: 'left',
  },
  avatarShell: {
    padding: 2,
    borderWidth: 2,
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
    marginHorizontal: 0,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
    overflow: 'visible',
  },
  remoteDiceBubble: {
    position: 'absolute',
    right: 64,
    top: 8,
    minWidth: 54,
    minHeight: 48,
    backgroundColor: '#A38621',
    borderColor: colors.goldDark,
  },
  remoteDiceBubbleLeft: {
    position: 'absolute',
    left: 64,
    top: 8,
    minWidth: 54,
    minHeight: 48,
    backgroundColor: '#A38621',
    borderColor: colors.goldDark,
  },
  diceBubbleActive: {
    borderColor: colors.gold,
    shadowColor: colors.gold,
    shadowOpacity: 0.45,
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
    marginBottom: 0,
  },
  poolDiceRowCompact: {
    marginTop: 8,
    marginBottom: 0,
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
  boardWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 0,
  },
  boardSquare: {
    position: 'relative',
    overflow: 'visible',
    borderRadius: 12,
  },
  boardSurface: {
    overflow: 'hidden',
    borderRadius: 12,
  },
  boardCityImage: {
    opacity: 0,
    borderRadius: 12,
  },
  boardCityTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  tokenLayer: {
    zIndex: 4,
    overflow: 'visible',
  },
  particleLayer: {
    zIndex: 3,
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
    fontWeight: '400',
    height: 25,
    marginBottom: 0,
    textShadowColor: '#000',
    textShadowRadius: 4,
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
  gemCostText: { color: colors.text, fontFamily: fontFamilies.heading, fontWeight: '400', fontSize: 12 },
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
    fontWeight: '400',
    fontSize: 13,
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
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 20,
  },
  menuTitle: {
    color: colors.goldLight,
    fontFamily: fontFamilies.heading,
    fontWeight: '400',
    fontSize: 24,
    letterSpacing: 1,
    textAlign: 'center',
  },
  menuSubtitle: {
    color: 'rgba(255,255,255,0.62)',
    fontFamily: fontFamilies.body,
    fontWeight: '400',
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
    fontWeight: '400',
    fontSize: 15,
    letterSpacing: 1.5,
  },
  menuQuitText: {
    color: '#fff',
    fontFamily: fontFamilies.heading,
    fontWeight: '400',
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
    fontFamily: fontFamilies.heading,
    fontSize: 21,
    fontWeight: '400',
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
    fontWeight: '400',
    textAlign: 'center',
  },
  countryText: {
    color: colors.text,
    fontFamily: fontFamilies.heading,
    fontSize: 14,
    fontWeight: '400',
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
    fontWeight: '400',
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
    fontWeight: '400',
  },
  statValue: {
    marginTop: 3,
    color: '#fff',
    fontFamily: fontFamilies.heading,
    fontSize: 17,
    fontWeight: '400',
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
    fontFamily: fontFamilies.heading,
    fontSize: 16,
    fontWeight: '400',
  },
});
