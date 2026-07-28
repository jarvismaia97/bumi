import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import SquarePlus from 'lucide-react-native/icons/square-plus';
import Share from 'lucide-react-native/icons/share';
import X from 'lucide-react-native/icons/x';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { Logo } from '@/components/Logo';
import { useThemeTokens } from '@/state/themeStore';
import { hitSlopFor } from '@/lib/touchTarget';
import { useI18n } from '@/i18n';

const CLOSE_SIZE = 34;
// The button floats over the sheet corner, so its slop has to stay on the sheet. The 5pt it
// needs fits inside both its 18pt right inset and its 10pt drop below the drag handle.
const CLOSE_HIT_SLOP = hitSlopFor({ width: CLOSE_SIZE, height: CLOSE_SIZE });

export interface IOSInstallPromptSheetHandle {
  present: () => void;
}

export const IOSInstallPromptSheet = forwardRef<IOSInstallPromptSheetHandle>(function IOSInstallPromptSheet(_, ref) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const theme = useThemeTokens();
  const { t } = useI18n();

  async function openShareMenu() {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return;

    try {
      await navigator.share({
        title: 'Bumi',
        text: t('install.shareText'),
        url: window.location.href,
      });
    } catch {
      // Closing the native share menu is not an error for the player.
    }
  }

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
  }));

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      enablePanDownToClose
      backgroundStyle={[styles.sheet, { backgroundColor: theme.bg }]}
      handleIndicatorStyle={{ backgroundColor: theme.gridSep }}
    >
      <BottomSheetView style={styles.content}>
        <AnimatedPressable feedback="icon" style={[styles.close, { borderColor: theme.gridSep }]} hitSlop={CLOSE_HIT_SLOP} onPress={() => sheetRef.current?.dismiss()} accessibilityLabel={t('a11y.close')}>
          <X size={17} color={theme.sub} strokeWidth={2.4} />
        </AnimatedPressable>
        <View style={[styles.logo, { backgroundColor: theme.surface }]}><Logo size={40} /></View>
        <Text style={[styles.title, { color: theme.text }]}>{t('install.title')}</Text>
        <Text style={[styles.subtitle, { color: theme.sub }]}>{t('install.subtitle')}</Text>
        <View style={styles.steps}>
          <AnimatedPressable
            style={[styles.step, styles.shareAction, { backgroundColor: theme.surface, borderColor: theme.gridSep }]}
            onPress={openShareMenu}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.openShareMenu')}
          >
            <Share size={19} color={theme.accent} strokeWidth={2.4} />
            <Text style={[styles.stepText, { color: theme.text }]}>{t('install.step1')}</Text>
          </AnimatedPressable>
          <View style={[styles.step, { backgroundColor: theme.surface, borderColor: theme.gridSep }]}>
            <SquarePlus size={19} color={theme.accent} strokeWidth={2.4} />
            <Text style={[styles.stepText, { color: theme.text }]}>{t('install.step2')}</Text>
          </View>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  content: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 34 },
  close: { position: 'absolute', right: 18, top: 10, width: CLOSE_SIZE, height: CLOSE_SIZE, borderWidth: 1.5, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 58, height: 58, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800' },
  subtitle: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 7, maxWidth: 290 },
  steps: { width: '100%', gap: 8, marginTop: 20 },
  step: { minHeight: 50, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  shareAction: { justifyContent: 'flex-start' },
  stepText: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: '700' },
});
