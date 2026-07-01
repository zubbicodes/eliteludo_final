import { useCallback, useEffect, useMemo, useRef, type MutableRefObject } from 'react';

import type { MatchBoardState, MoveOption } from '@/src/game/types';
import { boardVersion, shouldApplyMatchEvent, type MatchRealtimeEvent } from '@/src/supabase/matchRealtimeEvents';

import { REALTIME_BATCH_WINDOW_MS } from './constants';
import { sameMoveOption } from './moveOption';

type Options = {
  currentVersion: number;
  optimisticMove: MoveOption | null;
  seenEventIdsRef: MutableRefObject<Set<string>>;
  onApplyBoardState: (boardState: MatchBoardState, event: MatchRealtimeEvent) => void;
  onReloadSnapshot: () => void;
  batchWindowMs?: number;
};

export function pickNewestValidEvent(
  events: MatchRealtimeEvent[],
  currentVersion: number,
  seenEventIds: ReadonlySet<string>,
) {
  let newest: MatchRealtimeEvent | null = null;
  for (const event of events) {
    if (!shouldApplyMatchEvent(event, currentVersion, seenEventIds)) continue;
    if (!newest || event.version > newest.version) newest = event;
  }
  return newest;
}

export function shouldDeferEventForOptimisticMove(
  event: MatchRealtimeEvent,
  optimisticMove: MoveOption | null,
) {
  if (!optimisticMove || !event.boardState) return false;
  return sameMoveOption(event.boardState.lastMove, optimisticMove);
}

export function shouldReconcileBoardState(
  boardState: MatchBoardState | undefined | null,
  currentVersion: number,
) {
  return !!boardState && boardVersion(boardState) > currentVersion;
}

export function useRealtimeBoardQueue({
  currentVersion,
  optimisticMove,
  seenEventIdsRef,
  onApplyBoardState,
  onReloadSnapshot,
  batchWindowMs = REALTIME_BATCH_WINDOW_MS,
}: Options) {
  const queueRef = useRef<MatchRealtimeEvent[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deferredEventRef = useRef<MatchRealtimeEvent | null>(null);
  const currentVersionRef = useRef(currentVersion);
  const optimisticMoveRef = useRef(optimisticMove);
  const applyBoardStateRef = useRef(onApplyBoardState);
  const reloadSnapshotRef = useRef(onReloadSnapshot);

  useEffect(() => {
    currentVersionRef.current = currentVersion;
  }, [currentVersion]);

  useEffect(() => {
    optimisticMoveRef.current = optimisticMove;
  }, [optimisticMove]);

  useEffect(() => {
    applyBoardStateRef.current = onApplyBoardState;
  }, [onApplyBoardState]);

  useEffect(() => {
    reloadSnapshotRef.current = onReloadSnapshot;
  }, [onReloadSnapshot]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const applyEvent = useCallback((event: MatchRealtimeEvent) => {
    seenEventIdsRef.current.add(event.eventId);
    if (event.type === 'sync_required' || !event.boardState) {
      reloadSnapshotRef.current();
      return;
    }
    applyBoardStateRef.current(event.boardState, event);
  }, [seenEventIdsRef]);

  const flush = useCallback(() => {
    clearTimer();
    const currentVersionValue = currentVersionRef.current;
    const candidate = pickNewestValidEvent(
      queueRef.current,
      currentVersionValue,
      seenEventIdsRef.current,
    );
    queueRef.current = [];
    if (!candidate) return;
    if (shouldDeferEventForOptimisticMove(candidate, optimisticMoveRef.current)) {
      deferredEventRef.current = candidate;
      return;
    }
    deferredEventRef.current = null;
    applyEvent(candidate);
  }, [applyEvent, clearTimer, seenEventIdsRef]);

  const enqueueEvent = useCallback((event: MatchRealtimeEvent) => {
    queueRef.current.push(event);
    if (!timerRef.current) {
      timerRef.current = setTimeout(flush, batchWindowMs);
    }
  }, [batchWindowMs, flush]);

  useEffect(() => {
    if (!optimisticMove && deferredEventRef.current) {
      const deferred = deferredEventRef.current;
      deferredEventRef.current = null;
      if (!shouldApplyMatchEvent(deferred, currentVersion, seenEventIdsRef.current)) return;
      applyEvent(deferred);
    }
  }, [applyEvent, currentVersion, optimisticMove, seenEventIdsRef]);

  useEffect(() => () => {
    clearTimer();
    queueRef.current = [];
    deferredEventRef.current = null;
  }, [clearTimer]);

  return useMemo(() => ({ enqueueEvent, flush }), [enqueueEvent, flush]);
}
