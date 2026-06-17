import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createPrivateRoom, joinPrivateRoom } from '@/src/supabase/matches';
import { deductEntryFee } from '@/src/supabase/transactions';
import { useWalletStore } from '@/src/stores/wallet';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';
import { haptics } from '@/src/utils/haptics';

const PRIVATE_ENTRY_FEE = 250;

export default function PrivateRoomScreen() {
  const router = useRouter();
  const refreshWallet = useWalletStore((s) => s.refresh);
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);

  const payEntry = async () => {
    const paid = await deductEntryFee(PRIVATE_ENTRY_FEE, { mode: 'private' });
    await refreshWallet();
    if (!paid?.success) {
      Alert.alert('Not enough coins', 'Private tables require 250 coins.');
      return false;
    }
    return true;
  };

  const onCreate = async () => {
    if (loading) return;
    haptics.tap();
    setLoading(true);
    try {
      if (!(await payEntry())) return;
      const result = await createPrivateRoom({ entryFee: PRIVATE_ENTRY_FEE, citySlug: 'newdelhi' });
      if (!result?.matchId) throw new Error('missing room');
      Alert.alert('Room created', `Share code ${result.roomCode ?? '------'} with your friend.`);
      router.replace({
        pathname: '/game/[matchId]',
        params: { matchId: result.matchId, mode: '2p', entryFee: String(PRIVATE_ENTRY_FEE), citySlug: 'newdelhi' },
      } as never);
    } catch {
      Alert.alert('Room failed', 'Could not create a private room.');
    } finally {
      setLoading(false);
    }
  };

  const onJoin = async () => {
    const code = roomCode.trim().toUpperCase();
    if (loading || code.length < 4) return;
    haptics.tap();
    setLoading(true);
    try {
      if (!(await payEntry())) return;
      const result = await joinPrivateRoom({ roomCode: code, entryFee: PRIVATE_ENTRY_FEE });
      if (!result?.matchId) throw new Error(result?.reason ?? 'room_not_found');
      router.replace({
        pathname: '/game/[matchId]',
        params: { matchId: result.matchId, mode: '2p', entryFee: String(PRIVATE_ENTRY_FEE), citySlug: 'newdelhi' },
      } as never);
    } catch {
      Alert.alert('Join failed', 'Check the room code and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.gold} />
        </Pressable>
        <Text style={styles.title}>Private Table</Text>
      </View>

      <View style={styles.body}>
        <Pressable onPress={onCreate} disabled={loading} style={styles.createBtn}>
          <LinearGradient colors={[colors.gold, colors.goldDark]} style={StyleSheet.absoluteFill} />
          <Ionicons name="add-circle" size={26} color={colors.bg} />
          <Text style={styles.createText}>{loading ? 'Working...' : 'Create room'}</Text>
        </Pressable>

        <View style={styles.divider} />

        <Text style={styles.label}>Join with code</Text>
        <View style={styles.inputWrap}>
          <TextInput
            value={roomCode}
            onChangeText={(value) => setRoomCode(value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
            placeholder="ABC123"
            placeholderTextColor="rgba(255,255,255,0.2)"
            autoCapitalize="characters"
            style={styles.input}
          />
          <Pressable onPress={onJoin} disabled={loading || roomCode.length < 4} style={styles.joinBtn}>
            <Text style={styles.joinText}>Join</Text>
          </Pressable>
        </View>

        <Text style={styles.note}>Entry fee: 250 coins. Open seats can be filled from matchmaking when the table is ready.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050201' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,175,55,0.16)',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212,175,55,0.1)',
  },
  title: { color: colors.gold, fontFamily: fontFamilies.heading, fontWeight: '400', fontSize: 22, letterSpacing: 1 },
  body: { flex: 1, padding: 20, justifyContent: 'center', gap: 18 },
  createBtn: {
    height: 58,
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  createText: { color: colors.bg, fontFamily: fontFamilies.heading, fontWeight: '400', fontSize: 17 },
  divider: { height: 1, backgroundColor: 'rgba(212,175,55,0.16)', marginVertical: 8 },
  label: { color: colors.gold, fontFamily: fontFamilies.heading, fontWeight: '400', letterSpacing: 1 },
  inputWrap: {
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    overflow: 'hidden',
  },
  input: { flex: 1, color: '#fff', fontFamily: fontFamilies.heading, fontWeight: '400', fontSize: 20, letterSpacing: 3 },
  joinBtn: { alignSelf: 'stretch', paddingHorizontal: 22, justifyContent: 'center', backgroundColor: colors.gold },
  joinText: { color: colors.bg, fontFamily: fontFamilies.heading, fontWeight: '400' },
  note: { color: 'rgba(255,255,255,0.45)', fontFamily: fontFamilies.body, fontWeight: '400', lineHeight: 20, textAlign: 'center' },
});
