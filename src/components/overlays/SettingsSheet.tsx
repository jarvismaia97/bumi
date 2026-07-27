import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import Check from 'lucide-react-native/icons/check';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Cloud from 'lucide-react-native/icons/cloud';
import CloudOff from 'lucide-react-native/icons/cloud-off';
import LogOut from 'lucide-react-native/icons/log-out';
import Languages from 'lucide-react-native/icons/languages';
import Palette from 'lucide-react-native/icons/palette';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import Trash2 from 'lucide-react-native/icons/trash-2';
import Trophy from 'lucide-react-native/icons/trophy';
import Animated, { FadeIn, FadeOut, ReduceMotion, useAnimatedStyle, withTiming } from 'react-native-reanimated';
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
  { value: 'auto', label: 'Auto', flag: '🌐' },
  { value: 'pt-PT', label: 'Português', flag: '🇵🇹' },
  { value: 'en', label: 'English', flag: '🇬🇧' },
];

/** Points at the list it reveals. Rotation only — transform is the cheap property. */
function DisclosureChevron({ open, color }: { open: boolean; color: string }) {
  const style = useAnimatedStyle(() => ({
    transform: [
      { rotate: withTiming(open ? '180deg' : '0deg', { duration: 180, reduceMotion: ReduceMotion.System }) },
    ],
  }));
  return (
    <Animated.View style={style}>
      <ChevronDown size={18} color={color} strokeWidth={2.2} />
    </Animated.View>
  );
}

export const SettingsSheet = forwardRef<SettingsSheetHandle, SettingsSheetProps>(function SettingsSheet({ onOpenAchievements, onOpenThemes }, ref) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const theme = useThemeTokens();
  const user = useAuthStore(s => s.user);
  const error = useAuthStore(s => s.error);
  const signOut = useAuthStore(s => s.signOut);
  const deleteAccount = useAuthStore(s => s.deleteAccount);
  const status = useSyncStore(s => s.status);
  const hasPendingChanges = useSyncStore(s => s.hasPendingChanges);
  const languagePreference = useLanguageStore(state => state.preference);
  const setLanguagePreference = useLanguageStore(state => state.setPreference);
  const dailyReminderEnabled = useProgressStore(state => state.dailyReminderEnabled);
  const setDailyReminderEnabled = useProgressStore(state => state.setDailyReminderEnabled);
  const { t, language } = useI18n();
  const [languageOpen, setLanguageOpen] = useState(false);
  const optionLabel = (option: (typeof LANGUAGE_OPTIONS)[number]) =>
    option.value === 'auto' ? t('settings.languageAuto') : option.label;
  const languageValueLabel = optionLabel(
    LANGUAGE_OPTIONS.find(option => option.value === languagePreference) ?? LANGUAGE_OPTIONS[0],
  );

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
              <Pressable accessibilityRole="button" style={[styles.accountSignOut, { borderColor: theme.gridSep }]} onPress={() => signOut().then(() => sheetRef.current?.dismiss()).catch(() => {})}>
                <LogOut size={17} color={theme.text} strokeWidth={2.2} />
                <Text style={[styles.accountSignOutText, { color: theme.text }]}>{t('settings.signOut')}</Text>
              </Pressable>
            </View>

            <View style={styles.syncRow}>
              <SyncIcon size={18} color={hasPendingChanges ? '#b07a24' : theme.accent} strokeWidth={2.2} />
              <Text style={[styles.syncCopy, { color: theme.sub }]}>{syncCopy}</Text>
            </View>

          </>
        ) : null}

        <Text style={[styles.sectionLabel, { color: theme.sub }]}>{t('settings.game')}</Text>
        <Pressable accessibilityRole="button" style={[styles.row, { borderColor: theme.gridSep }]} onPress={() => closeAndOpen(onOpenAchievements)}>
          <View style={styles.rowCopy}><Trophy size={18} color="#c39828" strokeWidth={2.2} /><Text style={[styles.rowLabel, { color: theme.text }]}>{t('settings.achievements')}</Text></View>
          <ChevronRight size={18} color={theme.sub} />
        </Pressable>

        <Text style={[styles.sectionLabel, { color: theme.sub }]}>{t('settings.appearance')}</Text>
        <Pressable accessibilityRole="button" style={[styles.row, { borderColor: theme.gridSep }]} onPress={() => closeAndOpen(onOpenThemes)}>
          <View style={styles.rowCopy}><Palette size={18} color={theme.accent} strokeWidth={2.2} /><Text style={[styles.rowLabel, { color: theme.text }]}>{t('settings.themes')}</Text></View>
          <ChevronRight size={18} color={theme.sub} />
        </Pressable>

        <View style={[styles.group, { borderColor: languageOpen ? theme.accent : theme.gridSep }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: languageOpen }}
            style={styles.groupTrigger}
            onPress={() => setLanguageOpen(open => !open)}
          >
            <View style={styles.rowCopy}>
              <Languages size={18} color={theme.accent} strokeWidth={2.2} />
              <Text style={[styles.rowLabel, { color: theme.text }]}>{t('settings.language')}</Text>
            </View>
            <View style={styles.groupValue}>
              <Text style={[styles.groupValueText, { color: theme.sub }]}>{languageValueLabel}</Text>
              <DisclosureChevron open={languageOpen} color={theme.sub} />
            </View>
          </Pressable>

          {languageOpen && (
            <Animated.View
              entering={FadeIn.duration(140).reduceMotion(ReduceMotion.System)}
              exiting={FadeOut.duration(100).reduceMotion(ReduceMotion.System)}
            >
              {LANGUAGE_OPTIONS.map(option => {
                const selected = option.value === languagePreference;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={option.value}
                    style={[styles.groupOption, { borderTopColor: theme.gridSep }]}
                    onPress={() => {
                      setLanguagePreference(option.value);
                      setLanguageOpen(false);
                    }}
                    accessibilityState={{ selected }}
                  >
                    <View style={styles.rowCopy}>
                      <Text style={styles.flag}>{option.flag}</Text>
                      <View style={styles.groupOptionCopy}>
                        <Text style={[styles.rowLabel, { color: theme.text }]}>{optionLabel(option)}</Text>
                        {option.value === 'auto' && (
                          <Text style={[styles.rowDetail, { color: theme.sub }]}>{t('settings.languageAutoDetail')}</Text>
                        )}
                      </View>
                    </View>
                    {selected && <Check size={18} color={theme.accent} strokeWidth={2.8} />}
                  </Pressable>
                );
              })}
            </Animated.View>
          )}
        </View>


        <Text style={[styles.sectionLabel, { color: theme.sub }]}>{t('settings.privacySupport')}</Text>
        <Pressable accessibilityRole="button" style={[styles.row, { borderColor: theme.gridSep }]} onPress={closeAndOpenPrivacy}>
          <View style={styles.rowCopy}><ShieldCheck size={18} color={theme.text} strokeWidth={2.2} /><Text style={[styles.rowLabel, { color: theme.text }]}>{t('settings.privacy')}</Text></View>
          <ChevronRight size={18} color={theme.sub} />
        </Pressable>
        <Pressable accessibilityRole="button" style={[styles.row, { borderColor: theme.gridSep }]} onPress={() => Linking.openURL('mailto:suporte@jogarbumi.pt')}>
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
            <Pressable accessibilityRole="button" style={[styles.row, { borderColor: theme.gridSep }]} onPress={confirmDeleteAccount}>
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
  // One 4px scale throughout: 4 / 8 / 12 / 14 / 20 / 28.
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32, gap: 8 },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 12 },
  account: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 14, paddingTop: 14 },
  accountIdentity: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  accountIdentityCopy: { flex: 1, minWidth: 0 },
  accountName: { fontSize: 15, fontWeight: '800' },
  accountDetail: { fontSize: 12, marginTop: 4 },
  // Negative margin pulls the divider out to the card edges instead of stopping at the padding.
  accountSignOut: {
    minHeight: 44,
    marginTop: 14,
    marginHorizontal: -14,
    paddingHorizontal: 14,
    borderTopWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accountSignOutText: { fontSize: 13, fontWeight: '700' },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 2, paddingVertical: 4 },
  syncCopy: { flex: 1, fontSize: 12, lineHeight: 17 },
  // Binds to the rows below it: 8 down (the container gap), 28 up from the previous group.
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginTop: 20, marginBottom: 0 },
  row: { minHeight: 52, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowCopy: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  rowLabel: { fontSize: 14, fontWeight: '700' },
  rowDetail: { fontSize: 11, lineHeight: 15, marginTop: 2 },
  flag: { fontSize: 18, width: 18, textAlign: 'center' },
  group: { borderWidth: 1.5, borderRadius: 8, overflow: 'hidden' },
  groupTrigger: { minHeight: 52, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  groupValue: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  groupValueText: { fontSize: 13, fontWeight: '600' },
  groupOption: { minHeight: 52, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  groupOptionCopy: { flex: 1, minWidth: 0 },
  dangerText: { color: '#b03060', fontSize: 14, fontWeight: '700' },
  error: { color: '#b03060', fontSize: 12, lineHeight: 17, marginTop: 4 },
});
