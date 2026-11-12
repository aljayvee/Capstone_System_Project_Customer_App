import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../services/apiClient';
import { verifyPhoneBySms } from '../services/phoneVerification';
import { showAppAlert } from '../services/alertModal';
import AccountReminder, { accountReminderFor } from '../components/home/AccountReminder';
import LocationRequiredSpotlight from '../components/home/LocationRequiredSpotlight';

/**
 * Home's account reminders and the new-customer location spotlight
 * (2026-10-09).
 */

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('../services/apiClient', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

jest.mock('../services/phoneVerification', () => ({
  verifyPhoneBySms: jest.fn(),
}));

jest.mock('../services/alertModal', () => ({
  showAppAlert: jest.fn(),
}));

const user = { id: 4, username: 'maria', firstName: 'Maria' };
const profile = (over: Record<string, any> = {}) => ({
  id: 4,
  firstName: 'Maria',
  phone: '+639171234567',
  phoneVerified: false,
  birthdate: '1999-02-03',
  signUpMethod: 'password' as 'password' | 'google' | undefined,
  ...over,
});

beforeEach(() => jest.clearAllMocks());

describe('which reminder Home shows', () => {
  it('asks everyone without a mobile number for one, first', () => {
    expect(accountReminderFor(profile({ phone: '' }))).toBe('add-phone');
    expect(accountReminderFor(profile({ phone: '', signUpMethod: 'google', birthdate: null }))).toBe('add-phone');
  });

  it('asks a manual sign-up to verify its number, and nothing once verified', () => {
    expect(accountReminderFor(profile())).toBe('verify-phone');
    expect(accountReminderFor(profile({ phoneVerified: true }))).toBeNull();
    // A manual sign-up is not asked for a birthdate.
    expect(accountReminderFor(profile({ phoneVerified: true, birthdate: null }))).toBeNull();
  });

  it('asks a Google sign-up for its birthdate instead of verifying', () => {
    expect(accountReminderFor(profile({ signUpMethod: 'google', birthdate: null }))).toBe('add-birthdate');
    expect(accountReminderFor(profile({ signUpMethod: 'google' }))).toBeNull();
  });

  it('falls back to the Google id on a server that sends no sign-up method', () => {
    expect(accountReminderFor(profile({ signUpMethod: undefined, googleId: 'g-1', birthdate: null }))).toBe('add-birthdate');
    expect(accountReminderFor(profile({ signUpMethod: undefined }))).toBe('verify-phone');
  });

  it('shows nothing until the profile is known', () => {
    expect(accountReminderFor(null)).toBeNull();
  });
});

describe('the reminder card', () => {
  const navigation = { navigate: jest.fn(), addListener: jest.fn(() => jest.fn()) };
  const draw = async (data: object | null) => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data });
    return render(<AccountReminder user={user} navigation={navigation} />);
  };

  it('sends a customer with no number to Edit Account, pointed at the mobile number', async () => {
    const res: any = await draw(profile({ phone: '' }));
    expect(await res.findByText('You did not provide a mobile number. Provide immediately!')).toBeTruthy();
    expect(apiClient.get).toHaveBeenCalledWith('/customers/4');

    await fireEvent.press(res.getByTestId('account-reminder-action'));
    expect(navigation.navigate).toHaveBeenCalledWith('EditAccount', {
      user: expect.objectContaining({ id: 4, phone: '' }),
      focusField: 'phone',
    });
  });

  it('verifies a manual sign-up by SMS right from Home, then clears', async () => {
    const res: any = await draw(profile());
    expect(await res.findByText('Your Mobile Number is not verified yet. Want to verify it?')).toBeTruthy();
    (verifyPhoneBySms as jest.Mock).mockResolvedValue({ status: 'verified', idToken: 't', confirmed: true });
    (apiClient.get as jest.Mock).mockResolvedValue({ data: profile({ phoneVerified: true }) });

    await fireEvent.press(res.getByTestId('account-reminder-action'));
    expect(verifyPhoneBySms).toHaveBeenCalledWith('+639171234567');
    await waitFor(() => expect(res.queryByTestId('account-reminder-verify-phone')).toBeNull());
    expect(showAppAlert).toHaveBeenCalledWith(expect.objectContaining({ title: 'Mobile number verified' }));
  });

  it('keeps the card and says why when verification fails', async () => {
    const res: any = await draw(profile());
    await res.findByTestId('account-reminder-verify-phone');
    (verifyPhoneBySms as jest.Mock).mockResolvedValue({ status: 'failed', error: new Error('Network Error') });

    await fireEvent.press(res.getByTestId('account-reminder-action'));
    expect(await res.findByTestId('account-reminder-error')).toBeTruthy();
    expect(res.getByTestId('account-reminder-verify-phone')).toBeTruthy();
  });

  it('asks a Google sign-up for its birthdate, opening the date picker', async () => {
    const res: any = await draw(profile({ signUpMethod: 'google', birthdate: null }));
    expect(await res.findByText('You did not provide your birthdate! Provide it now!')).toBeTruthy();
    await fireEvent.press(res.getByTestId('account-reminder-action'));
    expect(navigation.navigate).toHaveBeenCalledWith('EditAccount', expect.objectContaining({ focusField: 'birthdate' }));
  });

  it('shows nothing for a complete profile, or one that cannot be read', async () => {
    const complete: any = await draw(profile({ phoneVerified: true }));
    await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
    expect(complete.queryByTestId(/account-reminder-/)).toBeNull();

    (apiClient.get as jest.Mock).mockRejectedValue(new Error('offline'));
    const failed: any = await render(<AccountReminder user={user} navigation={navigation} />);
    expect(failed.queryByTestId(/account-reminder-/)).toBeNull();
  });

  it('reads the profile again each time Home comes back into view', async () => {
    await draw(profile());
    expect(navigation.addListener).toHaveBeenCalledWith('focus', expect.any(Function));
  });
});

describe('the location spotlight', () => {
  it('rings the location card, explains, and opens Saved Locations from the button or the card', async () => {
    const onSetLocation = jest.fn();
    const res: any = await render(
      <LocationRequiredSpotlight visible target={{ x: 16, y: 120, width: 340, height: 64 }} onSetLocation={onSetLocation} />
    );
    expect(res.getByText('Set your delivery location first')).toBeTruthy();
    await fireEvent.press(res.getByTestId('location-required-set'));
    await fireEvent.press(res.getByTestId('location-required-target'));
    expect(onSetLocation).toHaveBeenCalledTimes(2);
  });

  it('still explains, centred, when the card could not be measured', async () => {
    const res: any = await render(<LocationRequiredSpotlight visible target={null} onSetLocation={jest.fn()} />);
    expect(res.getByTestId('location-required-note')).toBeTruthy();
    expect(res.queryByTestId('location-required-target')).toBeNull();
  });
});
