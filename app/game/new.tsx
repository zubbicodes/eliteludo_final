import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';

export default function NewGame() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();

  useEffect(() => {
    const matchId = 'solo-' + Date.now();
    const playerMode = mode === '3p' ? '3p' : mode === '4p' ? '4p' : '2p';
    router.replace({
      pathname: '/game/[matchId]',
      params: { matchId, mode: playerMode },
    } as never);
  }, [mode, router]);

  return null;
}
