import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Copy from 'lucide-react-native/icons/copy';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import Trash2 from 'lucide-react-native/icons/trash-2';
import Trophy from 'lucide-react-native/icons/trophy';
import UserPlus from 'lucide-react-native/icons/user-plus';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { PlayerAvatarTile } from '@/components/PlayerAvatar';
import { SettingsChildSheet, type SettingsChildSheetHandle } from '@/components/overlays/SettingsChildSheet';
import { FRIEND_CODE_LENGTH } from '@/lib/friendCode';
import { shareFriendCode } from '@/lib/friendCodeShare';
import { playHaptic } from '@/lib/haptics';
import { ARTISTS } from '@/lib/playerName';
import { newFriends, useFriendsStore, type LeaderboardEntry } from '@/state/friendsStore';
import { useAuthStore } from '@/state/authStore';
import { useSemanticTokens, useThemeTokens } from '@/state/themeStore';
import { useI18n, type SupportedLanguage } from '@/i18n';

export type LeaderboardSheetHandle = SettingsChildSheetHandle;

/** The board shows painter nicknames, the same identity the settings sheet shows. */
function entryName(entry: LeaderboardEntry, language: SupportedLanguage): string {
  const artist = ARTISTS[entry.artist % ARTISTS.length];
  return `${artist.name} "${artist.epithet[language]}"`;
}

export const LeaderboardSheet = forwardRef<LeaderboardSheetHandle>(function LeaderboardSheet(_, ref) {
  const sheetRef = useRef<SettingsChildSheetHandle>(null);
  const theme = useThemeTokens();
  const semantic = useSemanticTokens();
  const { t, language } = useI18n();
  const user = useAuthStore(state => state.user);
  const { code, entries, loading, busy, error, seenAt, markBoardSeen, load, addFriend, removeFriend, rotateCode, clearError } = useFriendsStore();
  // Read once per opening: marking the board seen must not make the badges vanish while the
  // player is still looking at them.
  const [seenAtOnOpen, setSeenAtOnOpen] = useState<string | null>(seenAt);
  const arrived = new Set(newFriends(entries, seenAtOnOpen).map(entry => entry.code));
  const [input, setInput] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    present: () => {
      setSeenAtOnOpen(useFriendsStore.getState().seenAt);
      load();
      markBoardSeen();
      sheetRef.current?.present();
    },
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  // A stale error from a previous attempt would greet the next visit, so it clears on typing.
  useEffect(() => {
    if (input) clearError();
  }, [clearError, input]);

  async function onAdd() {
    playHaptic('selection');
    if (await addFriend(input)) setInput('');
  }

  async function onShareCode() {
    if (!code) return;
    playHaptic('selection');
    const result = await shareFriendCode(code, language);
    if (result === 'copied') setNotice(t('leaderboard.codeCopied'));
    if (result === 'unavailable') setNotice(t('game.shareUnavailable'));
  }

  return (
    <SettingsChildSheet
      ref={sheetRef}
      title={t('leaderboard.title')}
      subtitle={t('leaderboard.subtitle')}
      snapPoints={['82%']}
      scrollable
    >
      {!user ? (
        <Text style={[styles.empty, { color: theme.sub }]}>{t('leaderboard.signInFirst')}</Text>
      ) : (
        <>
          <Text style={[styles.sectionTitle, { color: theme.sub }]}>{t('leaderboard.yourCode')}</Text>
          <View style={[styles.codeCard, { backgroundColor: theme.surface, borderColor: theme.gridSep }]}>
            <Text style={[styles.code, { color: theme.text }]}>{code ?? '••••••'}</Text>
            <View style={styles.codeActions}>
              <AnimatedPressable
                accessibilityRole="button"
                feedback="icon"
                style={[styles.iconButton, { borderColor: theme.gridSep }]}
                onPress={onShareCode}
                disabled={!code}
                accessibilityLabel={t('leaderboard.shareCode')}
              >
                <Copy size={17} color={theme.text} strokeWidth={2.2} />
              </AnimatedPressable>
              <AnimatedPressable
                accessibilityRole="button"
                feedback="icon"
                style={[styles.iconButton, { borderColor: theme.gridSep }]}
                onPress={() => { playHaptic('selection'); rotateCode(); }}
                disabled={busy || !code}
                accessibilityLabel={t('leaderboard.rotateCode')}
              >
                <RefreshCw size={17} color={theme.text} strokeWidth={2.2} />
              </AnimatedPressable>
            </View>
          </View>
          <Text style={[styles.hint, { color: theme.sub }]}>{t('leaderboard.codeHint')}</Text>
          {!!notice && <Text style={[styles.hint, { color: semantic.success }]}>{notice}</Text>}

          <Text style={[styles.sectionTitle, { color: theme.sub }]}>{t('leaderboard.addFriend')}</Text>
          <View style={styles.addRow}>
            <TextInput
              style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.gridSep, color: theme.text }]}
              value={input}
              onChangeText={setInput}
              placeholder={t('leaderboard.codePlaceholder')}
              placeholderTextColor={theme.sub}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={FRIEND_CODE_LENGTH + 2}
              onSubmitEditing={onAdd}
              accessibilityLabel={t('leaderboard.addFriend')}
            />
            <AnimatedPressable
              accessibilityRole="button"
              style={[styles.addButton, { backgroundColor: theme.accent }]}
              onPress={onAdd}
              disabled={busy}
              accessibilityLabel={t('leaderboard.addFriend')}
            >
              <UserPlus size={18} color="#fff" strokeWidth={2.3} />
            </AnimatedPressable>
          </View>
          {!!error && <Text style={[styles.error, { color: semantic.danger }]}>{t(`leaderboard.error.${error}`)}</Text>}

          <Text style={[styles.sectionTitle, { color: theme.sub }]}>{t('leaderboard.board')}</Text>
          {loading && !entries.length && <Text style={[styles.empty, { color: theme.sub }]}>{t('game.preparing')}</Text>}
          {!loading && entries.length <= 1 && (
            <Text style={[styles.empty, { color: theme.sub }]}>{t('leaderboard.alone')}</Text>
          )}
          {entries.map((entry, index) => (
            <View
              key={entry.code ?? `entry-${index}`}
              style={[
                styles.row,
                { backgroundColor: theme.surface, borderColor: entry.isSelf ? theme.accent : theme.gridSep },
              ]}
            >
              <Text style={[styles.rank, { color: theme.sub }]}>{index + 1}</Text>
              {/* Self is the only row whose account id this device knows, so only it gets the
                  real mosaic; a friend gets one seeded from the code they handed out. */}
              <PlayerAvatarTile userId={entry.isSelf ? user.id : entry.code ?? ''} size={34} />
              <View style={styles.rowCopy}>
                <View style={styles.rowNameLine}>
                  <Text style={[styles.rowName, { color: theme.text }]} numberOfLines={1}>
                    {entryName(entry, language)}
                  </Text>
                  {arrived.has(entry.code) && (
                    <Text style={[styles.newBadge, { color: semantic.success, borderColor: semantic.successBorder, backgroundColor: semantic.successSurface }]}>
                      {t('leaderboard.new')}
                    </Text>
                  )}
                </View>
                <Text style={[styles.rowDetail, { color: theme.sub }]} numberOfLines={1}>
                  {t('leaderboard.rowDetail', { solved: entry.solved, gold: entry.medals.gold, streak: entry.streak })}
                </Text>
              </View>
              <View style={styles.rowPoints}>
                <Trophy size={13} color={semantic.gold} strokeWidth={2.4} />
                <Text style={[styles.points, { color: theme.text }]}>{entry.points}</Text>
              </View>
              {!entry.isSelf && !!entry.code && (
                <AnimatedPressable
                  accessibilityRole="button"
                  feedback="icon"
                  style={styles.removeButton}
                  onPress={() => { playHaptic('selection'); removeFriend(entry.code as string); }}
                  disabled={busy}
                  accessibilityLabel={t('leaderboard.remove')}
                >
                  <Trash2 size={16} color={theme.sub} strokeWidth={2.2} />
                </AnimatedPressable>
              )}
            </View>
          ))}
          <Text style={[styles.hint, { color: theme.sub }]}>{t('leaderboard.pointsHint')}</Text>
        </>
      )}
    </SettingsChildSheet>
  );
});

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginTop: 18, marginBottom: 8 },
  codeCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12 },
  code: { flexShrink: 1, minWidth: 0, fontSize: 22, fontWeight: '800', letterSpacing: 3 },
  codeActions: { flexDirection: 'row', gap: 8, flexShrink: 0 },
  iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderRadius: 8 },
  hint: { fontSize: 11, lineHeight: 15, marginTop: 8 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, minWidth: 0, minHeight: 44, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 14, fontSize: 16, fontWeight: '700', letterSpacing: 2 },
  addButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8, flexShrink: 0 },
  error: { fontSize: 11, fontWeight: '700', marginTop: 8 },
  empty: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
  rank: { flexShrink: 0, minWidth: 16, fontSize: 12, fontWeight: '800' },
  rowCopy: { flex: 1, minWidth: 0 },
  rowNameLine: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  rowName: { flexShrink: 1, minWidth: 0, fontSize: 13, fontWeight: '800' },
  newBadge: { flexShrink: 0, fontSize: 9, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', borderWidth: 1, borderRadius: 20, paddingHorizontal: 6, paddingVertical: 1 },
  rowDetail: { fontSize: 10, marginTop: 2 },
  rowPoints: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 4 },
  points: { fontSize: 15, fontWeight: '800' },
  removeButton: { flexShrink: 0, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
});
