// Zustand store wrapping the pure game state. Keeps the rules engine pure
// (`src/game/`) and exposes UI-friendly actions.

import { create } from 'zustand';

import { chooseMove } from '@/src/game/ai';
import {
  advanceTurn,
  applyMove,
  getValidMoves,
  hasNoMoves,
  makeInitialGameState,
  rollDice,
} from '@/src/game/rules';
import type { Color, GameState, MoveOption } from '@/src/game/types';

type GameStore = {
  state: GameState;
  /** Last roll's legal moves, computed when the dice settles. */
  validMoves: MoveOption[];
  /** True while a roll animation is playing. */
  isRolling: boolean;

  newGame: (humanColor?: Color, botCount?: number) => void;
  /** Caller is responsible for setting isRolling=true, calling roll() after the dice anim finishes. */
  beginRollAnim: () => void;
  roll: () => number;
  selectMove: (move: MoveOption, opts?: { afterApply?: () => void }) => void;
  /** Clear the dice + advance turn, given the dice that was played. */
  finishTurn: (rolled: number, capturedAny: boolean) => void;
};

export const useGameStore = create<GameStore>((set, get) => ({
  state: makeInitialGameState('red', 3),
  validMoves: [],
  isRolling: false,

  newGame: (humanColor = 'red', botCount = 3) =>
    set({
      state: makeInitialGameState(humanColor, botCount),
      validMoves: [],
      isRolling: false,
    }),

  beginRollAnim: () => set({ isRolling: true }),

  roll: () => {
    const value = rollDice();
    const { state } = get();
    const moves = getValidMoves(state, state.players[state.currentPlayerIdx].color, value);
    set({
      state: { ...state, dice: value, status: moves.length > 0 ? 'awaiting_move' : 'idle' },
      validMoves: moves,
      isRolling: false,
    });
    return value;
  },

  selectMove: (move, opts) => {
    const { state } = get();
    const newState = applyMove(state, move);
    set({ state: { ...newState, status: 'animating' }, validMoves: [] });
    opts?.afterApply?.();
  },

  finishTurn: (rolled, capturedAny) => {
    const { state } = get();
    if (state.winnerColor) {
      set({ state: { ...state, status: 'finished' } });
      return;
    }
    set({ state: advanceTurn(state, rolled, capturedAny), validMoves: [] });
  },
}));

// Re-export helpers the screen uses so it doesn't import from rules directly.
export { hasNoMoves, chooseMove };
