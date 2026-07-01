import { useLocalSearchParams } from 'expo-router';

import { GameSessionController } from '@/src/gameplay/GameSessionController';

export default function GameScreen() {
  const { matchId, mode, entryFee, citySlug } = useLocalSearchParams<{
    matchId: string;
    mode?: string;
    entryFee?: string;
    citySlug?: string;
  }>();

  return (
    <GameSessionController
      matchId={matchId}
      mode={mode}
      entryFee={entryFee}
      citySlug={citySlug}
    />
  );
}
