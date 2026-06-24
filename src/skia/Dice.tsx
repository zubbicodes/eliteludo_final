// Premium gold dice rendered with Skia. Reanimated handles the roll zoom/spin
// while Skia paints bevels, metallic highlights, and black diamond pips.

import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
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

export function Dice({ size, value, rolling }: Props) {
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);
  const tilt = useSharedValue(0);

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

    scale.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.back(1.25)) });
    rotate.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) });
    tilt.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [rolling, rotate, scale, tilt, value]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: size * 9 },
      { scale: scale.value },
      { rotateZ: `${rotate.value}deg` },
      { rotateX: `${tilt.value}deg` },
      { rotateY: `${-tilt.value * 0.55}deg` },
    ],
  }));

  const face = rolling ? ((Math.floor(Date.now() / 120) % 6) + 1) : value;

  return (
    <Animated.View style={[{ width: size, height: size }, animatedStyle]}>
      <Canvas style={{ width: size, height: size }} pointerEvents="none">
        <GoldDieFace size={size} value={face} />
      </Canvas>
    </Animated.View>
  );
}

function GoldDieFace({ size, value }: { size: number; value: number | null }) {
  const radius = size * 0.22;
  const faceInset = size * 0.055;
  const pipSize = size * 0.112;
  const dots = value ? DOTS[value] : [];

  return (
    <>
      <RoundedRect x={size * 0.07} y={size * 0.1} width={size * 0.88} height={size * 0.88} r={radius} color="rgba(38, 19, 1, 0.42)" />
      <RoundedRect x={0} y={0} width={size} height={size} r={radius} color="#D89B13">
        <LinearGradient
          start={vec(0, 0)}
          end={vec(size, size)}
          colors={['#FFF5A5', '#F1B315', '#C17404', '#FFE174']}
          positions={[0, 0.4, 0.72, 1]}
        />
      </RoundedRect>
      <RoundedRect x={faceInset} y={faceInset} width={size - faceInset * 2} height={size - faceInset * 2} r={radius * 0.72} color="rgba(255,255,255,0.16)" style="stroke" strokeWidth={size * 0.034} />
      <Rect x={size * 0.1} y={size * 0.11} width={size * 0.8} height={size * 0.1} color="rgba(255,255,255,0.16)" />
      <Path path={bevelPath(size)} color="rgba(78, 37, 0, 0.24)" />
      {GLITTER.map(([x, y, r], index) => (
        <Circle key={`glitter-${index}`} cx={x * size} cy={y * size} r={r * size} color="rgba(255,255,255,0.58)" />
      ))}
      {dots.map(([x, y], index) => (
        <Group key={`dot-${index}`}>
          <Circle cx={x * size} cy={y * size} r={pipSize * 0.82} color="rgba(84, 45, 0, 0.42)" />
          <Path path={diamondPath(x * size, y * size, pipSize)} color="#050505" />
          <Path path={diamondFacetPath(x * size, y * size, pipSize)} color="rgba(255,255,255,0.28)" />
          <Path path={diamondPath(x * size, y * size, pipSize)} color="#8A5C07" style="stroke" strokeWidth={size * 0.018} />
        </Group>
      ))}
    </>
  );
}

function bevelPath(size: number) {
  const path = Skia.Path.Make();
  path.moveTo(size * 0.82, size * 0.08);
  path.quadTo(size * 0.94, size * 0.12, size * 0.94, size * 0.28);
  path.lineTo(size * 0.94, size * 0.78);
  path.quadTo(size * 0.92, size * 0.92, size * 0.78, size * 0.94);
  path.lineTo(size * 0.93, size * 0.58);
  path.lineTo(size * 0.93, size * 0.22);
  path.quadTo(size * 0.91, size * 0.1, size * 0.82, size * 0.08);
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
