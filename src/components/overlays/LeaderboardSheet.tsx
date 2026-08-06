import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Copy from 'lucide-react-native/icons/copy';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import Trash2 from 'lucide-react-native/icons/trash-2';
import Timer from 'lucide-react-native/icons/timer';
import Trophy from 'lucide-react-native/icons/trophy';
import UserPlus from 'lucide-react-native/icons/user-plus';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { PlayerAvatarTile } from '@/components/PlayerAvatar';
import { SettingsChildSheet, type SettingsChildSheetHandle } from '@/components/overlays/SettingsChildSheet';
import { FRIEND_CODE_LENGTH } from '@/lib/friendCode';
import { shareFriendCode } from '@/lib/friendCodeShare';
import { playHaptic } from '@/lib/haptics';
import { artistLabel } from '@/lib/playerName';
import { titleFor } from '@/game/titles';
import { newFriends, sortForView, useFriendsStore, type BoardView, type LeaderboardEntry } from '@/state/friendsStore';
import { formatResultDuration } from '@/game/medals';
import { useAuthStore } from '@/state/authStore';
import { useSemanticTokens, useThemeTokens } from '@/state/themeStore';
import { useI18n, type SupportedLanguage } from '@/i18n';

export type LeaderboardSheetHandle = SettingsChildSheetHandle;

/** The board shows painter nicknames, the same identity the settings sheet shows. */
function entryName(entry: LeaderboardEntry, language: SupportedLanguage): string {
  return artistLabel(entry.artist, language);
}

/** Rows are keyed by code; the player's own row has none until the server assigns one. */
function rowKey(entry: LeaderboardEntry, index: number): string {
  return entry.code ?? `entry-${index}`;
}

export const LeaderboardSheet = forwardRef<LeaderboardSheetHandle>(function LeaderboardSheet(_, ref) {
  const sheetRef = useRef<SettingsChildSheetHandle>(null);
  const theme = useThemeTokens();
  const semantic = useSemanticTokens();
  const { t, language } = useI18n();
  const user = useAuthStore(state => state.user);
  const { code, entries, loading, busy, error, load, addFriend, removeFriend, rotateCode, clearError } = useFriendsStore();
  const arrived = new Set(newFriends(entries).map(entry => entry.code));
  const [input, setInput] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  /**
   * Which row is showing who it really is. One at a time, and it stays until the player taps
   * again or leaves — a timer would take the answer away mid-read, and on a board you consult
   * rather than watch, that is the wrong kind of surprise.
   */
  const [revealed, setRevealed] = useState<string | null>(null);
  const [view, setView] = useState<BoardView>('points');
  const ordered = sortForView(entries, view);

  useImperativeHandle(ref, () => ({
    // Opening on a reveal left over from last time would answer a question nobody just asked.
    present: () => {
      setRevealed(null);
      load();
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
          {/* Two contests, one board. Picking one only reorders and relabels what is already
              loaded, so switching costs nothing and never waits on the network. */}
          <View style={[styles.viewSwitch, { borderColor: theme.gridSep }]}>
            {(['points', 'daily'] as const).map(option => {
              const active = view === option;
              return (
                <AnimatedPressable
                  key={option}
                  accessibilityRole="button"
                  feedback="control"
                  accessibilityState={{ selected: active }}
                  style={[styles.viewOption, active && { backgroundColor: theme.accent }]}
                  onPress={() => { playHaptic('selection'); setView(option); }}
                >
                  <Text style={[styles.viewLabel, { color: active ? '#fff' : theme.sub }]}>
                    {t(`leaderboard.view.${option}`)}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </View>
          {loading && !entries.length && <Text style={[styles.empty, { color: theme.sub }]}>{t('game.preparing')}</Text>}
          {!loading && entries.length <= 1 && (
            <Text style={[styles.empty, { color: theme.sub }]}>{t('leaderboard.alone')}</Text>
          )}
          {ordered.map((entry, index) => {
            const title = titleFor({ solved: entry.solved, gold: entry.medals.gold, streak: entry.streak });
            const rowTitle = title ? t(`title.${title.id}`) : null;
            const key = rowKey(entry, index);
            const isRevealed = revealed === key;
            return (
            <AnimatedPressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={entryName(entry, language)}
              accessibilityHint={t('leaderboard.revealHint')}
              accessibilityState={{ expanded: isRevealed }}
              onPress={() => {
                playHaptic('selection');
                setRevealed(current => (current === key ? null : key));
              }}
              // Web only, and additive: the pointer answers without having to commit to a tap.
              onHoverIn={() => setRevealed(key)}
              onHoverOut={() => setRevealed(current => (current === key ? null : current))}
              style={[
                styles.row,
                { backgroundColor: theme.surface, borderColor: entry.isSelf ? theme.accent : theme.gridSep },
                // Lifts the row so its bubble paints over the rows drawn after it.
                isRevealed && styles.rowRevealed,
              ]}
            >
              {isRevealed && (
                <View
                  style={[styles.tooltip, { backgroundColor: theme.text, borderColor: theme.text }]}
                  pointerEvents="none"
                >
                  <Text style={[styles.tooltipText, { color: theme.surface }]} numberOfLines={2}>
                    {entry.name ?? t('leaderboard.noName')}
                  </Text>
                </View>
              )}
              <Text style={[styles.rank, { color: theme.sub }]}>{index + 1}</Text>
              {/* Self is the only row whose account id this device knows, so only it gets the
                  real mosaic; a friend gets one seeded from the code they handed out. */}
              <PlayerAvatarTile userId={entry.isSelf ? user.id : entry.code ?? ''} size={34} frame={title ? semantic[title.frame] : undefined} />
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
                {/* On this line rather than beside the name: the name already truncates against
                    the NEW badge, and a title is permanent where that badge lasts a day. Cut
                    from the numbers that follow it, so a friend gets one without the board
                    having to send anything it does not already send. */}
                <Text style={[styles.rowDetail, { color: theme.sub }]} numberOfLines={1}>
                  {rowTitle && <Text style={{ color: theme.accent, fontWeight: '800' }}>{rowTitle} · </Text>}
                  {view === 'daily'
                    ? entry.dailyDone
                      ? t('leaderboard.dailyDone')
                      : t('leaderboard.dailyPending')
                    : t('leaderboard.rowDetail', { solved: entry.solved, gold: entry.medals.gold, streak: entry.streak })}
                </Text>
              </View>
              <View style={styles.rowPoints}>
                {view === 'daily' ? (
                  <>
                    <Timer size={13} color={entry.dailyDone ? semantic.success : theme.sub} strokeWidth={2.4} />
                    {/* A dash rather than a zero: a day not yet played is an unknown time, and
                        a zero would sort and read as the fastest solve on the board. */}
                    <Text style={[styles.points, { color: entry.dailyDone ? theme.text : theme.sub }]}>
                      {entry.dailyMs === null ? '—' : formatResultDuration(entry.dailyMs)}
                    </Text>
                  </>
                ) : (
                  <>
                    <Trophy size={13} color={semantic.gold} strokeWidth={2.4} />
                    <Text style={[styles.points, { color: theme.text }]}>{entry.points}</Text>
                  </>
                )}
              </View>
              {!entry.isSelf && !!entry.code && (
                <AnimatedPressable
                  accessibilityRole="button"
                  feedback="icon"
                  style={styles.removeButton}
                  // Native gives the touch to the inner responder, but on web the click bubbles
                  // to the row and would toggle the reveal on the way out.
                  onPress={event => {
                    event.stopPropagation?.();
                    playHaptic('selection');
                    removeFriend(entry.code as string);
                  }}
                  disabled={busy}
                  accessibilityLabel={t('leaderboard.remove')}
                >
                  <Trash2 size={16} color={theme.sub} strokeWidth={2.2} />
                </AnimatedPressable>
              )}
            </AnimatedPressable>
            );
          })}
          <Text style={[styles.hint, { color: theme.sub }]}>
            {t(view === 'daily' ? 'leaderboard.dailyHint' : 'leaderboard.pointsHint')}
          </Text>
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
  // Only while revealed: a permanent stacking context would put every row above the one below.
  rowRevealed: { zIndex: 2 },
  viewSwitch: { flexDirection: 'row', gap: 4, borderWidth: 1.5, borderRadius: 8, padding: 3, marginBottom: 10 },
  viewOption: { flex: 1, minHeight: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  viewLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  // Anchored over the name it explains, and inert — the tap belongs to the row underneath.
  tooltip: { position: 'absolute', left: 46, bottom: '82%', maxWidth: '76%', borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  tooltipText: { fontSize: 12, fontWeight: '800' },
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
