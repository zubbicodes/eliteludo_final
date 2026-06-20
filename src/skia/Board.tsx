// Phase 1: placeholder Skia board. Geometry only, no animations on the board itself.
// Tokens are layered on top by the game screen as Reanimated views.

import {
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Path,
  Rect,
  RoundedRect,
  Skia,
  vec,
} from '@shopify/react-native-skia';

import {
  BOARD_SIZE,
  HOME_BASE_SLOTS,
  HOME_COL_CELLS,
  OUTER_TRACK,
  SAFE_TRACK_INDICES,
} from '@/src/game/board';
import { cellForPerspective } from '@/src/game/perspective';
import type { Color } from '@/src/game/types';
import { COLORS as ALL_COLORS } from '@/src/game/types';
import { colors } from '@/src/theme/colors';

type Props = {
  /** Pixel size of the board (square). */
  size: number;
  perspectiveColor?: Color;
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

const ROYAL_GOLD = '#D6A943';
const ROYAL_GOLD_LIGHT = '#F9E19A';
const ROYAL_GOLD_DARK = '#6F430D';
const ROYAL_INK = '#100A10';

export function boardGeometry(size: number) {
  const inset = size * 0.042;
  const playSize = size - inset * 2;
  return { inset, playSize, cell: playSize / BOARD_SIZE };
}

export function BoardCanvas({ size, perspectiveColor = 'blue' }: Props) {
  const { inset, cell } = boardGeometry(size);
  const frameCell = size / BOARD_SIZE;

  return (
    <Canvas style={{ width: size, height: size }}>
      {/* Dark lacquer ground, kept translucent enough for the city artwork below. */}
      <Rect x={0} y={0} width={size} height={size}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(size, size)}
          colors={['rgba(42,20,31,0.9)', 'rgba(12,8,14,0.94)', 'rgba(39,18,24,0.9)']}
        />
      </Rect>
      <Group transform={[{ translateX: inset }, { translateY: inset }]}>
      {/* 4 colored home bases (6x6 corners) */}
      {ALL_COLORS.map((c) => {
        const tl = rectTopLeftForPerspective(HOME_BASE_TL[c], 6, perspectiveColor);
        return [
          <RoundedRect
            key={`home-${c}`}
            x={tl.col * cell + cell * 0.2}
            y={tl.row * cell + cell * 0.2}
            width={cell * 5.6}
            height={cell * 5.6}
            r={cell * 0.48}
            color="#0C0B0B"
          />,
          <RoundedRect
            key={`home-rim-${c}`}
            x={tl.col * cell + cell * 0.25}
            y={tl.row * cell + cell * 0.25}
            width={cell * 5.5}
            height={cell * 5.5}
            r={cell * 0.43}
            color={withAlpha(ROYAL_GOLD_LIGHT, 0.72)}
            style="stroke"
            strokeWidth={cell * 0.1}
          />,
        ];
      })}

      {/* inner "circle" inside each home base (where tokens park) */}
      {ALL_COLORS.map((c) => {
        const raw = HOME_BASE_TL[c];
        const tl = rectTopLeftForPerspective({ col: raw.col + 1, row: raw.row + 1 }, 4, perspectiveColor);
        return [
          <RoundedRect
            key={`home-inner-${c}`}
            x={tl.col * cell + cell * 0.08}
            y={tl.row * cell + cell * 0.08}
            width={cell * 3.84}
            height={cell * 3.84}
            r={cell * 0.58}
            color="#12100F"
          />,
          <RoundedRect
            key={`home-inner-rim-${c}`}
            x={tl.col * cell + cell * 0.12}
            y={tl.row * cell + cell * 0.12}
            width={cell * 3.76}
            height={cell * 3.76}
            r={cell * 0.54}
            color={withAlpha(ROYAL_GOLD_LIGHT, 0.48)}
            style="stroke"
            strokeWidth={cell * 0.07}
          />,
        ];
      })}

      {/* Heraldic medallions inspired by an ebony inlaid game table. */}
      {ALL_COLORS.flatMap((c) => {
        const tl = rectTopLeftForPerspective(HOME_BASE_TL[c], 6, perspectiveColor);
        const cx = (tl.col + 3) * cell;
        const cy = (tl.row + 3) * cell;
        return [
          <Circle key={`crest-outer-${c}`} cx={cx} cy={cy} r={cell * 1.72} color="#070606" />,
          <Circle
            key={`crest-outer-rim-${c}`}
            cx={cx}
            cy={cy}
            r={cell * 1.72}
            color={ROYAL_GOLD_DARK}
            style="stroke"
            strokeWidth={cell * 0.16}
          />,
          <Circle
            key={`crest-color-${c}`}
            cx={cx}
            cy={cy}
            r={cell * 1.46}
            color={withAlpha(PLAYER_HEX[c], 0.28)}
          />,
          <Circle
            key={`crest-color-rim-${c}`}
            cx={cx}
            cy={cy}
            r={cell * 1.46}
            color={withAlpha(ROYAL_GOLD_LIGHT, 0.75)}
            style="stroke"
            strokeWidth={cell * 0.07}
          />,
          <Circle
            key={`crest-inner-${c}`}
            cx={cx}
            cy={cy}
            r={cell * 0.78}
            color={withAlpha(ROYAL_GOLD, 0.2)}
            style="stroke"
            strokeWidth={cell * 0.05}
          />,
        ];
      })}

      {/* Gilded token wells inside each home court. */}
      {ALL_COLORS.flatMap((c) =>
        HOME_BASE_SLOTS[c].map((slot, index) => {
          const visual = cellForPerspective(slot, perspectiveColor);
          const cx = (visual.col + 0.5) * cell;
          const cy = (visual.row + 0.5) * cell;
          return [
            <Circle key={`well-${c}-${index}`} cx={cx} cy={cy} r={cell * 0.43} color="#070507" />,
            <Circle
              key={`well-rim-${c}-${index}`}
              cx={cx}
              cy={cy}
              r={cell * 0.43}
              color={withAlpha(ROYAL_GOLD, 0.7)}
              style="stroke"
              strokeWidth={cell * 0.07}
            />,
          ];
        }),
      )}

      {/* outer track cells */}
      {OUTER_TRACK.map((p, i) => (
        <TrackCell
          key={`t-${i}`}
          cell={cellForPerspective(p, perspectiveColor)}
          cellSize={cell}
          safe={SAFE_TRACK_INDICES.has(i)}
        />
      ))}

      {/* color start cells get a thicker tint */}
      {ALL_COLORS.map((c) => {
        const idx = startIndexFor(c);
        const p = cellForPerspective(OUTER_TRACK[idx], perspectiveColor);
        return (
          <RoundedRect
            key={`start-${c}`}
            x={p.col * cell + cell * 0.04}
            y={p.row * cell + cell * 0.04}
            width={cell * 0.92}
            height={cell * 0.92}
            r={cell * 0.06}
            color={withAlpha(PLAYER_HEX[c], 0.7)}
          />
        );
      })}

      {/* home columns */}
      {ALL_COLORS.map((c) =>
        HOME_COL_CELLS[c].map((p, i) => {
          const visual = cellForPerspective(p, perspectiveColor);
          return (
            <RoundedRect
              key={`hc-${c}-${i}`}
              x={visual.col * cell + cell * 0.04}
              y={visual.row * cell + cell * 0.04}
              width={cell * 0.92}
              height={cell * 0.92}
              r={cell * 0.05}
              color={withAlpha(PLAYER_HEX[c], 0.5)}
              style="fill"
            />
          );
        }),
      )}

      {/* Circular royal finish medallion. */}
      <Rect
        x={6 * cell}
        y={6 * cell}
        width={cell * 3}
        height={cell * 3}
        color={ROYAL_INK}
      />
      <Circle cx={7.5 * cell} cy={7.5 * cell} r={cell * 1.42} color="#080707" />
      <Circle
        cx={7.5 * cell}
        cy={7.5 * cell}
        r={cell * 1.35}
        color={ROYAL_GOLD}
        style="stroke"
        strokeWidth={cell * 0.11}
      />
      <Circle
        cx={7.5 * cell}
        cy={7.5 * cell}
        r={cell * 1.08}
        color={withAlpha(ROYAL_GOLD_LIGHT, 0.55)}
        style="stroke"
        strokeWidth={cell * 0.045}
      />
      <Path path={sunburstPath(7.5 * cell, 7.5 * cell, cell * 0.48, cell * 0.92)} color={ROYAL_GOLD} />
      <Circle cx={7.5 * cell} cy={7.5 * cell} r={cell * 0.4} color="#18100C" />
      <Circle cx={7.5 * cell} cy={7.5 * cell} r={cell * 0.23} color="#A8173E" />
      <Circle
        cx={7.5 * cell}
        cy={7.5 * cell}
        r={cell * 0.23}
        color={ROYAL_GOLD_LIGHT}
        style="stroke"
        strokeWidth={cell * 0.055}
      />
      </Group>

      {/* Frame is deliberately painted last so no court can chew through its edge. */}
      <RoundedRect
        x={frameCell * 0.2}
        y={frameCell * 0.2}
        width={size - frameCell * 0.4}
        height={size - frameCell * 0.4}
        r={frameCell * 0.78}
        color="#050404"
        style="stroke"
        strokeWidth={frameCell * 0.28}
      />
      <RoundedRect
        x={frameCell * 0.29}
        y={frameCell * 0.29}
        width={size - frameCell * 0.58}
        height={size - frameCell * 0.58}
        r={frameCell * 0.66}
        color={ROYAL_GOLD}
        style="stroke"
        strokeWidth={frameCell * 0.1}
      />
      <RoundedRect
        x={frameCell * 0.42}
        y={frameCell * 0.42}
        width={size - frameCell * 0.84}
        height={size - frameCell * 0.84}
        r={frameCell * 0.5}
        color="#0B0908"
        style="stroke"
        strokeWidth={frameCell * 0.1}
      />
      <RoundedRect
        x={frameCell * 0.52}
        y={frameCell * 0.52}
        width={size - frameCell * 1.04}
        height={size - frameCell * 1.04}
        r={frameCell * 0.4}
        color={withAlpha(ROYAL_GOLD_LIGHT, 0.7)}
        style="stroke"
        strokeWidth={frameCell * 0.045}
      />
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((rotation) => (
        <Group key={rotation} origin={vec(size / 2, size / 2)} transform={[{ rotate: rotation }]}>
          <Path
            path={cornerBracketPath(frameCell)}
            color={ROYAL_GOLD_LIGHT}
            style="stroke"
            strokeWidth={frameCell * 0.075}
            strokeCap="round"
          />
        </Group>
      ))}
    </Canvas>
  );
}

function rectTopLeftForPerspective(
  topLeft: { col: number; row: number },
  sideCells: number,
  perspectiveColor: Color,
): { col: number; row: number } {
  const maxOffset = sideCells - 1;
  const corners = [
    topLeft,
    { col: topLeft.col + maxOffset, row: topLeft.row },
    { col: topLeft.col, row: topLeft.row + maxOffset },
    { col: topLeft.col + maxOffset, row: topLeft.row + maxOffset },
  ].map((c) => cellForPerspective(c, perspectiveColor));

  return {
    col: Math.min(...corners.map((c) => c.col)),
    row: Math.min(...corners.map((c) => c.row)),
  };
}

function TrackCell({
  cell,
  cellSize,
  safe,
}: {
  cell: { col: number; row: number };
  cellSize: number;
  safe: boolean;
}) {
  return (
    <>
      <RoundedRect
        x={cell.col * cellSize + cellSize * 0.025}
        y={cell.row * cellSize + cellSize * 0.025}
        width={cellSize * 0.95}
        height={cellSize * 0.95}
        r={cellSize * 0.045}
        color={safe ? '#5B431C' : '#121111'}
      />
      <RoundedRect
        x={cell.col * cellSize + cellSize * 0.04}
        y={cell.row * cellSize + cellSize * 0.04}
        width={cellSize * 0.92}
        height={cellSize * 0.92}
        r={cellSize * 0.035}
        color={withAlpha(safe ? ROYAL_GOLD_LIGHT : ROYAL_GOLD, safe ? 0.88 : 0.7)}
        style="stroke"
        strokeWidth={cellSize * (safe ? 0.065 : 0.035)}
      />
    </>
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

function sunburstPath(cx: number, cy: number, innerRadius: number, outerRadius: number) {
  const p = Skia.Path.Make();
  const points = 40;
  for (let i = 0; i < points; i++) {
    const angle = -Math.PI / 2 + (i / points) * Math.PI * 2;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) p.moveTo(x, y);
    else p.lineTo(x, y);
  }
  p.close();
  return p;
}

function cornerBracketPath(cell: number) {
  const p = Skia.Path.Make();
  p.moveTo(cell * 0.72, cell * 2.25);
  p.lineTo(cell * 0.72, cell * 1.1);
  p.quadTo(cell * 0.72, cell * 0.72, cell * 1.1, cell * 0.72);
  p.lineTo(cell * 2.25, cell * 0.72);
  p.moveTo(cell * 0.96, cell * 1.85);
  p.lineTo(cell * 0.96, cell * 1.2);
  p.quadTo(cell * 0.96, cell * 0.96, cell * 1.2, cell * 0.96);
  p.lineTo(cell * 1.85, cell * 0.96);
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
