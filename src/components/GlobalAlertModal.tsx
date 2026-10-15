import React, { useEffect, useState } from 'react';
import ConfirmModal from './ConfirmModal';
import { AppAlertConfig, registerAlertListener } from '../services/alertModal';

/**
 * GlobalAlertModal
 *
 * Sits at the root level in AppNavigator. Listens for global alert/confirm
 * triggers invoked via `showAppAlert()` or `showAppConfirm()`.
 *
 * Completely replaces unstyled OS `Alert.alert` dialogs across the app
 * with our branded, dark-mode aware, tactile Material 3 dialogs.
 */
export default function GlobalAlertModal() {
  const [alertConfig, setAlertConfig] = useState<AppAlertConfig | null>(null);

  useEffect(() => {
    const unregister = registerAlertListener((newConfig) => {
      setAlertConfig(newConfig);
    });
    return unregister;
  }, []);

  if (!alertConfig) {
    return null;
  }

  return (
    <ConfirmModal
      visible={alertConfig.visible}
      title={alertConfig.title}
      message={alertConfig.message}
      confirmLabel={alertConfig.confirmLabel}
      cancelLabel={alertConfig.cancelLabel}
      destructive={alertConfig.destructive}
      singleButton={alertConfig.singleButton}
      variant={alertConfig.variant}
      icon={alertConfig.icon}
      primaryButton={alertConfig.primaryButton}
      buttonLayout={alertConfig.buttonLayout}
      onConfirm={() => {
        const handler = alertConfig.onConfirm;
        setAlertConfig(null);
        handler?.();
      }}
      onCancel={() => {
        const handler = alertConfig.onCancel;
        setAlertConfig(null);
        handler?.();
      }}
      testID="global-alert-modal"
    />
  );
}
