// Skia particle bursts for capture / win celebrations.
//
// The screen pushes `Burst` objects into an array; each burst spawns N circles
// that fly outward radially with slight gravity and fade out. New bursts have
// to use a unique `id` so the renderer remounts the per-burst hooks cleanly.
//
// Design notes:
//  - Capture: smaller, faster, single-color burst at the captured cell.
//  - Win: bigger, slower, gold + winner-color confetti from board center.
//  - All animation runs on the UI thread via Reanimated shared values; the
//    Skia canvas is overlaid above the board (pointerEvents="none").

import { Canvas, Circle } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import {
  Easing,
  type SharedValue,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/src/theme/colors';

export type BurstKind = 'capture' | 'win';

export type Burst = {
  /** Unique per emission — used as React key and as a particle randomness seed. */
  id: string;
  /** Burst origin in the canvas's pixel space. */
  cx: number;
  cy: number;
  /** Primary hex color (capture: captured token's color; win: winner's color). */
  color: string;
  kind: BurstKind;
};

type Props = {
  width: number;
  height: number;
  bursts: Burst[];
};

const CAPTURE = {
  count: 14,
  duration: 700,
  spread: 60,
  gravity: 30,
  baseR: 2.5,
  jitterR: 2,
};

const WIN = {
  count: 36,
  duration: 1400,
  spread: 130,
  gravity: 70,
  baseR: 3.5,
  jitterR: 2.5,
};

export function Particles({ width, height, bursts }: Props) {
  return (
    <Canvas style={{ width, height }} pointerEvents="none">
      {bursts.map((b) => (
        <BurstView key={b.id} burst={b} />
      ))}
    </Canvas>
  );
}

function BurstView({ burst }: { burst: Burst }) {
  const cfg = burst.kind === 'win' ? WIN : CAPTURE;
  const progress = useSharedValue(0);

  // Per-particle params are deterministic for a given burst id so the random
  // pattern doesn't flicker across re-renders.
  const seeds = useMemo(
    () =>
      Array.from({ length: cfg.count }, (_, i) => {
        const baseAngle = (i / cfg.count) * Math.PI * 2;
        const angleJitter = (rand(burst.id, i) - 0.5) * 0.6;
        const angle = baseAngle + angleJitter;
        const speed = cfg.spread * (0.55 + rand(burst.id, i + 100) * 0.7);
        const r = cfg.baseR + rand(burst.id, i + 200) * cfg.jitterR;
        return { angle, speed, r };
      }),
    [burst.id, cfg.count, cfg.spread, cfg.baseR, cfg.jitterR],
  );

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: cfg.duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [burst.id, cfg.duration, progress]);

  return (
    <>
      {seeds.map((s, i) => (
        <Particle
          key={i}
          cx={burst.cx}
          cy={burst.cy}
          angle={s.angle}
          speed={s.speed}
          baseRadius={s.r}
          color={particleColor(burst, i)}
          gravity={cfg.gravity}
          progress={progress}
        />
      ))}
    </>
  );
}

function Particle({
  cx,
  cy,
  angle,
  speed,
  baseRadius,
  color,
  gravity,
  progress,
}: {
  cx: number;
  cy: number;
  angle: number;
  speed: number;
  baseRadius: number;
  color: string;
  gravity: number;
  progress: SharedValue<number>;
}) {
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  const x = useDerivedValue(() => cx + cosA * speed * progress.value);
  const y = useDerivedValue(
    () => cy + sinA * speed * progress.value + gravity * progress.value * progress.value,
  );
  const r = useDerivedValue(() => Math.max(0, baseRadius * (1 - progress.value * 0.7)));
  const opacity = useDerivedValue(() => Math.max(0, 1 - progress.value));

  return <Circle cx={x} cy={y} r={r} color={color} opacity={opacity} />;
}

function particleColor(burst: Burst, i: number): string {
  if (burst.kind === 'win') {
    return i % 2 === 0 ? colors.gold : burst.color;
  }
  return burst.color;
}

/** Deterministic [0, 1) hash from (id, salt). */
function rand(id: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}
