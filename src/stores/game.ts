// Zustand store wrapping the pure game state. Keeps the rules engine pure
// (`src/game/`) and exposes UI-friendly actions matching the new dice-pool
// turn machine: awaiting_roll → rolling → awaiting_move → animating → ...

import { create } from 'zustand';

import { chooseMove } from '@/src/game/ai';
import {
  addRoll,
  advanceToNextPlayer,
  applyMove,
  finishMove,
  getValidMoves,
  makeInitialGameState,
  rollDice,
  type HumanProfile,
} from '@/src/game/rules';
import type { Color, GameState, MoveOption } from '@/src/game/types';

type GameStore = {
  state: GameState;
  /** Legal moves for the current player given the current dice pool. */
  validMoves: MoveOption[];

  newGame: (humanColor?: Color, botCount?: number, human?: HumanProfile) => void;
  /** Begin the dice tumble animation. status: awaiting_roll → rolling. */
  beginRoll: () => void;
  /**
   * Materialize the roll. status: rolling → awaiting_roll | awaiting_move | next-turn.
   * Returns the value that was rolled (used by the screen to show the settled die).
   */
  finishRoll: () => number;
  /** Apply a chosen move + die. status: awaiting_move → animating. */
  selectMove: (move: MoveOption) => void;
  /** Settle the move animation. Decides next state. */
  finishMoveAnim: () => void;
};

export const useGameStore = create<GameStore>((set, get) => ({
  state: makeInitialGameState('red', 3),
  validMoves: [],

  newGame: (humanColor = 'red', botCount = 3, human) =>
    set({
      state: makeInitialGameState(humanColor, botCount, human),
      validMoves: [],
    }),

  beginRoll: () =>
    set((s) => ({ state: { ...s.state, status: 'rolling' } })),

  finishRoll: () => {
    const value = rollDice();
    let next = addRoll(get().state, value);
    let moves = next.status === 'awaiting_move'
      ? getValidMoves(next, next.players[next.currentPlayerIdx].color)
      : [];
    // If we landed in awaiting_move with no legal play, skip the turn.
    if (next.status === 'awaiting_move' && moves.length === 0) {
      next = advanceToNextPlayer({ ...next, dicePool: [] });
      moves = [];
    }
    set({ state: next, validMoves: moves });
    return value;
  },

  selectMove: (move) => {
    const next = applyMove(get().state, move);
    set({ state: next, validMoves: [] });
  },

  finishMoveAnim: () => {
    const next = finishMove(get().state);
    const moves =
      next.status === 'awaiting_move'
        ? getValidMoves(next, next.players[next.currentPlayerIdx].color)
        : [];
    set({ state: next, validMoves: moves });
  },
}));

export { chooseMove };
