import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import Download from 'lucide-react-native/icons/download';
import X from 'lucide-react-native/icons/x';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { Logo } from '@/components/Logo';
import { useThemeTokens } from '@/state/themeStore';
import { hitSlopFor } from '@/lib/touchTarget';
import { useI18n } from '@/i18n';
import { APP_STORE_URL } from '@/lib/appStore';
import { renderSheetBackdrop } from '@/components/overlays/SheetBackdrop';

// 36 is the size every other icon button in the app is painted at — the header's two and the
// sheet back arrow — and this one was the odd 34 for no reason the layout depends on.
const CLOSE_SIZE = 36;
// The button floats over the sheet corner, so its slop has to stay on the sheet. The 4pt it
// needs fits inside both its 18pt right inset and its 10pt drop below the drag handle.
const CLOSE_HIT_SLOP = hitSlopFor({ width: CLOSE_SIZE, height: CLOSE_SIZE });

export interface IOSInstallPromptSheetHandle {
  present: () => void;
}

export const IOSInstallPromptSheet = forwardRef<IOSInstallPromptSheetHandle>(function IOSInstallPromptSheet(_, ref) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const theme = useThemeTokens();
  const { t } = useI18n();

  async function openAppStore() {
    try {
      await Linking.openURL(APP_STORE_URL);
    } catch {
      // A blocked pop-up or a dismissed store sheet is not an error for the player: the
      // sheet stays open behind it and the button can be pressed again.
    }
  }

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
  }));

  return (
    <BottomSheetModal
      backdropComponent={renderSheetBackdrop}
      ref={sheetRef}
      enableDynamicSizing
      enablePanDownToClose
      backgroundStyle={[styles.sheet, { backgroundColor: theme.bg }]}
      handleIndicatorStyle={{ backgroundColor: theme.gridSep }}
    >
      <BottomSheetView style={styles.content}>
        <AnimatedPressable accessibilityRole="button" feedback="icon" style={[styles.close, { borderColor: theme.gridSep }]} hitSlop={CLOSE_HIT_SLOP} onPress={() => sheetRef.current?.dismiss()} accessibilityLabel={t('a11y.close')}>
          <X size={17} color={theme.sub} strokeWidth={2.4} />
        </AnimatedPressable>
        <View style={[styles.logo, { backgroundColor: theme.surface }]}><Logo size={40} /></View>
        <Text style={[styles.title, { color: theme.text }]}>{t('install.title')}</Text>
        <Text style={[styles.subtitle, { color: theme.sub }]}>{t('install.subtitle')}</Text>
        <AnimatedPressable
          style={[styles.storeButton, { backgroundColor: theme.accent }]}
          onPress={openAppStore}
          accessibilityRole="button"
          accessibilityLabel={t('install.appStore')}
        >
          <Download size={19} color={theme.onAccent} strokeWidth={2.4} />
          <Text style={[styles.storeButtonText, { color: theme.onAccent }]}>{t('install.appStore')}</Text>
        </AnimatedPressable>
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
  storeButton: { width: '100%', minHeight: 50, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 11 },
  storeButtonText: { fontSize: 15, fontWeight: '800' },
});
