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
  /** Load an existing game state (used for multiplayer matches loaded from DB). */
  loadGame: (state: GameState) => void;
  /** Begin the dice tumble animation. status: awaiting_roll → rolling. */
  beginRoll: () => void;
  /**
   * Materialize the roll. status: rolling → awaiting_roll | awaiting_move | next-turn.
   * Pass externalValue to use a server-generated die (multiplayer); omit for local RNG.
   * Returns the value that was rolled.
   */
  finishRoll: (externalValue?: number) => number;
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

  loadGame: (gameState) =>
    set({ state: gameState, validMoves: [] }),

  beginRoll: () =>
    set((s) => ({ state: { ...s.state, status: 'rolling' } })),

  finishRoll: (externalValue?: number) => {
    const value = externalValue ?? rollDice();
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
