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
import { hitSlopFor, MIN_TOUCH_TARGET } from '@/lib/touchTarget';
import { playHaptic } from '@/lib/haptics';
import { artistLabel } from '@/lib/playerName';
import { titleFor } from '@/game/titles';
import { newFriends, sortForView, useFriendsStore, type BoardView, type LeaderboardEntry } from '@/state/friendsStore';
import { formatResultDuration } from '@/game/medals';
import { useAuthStore } from '@/state/authStore';
import { useSemanticTokens, useThemeTokens } from '@/state/themeStore';
import { useI18n, type SupportedLanguage } from '@/i18n';
import type { Translate } from '@/i18n/messages';

export type LeaderboardSheetHandle = SettingsChildSheetHandle;

// Derived from the painted boxes rather than shared with the header's, the same way login.tsx
// does it: the two happen to be 36pt squares, and a slop that comes from the box moves when
// the box does instead of leaving a stale constant behind.
const ICON_BUTTON_SIZE = 36;
const ICON_BUTTON_HIT_SLOP = hitSlopFor({ width: ICON_BUTTON_SIZE, height: ICON_BUTTON_SIZE });
// The destructive one, and the smallest thing on the row. It sits about 10pt from a toggle
// that spans the row, so a tap that misses it used to land on "reveal this friend's name".
const REMOVE_BUTTON_SIZE = 28;
const REMOVE_BUTTON_HIT_SLOP = hitSlopFor({ width: REMOVE_BUTTON_SIZE, height: REMOVE_BUTTON_SIZE });

/** The board shows painter nicknames, the same identity the settings sheet shows. */
function entryName(entry: LeaderboardEntry, language: SupportedLanguage): string {
  return artistLabel(entry.artist, language);
}

/** Rows are keyed by code; the player's own row has none until the server assigns one. */
function rowKey(entry: LeaderboardEntry, index: number): string {
  return entry.code ?? `entry-${index}`;
}

/**
 * What a finished daily says. The count only appears when hints were actually spent: a zero
 * would put a line about hints under every clean solve, and a null — a day recorded before the
 * count was kept — has nothing to say either way, so it reads as it always did.
 */
function dailyDoneDetail(entry: LeaderboardEntry, t: Translate): string {
  const count = entry.dailyHints;
  if (!count) return t('leaderboard.dailyDone');
  return t('leaderboard.dailyDoneHinted', {
    count,
    hints: t(count === 1 ? 'game.hintOne' : 'game.hintMany'),
  });
}

export const LeaderboardSheet = forwardRef<LeaderboardSheetHandle>(function LeaderboardSheet(_, ref) {
  const sheetRef = useRef<SettingsChildSheetHandle>(null);
  const theme = useThemeTokens();
  const semantic = useSemanticTokens();
  const { t, language } = useI18n();
  const user = useAuthStore(state => state.user);
  const { code, entries, friendCount, truncated, loading, busy, error, load, addFriend, removeFriend, rotateCode, clearError } = useFriendsStore();
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
                hitSlop={ICON_BUTTON_HIT_SLOP}
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
                hitSlop={ICON_BUTTON_HIT_SLOP}
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
              <UserPlus size={18} color={theme.onAccent} strokeWidth={2.3} />
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
                  <Text style={[styles.viewLabel, { color: active ? theme.onAccent : theme.sub }]}>
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
              // It stays additive because react-native-web drops hover for `pointerType`
              // 'touch', so a tap never opens the reveal on its way to toggling it shut.
              onHoverIn={() => setRevealed(key)}
              onHoverOut={() => setRevealed(current => (current === key ? null : current))}
              style={[
                styles.row,
                { backgroundColor: theme.surface, borderColor: entry.isSelf ? theme.accent : theme.gridSep },
              ]}
            >
              <Text style={[styles.rank, { color: theme.sub }]}>{index + 1}</Text>
              {/* Self is the only row whose account id this device knows, so only it gets the
                  real mosaic — and it is also the one row with no `code`, since there is
                  nothing there to remove. Everyone else is seeded from the removal handle,
                  which is a per-viewer HMAC rather than the add-code it used to be: still
                  deterministic, so a friend's tile is stable on this board, but the same
                  friend no longer draws the same tile on somebody else's. */}
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
                {/* The title sits on this line rather than beside the name, which already
                    truncates against the NEW badge — and it is cut from the numbers that follow
                    it, so a friend gets one without the board sending anything extra.

                    While revealed the line answers "who is this" instead. Inside the row rather
                    than floating over it: a bubble would have to be placed against a row whose
                    height varies and flipped below the first one to stay on screen. */}
                <Text
                  style={[styles.rowDetail, { color: isRevealed ? theme.accent : theme.sub }, isRevealed && styles.rowDetailRevealed]}
                  numberOfLines={1}
                >
                  {isRevealed ? (
                    entry.name ?? t('leaderboard.noName')
                  ) : (
                    <>
                      {rowTitle && <Text style={{ color: theme.accent, fontWeight: '800' }}>{rowTitle} · </Text>}
                      {view === 'daily'
                        ? entry.dailyDone
                          ? dailyDoneDetail(entry, t)
                          : t('leaderboard.dailyPending')
                        : t('leaderboard.rowDetail', { solved: entry.solved, gold: entry.medals.gold, streak: entry.streak })}
                    </>
                  )}
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
                  hitSlop={REMOVE_BUTTON_HIT_SLOP}
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
          {/* Adding is capped, but a friendship is written in both directions — so a player whose
              code has gone around can be carried past the cap by other people, and the board is
              cut to fit. Without this the list simply ends, and rows they cannot see look
              exactly like having no more friends. */}
          {truncated && (
            <Text style={[styles.empty, { color: theme.sub }]}>
              {t('leaderboard.truncated', { count: friendCount, shown: ordered.filter(entry => !entry.isSelf).length })}
            </Text>
          )}
          <Text style={[styles.hint, { color: theme.sub }]}>
            {t(view === 'daily' ? 'leaderboard.dailyHint' : 'leaderboard.pointsHint')}
          </Text>
        </>
      )}
    </SettingsChildSheet>
  );
});

const styles = StyleSheet.create({
  // The heading every sibling sheet uses, stated the same way here: this one was a point
  // smaller and tracked out further, which read as a different kind of heading rather than
  // the same one on a different sheet.
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 18, marginBottom: 8 },
  codeCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12 },
  code: { flexShrink: 1, minWidth: 0, fontSize: 22, fontWeight: '800', letterSpacing: 3 },
  codeActions: { flexDirection: 'row', gap: 8, flexShrink: 0 },
  iconButton: { width: ICON_BUTTON_SIZE, height: ICON_BUTTON_SIZE, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderRadius: 8 },
  hint: { fontSize: 11, lineHeight: 15, marginTop: 8 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, minWidth: 0, minHeight: 44, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 14, fontSize: 16, fontWeight: '700', letterSpacing: 2 },
  addButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8, flexShrink: 0 },
  error: { fontSize: 11, fontWeight: '700', marginTop: 8 },
  empty: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
  rowDetailRevealed: { fontSize: 12, fontWeight: '800' },
  viewSwitch: { flexDirection: 'row', gap: 4, borderWidth: 1.5, borderRadius: 8, padding: 3, marginBottom: 10 },
  viewOption: { flex: 1, minHeight: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  viewLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  rank: { flexShrink: 0, minWidth: 16, fontSize: 12, fontWeight: '800' },
  rowCopy: { flex: 1, minWidth: 0 },
  rowNameLine: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  rowName: { flexShrink: 1, minWidth: 0, fontSize: 13, fontWeight: '800' },
  // Was 9pt, the smallest type in the app, and tracked out on top of that. Uppercase at
  // this size needs the room back more than it needs the tracking.
  newBadge: { flexShrink: 0, fontSize: 10, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', borderWidth: 1, borderRadius: 20, paddingHorizontal: 6, paddingVertical: 1 },
  rowDetail: { fontSize: 10, marginTop: 2 },
  rowPoints: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 4 },
  points: { fontSize: 15, fontWeight: '800' },
  removeButton: { flexShrink: 0, width: REMOVE_BUTTON_SIZE, height: REMOVE_BUTTON_SIZE, alignItems: 'center', justifyContent: 'center' },
});
