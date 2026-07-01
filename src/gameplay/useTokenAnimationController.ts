import {
  Skia,
  useRectBuffer,
  useRSXformBuffer,
  type SkCanvas,
  type SkImage,
  PaintStyle,
} from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef } from 'react';
import {
  Easing,
  cancelAnimation,
  makeMutable,
  runOnJS,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { Color, TokenId } from '@/src/game/types';

import type { MoveAnimation, TokenCenter } from './helpers';

const TOKEN_SPRITE_SIZE = 128;
const MAX_RENDER_TOKENS = 16;

type AnimatedTokenDescriptor = TokenCenter & {
  id: TokenId;
  color: Color;
  highlighted: boolean;
};

type TokenSlot = {
  x: ReturnType<typeof makeMutable<number>>;
  y: ReturnType<typeof makeMutable<number>>;
  size: ReturnType<typeof makeMutable<number>>;
  scale: ReturnType<typeof makeMutable<number>>;
  lift: ReturnType<typeof makeMutable<number>>;
  glow: ReturnType<typeof makeMutable<number>>;
  spriteIndex: ReturnType<typeof makeMutable<number>>;
  visible: ReturnType<typeof makeMutable<number>>;
};

type TokenAtlasCache = {
  image: SkImage;
  haloImage: SkImage;
};

const TOKEN_ATLAS_CACHE = new Map<number, TokenAtlasCache>();

const COLOR_INDEX: Record<Color, number> = {
  red: 0,
  green: 1,
  yellow: 2,
  blue: 3,
};

export function useTokenAnimationController(params: {
  tokens: AnimatedTokenDescriptor[];
  moveAnimation: MoveAnimation | null;
  hopMs: number;
  onMoveAnimationComplete: () => void;
}) {
  const { tokens, moveAnimation, hopMs, onMoveAnimationComplete } = params;
  const slotsRef = useRef<TokenSlot[]>(
    Array.from({ length: MAX_RENDER_TOKENS }, () => createTokenSlot()),
  );
  const initializedRef = useRef<Set<TokenId>>(new Set());
  const moveTagRef = useRef(0);
  const atlas = useMemo(() => getTokenAtlas(TOKEN_SPRITE_SIZE), []);
  const tokenSprites = useRectBuffer(tokens.length, (rect, index) => {
    'worklet';
    const slot = slotsRef.current[index];
    rect.setXYWH(slot.spriteIndex.value * TOKEN_SPRITE_SIZE, 0, TOKEN_SPRITE_SIZE, TOKEN_SPRITE_SIZE);
  });
  const tokenTransforms = useRSXformBuffer(tokens.length, (transform, index) => {
    'worklet';
    const slot = slotsRef.current[index];
    const scale = Math.max(0.0001, (slot.size.value * slot.scale.value * slot.visible.value) / TOKEN_SPRITE_SIZE);
    transform.set(scale, 0, slot.x.value - (TOKEN_SPRITE_SIZE * scale) / 2, slot.y.value + slot.lift.value - (TOKEN_SPRITE_SIZE * scale) / 2);
  });
  const haloSprites = useRectBuffer(tokens.length, (rect) => {
    'worklet';
    rect.setXYWH(0, 0, TOKEN_SPRITE_SIZE, TOKEN_SPRITE_SIZE);
  });
  const haloTransforms = useRSXformBuffer(tokens.length, (transform, index) => {
    'worklet';
    const slot = slotsRef.current[index];
    const haloScale = Math.max(0.0001, ((slot.size.value * (1.04 + slot.glow.value * 0.18)) * slot.glow.value) / TOKEN_SPRITE_SIZE);
    transform.set(
      haloScale,
      0,
      slot.x.value - (TOKEN_SPRITE_SIZE * haloScale) / 2,
      slot.y.value - (TOKEN_SPRITE_SIZE * haloScale) / 2,
    );
  });

  const handleMoveCompletion = useMemo(
    () => (tag: number) => {
      if (moveTagRef.current !== tag) return;
      onMoveAnimationComplete();
    },
    [onMoveAnimationComplete],
  );

  useEffect(() => {
    tokens.forEach((token, index) => {
      const slot = slotsRef.current[index];
      slot.spriteIndex.value = COLOR_INDEX[token.color];
      slot.size.value = token.size;
      slot.visible.value = 1;

      if (!initializedRef.current.has(token.id)) {
        slot.x.value = token.cx;
        slot.y.value = token.cy;
        initializedRef.current.add(token.id);
      } else if (
        !moveAnimation ||
        (moveAnimation.movingTokenId !== token.id && !moveAnimation.capturedTokenIds.includes(token.id))
      ) {
        slot.x.value = withTiming(token.cx, { duration: 220 });
        slot.y.value = withTiming(token.cy, { duration: 220 });
      }

      slot.glow.value = withTiming(token.highlighted ? 1 : 0, { duration: 180 });
    });

    for (let index = tokens.length; index < MAX_RENDER_TOKENS; index++) {
      const slot = slotsRef.current[index];
      slot.visible.value = 0;
      slot.glow.value = 0;
    }
  }, [moveAnimation, tokens]);

  useEffect(() => {
    if (!moveAnimation) return;
    const movingIndex = tokens.findIndex((token) => token.id === moveAnimation.movingTokenId);
    if (movingIndex < 0) return;

    moveTagRef.current += 1;
    const moveTag = moveTagRef.current;
    const movingSlot = slotsRef.current[movingIndex];
    const movingToken = tokens[movingIndex];
    const arc = Math.min(12, movingToken.size * 0.32);
    const xSequence = moveAnimation.hopPath.slice(1).map((stop) =>
      withTiming(stop.cx, { duration: hopMs, easing: Easing.linear }),
    );
    const ySequence = moveAnimation.hopPath.slice(1).map((stop, index, list) =>
      withTiming(
        stop.cy,
        { duration: hopMs, easing: Easing.linear },
        index === list.length - 1
          ? (finished) => {
              if (finished) runOnJS(handleMoveCompletion)(moveTag);
            }
          : undefined,
      ),
    );
    const liftSequence = moveAnimation.hopPath.slice(1).flatMap(() => [
      withTiming(-arc, { duration: hopMs / 2, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: hopMs / 2, easing: Easing.in(Easing.quad) }),
    ]);
    const scaleSequence = moveAnimation.hopPath.slice(1).flatMap(() => [
      withTiming(1.08, { duration: hopMs / 2, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: hopMs / 2, easing: Easing.in(Easing.quad) }),
    ]);

    movingSlot.x.value = withSequence(...xSequence);
    movingSlot.y.value = withSequence(...ySequence);
    movingSlot.lift.value = withSequence(...liftSequence);
    movingSlot.scale.value = withSequence(...scaleSequence);

    moveAnimation.capturedTokenIds.forEach((capturedId) => {
      const capturedIndex = tokens.findIndex((token) => token.id === capturedId);
      if (capturedIndex < 0) return;
      const capturedSlot = slotsRef.current[capturedIndex];
      const target = tokens[capturedIndex];
      capturedSlot.scale.value = withDelay(
        moveAnimation.captureDelayMs,
        withSequence(
          withTiming(0.9, { duration: 110 }),
          withTiming(1, { duration: 180 }),
        ),
      );
      capturedSlot.x.value = withDelay(
        moveAnimation.captureDelayMs,
        withTiming(target.cx, { duration: 220, easing: Easing.out(Easing.cubic) }),
      );
      capturedSlot.y.value = withDelay(
        moveAnimation.captureDelayMs,
        withTiming(target.cy, { duration: 220, easing: Easing.out(Easing.cubic) }),
      );
    });

    return () => {
      cancelAnimation(movingSlot.x);
      cancelAnimation(movingSlot.y);
      cancelAnimation(movingSlot.lift);
      cancelAnimation(movingSlot.scale);
    };
  }, [handleMoveCompletion, hopMs, moveAnimation, tokens]);

  return {
    tokenImage: atlas.image,
    tokenSprites,
    tokenTransforms,
    haloImage: atlas.haloImage,
    haloSprites,
    haloTransforms,
  };
}

function createTokenSlot(): TokenSlot {
  return {
    x: makeMutable(0),
    y: makeMutable(0),
    size: makeMutable(0),
    scale: makeMutable(1),
    lift: makeMutable(0),
    glow: makeMutable(0),
    spriteIndex: makeMutable(0),
    visible: makeMutable(0),
  };
}

function getTokenAtlas(size: number): TokenAtlasCache {
  const cached = TOKEN_ATLAS_CACHE.get(size);
  if (cached) return cached;

  const surface = Skia.Surface.MakeOffscreen(size * 4, size);
  const haloSurface = Skia.Surface.MakeOffscreen(size, size);
  if (!surface || !haloSurface) {
    throw new Error('Unable to create token atlas surfaces');
  }

  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('transparent'));
  (Object.keys(COLOR_INDEX) as Color[]).forEach((color) => {
    drawTokenSprite(canvas, size, color, COLOR_INDEX[color] * size, 0);
  });

  const haloCanvas = haloSurface.getCanvas();
  haloCanvas.clear(Skia.Color('transparent'));
  drawHaloSprite(haloCanvas, size);

  const atlas = {
    image: surface.makeImageSnapshot(),
    haloImage: haloSurface.makeImageSnapshot(),
  };
  TOKEN_ATLAS_CACHE.set(size, atlas);
  return atlas;
}

function drawTokenSprite(
  canvas: SkCanvas,
  size: number,
  color: Color,
  offsetX: number,
  offsetY: number,
) {
  const fillPaint = Skia.Paint();
  fillPaint.setAntiAlias(true);
  const strokePaint = Skia.Paint();
  strokePaint.setAntiAlias(true);
  strokePaint.setStyle(PaintStyle.Stroke);
  const cx = offsetX + size / 2;
  const cy = offsetY + size / 2;
  const outerRadius = size * 0.44;
  const innerRadius = size * 0.34;

  fillPaint.setColor(Skia.Color('rgba(0,0,0,0.28)'));
  canvas.drawCircle(cx + size * 0.03, cy + size * 0.05, outerRadius, fillPaint);

  fillPaint.setColor(Skia.Color('#D6A943'));
  canvas.drawCircle(cx, cy, outerRadius, fillPaint);
  fillPaint.setColor(Skia.Color(tokenBaseColor(color)));
  canvas.drawCircle(cx, cy, innerRadius, fillPaint);
  fillPaint.setColor(Skia.Color(tokenLightColor(color)));
  canvas.drawCircle(cx - size * 0.12, cy - size * 0.12, size * 0.09, fillPaint);
  fillPaint.setColor(Skia.Color('#FFF2AE'));
  canvas.drawCircle(cx, cy, size * 0.11, fillPaint);
  fillPaint.setColor(Skia.Color(tokenJewelColor(color)));
  canvas.drawCircle(cx, cy, size * 0.08, fillPaint);

  strokePaint.setColor(Skia.Color('#71430B'));
  strokePaint.setStrokeWidth(size * 0.04);
  canvas.drawCircle(cx, cy, outerRadius, strokePaint);
  strokePaint.setColor(Skia.Color('rgba(255,255,255,0.24)'));
  strokePaint.setStrokeWidth(size * 0.022);
  canvas.drawCircle(cx, cy, innerRadius, strokePaint);
}

function drawHaloSprite(
  canvas: SkCanvas,
  size: number,
) {
  const fillPaint = Skia.Paint();
  fillPaint.setAntiAlias(true);
  const strokePaint = Skia.Paint();
  strokePaint.setAntiAlias(true);
  strokePaint.setStyle(PaintStyle.Stroke);
  const cx = size / 2;
  const cy = size / 2;
  fillPaint.setColor(Skia.Color('rgba(255,226,115,0.26)'));
  canvas.drawCircle(cx, cy, size * 0.46, fillPaint);
  strokePaint.setColor(Skia.Color('rgba(255,235,153,0.9)'));
  strokePaint.setStrokeWidth(size * 0.04);
  canvas.drawCircle(cx, cy, size * 0.42, strokePaint);
}

function tokenBaseColor(color: Color) {
  switch (color) {
    case 'red':
      return '#B81E49';
    case 'green':
      return '#0C8A52';
    case 'yellow':
      return '#C78F0F';
    case 'blue':
      return '#1874C4';
  }
}

function tokenLightColor(color: Color) {
  switch (color) {
    case 'red':
      return '#F36B8E';
    case 'green':
      return '#57CC8B';
    case 'yellow':
      return '#F3D65C';
    case 'blue':
      return '#67C0FF';
  }
}

function tokenJewelColor(color: Color) {
  switch (color) {
    case 'red':
      return '#8B102F';
    case 'green':
      return '#055534';
    case 'yellow':
      return '#9A6504';
    case 'blue':
      return '#0B437A';
  }
}
