import { BottomSheetModal, BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useImperativeHandle, useRef, type ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { hitSlopFor } from '@/lib/touchTarget';
import { useThemeTokens } from '@/state/themeStore';
import { useI18n } from '@/i18n';
import { renderSheetBackdrop } from '@/components/overlays/SheetBackdrop';

export interface SettingsChildSheetHandle {
  present: () => void;
  dismiss: () => void;
}

interface SettingsChildSheetProps {
  title: string;
  /** Present it and the header left-aligns, since a centred two-line block reads as adrift. */
  subtitle?: string;
  /** Sits where the back button's counterweight would be, keeping the title centred. */
  headerRight?: ReactNode;
  /** Omit to size the sheet to its content. */
  snapPoints?: string[];
  scrollable?: boolean;
  children: ReactNode;
}

/**
 * The back button and the slot facing it across the title are one number, so a sheet that puts
 * something real in that slot starts from the same width the empty spacer has rather than
 * guessing at one. Exported for those sheets to floor their own content with.
 */
export const HEADER_SLOT_WIDTH = 36;
const BACK_BUTTON_HIT_SLOP = hitSlopFor({ width: HEADER_SLOT_WIDTH, height: HEADER_SLOT_WIDTH });

/**
 * Everything Settings opens — themes, achievements, language, the privacy policy — is the
 * same sheet with different contents: a back arrow that returns to Settings, a centred
 * title, and a body. That shell was copied into all four, so a change to the header meant
 * four edits and three chances to miss one.
 *
 * Dismissing is all the back arrow does: the modal provider's 'switch' stack behaviour
 * restores the settings sheet underneath on its own.
 */
export const SettingsChildSheet = forwardRef<SettingsChildSheetHandle, SettingsChildSheetProps>(
  function SettingsChildSheet({ title, subtitle, headerRight, snapPoints, scrollable = false, children }, ref) {
    const sheetRef = useRef<BottomSheetModal>(null);
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const theme = useThemeTokens();
    const { t } = useI18n();

    useImperativeHandle(ref, () => ({
      present: () => sheetRef.current?.present(),
      dismiss: () => sheetRef.current?.dismiss(),
    }));

    const Body = scrollable ? BottomSheetScrollView : BottomSheetView;

    return (
      <BottomSheetModal
        backdropComponent={renderSheetBackdrop}
        ref={sheetRef}
        snapPoints={snapPoints}
        enableDynamicSizing={!snapPoints}
        // Same reasoning as the settings sheet: a sheet sized to its own content has nothing
        // stopping it from reaching the notch, and the language and privacy sheets both grow
        // with their translations.
        topInset={insets.top + 12}
        maxDynamicContentSize={height - insets.top - 24}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: theme.bg }}
        handleIndicatorStyle={{ backgroundColor: theme.gridSep }}
      >
        <Body
          style={scrollable ? undefined : [styles.content, { paddingBottom: insets.bottom + 34 }]}
          contentContainerStyle={scrollable ? [styles.content, { paddingBottom: insets.bottom + 34 }] : undefined}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <AnimatedPressable
              accessibilityRole="button"
              feedback="icon"
              style={[styles.backButton, { borderColor: theme.gridSep }]}
              hitSlop={BACK_BUTTON_HIT_SLOP}
              onPress={() => sheetRef.current?.dismiss()}
              accessibilityLabel={t('a11y.backToSettings')}
            >
              <ArrowLeft size={18} color={theme.text} strokeWidth={2.3} />
            </AnimatedPressable>
            {subtitle ? (
              <View style={styles.headerCopy}>
                <Text style={[styles.titleLeading, { color: theme.text }]}>{title}</Text>
                <Text style={[styles.subtitle, { color: theme.sub }]}>{subtitle}</Text>
              </View>
            ) : (
              <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
            )}
            {headerRight ?? <View style={styles.headerSpacer} />}
          </View>

          {children}
        </Body>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  backButton: { minWidth: HEADER_SLOT_WIDTH, minHeight: HEADER_SLOT_WIDTH, borderWidth: 1.5, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title: { flexShrink: 1, minWidth: 0, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  headerCopy: { flex: 1, minWidth: 0 },
  titleLeading: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 12, fontWeight: '600', marginTop: 3 },
  headerSpacer: { width: HEADER_SLOT_WIDTH, flexShrink: 0 },
});
