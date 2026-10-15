import { ModalIcon, ModalVariant } from '../components/ConfirmModal';

export interface AppAlertButton {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AppAlertConfig {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  singleButton?: boolean;
  variant?: ModalVariant;
  icon?: ModalIcon;
  primaryButton?: 'confirm' | 'cancel';
  buttonLayout?: 'horizontal' | 'vertical';
  onConfirm?: () => void;
  onCancel?: () => void;
}

export type ShowConfirmOptions = Omit<AppAlertConfig, 'visible'>;

type AlertListener = (config: AppAlertConfig | null) => void;

let currentListener: AlertListener | null = null;

export function registerAlertListener(listener: AlertListener) {
  currentListener = listener;
  return () => {
    if (currentListener === listener) {
      currentListener = null;
    }
  };
}

export function hideAppAlert() {
  if (currentListener) {
    currentListener(null);
  }
}

/**
 * Universal custom alert for SUGO Customer App.
 *
 * Supports:
 * 1. showAppAlert(title, message?, onConfirm?)
 * 2. showAppAlert(title, message?, buttons?)
 * 3. showAppAlert(optionsObject)
 */
export function showAppAlert(
  titleOrOptions: string | ShowConfirmOptions,
  message?: string,
  buttonsOrOnDismiss?: AppAlertButton[] | (() => void)
) {
  if (typeof titleOrOptions === 'object') {
    const config: AppAlertConfig = {
      ...titleOrOptions,
      visible: true,
      singleButton: titleOrOptions.singleButton ?? true,
      variant: titleOrOptions.variant ?? 'info',
      confirmLabel: titleOrOptions.confirmLabel ?? 'OK',
    };
    currentListener?.(config);
    return;
  }

  const title = titleOrOptions;
  const msg = message ?? '';

  if (typeof buttonsOrOnDismiss === 'function') {
    const config: AppAlertConfig = {
      visible: true,
      title,
      message: msg,
      singleButton: true,
      confirmLabel: 'OK',
      variant: 'info',
      onConfirm: () => {
        hideAppAlert();
        buttonsOrOnDismiss();
      },
      onCancel: () => {
        hideAppAlert();
      },
    };
    currentListener?.(config);
    return;
  }

  const buttons = Array.isArray(buttonsOrOnDismiss) ? buttonsOrOnDismiss : [];

  if (buttons.length <= 1) {
    const btn = buttons[0];
    const isDestructive = btn?.style === 'destructive';
    const config: AppAlertConfig = {
      visible: true,
      title,
      message: msg,
      singleButton: true,
      confirmLabel: btn?.text || 'OK',
      variant: isDestructive ? 'error' : 'info',
      destructive: isDestructive,
      onConfirm: () => {
        hideAppAlert();
        btn?.onPress?.();
      },
      onCancel: () => {
        hideAppAlert();
      },
    };
    currentListener?.(config);
    return;
  }

  // 2 or more buttons: map to confirmation dialog
  const cancelBtn = buttons.find((b) => b.style === 'cancel') || buttons[0];
  const confirmBtn =
    buttons.find((b) => b !== cancelBtn && b.style === 'destructive') ||
    buttons.find((b) => b !== cancelBtn) ||
    buttons[1];

  const isDestructive = confirmBtn?.style === 'destructive';

  const config: AppAlertConfig = {
    visible: true,
    title,
    message: msg,
    singleButton: false,
    variant: isDestructive ? 'confirm' : 'info',
    destructive: isDestructive,
    icon: isDestructive ? 'trash' : 'info',
    cancelLabel: cancelBtn?.text || 'Cancel',
    confirmLabel: confirmBtn?.text || 'Confirm',
    onCancel: () => {
      hideAppAlert();
      cancelBtn?.onPress?.();
    },
    onConfirm: () => {
      hideAppAlert();
      confirmBtn?.onPress?.();
    },
  };
  currentListener?.(config);
}

/**
 * Convenience helper for two-button confirmation dialogs.
 */
export function showAppConfirm(options: ShowConfirmOptions) {
  const isDestructive = options.destructive ?? false;
  const config: AppAlertConfig = {
    ...options,
    visible: true,
    singleButton: false,
    variant: options.variant ?? (isDestructive ? 'confirm' : 'info'),
    icon: options.icon ?? (isDestructive ? 'trash' : null),
    confirmLabel: options.confirmLabel ?? (isDestructive ? 'Delete' : 'Confirm'),
    cancelLabel: options.cancelLabel ?? 'Cancel',
    onConfirm: () => {
      hideAppAlert();
      options.onConfirm?.();
    },
    onCancel: () => {
      hideAppAlert();
      options.onCancel?.();
    },
  };
  currentListener?.(config);
}
