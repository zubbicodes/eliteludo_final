// Skia Ludo board renderer. Tokens are layered above this canvas by the game screen,
// so boardGeometry is the contract shared by art, hit targets, and token movement.

import { Canvas, createPicture, PaintStyle, Picture, Skia, type SkCanvas } from '@shopify/react-native-skia';
import { useMemo } from 'react';

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
  const picture = useMemo(
    () => createPicture((canvas) => drawBoard(canvas, size, perspectiveColor), { width: size, height: size }),
    [size, perspectiveColor],
  );

  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      <Picture picture={picture} />
    </Canvas>
  );
}

function drawBoard(canvas: SkCanvas, size: number, perspectiveColor: Color) {
  const { inset, playSize, cell } = boardGeometry(size);
  const outerRadius = size * 0.045;
  const trayRadius = cell * 0.28;
  const fillPaint = Skia.Paint();
  fillPaint.setAntiAlias(true);
  const strokePaint = Skia.Paint();
  strokePaint.setAntiAlias(true);
  strokePaint.setStyle(PaintStyle.Stroke);

  fillPaint.setColor(Skia.Color('#D99B13'));
  drawRoundedRect(canvas, fillPaint, 0, 0, size, size, outerRadius);
  fillPaint.setColor(Skia.Color('#E3AE24'));
  drawRoundedRect(canvas, fillPaint, size * 0.01, size * 0.012, size * 0.98, size * 0.976, outerRadius * 0.86);
  fillPaint.setColor(Skia.Color('#E0A21E'));
  drawRoundedRect(canvas, fillPaint, size * 0.02, size * 0.022, size * 0.96, size * 0.956, outerRadius * 0.72);
  fillPaint.setColor(Skia.Color(TRAY_GOLD));
  drawRoundedRect(canvas, fillPaint, size * 0.03, size * 0.032, size * 0.94, size * 0.936, outerRadius * 0.58);

  strokePaint.setColor(Skia.Color(RIM_GOLD));
  strokePaint.setStrokeWidth(cell * 0.12);
  drawRoundedRect(
    canvas,
    strokePaint,
    inset - cell * 0.055,
    inset - cell * 0.055,
    playSize + cell * 0.11,
    playSize + cell * 0.11,
    trayRadius * 0.85,
  );

  for (const [x, y, sparkleScale] of SPARKLES) {
    drawSparkle(canvas, fillPaint, x * size, y * size, cell * 0.055 * sparkleScale);
  }

  canvas.save();
  canvas.translate(inset, inset);

  fillPaint.setColor(Skia.Color(TRAY_GOLD));
  canvas.drawRect(Skia.XYWHRect(0, 0, playSize, playSize), fillPaint);

  for (const color of ALL_COLORS) {
    drawHomeCourt(canvas, fillPaint, strokePaint, color, cell, perspectiveColor);
  }

  OUTER_TRACK.forEach((cellPosition, index) => {
    const visual = cellForPerspective(cellPosition, perspectiveColor);
    const startColor = ALL_COLORS.find((color) => startIndexFor(color) === index);
    drawBoardCell(canvas, fillPaint, strokePaint, {
      col: visual.col,
      row: visual.row,
      size: cell,
      tone: trackTone(index, startColor),
      color: startColor ? PLAYER_HEX[startColor] : undefined,
      star: SAFE_TRACK_INDICES.has(index),
    });
  });

  for (const color of ALL_COLORS) {
    HOME_COL_CELLS[color].forEach((cellPosition, index) => {
      const visual = cellForPerspective(cellPosition, perspectiveColor);
      drawBoardCell(canvas, fillPaint, strokePaint, {
        col: visual.col,
        row: visual.row,
        size: cell,
        tone: 'color',
        color: PLAYER_HEX[color],
        arrow: index === 0 ? arrowSideFor(color, perspectiveColor) : undefined,
      });
    });
  }

  drawCenterFinish(canvas, fillPaint, strokePaint, cell, perspectiveColor);
  canvas.restore();
}

function drawHomeCourt(
  canvas: SkCanvas,
  fillPaint: ReturnType<typeof Skia.Paint>,
  strokePaint: ReturnType<typeof Skia.Paint>,
  color: Color,
  cell: number,
  perspectiveColor: Color,
) {
  const tl = rectTopLeftForPerspective(HOME_BASE_TL[color], 6, perspectiveColor);
  const x = tl.col * cell + cell * 0.12;
  const y = tl.row * cell + cell * 0.12;
  const side = cell * 5.76;
  const innerX = x + cell * 0.45;
  const innerY = y + cell * 0.45;
  const innerSide = side - cell * 0.9;
  const radius = cell * 0.48;

  fillPaint.setColor(Skia.Color(PLAYER_DARK[color]));
  fillPaint.setAlphaf(0.72);
  drawRoundedRect(canvas, fillPaint, x - cell * 0.08, y + cell * 0.08, side, side, radius);

  fillPaint.setColor(Skia.Color(PLAYER_HEX[color]));
  fillPaint.setAlphaf(1);
  drawRoundedRect(canvas, fillPaint, x, y, side, side, radius);

  fillPaint.setColor(Skia.Color(lighten(color)));
  fillPaint.setAlphaf(0.24);
  drawRoundedRect(canvas, fillPaint, x + cell * 0.14, y + cell * 0.16, side * 0.72, side * 0.24, radius * 0.55);

  fillPaint.setColor(Skia.Color(PLAYER_DARK[color]));
  fillPaint.setAlphaf(0.28);
  drawRoundedRect(canvas, fillPaint, x, y + side - cell * 0.22, side, cell * 0.22, cell * 0.16);

  strokePaint.setColor(Skia.Color(PLAYER_DARK[color]));
  strokePaint.setStrokeWidth(cell * 0.08);
  drawRoundedRect(canvas, strokePaint, innerX, innerY, innerSide, innerSide, cell * 0.58);

  fillPaint.setColor(Skia.Color(PLAYER_DARK[color]));
  fillPaint.setAlphaf(0.95);
  for (const slot of HOME_BASE_SLOTS[color]) {
    const visual = cellForPerspective(slot, perspectiveColor);
    canvas.drawCircle((visual.col + 0.5) * cell, (visual.row + 0.5) * cell, cell * 0.58, fillPaint);
  }
}

function drawBoardCell(
  canvas: SkCanvas,
  fillPaint: ReturnType<typeof Skia.Paint>,
  strokePaint: ReturnType<typeof Skia.Paint>,
  {
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

  fillPaint.setColor(Skia.Color('#3D2100'));
  fillPaint.setAlphaf(0.22);
  drawRoundedRect(canvas, fillPaint, x + size * 0.026, y + size * 0.03, side, side, size * 0.1);

  fillPaint.setColor(Skia.Color(fill));
  fillPaint.setAlphaf(1);
  drawRoundedRect(canvas, fillPaint, x, y, side, side, size * 0.1);

  strokePaint.setColor(Skia.Color(withAlpha(tone === 'color' ? '#2A1600' : '#7A3F00', tone === 'color' ? 0.3 : 0.18)));
  strokePaint.setStrokeWidth(size * 0.028);
  drawRoundedRect(canvas, strokePaint, x, y, side, side, size * 0.1);

  strokePaint.setColor(Skia.Color(withAlpha('#FFFFFF', tone === 'color' ? 0.22 : 0.28)));
  strokePaint.setStrokeWidth(size * 0.018);
  drawRoundedRect(canvas, strokePaint, x + size * 0.035, y + size * 0.035, side - size * 0.07, side - size * 0.07, size * 0.075);

  if (star) {
    fillPaint.setColor(Skia.Color('#B45E00'));
    canvas.drawPath(starPath(x + side / 2, y + side / 2, size * 0.26, size * 0.45), fillPaint);
    strokePaint.setColor(Skia.Color('#FFE97D'));
    strokePaint.setStrokeWidth(size * 0.045);
    canvas.drawPath(starPath(x + side / 2, y + side / 2, size * 0.26, size * 0.45), strokePaint);
  }

  if (arrow) {
    fillPaint.setColor(Skia.Color(withAlpha('#000000', tone === 'color' ? 0.26 : 0.14)));
    fillPaint.setAlphaf(1);
    canvas.drawPath(arrowPath(x + side / 2, y + side / 2, size * 0.33, arrow), fillPaint);
  }
}

function drawCenterFinish(
  canvas: SkCanvas,
  fillPaint: ReturnType<typeof Skia.Paint>,
  strokePaint: ReturnType<typeof Skia.Paint>,
  cell: number,
  perspectiveColor: Color,
) {
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

  fillPaint.setColor(Skia.Color('#050302'));
  canvas.drawRect(Skia.XYWHRect(x, y, side, side), fillPaint);
  fillPaint.setColor(Skia.Color(PLAYER_HEX[sideColor.top]));
  canvas.drawPath(trianglePath(center, x, y, side, 'top'), fillPaint);
  fillPaint.setColor(Skia.Color(PLAYER_HEX[sideColor.right]));
  canvas.drawPath(trianglePath(center, x, y, side, 'right'), fillPaint);
  fillPaint.setColor(Skia.Color(PLAYER_HEX[sideColor.bottom]));
  canvas.drawPath(trianglePath(center, x, y, side, 'bottom'), fillPaint);
  fillPaint.setColor(Skia.Color(PLAYER_HEX[sideColor.left]));
  canvas.drawPath(trianglePath(center, x, y, side, 'left'), fillPaint);
  strokePaint.setColor(Skia.Color(withAlpha('#FFFFFF', 0.22)));
  strokePaint.setStrokeWidth(cell * 0.035);
  canvas.drawPath(diamondStrokePath(x, y, side), strokePaint);
}

function drawSparkle(
  canvas: SkCanvas,
  fillPaint: ReturnType<typeof Skia.Paint>,
  cx: number,
  cy: number,
  radius: number,
) {
  fillPaint.setColor(Skia.Color('#FFF4A2'));
  fillPaint.setAlphaf(0.18);
  canvas.drawCircle(cx, cy, radius * 3.2, fillPaint);
  fillPaint.setColor(Skia.Color('#FFFFFF'));
  fillPaint.setAlphaf(1);
  canvas.drawCircle(cx, cy, radius, fillPaint);
  fillPaint.setColor(Skia.Color('#FFF6B5'));
  fillPaint.setAlphaf(0.82);
  canvas.drawPath(sparklePath(cx, cy, radius * 4.8), fillPaint);
}

function drawRoundedRect(
  canvas: SkCanvas,
  paint: ReturnType<typeof Skia.Paint>,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  canvas.drawRRect(
    Skia.RRectXY(Skia.XYWHRect(x, y, width, height), radius, radius),
    paint,
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
