import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Alert, Linking, Platform, StyleSheet, Switch, Text, View } from 'react-native';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Cloud from 'lucide-react-native/icons/cloud';
import CloudOff from 'lucide-react-native/icons/cloud-off';
import LogOut from 'lucide-react-native/icons/log-out';
import Languages from 'lucide-react-native/icons/languages';
import Mail from 'lucide-react-native/icons/mail';
import Palette from 'lucide-react-native/icons/palette';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import Trash2 from 'lucide-react-native/icons/trash-2';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import Trophy from 'lucide-react-native/icons/trophy';
import Users from 'lucide-react-native/icons/users';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { LANGUAGE_OPTIONS } from '@/components/overlays/LanguageSheet';
import { PlayerAvatarTile } from '@/components/PlayerAvatar';
import { playerName } from '@/lib/identity';
import { useAuthStore } from '@/state/authStore';
import { useLanguageStore } from '@/state/languageStore';
import { countMissedDays } from '@/game/archive';
import { newFriends, useFriendsStore } from '@/state/friendsStore';
import { useSyncStore } from '@/state/syncStore';
import { useSemanticTokens, useThemeTokens } from '@/state/themeStore';
import { refreshDailyReminders } from '@/lib/dailyReminder';
import { playHaptic } from '@/lib/haptics';
import { useProgressStore } from '@/state/progressStore';
import { useHydrated, useI18n } from '@/i18n';
import { renderSheetBackdrop } from '@/components/overlays/SheetBackdrop';

export interface SettingsSheetHandle {
  present: () => void;
}

interface SettingsSheetProps {
  onOpenAchievements: () => void;
  onOpenThemes: () => void;
  onOpenPrivacy: () => void;
  onOpenLanguage: () => void;
  onOpenLeaderboard: () => void;
  onOpenArchive: () => void;
}

export const SettingsSheet = forwardRef<SettingsSheetHandle, SettingsSheetProps>(function SettingsSheet({ onOpenAchievements, onOpenThemes, onOpenPrivacy, onOpenLanguage, onOpenLeaderboard, onOpenArchive }, ref) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const theme = useThemeTokens();
  const semantic = useSemanticTokens();
  const user = useAuthStore(s => s.user);
  const error = useAuthStore(s => s.error);
  const signOut = useAuthStore(s => s.signOut);
  const deleteAccount = useAuthStore(s => s.deleteAccount);
  const status = useSyncStore(s => s.status);
  const hasPendingChanges = useSyncStore(s => s.hasPendingChanges);
  const languagePreference = useLanguageStore(state => state.preference);
  const dailyReminderEnabled = useProgressStore(state => state.dailyReminderEnabled);
  const setDailyReminderEnabled = useProgressStore(state => state.setDailyReminderEnabled);
  const dailyCompletionDates = useProgressStore(state => state.dailyCompletionDates);
  // Derived from today's date, so it waits for hydration like it did on the menu.
  const hydrated = useHydrated();
  const missedDays = countMissedDays(dailyCompletionDates);
  const friendCode = useFriendsStore(state => state.code);
  const friendEntries = useFriendsStore(state => state.entries);
  const friendsSeenAt = useFriendsStore(state => state.seenAt);
  const loadFriends = useFriendsStore(state => state.load);
  const arrivedCount = newFriends(friendEntries, friendsSeenAt).length;
  const { t, language } = useI18n();
  const selectedLanguage = LANGUAGE_OPTIONS.find(option => option.value === languagePreference) ?? LANGUAGE_OPTIONS[0];
  const languageValueLabel = selectedLanguage.value === 'auto' ? t('settings.languageAuto') : selectedLanguage.label;

  useImperativeHandle(ref, () => ({
    present: () => {
      // Fetched here so the code is already under the player's name when they look for it,
      // rather than appearing a beat after the leaderboard is opened.
      if (user) loadFriends();
      sheetRef.current?.present();
    },
  }));

  const syncCopy = hasPendingChanges
    ? status === 'offline'
      ? t('settings.offline')
      : t('settings.retrying')
    : status === 'syncing'
      ? t('settings.syncing')
      : t('settings.synced');
  const SyncIcon = hasPendingChanges ? CloudOff : Cloud;

  // No dismiss first: the modal provider's default 'switch' stack behaviour minimises
  // this sheet and restores it when the child is dismissed, so the old dismiss-wait-open
  // dance was fighting the library and showing an empty screen for its 180ms.
  function openChildSheet(next: () => void) {
    next();
  }

  function confirmDeleteAccount() {
    Alert.alert(
      t('settings.deleteTitle'),
      t('settings.deleteBody'),
      [
        { text: t('settings.cancel'), style: 'cancel' },
        {
          text: t('settings.deleteConfirm'),
          style: 'destructive',
          onPress: () => {
            // Fires at the point of no return, not when the row merely opened this dialog.
            playHaptic('warning');
            deleteAccount().then(() => sheetRef.current?.dismiss()).catch(() => {});
          },
        },
      ],
    );
  }

  async function toggleDailyReminder(enabled: boolean) {
    const progress = useProgressStore.getState();
    const scheduled = await refreshDailyReminders({
      enabled,
      language,
      dailyDoneToday: progress.isDailyDoneToday(),
      dailyStreak: progress.dailyStreak(),
    });
    if (scheduled) {
      playHaptic('selection');
      setDailyReminderEnabled(enabled);
    } else if (enabled) {
      // The switch springs back because permission was refused, so the buzz has to read
      // as "that did not take" rather than confirming a change that never happened.
      playHaptic('warning');
      Alert.alert(t('settings.permissionTitle'), t('settings.permissionBody'));
    }
  }

  return (
    <BottomSheetModal
      backdropComponent={renderSheetBackdrop}
      ref={sheetRef}
      enableDynamicSizing
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: theme.bg }}
      handleIndicatorStyle={{ backgroundColor: theme.gridSep }}
    >
      <BottomSheetView style={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>{t('settings.title')}</Text>

        {user ? (
          <>
            <View style={[styles.account, { backgroundColor: theme.surface, borderColor: theme.gridSep }]}> 
              <View style={styles.accountIdentity}>
                <PlayerAvatarTile userId={user.id} size={44} />
                <View style={styles.accountIdentityCopy}>
                  <Text style={[styles.accountName, { color: theme.text }]}>{playerName(user.id, language)}</Text>
                  {/* The code sits under the name because that is the pair a player reads out
                      to a friend: who they are, and how to be added. */}
                  {!!friendCode && (
                    <Text style={[styles.accountCode, { color: theme.sub }]}>{t('leaderboard.yourCode')} · {friendCode}</Text>
                  )}
                </View>
              </View>
              <AnimatedPressable accessibilityRole="button" style={[styles.accountSignOut, { borderColor: theme.gridSep }]} onPress={() => signOut().then(() => sheetRef.current?.dismiss()).catch(() => {})}>
                <LogOut size={17} color={theme.text} strokeWidth={2.2} />
                <Text style={[styles.accountSignOutText, { color: theme.text }]}>{t('settings.signOut')}</Text>
              </AnimatedPressable>
            </View>

            <View style={styles.syncRow}>
              <SyncIcon size={18} color={hasPendingChanges ? semantic.warning : theme.accent} strokeWidth={2.2} />
              <Text style={[styles.syncCopy, { color: theme.sub }]}>{syncCopy}</Text>
            </View>

          </>
        ) : null}

        <Text style={[styles.sectionLabel, { color: theme.sub }]}>{t('settings.game')}</Text>
        <AnimatedPressable accessibilityRole="button" style={[styles.row, { borderColor: theme.gridSep }]} onPress={() => openChildSheet(onOpenLeaderboard)}>
          <View style={styles.rowCopy}><Users size={18} color={theme.accent} strokeWidth={2.2} /><Text style={[styles.rowLabel, { color: theme.text }]}>{t('leaderboard.open')}</Text></View>
          <View style={styles.rowValue}>
            {/* Someone adding you is the one thing on this board that happens without you. */}
            {arrivedCount > 0 && (
              <Text style={[styles.rowBadge, { color: semantic.success, borderColor: semantic.successBorder, backgroundColor: semantic.successSurface }]}>
                {t('leaderboard.newCount', { count: arrivedCount })}
              </Text>
            )}
            <ChevronRight size={18} color={theme.sub} />
          </View>
        </AnimatedPressable>
        <AnimatedPressable accessibilityRole="button" style={[styles.row, { borderColor: theme.gridSep }]} onPress={() => openChildSheet(onOpenAchievements)}>
          <View style={styles.rowCopy}><Trophy size={18} color={semantic.gold} strokeWidth={2.2} /><Text style={[styles.rowLabel, { color: theme.text }]}>{t('settings.achievements')}</Text></View>
          <ChevronRight size={18} color={theme.sub} />
        </AnimatedPressable>

        <AnimatedPressable accessibilityRole="button" style={[styles.row, { borderColor: theme.gridSep }]} onPress={() => openChildSheet(onOpenArchive)}>
          <View style={styles.rowCopy}><CalendarDays size={18} color={theme.accent} strokeWidth={2.2} /><Text style={[styles.rowLabel, { color: theme.text }]}>{t('archive.open')}</Text></View>
          <View style={styles.rowValue}>
            {hydrated && (
              <Text style={[styles.rowValueText, { color: theme.sub }]}>
                {missedDays ? String(missedDays) : t('archive.allDoneShort')}
              </Text>
            )}
            <ChevronRight size={18} color={theme.sub} />
          </View>
        </AnimatedPressable>

        <Text style={[styles.sectionLabel, { color: theme.sub }]}>{t('settings.appearance')}</Text>
        <AnimatedPressable accessibilityRole="button" style={[styles.row, { borderColor: theme.gridSep }]} onPress={() => openChildSheet(onOpenThemes)}>
          <View style={styles.rowCopy}><Palette size={18} color={theme.accent} strokeWidth={2.2} /><Text style={[styles.rowLabel, { color: theme.text }]}>{t('settings.themes')}</Text></View>
          <ChevronRight size={18} color={theme.sub} />
        </AnimatedPressable>

        <AnimatedPressable accessibilityRole="button" style={[styles.row, { borderColor: theme.gridSep }]} onPress={() => openChildSheet(onOpenLanguage)}>
          <View style={styles.rowCopy}><Languages size={18} color={theme.accent} strokeWidth={2.2} /><Text style={[styles.rowLabel, { color: theme.text }]}>{t('settings.language')}</Text></View>
          <View style={styles.rowValue}>
            <Text style={[styles.rowValueText, { color: theme.sub }]}>{languageValueLabel}</Text>
            <ChevronRight size={18} color={theme.sub} />
          </View>
        </AnimatedPressable>

        <Text style={[styles.sectionLabel, { color: theme.sub }]}>{t('settings.privacySupport')}</Text>
        <AnimatedPressable accessibilityRole="button" style={[styles.row, { borderColor: theme.gridSep }]} onPress={() => openChildSheet(onOpenPrivacy)}>
          <View style={styles.rowCopy}><ShieldCheck size={18} color={theme.text} strokeWidth={2.2} /><Text style={[styles.rowLabel, { color: theme.text }]}>{t('settings.privacy')}</Text></View>
          <ChevronRight size={18} color={theme.sub} />
        </AnimatedPressable>
        <AnimatedPressable accessibilityRole="button" style={[styles.row, { borderColor: theme.gridSep }]} onPress={() => Linking.openURL('mailto:suporte@jogarbumi.pt')}>
          <View style={styles.rowCopy}><Mail size={18} color={theme.text} strokeWidth={2.2} /><Text style={[styles.rowLabel, { color: theme.text }]}>{t('settings.support')}</Text></View>
          <ChevronRight size={18} color={theme.sub} />
        </AnimatedPressable>

        {Platform.OS !== 'web' ? (
          <>
            <Text style={[styles.sectionLabel, { color: theme.sub }]}>{t('settings.reminder')}</Text>
            <View style={[styles.row, { borderColor: theme.gridSep }]}>
              <View style={styles.rowCopy}>
                <View style={styles.rowCopyStack}><Text style={[styles.rowLabel, { color: theme.text }]}>{t('settings.dailyReminder')}</Text><Text style={[styles.rowDetail, { color: theme.sub }]}>{t('settings.reminderTime')}</Text></View>
              </View>
              <Switch value={dailyReminderEnabled} onValueChange={toggleDailyReminder} trackColor={{ false: theme.gridSep, true: theme.accent }} />
            </View>
          </>
        ) : null}

        {user ? (
          <>
            <Text style={[styles.sectionLabel, { color: theme.sub }]}>{t('settings.account')}</Text>
            <AnimatedPressable accessibilityRole="button" style={[styles.row, { borderColor: theme.gridSep }]} onPress={confirmDeleteAccount}>
              <View style={styles.rowCopy}><Trash2 size={18} color={semantic.danger} strokeWidth={2.2} /><Text style={[styles.dangerText, { color: semantic.danger }]}>{t('settings.delete')}</Text></View>
              <ChevronRight size={18} color={semantic.danger} />
            </AnimatedPressable>
            {error ? <Text style={[styles.error, { color: semantic.danger }]}>{error}</Text> : null}
          </>
        ) : null}
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  // One 4px scale throughout: 4 / 8 / 12 / 14 / 20 / 28.
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32, gap: 8 },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 12 },
  account: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 14, paddingTop: 16 },
  accountIdentity: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  accountIdentityCopy: { flex: 1, minWidth: 0 },
  accountName: { fontSize: 15, fontWeight: '800' },
  accountCode: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, marginTop: 3 },
  rowBadge: { fontSize: 10, fontWeight: '800', borderWidth: 1, borderRadius: 20, paddingHorizontal: 7, paddingVertical: 1 },
  // Negative margin pulls the divider out to the card edges instead of stopping at the padding.
  // minHeight (not height) keeps the 44pt touch target while letting the label grow.
  accountSignOut: {
    minHeight: 44,
    marginTop: 14,
    marginHorizontal: -14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accountSignOutText: { flexShrink: 1, minWidth: 0, fontSize: 13, fontWeight: '700' },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 2, paddingVertical: 4 },
  syncCopy: { flex: 1, fontSize: 12, lineHeight: 17 },
  // Binds to the rows below it: 8 down (the container gap), 28 up from the previous group.
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginTop: 20, marginBottom: 0 },
  // 52 is the resting touch target, not the row height: padding + minHeight so a label that
  // wraps at the accessibility text sizes pushes the row taller instead of being clipped.
  row: { minHeight: 52, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowCopy: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  rowCopyStack: { flex: 1, minWidth: 0 },
  // Shared by row and column parents, so it shrinks rather than claiming flex on either axis.
  rowLabel: { flexShrink: 1, minWidth: 0, fontSize: 14, fontWeight: '700' },
  rowDetail: { fontSize: 11, lineHeight: 15, marginTop: 2 },
  rowValue: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  rowValueText: { fontSize: 13, fontWeight: '600' },
  // 44 = 14 padding + the 18pt icon column + its 12pt gap, so option labels sit under
  // the trigger's label instead of under its icon.
  dangerText: { flexShrink: 1, minWidth: 0, fontSize: 14, fontWeight: '700' },
  error: { fontSize: 12, lineHeight: 17, marginTop: 4 },
});
