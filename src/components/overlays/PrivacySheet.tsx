import { forwardRef, useImperativeHandle, useRef } from 'react';
import { PrivacyPolicy } from '@/components/PrivacyPolicy';
import { SettingsChildSheet, type SettingsChildSheetHandle } from '@/components/overlays/SettingsChildSheet';
import { useI18n } from '@/i18n';

export type PrivacySheetHandle = SettingsChildSheetHandle;

export const PrivacySheet = forwardRef<PrivacySheetHandle>(function PrivacySheet(_, ref) {
  const sheetRef = useRef<SettingsChildSheetHandle>(null);
  const { t } = useI18n();

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  return (
    <SettingsChildSheet ref={sheetRef} title={t('privacy.title')} snapPoints={['86%']} scrollable>
      <PrivacyPolicy showTitle={false} />
    </SettingsChildSheet>
  );
});
