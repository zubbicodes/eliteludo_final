import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { RoyalCurrencyIcon } from "@/src/skia/HomeArtwork";

type Point = {
  x: number;
  y: number;
};

type Props = {
  id: number;
  start: Point;
  end: Point;
  count?: number;
  onDone?: () => void;
};

export function CoinFlyAnimation({ id, start, end, count = 12, onDone }: Props) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: count }, (_, index) => (
        <FlyingCoin
          key={`${id}-${index}`}
          index={index}
          total={count}
          start={start}
          end={end}
          onDone={index === count - 1 ? onDone : undefined}
        />
      ))}
    </View>
  );
}

function FlyingCoin({
  index,
  total,
  start,
  end,
  onDone,
}: {
  index: number;
  total: number;
  start: Point;
  end: Point;
  onDone?: () => void;
}) {
  const progress = useSharedValue(0);
  const pop = useSharedValue(0);
  const delay = index * 38;
  const spreadAngle = -Math.PI + (index / Math.max(1, total - 1)) * Math.PI;
  const spread = 34 + (index % 4) * 8;
  const startX = start.x + Math.cos(spreadAngle) * spread;
  const startY = start.y + Math.sin(spreadAngle) * spread * 0.55;
  const arcLift = 96 + (index % 5) * 14;

  useEffect(() => {
    pop.value = 0;
    progress.value = 0;
    pop.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: 130, easing: Easing.out(Easing.back(1.7)) }),
        withTiming(0.9, { duration: 110 }),
      ),
    );
    progress.value = withDelay(
      delay + 90,
      withTiming(1, { duration: 720, easing: Easing.inOut(Easing.cubic) }, (finished) => {
        if (finished && onDone) runOnJS(onDone)();
      }),
    );
  }, [delay, onDone, pop, progress]);

  const coinStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const curve = Math.sin(t * Math.PI) * arcLift;
    const x = startX + (end.x - startX) * t;
    const y = startY + (end.y - startY) * t - curve;
    const scale = pop.value * (1 - t * 0.25);
    return {
      opacity: t > 0.96 ? (1 - t) / 0.04 : 1,
      transform: [
        { translateX: x - 14 },
        { translateY: y - 14 },
        { scale },
        { rotate: `${index * 17 + t * 420}deg` },
      ],
    };
  });

  return (
    <Animated.View style={[styles.coin, coinStyle]}>
      <RoyalCurrencyIcon kind="coin" size={28} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  coin: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 28,
    height: 28,
    zIndex: 100,
  },
});
