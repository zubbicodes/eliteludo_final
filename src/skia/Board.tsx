// Skia Ludo board renderer. Tokens are layered above this canvas by the game screen,
// so boardGeometry is the contract shared by art, hit targets, and token movement.

import {
  BlurMask,
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
import { cellForPerspective, visualCornerForColor, type VisualCorner } from '@/src/game/perspective';
import type { Color } from '@/src/game/types';
import { COLORS as ALL_COLORS } from '@/src/game/types';

type Props = {
  /** Pixel size of the board (square). */
  size: number;
  perspectiveColor?: Color;
};

const PLAYER_HEX: Record<Color, string> = {
  red: '#F5223D',
  green: '#21B94B',
  yellow: '#FFD51F',
  blue: '#1677FF',
};

const PLAYER_DARK: Record<Color, string> = {
  red: '#8B0616',
  green: '#075D2A',
  yellow: '#9B6200',
  blue: '#0B2A97',
};

const HOME_BASE_TL: Record<Color, { col: number; row: number }> = {
  red: { col: 0, row: 0 },
  green: { col: 9, row: 0 },
  yellow: { col: 9, row: 9 },
  blue: { col: 0, row: 9 },
};

const CREAM_CELL = 'rgba(255, 251, 232, 0.98)';
const GOLD_CELL = 'rgba(255, 227, 128, 0.96)';
const TRAY_GOLD = '#A86105';
const RIM_GOLD = '#7B3F03';

const SPARKLES = [
  [0.08, 0.1, 0.9],
  [0.14, 0.2, 0.55],
  [0.24, 0.12, 0.72],
  [0.33, 0.08, 0.42],
  [0.45, 0.12, 0.66],
  [0.58, 0.08, 0.5],
  [0.72, 0.13, 0.84],
  [0.84, 0.2, 0.56],
  [0.92, 0.1, 0.75],
  [0.1, 0.86, 0.68],
  [0.2, 0.94, 0.5],
  [0.36, 0.88, 0.8],
  [0.5, 0.94, 0.44],
  [0.66, 0.87, 0.62],
  [0.82, 0.92, 0.82],
  [0.91, 0.78, 0.5],
  [0.1, 0.42, 0.5],
  [0.9, 0.38, 0.62],
  [0.14, 0.62, 0.78],
  [0.87, 0.62, 0.54],
];

export function boardGeometry(size: number) {
  const inset = size * 0.022;
  const playSize = size - inset * 2;
  return { inset, playSize, cell: playSize / BOARD_SIZE };
}

export function BoardCanvas({ size, perspectiveColor = 'blue' }: Props) {
  const { inset, playSize, cell } = boardGeometry(size);
  const outerRadius = size * 0.045;
  const trayRadius = cell * 0.28;

  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      <RoundedRect x={0} y={0} width={size} height={size} r={outerRadius} color="#D99B13">
        <LinearGradient
          start={vec(0, 0)}
          end={vec(size, size)}
          colors={['#FFF4B1', '#C17607', '#FFE064', '#804102']}
          positions={[0, 0.32, 0.62, 1]}
        />
      </RoundedRect>

      <RoundedRect x={size * 0.01} y={size * 0.012} width={size * 0.98} height={size * 0.976} r={outerRadius * 0.86} color="#E3AE24">
        <LinearGradient
          start={vec(0, 0)}
          end={vec(size, size)}
          colors={['#FFF9CF', '#D1910D', '#FFE179', '#8F4A03']}
        />
      </RoundedRect>

      <RoundedRect x={size * 0.02} y={size * 0.022} width={size * 0.96} height={size * 0.956} r={outerRadius * 0.72} color="#E0A21E" />
      <RoundedRect x={size * 0.03} y={size * 0.032} width={size * 0.94} height={size * 0.936} r={outerRadius * 0.58} color={TRAY_GOLD} />
      <RoundedRect
        x={inset - cell * 0.055}
        y={inset - cell * 0.055}
        width={playSize + cell * 0.11}
        height={playSize + cell * 0.11}
        r={trayRadius * 0.85}
        color={RIM_GOLD}
        style="stroke"
        strokeWidth={cell * 0.12}
      />

      {SPARKLES.map(([x, y, s], index) => (
        <Sparkle key={`sparkle-${index}`} cx={x * size} cy={y * size} radius={cell * 0.055 * s} />
      ))}

      <Group transform={[{ translateX: inset }, { translateY: inset }]}>
        <Rect x={0} y={0} width={playSize} height={playSize} color={TRAY_GOLD} />

        {ALL_COLORS.map((color) => (
          <HomeCourt key={`home-${color}`} color={color} cell={cell} perspectiveColor={perspectiveColor} />
        ))}

        {OUTER_TRACK.map((cellPosition, index) => {
          const visual = cellForPerspective(cellPosition, perspectiveColor);
          const startColor = ALL_COLORS.find((color) => startIndexFor(color) === index);
          return (
            <BoardCell
              key={`track-${index}`}
              col={visual.col}
              row={visual.row}
              size={cell}
              tone={trackTone(index, startColor)}
              color={startColor ? PLAYER_HEX[startColor] : undefined}
              star={SAFE_TRACK_INDICES.has(index)}
            />
          );
        })}

        {ALL_COLORS.map((color) =>
          HOME_COL_CELLS[color].map((cellPosition, index) => {
            const visual = cellForPerspective(cellPosition, perspectiveColor);
            return (
              <BoardCell
                key={`home-col-${color}-${index}`}
                col={visual.col}
                row={visual.row}
                size={cell}
                tone="color"
                color={PLAYER_HEX[color]}
                arrow={index === 0 ? arrowSideFor(color, perspectiveColor) : undefined}
              />
            );
          }),
        )}

        <CenterFinish cell={cell} perspectiveColor={perspectiveColor} />
      </Group>
    </Canvas>
  );
}

function HomeCourt({
  color,
  cell,
  perspectiveColor,
}: {
  color: Color;
  cell: number;
  perspectiveColor: Color;
}) {
  const tl = rectTopLeftForPerspective(HOME_BASE_TL[color], 6, perspectiveColor);
  const x = tl.col * cell + cell * 0.12;
  const y = tl.row * cell + cell * 0.12;
  const side = cell * 5.76;
  const innerX = x + cell * 0.45;
  const innerY = y + cell * 0.45;
  const innerSide = side - cell * 0.9;
  const radius = cell * 0.48;

  return (
    <>
      <RoundedRect x={x - cell * 0.08} y={y + cell * 0.08} width={side} height={side} r={radius} color={PLAYER_DARK[color]} opacity={0.72} />
      <RoundedRect x={x} y={y} width={side} height={side} r={radius} color={PLAYER_HEX[color]}>
        <LinearGradient
          start={vec(x, y)}
          end={vec(x + side, y + side)}
          colors={[lighten(color), PLAYER_HEX[color], darken(color)]}
          positions={[0, 0.62, 1]}
        />
      </RoundedRect>
      <RoundedRect
        x={x}
        y={y + side - cell * 0.22}
        width={side}
        height={cell * 0.22}
        r={cell * 0.16}
        color={PLAYER_DARK[color]}
        opacity={0.28}
      />
      <RoundedRect
        x={innerX}
        y={innerY}
        width={innerSide}
        height={innerSide}
        r={cell * 0.58}
        color={PLAYER_DARK[color]}
        style="stroke"
        strokeWidth={cell * 0.08}
        opacity={0.72}
      />
      {HOME_BASE_SLOTS[color].map((slot, index) => {
        const visual = cellForPerspective(slot, perspectiveColor);
        return (
          <Circle
            key={`well-${color}-${index}`}
            cx={(visual.col + 0.5) * cell}
            cy={(visual.row + 0.5) * cell}
            r={cell * 0.58}
            color={PLAYER_DARK[color]}
            opacity={0.95}
          />
        );
      })}
    </>
  );
}

function BoardCell({
  col,
  row,
  size,
  tone,
  color,
  star,
  arrow,
}: {
  col: number;
  row: number;
  size: number;
  tone: 'cream' | 'gold' | 'color';
  color?: string;
  star?: boolean;
  arrow?: 'up' | 'right' | 'down' | 'left';
}) {
  const x = col * size + size * 0.025;
  const y = row * size + size * 0.025;
  const side = size * 0.95;
  const fill = tone === 'color' ? color ?? GOLD_CELL : tone === 'gold' ? GOLD_CELL : CREAM_CELL;

  return (
    <>
      <RoundedRect x={x + size * 0.026} y={y + size * 0.03} width={side} height={side} r={size * 0.1} color="#3D2100" opacity={0.22} />
      <RoundedRect x={x} y={y} width={side} height={side} r={size * 0.1} color={fill} />
      <RoundedRect
        x={x}
        y={y}
        width={side}
        height={side}
        r={size * 0.1}
        color={withAlpha(tone === 'color' ? '#2A1600' : '#7A3F00', tone === 'color' ? 0.3 : 0.18)}
        style="stroke"
        strokeWidth={size * 0.028}
      />
      <RoundedRect x={x + size * 0.035} y={y + size * 0.035} width={side - size * 0.07} height={side - size * 0.07} r={size * 0.075} color={withAlpha('#FFFFFF', tone === 'color' ? 0.22 : 0.28)} style="stroke" strokeWidth={size * 0.018} />
      {star && <Path path={starPath(x + side / 2, y + side / 2, size * 0.26, size * 0.45)} color="#B45E00" />}
      {star && <Path path={starPath(x + side / 2, y + side / 2, size * 0.26, size * 0.45)} color="#FFE97D" style="stroke" strokeWidth={size * 0.045} />}
      {arrow && <Path path={arrowPath(x + side / 2, y + side / 2, size * 0.33, arrow)} color={withAlpha('#000000', tone === 'color' ? 0.26 : 0.14)} />}
    </>
  );
}

function CenterFinish({ cell, perspectiveColor }: { cell: number; perspectiveColor: Color }) {
  const x = 6 * cell;
  const y = 6 * cell;
  const side = 3 * cell;
  const center = { x: x + side / 2, y: y + side / 2 };
  const sideColor: Record<'top' | 'right' | 'bottom' | 'left', Color> = {
    top: 'yellow',
    right: 'blue',
    bottom: 'red',
    left: 'green',
  };

  for (const color of ALL_COLORS) {
    const corner = visualCornerForColor(color, perspectiveColor);
    const sideName = sideForCorner(corner);
    sideColor[sideName] = color;
  }

  return (
    <>
      <Rect x={x} y={y} width={side} height={side} color="#050302" />
      <Path path={trianglePath(center, x, y, side, 'top')} color={PLAYER_HEX[sideColor.top]} />
      <Path path={trianglePath(center, x, y, side, 'right')} color={PLAYER_HEX[sideColor.right]} />
      <Path path={trianglePath(center, x, y, side, 'bottom')} color={PLAYER_HEX[sideColor.bottom]} />
      <Path path={trianglePath(center, x, y, side, 'left')} color={PLAYER_HEX[sideColor.left]} />
      <Path path={diamondStrokePath(x, y, side)} color={withAlpha('#FFFFFF', 0.22)} style="stroke" strokeWidth={cell * 0.035} />
    </>
  );
}

function Sparkle({ cx, cy, radius }: { cx: number; cy: number; radius: number }) {
  return (
    <>
      <Circle cx={cx} cy={cy} r={radius * 3.2} color="#FFF4A2" opacity={0.18}>
        <BlurMask blur={radius * 5} style="normal" />
      </Circle>
      <Circle cx={cx} cy={cy} r={radius} color="#FFFFFF" />
      <Path path={sparklePath(cx, cy, radius * 4.8)} color="#FFF6B5" opacity={0.82} />
    </>
  );
}

function trackTone(index: number, startColor?: Color): 'cream' | 'gold' | 'color' {
  if (startColor) return 'color';
  return index % 2 === 0 ? 'cream' : 'gold';
}

function arrowSideFor(color: Color, perspectiveColor: Color): 'up' | 'right' | 'down' | 'left' {
  const visual = cellForPerspective(HOME_COL_CELLS[color][0], perspectiveColor);
  if (visual.col === 7 && visual.row > 7) return 'up';
  if (visual.col === 7 && visual.row < 7) return 'down';
  if (visual.row === 7 && visual.col > 7) return 'left';
  return 'right';
}

function sideForCorner(corner: VisualCorner): 'top' | 'right' | 'bottom' | 'left' {
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

function startIndexFor(color: Color): number {
  switch (color) {
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
  ].map((corner) => cellForPerspective(corner, perspectiveColor));

  return {
    col: Math.min(...corners.map((corner) => corner.col)),
    row: Math.min(...corners.map((corner) => corner.row)),
  };
}

function starPath(cx: number, cy: number, innerRadius: number, outerRadius: number) {
  const path = Skia.Path.Make();
  const points = 10;
  for (let i = 0; i < points; i++) {
    const angle = -Math.PI / 2 + (i / points) * Math.PI * 2;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  path.close();
  return path;
}

function arrowPath(cx: number, cy: number, r: number, direction: 'up' | 'right' | 'down' | 'left') {
  const path = Skia.Path.Make();
  const points: Record<typeof direction, [number, number][]> = {
    up: [
      [0, -1],
      [0.72, -0.22],
      [0.28, -0.22],
      [0.28, 0.78],
      [-0.28, 0.78],
      [-0.28, -0.22],
      [-0.72, -0.22],
    ],
    right: [
      [1, 0],
      [0.22, 0.72],
      [0.22, 0.28],
      [-0.78, 0.28],
      [-0.78, -0.28],
      [0.22, -0.28],
      [0.22, -0.72],
    ],
    down: [
      [0, 1],
      [0.72, 0.22],
      [0.28, 0.22],
      [0.28, -0.78],
      [-0.28, -0.78],
      [-0.28, 0.22],
      [-0.72, 0.22],
    ],
    left: [
      [-1, 0],
      [-0.22, 0.72],
      [-0.22, 0.28],
      [0.78, 0.28],
      [0.78, -0.28],
      [-0.22, -0.28],
      [-0.22, -0.72],
    ],
  };
  points[direction].forEach(([x, y], index) => {
    const px = cx + x * r;
    const py = cy + y * r;
    if (index === 0) path.moveTo(px, py);
    else path.lineTo(px, py);
  });
  path.close();
  return path;
}

function trianglePath(
  center: { x: number; y: number },
  x: number,
  y: number,
  side: number,
  edge: 'top' | 'right' | 'bottom' | 'left',
) {
  const path = Skia.Path.Make();
  path.moveTo(center.x, center.y);
  switch (edge) {
    case 'top':
      path.lineTo(x, y);
      path.lineTo(x + side, y);
      break;
    case 'right':
      path.lineTo(x + side, y);
      path.lineTo(x + side, y + side);
      break;
    case 'bottom':
      path.lineTo(x + side, y + side);
      path.lineTo(x, y + side);
      break;
    case 'left':
      path.lineTo(x, y + side);
      path.lineTo(x, y);
      break;
  }
  path.close();
  return path;
}

function diamondStrokePath(x: number, y: number, side: number) {
  const path = Skia.Path.Make();
  path.moveTo(x, y);
  path.lineTo(x + side, y);
  path.lineTo(x + side, y + side);
  path.lineTo(x, y + side);
  path.close();
  return path;
}

function sparklePath(cx: number, cy: number, r: number) {
  const path = Skia.Path.Make();
  path.moveTo(cx, cy - r);
  path.lineTo(cx + r * 0.18, cy - r * 0.18);
  path.lineTo(cx + r, cy);
  path.lineTo(cx + r * 0.18, cy + r * 0.18);
  path.lineTo(cx, cy + r);
  path.lineTo(cx - r * 0.18, cy + r * 0.18);
  path.lineTo(cx - r, cy);
  path.lineTo(cx - r * 0.18, cy - r * 0.18);
  path.close();
  return path;
}

function lighten(color: Color): string {
  switch (color) {
    case 'red':
      return '#FF4A66';
    case 'green':
      return '#86DA43';
    case 'yellow':
      return '#FFFF10';
    case 'blue':
      return '#42B8FF';
  }
}

function darken(color: Color): string {
  switch (color) {
    case 'red':
      return '#C60025';
    case 'green':
      return '#35A722';
    case 'yellow':
      return '#E1B800';
    case 'blue':
      return '#342DFF';
  }
}

/** Returns an rgba() string with the supplied alpha for a hex color. */
function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
