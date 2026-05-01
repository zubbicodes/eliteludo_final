import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { supabase } from '@/src/supabase/client';
import { findMatch, subscribeQueue } from '@/src/supabase/matches';
import { colors } from '@/src/theme/colors';
import { radius, spacing, typography } from '@/src/theme/typography';

const BOT_FALLBACK_MS = 12_000;
const POLL_INTERVAL_MS = 4_000;

export default function MatchmakingScreen() {
  const router = useRouter();
  const scale = useSharedValue(1);
  const [label, setLabel] = useState('Finding opponent…');
  const navigatedRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const navigate = (matchId: string) => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    clearInterval(pollRef.current!);
    clearTimeout(fallbackRef.current!);
    unsubRef.current?.();
    setLabel('Match found!');
    setTimeout(() => router.replace(`/game/${matchId}` as never), 350);
  };

  useEffect(() => {
    scale.value = withRepeat(withTiming(1.12, { duration: 900 }), -1, true);

    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.back(); return; }

      // Subscribe to own queue row so we hear the match_id update instantly
      unsubRef.current = subscribeQueue(session.user.id, navigate);

      // Initial pair attempt
      const r0 = await findMatch({ entryFee: 0, botFallback: false });
      if (r0?.matchId) { navigate(r0.matchId); return; }

      // Poll every 4 s while waiting (partner may call find-match at any time)
      pollRef.current = setInterval(async () => {
        const r = await findMatch({ entryFee: 0, botFallback: false });
        if (r?.matchId) navigate(r.matchId);
      }, POLL_INTERVAL_MS);

      // After 12 s fall back to solo vs-AI
      fallbackRef.current = setTimeout(async () => {
        clearInterval(pollRef.current!);
        const r = await findMatch({ entryFee: 0, botFallback: true });
        if (r?.matchId) navigate(r.matchId);
      }, BOT_FALLBACK_MS);
    };

    run();

    return () => {
      clearInterval(pollRef.current!);
      clearTimeout(fallbackRef.current!);
      unsubRef.current?.();
    };
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.root}>
      <Animated.View entering={FadeIn.duration(500)} style={styles.content}>
        <Animated.View style={[styles.pulse, animStyle]}>
          <Ionicons name="search" size={56} color={colors.gold} />
        </Animated.View>

        <Text style={styles.title}>{label}</Text>
        <Text style={styles.subtitle}>
          We'll fall back to AI if no one joins in 12 s
        </Text>

        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.cancel, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { alignItems: 'center', paddingHorizontal: spacing.xl },
  pulse: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  cancel: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelText: {
    ...typography.body,
    color: colors.textMuted,
  },
});
