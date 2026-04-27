import { useRouter } from 'expo-router';
import { useEffect } from 'react';

export default function NewGame() {
  const router = useRouter();

  useEffect(() => {
    const matchId = 'solo-' + Date.now();
    router.replace(`/game/${matchId}`);
  }, []);

  return null;
}