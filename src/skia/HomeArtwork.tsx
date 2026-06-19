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
  Text as SkiaText,
  useFont,
  vec
} from "@shopify/react-native-skia";
import { useEffect, useMemo } from "react";
import { Image } from "react-native";
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { OrnateTokenGlyph } from "@/src/skia/OrnateToken";

export type HomeModeArtwork = "2p" | "4p" | "private" | "friends" | "offline";

const GOLD = "#D6A943";
const PALE_GOLD = "#FFE9A2";
const GOLD_DARK = "#71430B";

export function RoyalHomeBackdrop({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  const pulse = useLoop(4200);
  const glowOpacity = useDerivedValue(() => 0.13 + pulse.value * 0.08);
  const moteY = useDerivedValue(() => height * (0.18 + pulse.value * 0.08));

  return (
    <Canvas style={{ width, height }} pointerEvents="none">
      <Rect x={0} y={0} width={width} height={height} color="#070706">
        <LinearGradient
          start={vec(0, 0)}
          end={vec(width, height)}
          colors={["#16130f", "#050505", "#0c0905"]}
        />
      </Rect>
      <Circle
        cx={width * 0.5}
        cy={height * 0.43}
        r={width * 0.52}
        color="#B7892D"
        opacity={glowOpacity}
      >
        <BlurMask blur={54} style="normal" />
      </Circle>
      <Circle
        cx={width * 0.16}
        cy={moteY}
        r={2.2}
        color={PALE_GOLD}
        opacity={0.55}
      >
        <BlurMask blur={3} style="normal" />
      </Circle>
      <Circle
        cx={width * 0.83}
        cy={height * 0.31}
        r={1.7}
        color={PALE_GOLD}
        opacity={0.4}
      />
      <Circle
        cx={width * 0.72}
        cy={height * 0.63}
        r={1.4}
        color={GOLD}
        opacity={0.38}
      />
      {Array.from({ length: 9 }, (_, index) => (
        <Rect
          key={index}
          x={-width + index * 58}
          y={0}
          width={1}
          height={height * 1.5}
          color="#D9B45B"
          opacity={0.025}
          transform={[{ rotate: -0.35 }]}
        />
      ))}
    </Canvas>
  );
}

export function RoyalCrestCanvas({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  const pulse = useLoop(2600);
  const halo = useDerivedValue(() => 0.1 + pulse.value * 0.08);
  const crownY = useDerivedValue(() => 2 - pulse.value * 1.2);
  const crownTransform = useDerivedValue(() => [{ translateY: crownY.value }]);
  const titleFont = useFont(
    require("../../assets/fonts/CinzelDecorative-Regular.ttf"),
    Math.min(30, width * 0.1),
  );
  const tagFont = useFont(
    require("../../assets/fonts/CinzelDecorative-Regular.ttf"),
    Math.min(8, width * 0.029),
  );
  const title = "ELITE LUDO";
  const tag = "PLAY LIKE ROYALTY";
  const titleX = (width - (titleFont?.measureText(title).width ?? width * 0.7)) / 2;
  const tagX = (width - (tagFont?.measureText(tag).width ?? width * 0.48)) / 2;
  const crown = useMemo(() => {
    const path = Skia.Path.Make();
    path.moveTo(width * 0.39, 29);
    path.lineTo(width * 0.405, 9);
    path.lineTo(width * 0.46, 21);
    path.lineTo(width * 0.5, 3);
    path.lineTo(width * 0.54, 21);
    path.lineTo(width * 0.595, 9);
    path.lineTo(width * 0.61, 29);
    path.close();
    return path;
  }, [width]);

  return (
    <Canvas style={{ width, height }} pointerEvents="none">
      <Circle cx={width / 2} cy={52} r={width * 0.27} color={GOLD} opacity={halo}>
        <BlurMask blur={24} style="normal" />
      </Circle>
      <Group transform={crownTransform}>
        <Path path={crown} color={GOLD}>
          <LinearGradient
            start={vec(width * 0.43, 4)}
            end={vec(width * 0.58, 31)}
            colors={["#FFF2A4", GOLD, "#68400A"]}
          />
        </Path>
        <RoundedRect
          x={width * 0.39}
          y={28}
          width={width * 0.22}
          height={6}
          r={3}
        >
          <LinearGradient
            start={vec(width * 0.39, 28)}
            end={vec(width * 0.61, 34)}
            colors={["#78490B", "#FFE58A", "#8D5A10"]}
          />
        </RoundedRect>
        <Circle cx={width * 0.43} cy={30.5} r={1.7} color="#9B183C" />
        <Circle cx={width * 0.5} cy={30.5} r={1.9} color="#176F5D" />
        <Circle cx={width * 0.57} cy={30.5} r={1.7} color="#233E8A" />
      </Group>

      {titleFont && (
        <Group>
          <SkiaText x={titleX + 1.2} y={69.5} text={title} font={titleFont} color="#000000" opacity={0.82} />
          <SkiaText
            x={titleX}
            y={68}
            text={title}
            font={titleFont}
            color="#6F5827"
            style="stroke"
            strokeWidth={1.2}
            opacity={0.72}
          />
          <SkiaText x={titleX} y={68} text={title} font={titleFont} color="#17140E" />
          <SkiaText x={titleX} y={67.2} text={title} font={titleFont} color="#D0AE58" opacity={0.22} />
        </Group>
      )}
      {tagFont && (
        <SkiaText
          x={tagX}
          y={height - 3}
          text={tag}
          font={tagFont}
          color="#9D8244"
          opacity={0.58}
        />
      )}
      <Rect
        x={width * 0.07}
        y={61}
        width={width * 0.19}
        height={1}
        color="#8D7138"
        opacity={0.48}
      />
      <Rect
        x={width * 0.74}
        y={61}
        width={width * 0.19}
        height={1}
        color="#8D7138"
        opacity={0.48}
      />
      <Circle cx={width * 0.055} cy={61.5} r={1.8} color="#8D7138" opacity={0.7} />
      <Circle cx={width * 0.945} cy={61.5} r={1.8} color="#8D7138" opacity={0.7} />
    </Canvas>
  );
}

export function HomeModeCanvas({
  width,
  height,
  mode,
}: {
  width: number;
  height: number;
  mode: HomeModeArtwork;
}) {
  const progress = useLoop(3200 + mode.length * 180);
  const shineProgress = useSweep(2600 + mode.length * 90);
  const bob = useDerivedValue(
    () => Math.sin(progress.value * Math.PI * 2) * 2.5,
  );
  const bobTransform = useDerivedValue(() => [{ translateY: bob.value }]);
  const shineBandWidth = Math.max(30, width * 0.3);
  const shineBandLength = Math.hypot(width, height) * 2.2;
  const shineTranslate = useDerivedValue(() => [
    {
      translateX:
        width + shineBandWidth * 1.2 -
        shineProgress.value * (width + shineBandWidth * 2.4),
    },
    {
      translateY:
        -shineBandWidth * 1.2 +
        shineProgress.value * (height + shineBandWidth * 2.4),
    },
  ]);
  const large = mode === "2p" || mode === "4p";
  const premiumFrame =
    large || mode === "private" || mode === "friends" || mode === "offline";

  return (
    <Canvas style={{ width, height }} pointerEvents="none">
      {premiumFrame ? (
        <HeroButtonFrame
          width={width}
          height={height}
          label={
            mode === "2p"
              ? "2 Player"
              : mode === "4p"
                ? "4 Player"
                : mode === "private"
                  ? "Private Table"
                  : mode === "friends"
                    ? "Team Up Friends"
                    : "Offline"
          }
        />
      ) : (
        <Group>
          <RoundedRect
            x={2}
            y={7}
            width={width - 4}
            height={height - 11}
            r={large ? 18 : 15}
            color="#050505"
          />
          <RoundedRect
            x={3}
            y={3}
            width={width - 6}
            height={height - 12}
            r={large ? 17 : 14}
          >
            <LinearGradient
              start={vec(0, 0)}
              end={vec(width, height)}
              colors={["#3A2A13", "#11100e", "#080808"]}
            />
          </RoundedRect>
          <RoundedRect
            x={4}
            y={4}
            width={width - 8}
            height={height - 14}
            r={large ? 16 : 13}
            style="stroke"
            strokeWidth={1.4}
            color={GOLD}
            opacity={0.82}
          />
          <RoundedRect
            x={10}
            y={10}
            width={width - 20}
            height={height - 26}
            r={large ? 11 : 9}
            style="stroke"
            strokeWidth={0.7}
            color={PALE_GOLD}
            opacity={0.23}
          />
        </Group>
      )}
      <Circle
        cx={width / 2}
        cy={height * 0.42}
        r={width * 0.33}
        color="#D09A31"
        opacity={0.12}
      >
        <BlurMask blur={18} style="normal" />
      </Circle>

      <Group transform={bobTransform}>
        {large ? (
          <LargeTable
            width={width}
            height={height}
            players={mode === "2p" ? 2 : 4}
          />
        ) : (
          <SmallEmblem width={width} height={height} mode={mode} />
        )}
      </Group>

      <Group transform={shineTranslate}>
        <Group transform={[{ rotate: -Math.PI / 4 }]}>
          <Rect
            x={-shineBandWidth / 2}
            y={-shineBandLength / 2}
            width={shineBandWidth}
            height={shineBandLength}
            opacity={0.34}
          >
            <LinearGradient
              start={vec(-shineBandWidth / 2, 0)}
              end={vec(shineBandWidth / 2, 0)}
              colors={[
                "transparent",
                "rgba(255,226,137,0.12)",
                "rgba(255,250,221,0.88)",
                "rgba(255,255,255,0.98)",
                "rgba(255,250,221,0.88)",
                "rgba(255,205,91,0.12)",
                "transparent",
              ]}
              positions={[0, 0.18, 0.42, 0.5, 0.58, 0.82, 1]}
            />
          </Rect>
        </Group>
      </Group>
      {!premiumFrame && (
        <RoundedRect
          x={width * 0.29}
          y={height - 24}
          width={width * 0.42}
          height={2}
          r={1}
          color={GOLD}
          opacity={0.5}
        />
      )}
    </Canvas>
  );
}

function HeroButtonFrame({
  width,
  height,
  label,
}: {
  width: number;
  height: number;
  label: string;
}) {
  const radius = Math.min(24, width * 0.14);
  const extrusionDepth = Math.max(14, height * 0.105);
  const compactLabel = label.length > 9;
  const labelFontSize = compactLabel
    ? Math.min(height * 0.105, (width - 24) / (label.length * 0.68))
    : Math.min(22, height * 0.135);
  const labelFont = useFont(
    require("../../assets/fonts/CinzelDecorative-Regular.ttf"),
    labelFontSize,
  );
  const labelWidth = labelFont?.measureText(label).width ?? width * 0.48;
  return (
    <Group>
      {/* Golden lower cradle / extrusion base. */}
      <RoundedRect
        x={0}
        y={extrusionDepth}
        width={width}
        height={height - extrusionDepth}
        r={radius}
      >
        <LinearGradient
          start={vec(0, height)}
          end={vec(width, height)}
          colors={["#8B5812", "#D4AF37", "#F3E5AB", "#996515"]}
          positions={[0, 0.24, 0.56, 1]}
        />
      </RoundedRect>

      {/* Dark marble body and top cap. */}
      <RoundedRect x={0} y={8} width={width} height={height - 20} r={radius}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(0, height)}
          colors={["#242424", "#080808"]}
        />
      </RoundedRect>
      <RoundedRect
        x={0}
        y={0}
        width={width}
        height={height - extrusionDepth}
        r={radius}
      >
        <LinearGradient
          start={vec(0, 0)}
          end={vec(width, height)}
          colors={["#343434", "#1A1A1A", "#101010"]}
        />
      </RoundedRect>

      {/* Subtle procedural marble veins. */}
      <Path
        path={marbleVein(
          width * 0.06,
          height * 0.2,
          width * 0.82,
          height * 0.06,
        )}
        color="#FFFFFF"
        opacity={0.055}
        style="stroke"
        strokeWidth={1.1}
      />
      <Path
        path={marbleVein(
          width * 0.22,
          height * 0.5,
          width * 0.68,
          -height * 0.08,
        )}
        color="#D8C48C"
        opacity={0.06}
        style="stroke"
        strokeWidth={0.8}
      />

      {/* Inset metallic frame, shortened to preserve the title area. */}
      <RoundedRect
        x={12}
        y={12}
        width={width - 24}
        height={height - extrusionDepth - 54}
        r={Math.max(8, radius - 6)}
        style="stroke"
        strokeWidth={2.5}
      >
        <LinearGradient
          start={vec(12, 12)}
          end={vec(width - 12, height - 42)}
          colors={["#8E5A12", "#F3E5AB", "#D4AF37", "#7B4B0A"]}
          positions={[0, 0.38, 0.68, 1]}
        />
      </RoundedRect>
      <Rect
        x={18}
        y={height - 42}
        width={width - 36}
        height={1}
        color="#E7C96D"
        opacity={0.28}
      />

      {labelFont && (
        <Group>
          <SkiaText
            x={(width - labelWidth) / 2 + 1}
            y={height - 17}
            text={label}
            font={labelFont}
            color="#5B3509"
          />
          <SkiaText
            x={(width - labelWidth) / 2}
            y={height - 19}
            text={label}
            font={labelFont}
            color={GOLD}
          >
            <LinearGradient
              start={vec(0, height - 38)}
              end={vec(0, height - 14)}
              colors={["#FFF4B9", "#D4AF37", "#8E5B11"]}
              positions={[0, 0.56, 1]}
            />
          </SkiaText>
        </Group>
      )}
    </Group>
  );
}

function marbleVein(x: number, y: number, width: number, rise: number) {
  const path = Skia.Path.Make();
  path.moveTo(x, y);
  path.cubicTo(
    x + width * 0.2,
    y - 8,
    x + width * 0.36,
    y + rise + 7,
    x + width * 0.52,
    y + rise,
  );
  path.cubicTo(
    x + width * 0.7,
    y + rise - 8,
    x + width * 0.84,
    y + 5,
    x + width,
    y + rise * 0.2,
  );
  return path;
}

function LargeTable({
  width,
  height,
  players,
}: {
  width: number;
  height: number;
  players: 2 | 4;
}) {
  const numberSize = Math.min(width * 0.63, height * 0.69);
  const numberFont = useFont(
    require("../../assets/fonts/CinzelDecorative-Regular.ttf"),
    numberSize,
  );
  const boardX = width * 0.1;
  const boardY = height * 0.39;
  const boardW = width * 0.8;
  const boardH = height * 0.31;
  const numberX = width * (players === 2 ? 0.27 : 0.31);
  const numberY = height * 0.53;
  return (
    <Group>
      <Circle
        cx={width * 0.5}
        cy={height * 0.43}
        r={width * 0.3}
        color="#E1A630"
        opacity={0.2}
      >
        <BlurMask blur={16} style="normal" />
      </Circle>

      <BoardPlane x={boardX} y={boardY} width={boardW} height={boardH} />

      {players === 2 ? (
        <Group>
          <OrnateTokenGlyph
            cx={width * 0.23}
            cy={height * 0.385}
            size={height * 0.25}
            color="blue"
          />
          <OrnateTokenGlyph
            cx={width * 0.75}
            cy={height * 0.35}
            size={height * 0.25}
            color="red"
          />
        </Group>
      ) : (
        <Group>
          <OrnateTokenGlyph
            cx={width * 0.16}
            cy={height * 0.38}
            size={height * 0.2}
            color="blue"
          />
          <OrnateTokenGlyph
            cx={width * 0.34}
            cy={height * 0.3}
            size={height * 0.2}
            color="green"
          />
          <OrnateTokenGlyph
            cx={width * 0.7}
            cy={height * 0.3}
            size={height * 0.2}
            color="red"
          />
          <OrnateTokenGlyph
            cx={width * 0.87}
            cy={height * 0.38}
            size={height * 0.2}
            color="yellow"
          />
        </Group>
      )}

      {numberFont && (
        <Group>
          {[8, 6, 4, 2].map((depth) => (
            <SkiaText
              key={depth}
              x={numberX + depth * 0.65}
              y={numberY + depth * 0.7}
              text={String(players)}
              font={numberFont}
              color={depth > 4 ? "#5D350B" : "#9D6415"}
            />
          ))}
          <SkiaText
            x={numberX}
            y={numberY}
            text={String(players)}
            font={numberFont}
            color={GOLD}
          >
            <LinearGradient
              start={vec(numberX, height * 0.03)}
              end={vec(numberX + numberSize * 0.7, numberY)}
              colors={["#FFF1A3", "#F3BC35", "#A45D08", "#FFE070"]}
            />
          </SkiaText>
          <SkiaText
            x={numberX + 1}
            y={numberY - 1}
            text={String(players)}
            font={numberFont}
            color="#FFF5BD"
            opacity={0.2}
          />
        </Group>
      )}

      {players === 2 ? (
        <Die
          x={width * 0.43}
          y={height * 0.42}
          size={height * 0.24}
          dark={false}
          rotate={0.14}
          value={3}
        />
      ) : (
        <Group>
          <Die
            x={width * 0.21}
            y={height * 0.48}
            size={height * 0.22}
            dark
            showShadow={false}
            rotate={-0.12}
            value={4}
          />
          <Die
            x={width * 0.41}
            y={height * 0.46}
            size={height * 0.24}
            dark
            showShadow={false}
            rotate={0.22}
            value={3}
          />
          <Die
            x={width * 0.63}
            y={height * 0.48}
            size={height * 0.23}
            dark
            showShadow={false}
            rotate={-0.2}
            value={5}
          />
        </Group>
      )}
    </Group>
  );
}

function BoardPlane({
  x,
  y,
  width,
  height,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const top = quadPath(
    x + width * 0.12,
    y,
    x + width,
    y + height * 0.2,
    x + width * 0.88,
    y + height,
    x,
    y + height * 0.78,
  );
  const lower = quadPath(
    x,
    y + height * 0.78,
    x + width * 0.88,
    y + height,
    x + width * 0.88,
    y + height + 8,
    x,
    y + height * 0.78 + 8,
  );
  const centerX = x + width * 0.5;
  const centerY = y + height * 0.5;
  return (
    <Group>
      <Path path={lower} color="#5A370E" />
      <Path path={top} color="#E4C36A" />
      <Path
        path={quadPath(
          x + width * 0.14,
          y + 4,
          centerX,
          centerY,
          centerX - 3,
          y + height * 0.92,
          x + 4,
          y + height * 0.75,
        )}
        color="#248BC0"
      />
      <Path
        path={quadPath(
          x + width * 0.14,
          y + 4,
          x + width - 5,
          y + height * 0.21,
          centerX,
          centerY,
          centerX,
          centerY,
        )}
        color="#D44D57"
      />
      <Path
        path={quadPath(
          centerX,
          centerY,
          x + width - 5,
          y + height * 0.21,
          x + width * 0.86,
          y + height * 0.91,
          centerX,
          centerY,
        )}
        color="#E3B93A"
      />
      <Path
        path={quadPath(
          x + 4,
          y + height * 0.75,
          centerX,
          centerY,
          x + width * 0.86,
          y + height * 0.91,
          centerX - 3,
          y + height * 0.92,
        )}
        color="#299A58"
      />
      <Path
        path={top}
        color="#FFF0A5"
        style="stroke"
        strokeWidth={2}
        opacity={0.72}
      />
      <Path
        path={quadPath(
          centerX - 9,
          centerY - 3,
          centerX + 8,
          centerY,
          centerX + 4,
          centerY + 10,
          centerX - 12,
          centerY + 7,
        )}
        color="#F7EDC6"
      />
    </Group>
  );
}

function quadPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number,
) {
  const path = Skia.Path.Make();
  path.moveTo(x1, y1);
  path.lineTo(x2, y2);
  path.lineTo(x3, y3);
  path.lineTo(x4, y4);
  path.close();
  return path;
}

function Die({
  x,
  y,
  size,
  dark,
  showShadow = true,
  rotate = 0,
  value = 3,
}: {
  x: number;
  y: number;
  size: number;
  dark: boolean;
  showShadow?: boolean;
  rotate?: number;
  value?: number;
}) {
  const face = dark ? "#151515" : "#F2E2AD";
  const pip = dark ? GOLD : "#24180B";
  const depth = size * 0.12;
  return (
    <Group origin={vec(x + size / 2, y + size / 2)} transform={[{ rotate }]}>
      {showShadow && (
        <RoundedRect
          x={x + 3}
          y={y + depth}
          width={size}
          height={size}
          r={size * 0.2}
          color="#000"
          opacity={0.52}
        >
          <BlurMask blur={3} style="normal" />
        </RoundedRect>
      )}
      {!dark && (
        <Group>
          <Path
            path={quadPath(
              x + size,
              y + depth * 0.45,
              x + size + depth,
              y + depth,
              x + size + depth,
              y + size,
              x + size,
              y + size + depth * 0.45,
            )}
            color="#9D6A18"
          />
          <Path
            path={quadPath(
              x + depth * 0.35,
              y + size,
              x + size,
              y + size,
              x + size + depth,
              y + size,
              x + depth,
              y + size + depth,
            )}
            color="#B77B1B"
          />
        </Group>
      )}
      <RoundedRect
        x={x}
        y={y}
        width={size}
        height={size}
        r={size * 0.2}
        color={face}
      />
      <RoundedRect
        x={x + size * 0.08}
        y={y + size * 0.07}
        width={size * 0.42}
        height={size * 0.1}
        r={size * 0.05}
        color="#FFFFFF"
        opacity={dark ? 0.12 : 0.42}
      />
      <RoundedRect
        x={x + 1}
        y={y + 1}
        width={size - 2}
        height={size - 2}
        r={size * 0.18}
        style="stroke"
        strokeWidth={1.2}
        color={PALE_GOLD}
        opacity={0.6}
      />
      {diePips(value).map(([px, py], index) => (
        <Circle
          key={index}
          cx={x + size * px}
          cy={y + size * py}
          r={size * 0.075}
          color={pip}
        />
      ))}
    </Group>
  );
}

function diePips(value: number): [number, number][] {
  const map: Record<number, [number, number][]> = {
    1: [[0.5, 0.5]],
    2: [
      [0.3, 0.3],
      [0.7, 0.7],
    ],
    3: [
      [0.28, 0.28],
      [0.5, 0.5],
      [0.72, 0.72],
    ],
    4: [
      [0.3, 0.3],
      [0.7, 0.3],
      [0.3, 0.7],
      [0.7, 0.7],
    ],
    5: [
      [0.28, 0.28],
      [0.72, 0.28],
      [0.5, 0.5],
      [0.28, 0.72],
      [0.72, 0.72],
    ],
  };
  return map[value] ?? map[3];
}

function SmallEmblem({
  width,
  height,
  mode,
}: {
  width: number;
  height: number;
  mode: Exclude<HomeModeArtwork, "2p" | "4p">;
}) {
  if (mode === "private") {
    return <PrivateTableEmblem width={width} height={height} />;
  }
  return mode === "friends" ? (
    <TeamFriendsEmblem width={width} height={height} />
  ) : (
    <OfflineEmblem width={width} height={height} />
  );
}

export function RoyalCurrencyIcon({
  kind,
  size = 36,
}: {
  kind: "coin" | "gem";
  size?: number;
}) {
  if (kind === "gem") {
    return (
      <Image
        source={require("../../assets/crowns/gem.png")}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    );
  }

  return (
    <Image
      source={require("../../assets/crowns/coin.png")}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}

function TeamFriendsEmblem({ width, height }: { width: number; height: number }) {
  return (
    <Group>
      <ChatBubble x={width * 0.17} y={height * 0.16} size={height * 0.17} flip={false} />
      <ChatBubble x={width * 0.72} y={height * 0.13} size={height * 0.15} flip />
      <SmileyAvatar cx={width * 0.38} cy={height * 0.38} size={height * 0.36} tilt={-0.12} />
      <SmileyAvatar cx={width * 0.64} cy={height * 0.36} size={height * 0.38} tilt={0.12} />
      <Path path={heartPath(width * 0.51, height * 0.49, height * 0.075)} color="#EBCB6B" />
    </Group>
  );
}

function SmileyAvatar({ cx, cy, size, tilt }: { cx: number; cy: number; size: number; tilt: number }) {
  const r = size / 2;
  return (
    <Group origin={vec(cx, cy)} transform={[{ rotate: tilt }]}>
      <Circle cx={cx + 1.5} cy={cy + 2.5} r={r} color="#000000" opacity={0.5} />
      <Circle cx={cx} cy={cy} r={r}>
        <LinearGradient
          start={vec(cx - r, cy - r)}
          end={vec(cx + r, cy + r)}
          colors={["#FFF1A1", "#D7A62F", "#7D4A09"]}
        />
      </Circle>
      <RoundedRect x={cx - r * 0.72} y={cy - r * 0.28} width={r * 0.58} height={r * 0.38} r={r * 0.16} color="#111111" />
      <RoundedRect x={cx + r * 0.14} y={cy - r * 0.28} width={r * 0.58} height={r * 0.38} r={r * 0.16} color="#111111" />
      <Rect x={cx - r * 0.14} y={cy - r * 0.15} width={r * 0.28} height={r * 0.08} color="#111111" />
      <Path path={smilePath(cx, cy + r * 0.12, r * 0.42)} color="#2B1705" style="stroke" strokeWidth={1.5} />
      <Circle cx={cx - r * 0.45} cy={cy - r * 0.48} r={r * 0.1} color="#FFFFFF" opacity={0.55} />
    </Group>
  );
}

function ChatBubble({ x, y, size, flip }: { x: number; y: number; size: number; flip: boolean }) {
  const tail = flip ? x + size * 0.7 : x + size * 0.3;
  return (
    <Group>
      <RoundedRect x={x} y={y} width={size} height={size * 0.62} r={size * 0.22} color={PALE_GOLD} />
      <Path path={chatTailPath(tail, y + size * 0.48, size * 0.2, flip)} color={PALE_GOLD} />
      <Circle cx={x + size * 0.3} cy={y + size * 0.31} r={size * 0.045} color={GOLD_DARK} />
      <Circle cx={x + size * 0.5} cy={y + size * 0.31} r={size * 0.045} color={GOLD_DARK} />
      <Circle cx={x + size * 0.7} cy={y + size * 0.31} r={size * 0.045} color={GOLD_DARK} />
    </Group>
  );
}

function OfflineEmblem({ width, height }: { width: number; height: number }) {
  const cx = width / 2;
  return (
    <Group>
      <BoardPlane x={width * 0.13} y={height * 0.31} width={width * 0.74} height={height * 0.23} />
      <OrnateTokenGlyph cx={width * 0.25} cy={height * 0.39} size={height * 0.22} color="blue" />
      <OrnateTokenGlyph cx={width * 0.76} cy={height * 0.39} size={height * 0.22} color="yellow" />

      <Path path={botAntennaPath(cx, height * 0.13, height * 0.1)} color={GOLD} style="stroke" strokeWidth={1.5} />
      <Circle cx={cx} cy={height * 0.12} r={height * 0.027} color={PALE_GOLD} />
      <RoundedRect x={cx - height * 0.15} y={height * 0.17} width={height * 0.3} height={height * 0.24} r={height * 0.055}>
        <LinearGradient
          start={vec(cx - height * 0.15, height * 0.17)}
          end={vec(cx + height * 0.15, height * 0.41)}
          colors={["#F6D878", GOLD, "#7C4B0A"]}
        />
      </RoundedRect>
      <RoundedRect x={cx - height * 0.115} y={height * 0.205} width={height * 0.23} height={height * 0.145} r={height * 0.035} color="#11110F" />
      <Circle cx={cx - height * 0.055} cy={height * 0.275} r={height * 0.022} color="#7FD8FF" />
      <Circle cx={cx + height * 0.055} cy={height * 0.275} r={height * 0.022} color="#7FD8FF" />

      <Path path={wifiOffPath(width * 0.8, height * 0.17, height * 0.1)} color="#E8C768" style="stroke" strokeWidth={1.4} />
    </Group>
  );
}

function smilePath(cx: number, cy: number, r: number) {
  const p = Skia.Path.Make();
  p.moveTo(cx - r, cy);
  p.cubicTo(cx - r * 0.45, cy + r * 0.8, cx + r * 0.45, cy + r * 0.8, cx + r, cy);
  return p;
}

function chatTailPath(x: number, y: number, size: number, flip: boolean) {
  const p = Skia.Path.Make();
  p.moveTo(x, y);
  p.lineTo(x + (flip ? size : -size), y + size);
  p.lineTo(x + (flip ? -size * 0.2 : size * 0.2), y + size * 0.25);
  p.close();
  return p;
}

function botAntennaPath(cx: number, y: number, size: number) {
  const p = Skia.Path.Make();
  p.moveTo(cx, y + size);
  p.lineTo(cx, y);
  return p;
}

function wifiOffPath(cx: number, cy: number, size: number) {
  const p = Skia.Path.Make();
  p.moveTo(cx - size, cy);
  p.cubicTo(cx - size * 0.45, cy - size * 0.5, cx + size * 0.45, cy - size * 0.5, cx + size, cy);
  p.moveTo(cx - size * 0.62, cy + size * 0.28);
  p.cubicTo(cx - size * 0.25, cy - size * 0.02, cx + size * 0.25, cy - size * 0.02, cx + size * 0.62, cy + size * 0.28);
  p.moveTo(cx - size * 0.9, cy - size * 0.55);
  p.lineTo(cx + size * 0.9, cy + size * 0.65);
  return p;
}

function PrivateTableEmblem({ width, height }: { width: number; height: number }) {
  const cx = width / 2;
  const coinSize = Math.min(28, height * 0.27);
  return (
    <Group>
      <Path path={cornerFlourishPath(16, 17, 18, 1)} color={GOLD} style="stroke" strokeWidth={1.2} opacity={0.72} />
      <Path path={cornerFlourishPath(width - 16, 17, 18, -1)} color={GOLD} style="stroke" strokeWidth={1.2} opacity={0.72} />

      <BoardPlane
        x={width * 0.13}
        y={height * 0.24}
        width={width * 0.74}
        height={height * 0.28}
      />

      <CrownCoin cx={cx - coinSize * 0.58} cy={height * 0.3} size={coinSize} />
      <CrownCoin cx={cx + coinSize * 0.58} cy={height * 0.3} size={coinSize} />

      <Path path={heartPath(cx, height * 0.49, height * 0.17)} color={GOLD_DARK} />
      <Path path={heartPath(cx, height * 0.475, height * 0.135)} color={PALE_GOLD} />
      <Path path={heartPath(cx, height * 0.475, height * 0.095)} color="#11100E" />
      <Circle cx={cx - height * 0.025} cy={height * 0.445} r={height * 0.014} color="#FFFFFF" opacity={0.52} />
    </Group>
  );
}

function CrownCoin({ cx, cy, size }: { cx: number; cy: number; size: number }) {
  const r = size / 2;
  return (
    <Group>
      <Circle cx={cx + 1.5} cy={cy + 2.5} r={r} color="#000000" opacity={0.5} />
      <Circle cx={cx} cy={cy} r={r} color={GOLD_DARK} />
      <Circle cx={cx} cy={cy - 1} r={r * 0.88}>
        <LinearGradient
          start={vec(cx - r, cy - r)}
          end={vec(cx + r, cy + r)}
          colors={["#FFF1A1", GOLD, "#8B5510"]}
        />
      </Circle>
      <Circle cx={cx} cy={cy - 1} r={r * 0.65} color="#17130D" />
      <Path path={crownCoinPath(cx, cy - 1, size * 0.46)} color={PALE_GOLD} />
    </Group>
  );
}

function crownCoinPath(cx: number, cy: number, size: number) {
  const p = Skia.Path.Make();
  p.moveTo(cx - size * 0.5, cy + size * 0.28);
  p.lineTo(cx - size * 0.42, cy - size * 0.35);
  p.lineTo(cx - size * 0.12, cy - size * 0.08);
  p.lineTo(cx, cy - size * 0.5);
  p.lineTo(cx + size * 0.12, cy - size * 0.08);
  p.lineTo(cx + size * 0.42, cy - size * 0.35);
  p.lineTo(cx + size * 0.5, cy + size * 0.28);
  p.close();
  return p;
}

function royalGemPath(size: number) {
  const p = Skia.Path.Make();
  p.moveTo(size * 0.3, size * 0.08);
  p.lineTo(size * 0.72, size * 0.12);
  p.lineTo(size * 0.92, size * 0.42);
  p.lineTo(size * 0.58, size * 0.92);
  p.lineTo(size * 0.18, size * 0.78);
  p.lineTo(size * 0.08, size * 0.34);
  p.close();
  return p;
}

function coinReedsPath(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  count: number,
) {
  const p = Skia.Path.Make();
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
    p.moveTo(cx + Math.cos(angle) * innerRadius, cy + Math.sin(angle) * innerRadius);
    p.lineTo(cx + Math.cos(angle) * outerRadius, cy + Math.sin(angle) * outerRadius);
  }
  return p;
}

function coinOrnamentPath(
  cx: number,
  cy: number,
  radius: number,
  ornamentSize: number,
  count: number,
) {
  const p = Skia.Path.Make();
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    p.moveTo(x, y - ornamentSize);
    p.lineTo(x + ornamentSize, y);
    p.lineTo(x, y + ornamentSize);
    p.lineTo(x - ornamentSize, y);
    p.close();
  }
  return p;
}

function coinStarPath(cx: number, cy: number, radius: number) {
  const p = Skia.Path.Make();
  for (let index = 0; index < 10; index += 1) {
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    const r = index % 2 === 0 ? radius : radius * 0.42;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (index === 0) p.moveTo(x, y);
    else p.lineTo(x, y);
  }
  p.close();
  return p;
}

function royalGemFacetPath(size: number) {
  const p = Skia.Path.Make();
  p.moveTo(size * 0.3, size * 0.08);
  p.lineTo(size * 0.4, size * 0.38);
  p.lineTo(size * 0.58, size * 0.92);
  p.moveTo(size * 0.72, size * 0.12);
  p.lineTo(size * 0.4, size * 0.38);
  p.lineTo(size * 0.08, size * 0.34);
  p.moveTo(size * 0.4, size * 0.38);
  p.lineTo(size * 0.92, size * 0.42);
  return p;
}

function cornerFlourishPath(x: number, y: number, size: number, direction: 1 | -1) {
  const p = Skia.Path.Make();
  p.moveTo(x, y + size);
  p.cubicTo(x, y + size * 0.35, x + direction * size * 0.25, y, x + direction * size, y);
  p.moveTo(x + direction * size * 0.18, y + size * 0.56);
  p.cubicTo(x + direction * size * 0.5, y + size * 0.7, x + direction * size * 0.7, y + size * 0.48, x + direction * size * 0.58, y + size * 0.26);
  return p;
}

function heartPath(cx: number, cy: number, size: number) {
  const p = Skia.Path.Make();
  p.moveTo(cx, cy + size * 0.45);
  p.cubicTo(
    cx - size,
    cy - size * 0.15,
    cx - size * 0.55,
    cy - size,
    cx,
    cy - size * 0.42,
  );
  p.cubicTo(
    cx + size * 0.55,
    cy - size,
    cx + size,
    cy - size * 0.15,
    cx,
    cy + size * 0.45,
  );
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
    value.value = 0;
    value.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.cubic) }),
      -1,
      false,
    );
  }, [duration, value]);
  return value;
}
