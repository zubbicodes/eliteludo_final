import type { ImageSourcePropType } from 'react-native';

import { Images } from '@/src/assets';
import { cellForToken, type Cell } from '@/src/game/board';
import { cellForPerspective, visualCornerForColor, type VisualCorner } from '@/src/game/perspective';
import { pathCellsForMove } from '@/src/game/rules';
import { assignRuntimeColors, isOppositePair, oppositeColor } from '@/src/game/seating';
import type {
  Color,
  GameState,
  MatchBoardState,
  MatchPlayer,
  Player,
  Token as GameToken,
  TokenId,
} from '@/src/game/types';
import { boardVersion, withBoardVersion } from '@/src/supabase/matchRealtime';
import { colors } from '@/src/theme/colors';

export { sameMoveOption } from './moveOption';

export type MatchPlayerEntry = MatchPlayer & { is_bot?: boolean };

export type TokenCenter = {
  cx: number;
  cy: number;
  size: number;
};

export type MoveAnimation = {
  movingTokenId: TokenId;
  hopPath: { cx: number; cy: number }[];
  capturedTokenIds: TokenId[];
  captureDelayMs: number;
  totalDurationMs: number;
  baseDurationMs: number;
};

export const PLAYER_HEX: Record<Color, string> = {
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

export function createSeatColors(gameMode: '2p' | '3p' | '4p') {
  const targetCount = gameMode === '2p' ? 2 : gameMode === '3p' ? 3 : 4;
  return assignRuntimeColors(targetCount);
}

export function hopsForMove(from: { kind: string }, dieValue: number): number {
  if (from.kind === 'home') return 1;
  return dieValue;
}

export function getPerspectiveColor(state: GameState, myColor: Color | null): Color {
  if (myColor) return myColor;
  return state.players.find((player) => !player.isAI)?.color ?? state.players[0]?.color ?? 'blue';
}

export function citySourceForSlug(slug?: string | string[] | null): ImageSourcePropType | undefined {
  const value = Array.isArray(slug) ? slug[0] : slug;
  if (!value) return undefined;
  const normalized = value.toLowerCase().replace(/[\s_]+/g, '-');
  return CITY_BACKGROUNDS[normalized] ?? CITY_BACKGROUNDS[normalized.replace(/-/g, '')];
}

export function seatPlayersByCorner(players: Player[], perspectiveColor: Color) {
  const seats: Partial<Record<'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft', Player>> = {};
  for (const player of players) {
    seats[visualCornerForColor(player.color, perspectiveColor)] = player;
  }
  return seats;
}

export function normalizeMatchBoardState(
  boardState: MatchBoardState,
  matchPlayers: MatchPlayerEntry[],
  anchorColor?: Color | null,
): GameState {
  const versionedBoardState = withBoardVersion(boardState);
  if (matchPlayers.length === 0) return versionedBoardState;
  const byColor = new Map(matchPlayers.map((player) => [player.color, player]));
  let changed = false;
  let players = versionedBoardState.players.map((player) => {
    const matchPlayer = byColor.get(player.color);
    if (!matchPlayer) return player;
    const isAI = !!matchPlayer.is_bot;
    if (player.isAI === isAI) return player;
    changed = true;
    return { ...player, isAI };
  });

  if (players.length === 2 && !isOppositePair(players[0].color, players[1].color)) {
    const localIdx = anchorColor ? players.findIndex((player) => player.color === anchorColor) : -1;
    const humanIdx = players.findIndex((player) => !player.isAI);
    const anchorIdx = localIdx >= 0 ? localIdx : humanIdx >= 0 ? humanIdx : 0;
    const otherIdx = anchorIdx === 0 ? 1 : 0;
    const otherColor = oppositeColor(players[anchorIdx].color);
    players = players.map((player, index) =>
      index === otherIdx ? recolorPlayer(player, otherColor) : player,
    );
    changed = true;
  }

  return changed
    ? {
        ...versionedBoardState,
        players,
        lastRollByColor: remapLastRolls(versionedBoardState.lastRollByColor, players),
      }
    : versionedBoardState;
}

export function shouldLoadBoardState(boardState: MatchBoardState | undefined | null, currentVersion: number) {
  return !!boardState && boardVersion(boardState) > currentVersion;
}

export function buildMoveAnimation(
  state: GameState,
  perspectiveColor: Color,
  boardInset: number,
  cellPx: number,
  hopMs: number,
  captureTailMs: number,
  minMoveMs: number,
): MoveAnimation | null {
  const move = state.lastMove;
  if (!move) return null;
  const movingToken = state.players.flatMap((player) => player.tokens).find((token) => token.id === move.tokenId);
  if (!movingToken) return null;
  const cells = pathCellsForMove(movingToken.color, move.from, move.dieValue);
  const hopPath = cells.map((cell) => {
    const visual = cellForPerspective(cell, perspectiveColor);
    return {
      cx: boardInset + (visual.col + 0.5) * cellPx,
      cy: boardInset + (visual.row + 0.5) * cellPx,
    };
  });
  const baseDurationMs = Math.max(minMoveMs, Math.max(1, hopPath.length - 1) * hopMs);
  const captureDelayMs = Math.max(0, hopPath.length - 1) * hopMs;
  const totalDurationMs = baseDurationMs + (move.captures.length > 0 ? captureTailMs : 0);
  return {
    movingTokenId: move.tokenId,
    hopPath,
    capturedTokenIds: move.captures,
    captureDelayMs,
    totalDurationMs,
    baseDurationMs,
  };
}

export function buildTokenCenters(
  tokens: GameToken[],
  perspectiveColor: Color,
  boardInset: number,
  cellPx: number,
  tokenSize: number,
): Map<TokenId, TokenCenter> {
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

  const centers = new Map<TokenId, TokenCenter>();
  for (const group of grouped.values()) {
    const sorted = [...group].sort((left, right) => left.token.id.localeCompare(right.token.id));
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

function remapLastRolls(rolls: GameState['lastRollByColor'], players: Player[]) {
  const next: GameState['lastRollByColor'] = {};
  for (const player of players) {
    if (rolls[player.color]) next[player.color] = rolls[player.color];
  }
  return next;
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

function stackedTokenSize(tokenSize: number, count: number) {
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
