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
} from "@shopify/react-native-skia";
import { useEffect, useMemo } from "react";
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

type Props = {
  width: number;
  height: number;
  won: boolean;
  accent: string;
};

const GOLD = "#D4AF37";
const PALE_GOLD = "#FFF0A8";
const DARK_GOLD = "#71430B";
const DEFEAT = "#E2574C";

export function ResultCrestCanvas({ width, height, won, accent }: Props) {
  const loop = useLoop(won ? 3400 : 4200);
  const spin = useSweep(won ? 5200 : 6800);
  const glow = useDerivedValue(() => (won ? 0.23 : 0.14) + loop.value * 0.12);
  const bob = useDerivedValue(() => Math.sin(loop.value * Math.PI * 2) * 5);
  const crestTransform = useDerivedValue(() => [{ translateY: bob.value }]);
  const rayTransform = useDerivedValue(() => [{ rotate: spin.value * Math.PI * 2 }]);

  const rays = useMemo(() => starburstPath(width / 2, height / 2, width * 0.17, width * 0.44, 24), [height, width]);

  return (
    <Canvas style={{ width, height }} pointerEvents="none">
      <Circle cx={width / 2} cy={height / 2} r={width * 0.44} color={won ? GOLD : DEFEAT} opacity={glow}>
        <BlurMask blur={38} style="normal" />
      </Circle>
      <Group origin={vec(width / 2, height / 2)} transform={rayTransform}>
        <Path path={rays} color={won ? GOLD : DEFEAT} opacity={won ? 0.18 : 0.11} />
      </Group>
      <Group transform={crestTransform}>
        <Circle cx={width / 2} cy={height / 2 + 8} r={width * 0.34} color="#000000" opacity={0.44}>
          <BlurMask blur={12} style="normal" />
        </Circle>
        <Circle cx={width / 2} cy={height / 2} r={width * 0.31}>
          <LinearGradient
            start={vec(width * 0.22, height * 0.2)}
            end={vec(width * 0.78, height * 0.83)}
            colors={won ? ["#FFF2A8", GOLD, DARK_GOLD] : ["#FFB2A9", DEFEAT, "#531515"]}
          />
        </Circle>
        <Circle cx={width / 2} cy={height / 2} r={width * 0.25} color="#080604" opacity={0.86} />
        <Circle cx={width / 2} cy={height / 2} r={width * 0.22} color={accent} opacity={won ? 0.2 : 0.16}>
          <BlurMask blur={10} style="normal" />
        </Circle>
        {won ? <TrophyGlyph cx={width / 2} cy={height / 2} size={width * 0.43} /> : <DefeatGlyph cx={width / 2} cy={height / 2} size={width * 0.43} />}
        <Circle cx={width * 0.38} cy={height * 0.38} r={width * 0.035} color="#FFFFFF" opacity={0.3} />
      </Group>
    </Canvas>
  );
}

function TrophyGlyph({ cx, cy, size }: { cx: number; cy: number; size: number }) {
  const cup = useMemo(() => trophyCupPath(cx, cy - size * 0.18, size), [cx, cy, size]);
  return (
    <Group>
      <Path path={cup}>
        <LinearGradient
          start={vec(cx - size * 0.26, cy - size * 0.43)}
          end={vec(cx + size * 0.22, cy + size * 0.22)}
          colors={["#FFF7B8", GOLD, "#8C5A10"]}
        />
      </Path>
      <Path path={cup} color="#4D2C06" style="stroke" strokeWidth={2.4} opacity={0.52} />
      <Rect x={cx - size * 0.055} y={cy + size * 0.05} width={size * 0.11} height={size * 0.18} color={GOLD} />
      <RoundedRect x={cx - size * 0.21} y={cy + size * 0.22} width={size * 0.42} height={size * 0.08} r={size * 0.03}>
        <LinearGradient start={vec(cx - size * 0.2, cy)} end={vec(cx + size * 0.2, cy + size * 0.3)} colors={["#FFF0A8", GOLD, "#83500B"]} />
      </RoundedRect>
      <Path path={crownPath(cx, cy - size * 0.33, size * 0.24)} color={PALE_GOLD} />
    </Group>
  );
}

function DefeatGlyph({ cx, cy, size }: { cx: number; cy: number; size: number }) {
  const slashA = useMemo(() => linePath(cx - size * 0.2, cy + size * 0.15, cx + size * 0.2, cy - size * 0.18), [cx, cy, size]);
  const slashB = useMemo(() => linePath(cx - size * 0.2, cy - size * 0.18, cx + size * 0.2, cy + size * 0.15), [cx, cy, size]);

  return (
    <Group>
      <Path path={shieldPath(cx, cy - size * 0.02, size * 0.56)} color="#250908" />
      <Path path={shieldPath(cx, cy - size * 0.04, size * 0.49)}>
        <LinearGradient start={vec(cx - size * 0.24, cy - size * 0.36)} end={vec(cx + size * 0.2, cy + size * 0.28)} colors={["#FF9F93", DEFEAT, "#661717"]} />
      </Path>
      <Path path={slashA} color="#FFF0D4" style="stroke" strokeWidth={size * 0.045} strokeCap="round" />
      <Path path={slashB} color="#FFF0D4" style="stroke" strokeWidth={size * 0.045} strokeCap="round" />
      <Path path={crackPath(cx, cy - size * 0.2, size * 0.36)} color="#190504" style="stroke" strokeWidth={2.2} />
    </Group>
  );
}

function trophyCupPath(cx: number, y: number, size: number) {
  const p = Skia.Path.Make();
  p.moveTo(cx - size * 0.24, y);
  p.lineTo(cx + size * 0.24, y);
  p.cubicTo(cx + size * 0.22, y + size * 0.3, cx + size * 0.13, y + size * 0.44, cx, y + size * 0.47);
  p.cubicTo(cx - size * 0.13, y + size * 0.44, cx - size * 0.22, y + size * 0.3, cx - size * 0.24, y);
  p.moveTo(cx - size * 0.24, y + size * 0.08);
  p.cubicTo(cx - size * 0.43, y + size * 0.1, cx - size * 0.38, y + size * 0.32, cx - size * 0.22, y + size * 0.3);
  p.moveTo(cx + size * 0.24, y + size * 0.08);
  p.cubicTo(cx + size * 0.43, y + size * 0.1, cx + size * 0.38, y + size * 0.32, cx + size * 0.22, y + size * 0.3);
  return p;
}

function crownPath(cx: number, cy: number, size: number) {
  const p = Skia.Path.Make();
  p.moveTo(cx - size * 0.5, cy + size * 0.24);
  p.lineTo(cx - size * 0.42, cy - size * 0.38);
  p.lineTo(cx - size * 0.14, cy - size * 0.08);
  p.lineTo(cx, cy - size * 0.5);
  p.lineTo(cx + size * 0.14, cy - size * 0.08);
  p.lineTo(cx + size * 0.42, cy - size * 0.38);
  p.lineTo(cx + size * 0.5, cy + size * 0.24);
  p.close();
  return p;
}

function shieldPath(cx: number, cy: number, size: number) {
  const p = Skia.Path.Make();
  p.moveTo(cx, cy - size * 0.5);
  p.cubicTo(cx + size * 0.36, cy - size * 0.4, cx + size * 0.42, cy - size * 0.34, cx + size * 0.42, cy - size * 0.34);
  p.cubicTo(cx + size * 0.4, cy + size * 0.16, cx + size * 0.23, cy + size * 0.38, cx, cy + size * 0.52);
  p.cubicTo(cx - size * 0.23, cy + size * 0.38, cx - size * 0.4, cy + size * 0.16, cx - size * 0.42, cy - size * 0.34);
  p.cubicTo(cx - size * 0.42, cy - size * 0.34, cx - size * 0.36, cy - size * 0.4, cx, cy - size * 0.5);
  return p;
}

function crackPath(cx: number, cy: number, size: number) {
  const p = Skia.Path.Make();
  p.moveTo(cx - size * 0.04, cy - size * 0.35);
  p.lineTo(cx + size * 0.05, cy - size * 0.06);
  p.lineTo(cx - size * 0.02, cy + size * 0.03);
  p.lineTo(cx + size * 0.08, cy + size * 0.28);
  return p;
}

function linePath(x1: number, y1: number, x2: number, y2: number) {
  const p = Skia.Path.Make();
  p.moveTo(x1, y1);
  p.lineTo(x2, y2);
  return p;
}

function starburstPath(cx: number, cy: number, inner: number, outer: number, points: number) {
  const p = Skia.Path.Make();
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (i * Math.PI) / points;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) p.moveTo(x, y);
    else p.lineTo(x, y);
  }
  p.close();
  return p;
}

function useLoop(duration: number) {
  const value = useSharedValue(0);
  useEffect(() => {
    value.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [duration, value]);
  return value;
}

function useSweep(duration: number) {
  const value = useSharedValue(0);
  useEffect(() => {
    value.value = withRepeat(
      withTiming(1, { duration, easing: Easing.linear }),
      -1,
      false,
    );
  }, [duration, value]);
  return value;
}
