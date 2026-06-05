import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';

export default function NewGame() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();

  useEffect(() => {
    const matchId = 'solo-' + Date.now();
    router.replace({
      pathname: '/game/[matchId]',
      params: { matchId, mode: mode === '2p' ? '2p' : '4p' },
    } as never);
  }, [mode, router]);

  return null;
}
