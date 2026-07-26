import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import SquarePlus from 'lucide-react-native/icons/square-plus';
import Share from 'lucide-react-native/icons/share';
import X from 'lucide-react-native/icons/x';
import { Logo } from '@/components/Logo';
import { useThemeTokens } from '@/state/themeStore';

export interface IOSInstallPromptSheetHandle {
  present: () => void;
}

export const IOSInstallPromptSheet = forwardRef<IOSInstallPromptSheetHandle>(function IOSInstallPromptSheet(_, ref) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const theme = useThemeTokens();

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
        <Pressable style={[styles.close, { borderColor: theme.gridSep }]} onPress={() => sheetRef.current?.dismiss()} accessibilityLabel="Fechar">
          <X size={17} color={theme.sub} strokeWidth={2.4} />
        </Pressable>
        <View style={[styles.logo, { backgroundColor: theme.surface }]}><Logo size={40} /></View>
        <Text style={[styles.title, { color: theme.text }]}>Joga como uma app</Text>
        <Text style={[styles.subtitle, { color: theme.sub }]}>Adiciona Bumi ao ecrã principal para abrir mais depressa.</Text>
        <View style={styles.steps}>
          <View style={[styles.step, { backgroundColor: theme.surface, borderColor: theme.gridSep }]}>
            <Share size={19} color={theme.accent} strokeWidth={2.4} />
            <Text style={[styles.stepText, { color: theme.text }]}>Toca em Partilhar</Text>
          </View>
          <View style={[styles.step, { backgroundColor: theme.surface, borderColor: theme.gridSep }]}>
            <SquarePlus size={19} color={theme.accent} strokeWidth={2.4} />
            <Text style={[styles.stepText, { color: theme.text }]}>Adicionar ao ecrã principal</Text>
          </View>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  content: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 34 },
  close: { position: 'absolute', right: 18, top: 10, width: 34, height: 34, borderWidth: 1.5, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 58, height: 58, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800' },
  subtitle: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 7, maxWidth: 290 },
  steps: { width: '100%', gap: 8, marginTop: 20 },
  step: { minHeight: 50, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  stepText: { fontSize: 14, fontWeight: '700' },
});
