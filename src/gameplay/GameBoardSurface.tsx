import { Atlas, Canvas } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { ImageBackground, Pressable, StyleSheet, View, type ImageSourcePropType } from 'react-native';

import { TokenDicePicker } from '@/src/components/TokenDicePicker';
import type { Color, Token as GameToken, TokenId } from '@/src/game/types';
import { BoardCanvas } from '@/src/skia/Board';
import { Particles, type Burst } from '@/src/skia/Particles';

import { HOP_MS } from './constants';
import type { MoveAnimation, TokenCenter } from './helpers';
import { useTokenAnimationController } from './useTokenAnimationController';

type Props = {
  boardSize: number;
  cityTableSource?: ImageSourcePropType;
  perspectiveColor: Color;
  tokens: GameToken[];
  tokenCenters: Map<TokenId, TokenCenter>;
  movableTokenIds: Set<TokenId>;
  moveAnimation: MoveAnimation | null;
  pickerForToken: TokenId | null;
  pickerValues: number[];
  pickerCenter: TokenCenter | null;
  bursts: Burst[];
  onTokenTap: (tokenId: TokenId) => void;
  onPickerSelect: (value: number) => void;
  onMoveAnimationComplete: () => void;
};

export const GameBoardSurface = memo(function GameBoardSurface({
  boardSize,
  cityTableSource,
  perspectiveColor,
  tokens,
  tokenCenters,
  movableTokenIds,
  moveAnimation,
  pickerForToken,
  pickerValues,
  pickerCenter,
  bursts,
  onTokenTap,
  onPickerSelect,
  onMoveAnimationComplete,
}: Props) {
  const orderedTokens = useMemo(
    () => [...tokens].sort((left, right) => left.id.localeCompare(right.id)),
    [tokens],
  );

  const animatedTokens = useMemo(
    () =>
      orderedTokens
        .map((token) => {
          const center = tokenCenters.get(token.id);
          if (!center) return null;
          return {
            id: token.id,
            color: token.color,
            cx: center.cx,
            cy: center.cy,
            size: center.size,
            highlighted: movableTokenIds.has(token.id),
          };
        })
        .filter((token): token is NonNullable<typeof token> => !!token),
    [movableTokenIds, orderedTokens, tokenCenters],
  );

  const animation = useTokenAnimationController({
    tokens: animatedTokens,
    moveAnimation,
    hopMs: HOP_MS,
    onMoveAnimationComplete,
  });

  return (
    <View style={[styles.boardWrap, { width: boardSize, height: boardSize }]}>
      <View style={[styles.boardSquare, { width: boardSize, height: boardSize }]}>
        <ImageBackground
          source={cityTableSource}
          style={[StyleSheet.absoluteFill, styles.boardSurface]}
          imageStyle={styles.boardCityImage}
          resizeMode="cover"
        >
          <View style={styles.boardCityTint} />
          <BoardCanvas size={boardSize} perspectiveColor={perspectiveColor} />
        </ImageBackground>

        <View style={[StyleSheet.absoluteFill, styles.tokenLayer]} pointerEvents="box-none">
          <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
            <Atlas image={animation.haloImage} sprites={animation.haloSprites} transforms={animation.haloTransforms} />
            <Atlas image={animation.tokenImage} sprites={animation.tokenSprites} transforms={animation.tokenTransforms} />
          </Canvas>

          {animatedTokens
            .filter((token) => movableTokenIds.has(token.id))
            .map((token) => (
              <Pressable
                key={token.id}
                onPress={() => onTokenTap(token.id)}
                style={[
                  styles.hitTarget,
                  {
                    left: token.cx - token.size / 2,
                    top: token.cy - token.size / 2,
                    width: token.size,
                    height: token.size,
                    borderRadius: token.size / 2,
                  },
                ]}
              />
            ))}

          {pickerForToken && pickerCenter && pickerValues.length > 0 && (
            <TokenDicePicker
              cx={pickerCenter.cx}
              cy={pickerCenter.cy}
              offset={pickerCenter.size / 2}
              boardSize={boardSize}
              values={pickerValues}
              onPick={onPickerSelect}
            />
          )}
        </View>

        <View style={[StyleSheet.absoluteFill, styles.particleLayer]} pointerEvents="none">
          <Particles width={boardSize} height={boardSize} bursts={bursts} />
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  boardWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  boardSquare: {
    position: 'relative',
    overflow: 'visible',
    borderRadius: 12,
  },
  boardSurface: {
    overflow: 'hidden',
    borderRadius: 12,
  },
  boardCityImage: {
    opacity: 0,
    borderRadius: 12,
  },
  boardCityTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  tokenLayer: {
    zIndex: 4,
    overflow: 'visible',
  },
  particleLayer: {
    zIndex: 3,
  },
  hitTarget: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
});
