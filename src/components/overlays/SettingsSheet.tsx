import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import Check from 'lucide-react-native/icons/check';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Cloud from 'lucide-react-native/icons/cloud';
import CloudOff from 'lucide-react-native/icons/cloud-off';
import LogOut from 'lucide-react-native/icons/log-out';
import Languages from 'lucide-react-native/icons/languages';
import Palette from 'lucide-react-native/icons/palette';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import Trash2 from 'lucide-react-native/icons/trash-2';
import Trophy from 'lucide-react-native/icons/trophy';
import { router } from 'expo-router';
import { PlayerAvatarTile } from '@/components/PlayerAvatar';
import { playerName } from '@/lib/identity';
import { useAuthStore } from '@/state/authStore';
import { useLanguageStore, type LanguagePreference } from '@/state/languageStore';
import { useSyncStore } from '@/state/syncStore';
import { useThemeTokens } from '@/state/themeStore';
import { setDailyReminder } from '@/lib/dailyReminder';
import { useProgressStore } from '@/state/progressStore';
import { useI18n } from '@/i18n';

export interface SettingsSheetHandle {
  present: () => void;
}

interface SettingsSheetProps {
  onOpenAchievements: () => void;
  onOpenThemes: () => void;
}

/** Native names, so a player who lands in the wrong language can still find their own. */
const LANGUAGE_OPTIONS: { value: LanguagePreference; label: string; flag: string }[] = [
  { value: 'auto', label: 'Auto', flag: '' },
  { value: 'pt-PT', label: 'Português', flag: '🇵🇹' },
  { value: 'en', label: 'English', flag: '🇬🇧' },
];

export const SettingsSheet = forwardRef<SettingsSheetHandle, SettingsSheetProps>(function SettingsSheet({ onOpenAchievements, onOpenThemes }, ref) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const theme = useThemeTokens();
  const { user, signOut, deleteAccount, error } = useAuthStore();
  const { status, hasPendingChanges } = useSyncStore();
  const languagePreference = useLanguageStore(state => state.preference);
  const setLanguagePreference = useLanguageStore(state => state.setPreference);
  const dailyReminderEnabled = useProgressStore(state => state.dailyReminderEnabled);
  const setDailyReminderEnabled = useProgressStore(state => state.setDailyReminderEnabled);
  const { t, language } = useI18n();

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
  }));

  const syncCopy = hasPendingChanges
    ? status === 'offline'
      ? t('settings.offline')
      : t('settings.retrying')
    : status === 'syncing'
      ? t('settings.syncing')
      : t('settings.synced');
  const SyncIcon = hasPendingChanges ? CloudOff : Cloud;

  function closeAndOpenPrivacy() {
    sheetRef.current?.dismiss();
    router.push('../privacidade');
  }

  function closeAndOpen(next: () => void) {
    sheetRef.current?.dismiss();
    setTimeout(next, 180);
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
          onPress: () => deleteAccount().then(() => sheetRef.current?.dismiss()).catch(() => {}),
        },
      ],
    );
  }

  async function toggleDailyReminder(enabled: boolean) {
    const scheduled = await setDailyReminder(enabled, language);
    if (scheduled) setDailyReminderEnabled(enabled);
    else if (enabled) Alert.alert(t('settings.permissionTitle'), t('settings.permissionBody'));
  }

  return (
    <BottomSheetModal
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
                  <Text style={[styles.accountName, { color: theme.text }]} numberOfLines={2}>{playerName(user.id, language)}</Text>
                  <Text style={[styles.accountDetail, { color: theme.sub }]} numberOfLines={1}>{t('settings.playerHint')}</Text>
                </View>
              </View>
              <Pressable style={[styles.accountSignOut, { borderColor: theme.gridSep }]} onPress={() => signOut().then(() => sheetRef.current?.dismiss()).catch(() => {})}>
                <LogOut size={17} color={theme.text} strokeWidth={2.2} />
                <Text style={[styles.accountSignOutText, { color: theme.text }]}>{t('settings.signOut')}</Text>
              </Pressable>
            </View>

            <View style={[styles.syncRow, { borderColor: theme.gridSep }]}>
              <SyncIcon size={18} color={hasPendingChanges ? '#b07a24' : theme.accent} strokeWidth={2.2} />
              <Text style={[styles.syncCopy, { color: theme.sub }]}>{syncCopy}</Text>
            </View>

          </>
        ) : null}

        <Text style={[styles.sectionLabel, { color: theme.sub }]}>{t('settings.game')}</Text>
        <Pressable style={[styles.row, { borderColor: theme.gridSep }]} onPress={() => closeAndOpen(onOpenAchievements)}>
          <View style={styles.rowCopy}><Trophy size={18} color="#c39828" strokeWidth={2.2} /><Text style={[styles.rowLabel, { color: theme.text }]}>{t('settings.achievements')}</Text></View>
          <ChevronRight size={18} color={theme.sub} />
        </Pressable>

        <Text style={[styles.sectionLabel, { color: theme.sub }]}>{t('settings.appearance')}</Text>
        <Pressable style={[styles.row, { borderColor: theme.gridSep }]} onPress={() => closeAndOpen(onOpenThemes)}>
          <View style={styles.rowCopy}><Palette size={18} color={theme.accent} strokeWidth={2.2} /><Text style={[styles.rowLabel, { color: theme.text }]}>{t('settings.themes')}</Text></View>
          <ChevronRight size={18} color={theme.sub} />
        </Pressable>

        <Text style={[styles.sectionLabel, { color: theme.sub }]}>{t('settings.language')}</Text>
        {LANGUAGE_OPTIONS.map(option => {
          const selected = option.value === languagePreference;
          return (
            <Pressable
              key={option.value}
              style={[styles.row, { borderColor: selected ? theme.accent : theme.gridSep }]}
              onPress={() => setLanguagePreference(option.value)}
              accessibilityState={{ selected }}
            >
              <View style={styles.rowCopy}>
                {option.value === 'auto'
                  ? <Languages size={18} color={theme.accent} strokeWidth={2.2} />
                  : <Text style={styles.flag}>{option.flag}</Text>}
                <View>
                  <Text style={[styles.rowLabel, { color: theme.text }]}>{option.value === 'auto' ? t('settings.languageAuto') : option.label}</Text>
                  {option.value === 'auto' && <Text style={[styles.rowDetail, { color: theme.sub }]}>{t('settings.languageAutoDetail')}</Text>}
                </View>
              </View>
              {selected && <Check size={18} color={theme.accent} strokeWidth={2.8} />}
            </Pressable>
          );
        })}

        <Text style={[styles.sectionLabel, { color: theme.sub }]}>{t('settings.privacySupport')}</Text>
        <Pressable style={[styles.row, { borderColor: theme.gridSep }]} onPress={closeAndOpenPrivacy}>
          <View style={styles.rowCopy}><ShieldCheck size={18} color={theme.text} strokeWidth={2.2} /><Text style={[styles.rowLabel, { color: theme.text }]}>{t('settings.privacy')}</Text></View>
          <ChevronRight size={18} color={theme.sub} />
        </Pressable>
        <Pressable style={[styles.row, { borderColor: theme.gridSep }]} onPress={() => Linking.openURL('mailto:suporte@jogarbumi.pt')}>
          <View style={styles.rowCopy}><Text style={[styles.rowLabel, { color: theme.text }]}>{t('settings.support')}</Text></View>
          <ChevronRight size={18} color={theme.sub} />
        </Pressable>

        {Platform.OS !== 'web' ? (
          <>
            <Text style={[styles.sectionLabel, { color: theme.sub }]}>{t('settings.reminder')}</Text>
            <View style={[styles.row, { borderColor: theme.gridSep }]}>
              <View style={styles.rowCopy}>
                <View><Text style={[styles.rowLabel, { color: theme.text }]}>{t('settings.dailyReminder')}</Text><Text style={[styles.rowDetail, { color: theme.sub }]}>{t('settings.reminderTime')}</Text></View>
              </View>
              <Switch value={dailyReminderEnabled} onValueChange={toggleDailyReminder} trackColor={{ false: theme.gridSep, true: theme.accent }} />
            </View>
          </>
        ) : null}

        {user ? (
          <>
            <Text style={[styles.sectionLabel, { color: theme.sub }]}>{t('settings.account')}</Text>
            <Pressable style={[styles.dangerRow, { borderColor: theme.gridSep }]} onPress={confirmDeleteAccount}>
              <View style={styles.rowCopy}><Trash2 size={18} color="#b03060" strokeWidth={2.2} /><Text style={styles.dangerText}>{t('settings.delete')}</Text></View>
              <ChevronRight size={18} color="#b03060" />
            </Pressable>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </>
        ) : null}
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 34, gap: 8 },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  account: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 5 },
  accountIdentity: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  accountIdentityCopy: { flex: 1, minWidth: 0 },
  accountName: { fontSize: 15, fontWeight: '800' },
  accountDetail: { fontSize: 12, marginTop: 3 },
  accountSignOut: { minHeight: 38, marginTop: 10, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  accountSignOutText: { fontSize: 13, fontWeight: '700' },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 3, paddingVertical: 7 },
  syncCopy: { flex: 1, fontSize: 12, lineHeight: 17 },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginTop: 12, marginBottom: 2 },
  row: { minHeight: 52, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowCopy: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  rowLabel: { fontSize: 14, fontWeight: '700' },
  rowDetail: { fontSize: 11, marginTop: 2 },
  flag: { fontSize: 18 },
  dangerRow: { minHeight: 52, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dangerText: { color: '#b03060', fontSize: 14, fontWeight: '700' },
  error: { color: '#b03060', fontSize: 12, lineHeight: 17, marginTop: 2 },
});
