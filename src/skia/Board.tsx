// Phase 1: placeholder Skia board. Geometry only, no animations on the board itself.
// Tokens are layered on top by the game screen as Reanimated views.

import { Canvas, Path, Rect, RoundedRect, Skia } from '@shopify/react-native-skia';

import {
  BOARD_SIZE,
  HOME_COL_CELLS,
  OUTER_TRACK,
  SAFE_TRACK_INDICES,
} from '@/src/game/board';
import type { Color } from '@/src/game/types';
import { COLORS as ALL_COLORS } from '@/src/game/types';
import { colors } from '@/src/theme/colors';

type Props = {
  /** Pixel size of the board (square). */
  size: number;
};

const PLAYER_HEX: Record<Color, string> = {
  red: colors.red,
  green: colors.green,
  yellow: colors.yellow,
  blue: colors.blue,
};

const HOME_BASE_TL: Record<Color, { col: number; row: number }> = {
  red: { col: 0, row: 0 },
  green: { col: 9, row: 0 },
  yellow: { col: 9, row: 9 },
  blue: { col: 0, row: 9 },
};

export function BoardCanvas({ size }: Props) {
  const cell = size / BOARD_SIZE;

  return (
    <Canvas style={{ width: size, height: size }}>
      {/* board background */}
      <Rect x={0} y={0} width={size} height={size} color={colors.bgElevated} />

      {/* 4 colored home bases (6x6 corners) */}
      {ALL_COLORS.map((c) => {
        const tl = HOME_BASE_TL[c];
        return (
          <RoundedRect
            key={`home-${c}`}
            x={tl.col * cell + 2}
            y={tl.row * cell + 2}
            width={cell * 6 - 4}
            height={cell * 6 - 4}
            r={cell * 0.4}
            color={withAlpha(PLAYER_HEX[c], 0.18)}
          />
        );
      })}

      {/* inner "circle" inside each home base (where tokens park) */}
      {ALL_COLORS.map((c) => {
        const tl = HOME_BASE_TL[c];
        return (
          <RoundedRect
            key={`home-inner-${c}`}
            x={(tl.col + 1) * cell}
            y={(tl.row + 1) * cell}
            width={cell * 4}
            height={cell * 4}
            r={cell * 0.3}
            color={colors.bg}
          />
        );
      })}

      {/* outer track cells */}
      {OUTER_TRACK.map((p, i) => (
        <RoundedRect
          key={`t-${i}`}
          x={p.col * cell + 1}
          y={p.row * cell + 1}
          width={cell - 2}
          height={cell - 2}
          r={4}
          color={SAFE_TRACK_INDICES.has(i) ? withAlpha(colors.gold, 0.18) : colors.surface}
        />
      ))}

      {/* color start cells get a thicker tint */}
      {ALL_COLORS.map((c) => {
        const idx = startIndexFor(c);
        const p = OUTER_TRACK[idx];
        return (
          <RoundedRect
            key={`start-${c}`}
            x={p.col * cell + 1}
            y={p.row * cell + 1}
            width={cell - 2}
            height={cell - 2}
            r={4}
            color={withAlpha(PLAYER_HEX[c], 0.55)}
          />
        );
      })}

      {/* home columns */}
      {ALL_COLORS.map((c) =>
        HOME_COL_CELLS[c].map((p, i) => (
          <RoundedRect
            key={`hc-${c}-${i}`}
            x={p.col * cell + 1}
            y={p.row * cell + 1}
            width={cell - 2}
            height={cell - 2}
            r={4}
            color={withAlpha(PLAYER_HEX[c], 0.4)}
          />
        )),
      )}

      {/* center 3x3 finish (gold diamond) */}
      <Rect
        x={6 * cell}
        y={6 * cell}
        width={cell * 3}
        height={cell * 3}
        color={colors.bg}
      />
      <Path
        path={diamondPath(6 * cell, 6 * cell, cell * 3)}
        color={colors.gold}
        style="fill"
      />
    </Canvas>
  );
}

function startIndexFor(c: Color): number {
  switch (c) {
    case 'red':
      return 0;
    case 'green':
      return 13;
    case 'yellow':
      return 26;
    case 'blue':
      return 39;
  }
}

function diamondPath(x: number, y: number, side: number) {
  const p = Skia.Path.Make();
  const cx = x + side / 2;
  const cy = y + side / 2;
  p.moveTo(cx, y + 4);
  p.lineTo(x + side - 4, cy);
  p.lineTo(cx, y + side - 4);
  p.lineTo(x + 4, cy);
  p.close();
  return p;
}

/** Returns an rgba() string with the supplied alpha for a hex color. */
function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
