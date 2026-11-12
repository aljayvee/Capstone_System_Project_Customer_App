import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CalendarDays, PhoneOff, ShieldAlert } from 'lucide-react-native';
import { useThemeColor } from '../../hooks/useThemeColor';
import { apiClient } from '../../services/apiClient';
import { verifyPhoneBySms } from '../../services/phoneVerification';
import { toUserMessage } from '../../services/errorMessages';
import { showAppAlert } from '../../services/alertModal';
import {
  BorderRadius,
  FontFamily,
  PortalFontSizeMultipliers,
  PortalFontSizes,
  PortalTouchTargets,
  Spacing,
  getPortalLineHeight,
  scaledPortalFontSize,
} from '../../config/theme';

/** What the customer's profile is missing, most urgent first. */
export type AccountReminderKind = 'add-phone' | 'verify-phone' | 'add-birthdate';

export interface ReminderProfile {
  phone?: string | null;
  phoneVerified?: boolean;
  birthdate?: string | null;
  signUpMethod?: 'password' | 'google';
  googleId?: string | null;
}

/**
 * The one reminder Home shows, or null when the profile is complete.
 *
 *  1. No mobile number, whoever the customer is: riders call it at the door.
 *  2. A manual sign-up with the number unverified: verify it by SMS.
 *  3. A Google sign-up with no birthdate: Google does not give one.
 *
 * One at a time, so the next appears once the first is done. A server from
 * before 2026-10-09 sends no signUpMethod; a Google id stands in for it, which
 * misreads only a manual account that later linked Google.
 */
export function accountReminderFor(profile: ReminderProfile | null): AccountReminderKind | null {
  if (!profile) return null;
  if (!String(profile.phone ?? '').trim()) return 'add-phone';
  const method = profile.signUpMethod ?? (profile.googleId ? 'google' : 'password');
  if (method === 'password') return profile.phoneVerified ? null : 'verify-phone';
  return profile.birthdate ? null : 'add-birthdate';
}

const COPY: Record<AccountReminderKind, { message: string; action: string; Icon: any; tone: 'danger' | 'warning' }> = {
  'add-phone': {
    message: 'You did not provide a mobile number. Provide immediately!',
    action: 'Add mobile number',
    Icon: PhoneOff,
    tone: 'danger',
  },
  'verify-phone': {
    message: 'Your Mobile Number is not verified yet. Want to verify it?',
    action: 'Verify now',
    Icon: ShieldAlert,
    tone: 'warning',
  },
  'add-birthdate': {
    message: 'You did not provide your birthdate! Provide it now!',
    action: 'Add birthdate',
    Icon: CalendarDays,
    tone: 'warning',
  },
};

interface AccountReminderProps {
  user: any;
  navigation: { navigate: (screen: any, params?: any) => void; addListener?: (event: any, cb: () => void) => () => void };
}

/**
 * A reminder card on the Home tab for what the customer's account is missing
 * (2026-10-09). Reads the profile fresh, on mount and each time Home comes back
 * into view, so finishing the fix in Edit Account clears the card at once.
 * Shows nothing while loading or if the profile cannot be read: a reminder is
 * never worth a spinner or an error on Home.
 */
export default function AccountReminder({ user, navigation }: AccountReminderProps) {
  const { colors, isDark } = useThemeColor();
  const [profile, setProfile] = useState<(ReminderProfile & Record<string, any>) | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const customerId = user?.id;

  const load = useCallback(() => {
    if (customerId === undefined || customerId === null) return;
    apiClient
      .get(`/customers/${customerId}`)
      .then((res) => {
        const data = res?.data;
        setProfile(data && typeof data === 'object' && !Array.isArray(data) ? data : null);
      })
      .catch(() => {
        // Keep what was shown; nothing to tell the customer about here.
      });
  }, [customerId]);

  useEffect(() => {
    load();
    return navigation.addListener?.('focus', load);
  }, [load, navigation]);

  const kind = accountReminderFor(profile);
  if (!kind) return null;
  const copy = COPY[kind];
  const accent = copy.tone === 'danger' ? colors.danger : colors.warning;
  const surface =
    copy.tone === 'danger'
      ? { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2', borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : '#FECACA' }
      : { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#FFFBEB', borderColor: isDark ? 'rgba(245, 158, 11, 0.35)' : '#FDE68A' };

  const openEditAccount = (focusField: 'phone' | 'birthdate') =>
    navigation.navigate('EditAccount', { user: { ...user, ...profile }, focusField });

  const verify = async () => {
    setError(null);
    setVerifying(true);
    const result = await verifyPhoneBySms(String(profile?.phone ?? ''));
    setVerifying(false);
    if (result.status === 'verified' && result.confirmed) {
      showAppAlert({ title: 'Mobile number verified', message: 'Thank you. Your rider can now reach you on this number.', variant: 'success' });
      load();
    } else if (result.status === 'verified' || result.status === 'failed') {
      // Verified by SMS but not recorded, or not verified at all: say so and keep the card.
      setError(toUserMessage(result.error, 'profile'));
    }
  };

  const onPress = () => {
    if (kind === 'add-phone') openEditAccount('phone');
    else if (kind === 'add-birthdate') openEditAccount('birthdate');
    else void verify();
  };

  return (
    <View style={[styles.card, surface]} testID={`account-reminder-${kind}`} accessibilityRole="alert">
      <View style={styles.row}>
        <View style={[styles.iconBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF' }]}>
          <copy.Icon size={18} color={accent} strokeWidth={2.2} />
        </View>
        <Text style={[styles.message, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
          {copy.message}
        </Text>
      </View>
      {error ? (
        <Text style={[styles.error, { color: colors.danger }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption} testID="account-reminder-error">
          {error}
        </Text>
      ) : null}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: copy.tone === 'danger' ? colors.danger : colors.primary }, verifying && styles.busy]}
        onPress={onPress}
        disabled={verifying}
        hitSlop={PortalTouchTargets.compactHitSlop}
        accessibilityRole="button"
        accessibilityLabel={copy.action}
        testID="account-reminder-action"
      >
        {verifying ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
        <Text style={styles.buttonText} maxFontSizeMultiplier={PortalFontSizeMultipliers.button}>
          {verifying ? 'Verifying' : copy.action}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm + 4,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    flex: 1,
    fontFamily: FontFamily.semibold,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    lineHeight: getPortalLineHeight(PortalFontSizes.body, 1.35),
  },
  error: {
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
  },
  button: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    minHeight: PortalTouchTargets.pillHeight,
  },
  busy: {
    opacity: 0.75,
  },
  buttonText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
  },
});
