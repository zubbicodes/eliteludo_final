// Premium gold dice rendered with cached Skia sprites. Reanimated owns the
// roll transform and face cycling so rolling does not require React rerenders.

import {
    Atlas,
    Canvas,
    PaintStyle,
    Skia,
    useRSXformBuffer,
    useRectBuffer,
    type SkCanvas,
    type SkImage,
} from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import Animated, {
    Easing,
    useAnimatedStyle,
    useFrameCallback,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';

type Props = {
  size: number;
  value: number | null;
  rolling: boolean;
};

const DOTS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.3, 0.3], [0.7, 0.7]],
  3: [[0.3, 0.3], [0.5, 0.5], [0.7, 0.7]],
  4: [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]],
  5: [[0.3, 0.3], [0.7, 0.3], [0.5, 0.5], [0.3, 0.7], [0.7, 0.7]],
  6: [[0.3, 0.26], [0.7, 0.26], [0.3, 0.5], [0.7, 0.5], [0.3, 0.74], [0.7, 0.74]],
};

const GLITTER = [
  [0.2, 0.18, 0.018],
  [0.68, 0.16, 0.012],
  [0.82, 0.34, 0.014],
  [0.16, 0.62, 0.011],
  [0.42, 0.78, 0.014],
  [0.76, 0.78, 0.01],
];

type CachedDiceAtlas = {
  image: SkImage;
  spriteSize: number;
};

const DICE_ATLAS_CACHE = new Map<number, CachedDiceAtlas>();

export function Dice({ size, value, rolling }: Props) {
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);
  const tilt = useSharedValue(0);
  const faceIndex = useSharedValue(value ? value - 1 : 0);
  const atlas = useMemo(() => getDiceAtlas(size), [size]);
  const transforms = useRSXformBuffer(1, (transform) => {
    'worklet';
    transform.set(1, 0, 0, 0);
  });
  const sprites = useRectBuffer(1, (rect) => {
    'worklet';
    rect.setXYWH(faceIndex.value * atlas.spriteSize, 0, atlas.spriteSize, atlas.spriteSize);
  });

  useEffect(() => {
    if (rolling) {
      scale.value = withTiming(1.42, { duration: 160, easing: Easing.out(Easing.cubic) });
      rotate.value = withRepeat(withTiming(360, { duration: 520, easing: Easing.linear }), -1, false);
      tilt.value = withRepeat(
        withSequence(
          withTiming(16, { duration: 140, easing: Easing.inOut(Easing.quad) }),
          withTiming(-16, { duration: 140, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      );
      return;
    }

    faceIndex.value = typeof value === 'number' ? value - 1 : faceIndex.value;
    scale.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.back(1.25)) });
    rotate.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) });
    tilt.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [faceIndex, rolling, rotate, scale, tilt, value]);

  useFrameCallback((frameInfo) => {
    'worklet';
    if (!rolling) return;
    const timestamp = frameInfo.timestamp ?? 0;
    faceIndex.value = Math.floor(timestamp / 90) % 6;
  }, true);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: size * 9 },
      { scale: scale.value },
      { rotateZ: `${rotate.value}deg` },
      { rotateX: `${tilt.value}deg` },
      { rotateY: `${-tilt.value * 0.55}deg` },
    ],
  }));

  return (
    <Animated.View style={[{ width: size, height: size }, animatedStyle]}>
      <Canvas style={{ width: size, height: size }} pointerEvents="none">
        <Atlas image={atlas.image} sprites={sprites} transforms={transforms} />
      </Canvas>
    </Animated.View>
  );
}

function getDiceAtlas(size: number) {
  const cached = DICE_ATLAS_CACHE.get(size);
  if (cached) return cached;

  const surface = Skia.Surface.MakeOffscreen(size * 6, size);
  if (!surface) {
    throw new Error('Unable to create dice atlas surface');
  }
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('transparent'));
  for (let face = 1; face <= 6; face++) {
    drawDiceFace(canvas, size, face, (face - 1) * size, 0);
  }
  const atlas = {
    image: surface.makeImageSnapshot(),
    spriteSize: size,
  };
  DICE_ATLAS_CACHE.set(size, atlas);
  return atlas;
}

function drawDiceFace(canvas: SkCanvas, size: number, value: number, offsetX: number, offsetY: number) {
  const radius = size * 0.22;
  const faceInset = size * 0.055;
  const pipSize = size * 0.112;
  const fillPaint = Skia.Paint();
  fillPaint.setAntiAlias(true);
  const strokePaint = Skia.Paint();
  strokePaint.setAntiAlias(true);
  strokePaint.setStyle(PaintStyle.Stroke);
  const dots = DOTS[value] ?? [];

  fillPaint.setColor(Skia.Color('rgba(38, 19, 1, 0.42)'));
  canvas.drawRRect(
    Skia.RRectXY(Skia.XYWHRect(offsetX + size * 0.07, offsetY + size * 0.1, size * 0.88, size * 0.88), radius, radius),
    fillPaint,
  );
  fillPaint.setColor(Skia.Color('#D89B13'));
  canvas.drawRRect(
    Skia.RRectXY(Skia.XYWHRect(offsetX, offsetY, size, size), radius, radius),
    fillPaint,
  );
  fillPaint.setColor(Skia.Color('rgba(255,255,255,0.12)'));
  canvas.drawRRect(
    Skia.RRectXY(
      Skia.XYWHRect(offsetX + size * 0.08, offsetY + size * 0.1, size * 0.72, size * 0.18),
      radius * 0.42,
      radius * 0.42,
    ),
    fillPaint,
  );
  strokePaint.setColor(Skia.Color('rgba(255,255,255,0.16)'));
  strokePaint.setStrokeWidth(size * 0.034);
  canvas.drawRRect(
    Skia.RRectXY(
      Skia.XYWHRect(offsetX + faceInset, offsetY + faceInset, size - faceInset * 2, size - faceInset * 2),
      radius * 0.72,
      radius * 0.72,
    ),
    strokePaint,
  );
  fillPaint.setColor(Skia.Color('rgba(78, 37, 0, 0.24)'));
  canvas.drawPath(bevelPath(size, offsetX, offsetY), fillPaint);
  for (const [x, y, glitterRadius] of GLITTER) {
    fillPaint.setColor(Skia.Color('rgba(255,255,255,0.58)'));
    canvas.drawCircle(offsetX + x * size, offsetY + y * size, glitterRadius * size, fillPaint);
  }
  for (const [x, y] of dots) {
    fillPaint.setColor(Skia.Color('rgba(84, 45, 0, 0.42)'));
    canvas.drawCircle(offsetX + x * size, offsetY + y * size, pipSize * 0.82, fillPaint);
    fillPaint.setColor(Skia.Color('#050505'));
    canvas.drawPath(diamondPath(offsetX + x * size, offsetY + y * size, pipSize), fillPaint);
    fillPaint.setColor(Skia.Color('rgba(255,255,255,0.28)'));
    canvas.drawPath(diamondFacetPath(offsetX + x * size, offsetY + y * size, pipSize), fillPaint);
    strokePaint.setColor(Skia.Color('#8A5C07'));
    strokePaint.setStrokeWidth(size * 0.018);
    canvas.drawPath(diamondPath(offsetX + x * size, offsetY + y * size, pipSize), strokePaint);
  }
}

function bevelPath(size: number, offsetX: number, offsetY: number) {
  const path = Skia.Path.Make();
  path.moveTo(offsetX + size * 0.82, offsetY + size * 0.08);
  path.quadTo(offsetX + size * 0.94, offsetY + size * 0.12, offsetX + size * 0.94, offsetY + size * 0.28);
  path.lineTo(offsetX + size * 0.94, offsetY + size * 0.78);
  path.quadTo(offsetX + size * 0.92, offsetY + size * 0.92, offsetX + size * 0.78, offsetY + size * 0.94);
  path.lineTo(offsetX + size * 0.93, offsetY + size * 0.58);
  path.lineTo(offsetX + size * 0.93, offsetY + size * 0.22);
  path.quadTo(offsetX + size * 0.91, offsetY + size * 0.1, offsetX + size * 0.82, offsetY + size * 0.08);
  path.close();
  return path;
}

function diamondPath(cx: number, cy: number, r: number) {
  const path = Skia.Path.Make();
  path.moveTo(cx, cy - r);
  path.lineTo(cx + r, cy);
  path.lineTo(cx, cy + r);
  path.lineTo(cx - r, cy);
  path.close();
  return path;
}

function diamondFacetPath(cx: number, cy: number, r: number) {
  const path = Skia.Path.Make();
  path.moveTo(cx - r * 0.48, cy - r * 0.08);
  path.lineTo(cx, cy - r * 0.62);
  path.lineTo(cx + r * 0.36, cy - r * 0.1);
  path.lineTo(cx, cy + r * 0.12);
  path.close();
  return path;
}
