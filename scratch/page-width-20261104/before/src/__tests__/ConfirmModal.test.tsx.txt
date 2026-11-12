import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ConfirmModal from '../components/ConfirmModal';

jest.mock('../hooks/useThemeColor', () => ({
  useThemeColor: () => ({
    colors: {
      primary: '#F62459',
      danger: '#EF4444',
      bgApp: '#FFFFFF',
      card: '#FFFFFF',
      border: '#E2E8F0',
      textDark: '#0B132B',
      textGray: '#64748B',
      bgGray: '#F1F5F9',
    },
    isDark: false,
  }),
}));

describe('ConfirmModal', () => {
  it('renders modal with title, message, and action buttons', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();

    const res: any = await render(
      <ConfirmModal
        visible={true}
        title="Sign Out of Your Account?"
        message="Are you sure you want to sign out?"
        confirmLabel="Yes, Sign Out"
        cancelLabel="Stay Signed In"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(res.getByText('Sign Out of Your Account?')).toBeTruthy();
    expect(res.getByText('Are you sure you want to sign out?')).toBeTruthy();
    expect(res.getByTestId('confirm-modal-cancel')).toBeTruthy();
    expect(res.getByTestId('confirm-modal-submit')).toBeTruthy();
  });

  it('renders Stay Signed In as primary CTA when primaryButton is cancel', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();

    const res: any = await render(
      <ConfirmModal
        visible={true}
        title="Sign Out of Your Account?"
        message="Are you sure you want to sign out?"
        confirmLabel="Yes, Sign Out"
        cancelLabel="Stay Signed In"
        primaryButton="cancel"
        buttonLayout="vertical"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const cancelBtn = res.getByTestId('confirm-modal-cancel');
    const confirmBtn = res.getByTestId('confirm-modal-submit');

    // "Stay Signed In" (Cancel) has primary brand color background
    const cancelStyle = Array.isArray(cancelBtn.props.style)
      ? Object.assign({}, ...cancelBtn.props.style.flat(Infinity))
      : cancelBtn.props.style;
    expect(cancelStyle.backgroundColor).toBe('#F62459');

    // "Yes, Sign Out" (Confirm) has muted neutral background (less stand out)
    const confirmStyle = Array.isArray(confirmBtn.props.style)
      ? Object.assign({}, ...confirmBtn.props.style.flat(Infinity))
      : confirmBtn.props.style;
    expect(confirmStyle.backgroundColor).toBe('#F1F5F9');

    // Tapping Stay Signed In triggers onCancel
    await fireEvent.press(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);

    // Tapping Yes, Sign Out triggers onConfirm
    await fireEvent.press(confirmBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('keeps confirm button as primary by default for other confirmation dialogs', async () => {
    const res: any = await render(
      <ConfirmModal
        visible={true}
        title="Discard Changes?"
        message="Are you sure?"
        confirmLabel="Discard & Exit"
        cancelLabel="Keep Editing"
        destructive={true}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    const confirmBtn = res.getByTestId('confirm-modal-submit');
    const cancelBtn = res.getByTestId('confirm-modal-cancel');

    const confirmStyle = Array.isArray(confirmBtn.props.style)
      ? Object.assign({}, ...confirmBtn.props.style.flat(Infinity))
      : confirmBtn.props.style;
    expect(confirmStyle.backgroundColor).toBe('#EF4444');

    const cancelStyle = Array.isArray(cancelBtn.props.style)
      ? Object.assign({}, ...cancelBtn.props.style.flat(Infinity))
      : cancelBtn.props.style;
    expect(cancelStyle.backgroundColor).toBe('#F1F5F9');
  });

  it('renders single-button alert mode correctly without cancel button', async () => {
    const onConfirm = jest.fn();

    const res: any = await render(
      <ConfirmModal
        visible={true}
        title="Validation Error"
        message="Please enter a valid label."
        singleButton={true}
        variant="warning"
        icon="warning"
        onConfirm={onConfirm}
      />
    );

    expect(res.getByText('Validation Error')).toBeTruthy();
    expect(res.getByText('Please enter a valid label.')).toBeTruthy();
    expect(res.getByText('OK')).toBeTruthy();
    expect(res.queryByTestId('confirm-modal-cancel')).toBeNull();
    expect(res.getByTestId('confirm-modal-submit')).toBeTruthy();

    await fireEvent.press(res.getByTestId('confirm-modal-submit'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
