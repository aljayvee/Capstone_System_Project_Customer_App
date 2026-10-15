import React from 'react';
import { Linking } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import LegalDocumentScreen from '../screens/LegalDocumentScreen';
import {
  LEGAL_CONTACT,
  LEGAL_DOCUMENTS,
  LEGAL_EFFECTIVE_DATE,
  PRIVACY_POLICY,
  TERMS_OF_SERVICE,
  type LegalDocument,
} from '../constants/legalDocuments';

jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }: any) => children,
    SafeAreaView: ({ children }: any) => children,
    useSafeAreaInsets: () => inset,
  };
});

jest.mock('../hooks/useThemeColor', () => ({
  useThemeColor: () => ({
    colors: {
      primary: '#F62459',
      bgApp: '#F6F7F8',
      card: '#FFFFFF',
      textDark: '#1F2937',
      textMedium: '#374151',
      textGray: '#6B7280',
      textLight: '#646B76',
      border: '#E5E7EB',
    },
    isDark: false,
  }),
}));

function allText(doc: LegalDocument): string[] {
  const out: string[] = [doc.title, doc.summary];
  for (const sec of doc.sections) {
    out.push(sec.title);
    for (const block of sec.blocks) {
      if (block.kind === 'list') block.items.forEach((i) => out.push(i.lead ?? '', i.text));
      else out.push(block.lead ?? '', block.text);
    }
  }
  return out;
}

describe('legal document content', () => {
  it.each([TERMS_OF_SERVICE, PRIVACY_POLICY])('$title has no em or en dashes', (doc) => {
    for (const text of allText(doc)) expect(text).not.toMatch(/[–—]/);
  });

  it.each([TERMS_OF_SERVICE, PRIVACY_POLICY])('$title has unique section ids', (doc) => {
    const ids = doc.sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('names the contact address correctly', () => {
    // It was once published one "e" short, so privacy requests went nowhere.
    expect(LEGAL_CONTACT.email).toBe('aljayveeversola@gmail.com');
  });

  it('describes the payment methods customers can actually choose', () => {
    const payment = TERMS_OF_SERVICE.sections.find((s) => s.id === 'payment')!;
    const text = JSON.stringify(payment);
    expect(text).toContain('cash on delivery');
    expect(text).toContain('GCash or Maya');
    expect(text).toContain('bank transfer');
    expect(text).toContain('Card payments are not available');
  });

  it('keeps the retention figures the system enforces', () => {
    const retention = JSON.stringify(PRIVACY_POLICY.sections.find((s) => s.id === 'retention'));
    expect(retention).toContain('30 days'); // REFRESH_SESSION_TTL_MS
    expect(retention).toContain('7 days'); // sysAdminBackupService RETENTION_DAYS
  });
});

describe('LegalDocumentScreen', () => {
  const navigation = { goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders every section of the Terms of Service, numbered, with the effective date', async () => {
    const res: any = await render(
      <LegalDocumentScreen navigation={navigation} route={{ params: { doc: 'terms' } }} />
    );

    expect(res.getByText('Terms of Service')).toBeTruthy();
    expect(res.getByText(`Effective ${LEGAL_EFFECTIVE_DATE}`)).toBeTruthy();
    TERMS_OF_SERVICE.sections.forEach((sec, i) => {
      expect(res.getByText(`${i + 1}. ${sec.title}`)).toBeTruthy();
      expect(res.getByTestId(`legal-contents-${sec.id}`)).toBeTruthy();
    });
  });

  it('renders the Privacy Policy, including the National Privacy Commission complaint route', async () => {
    const res: any = await render(
      <LegalDocumentScreen navigation={navigation} route={{ params: { doc: 'privacy' } }} />
    );

    expect(res.getByTestId('legal-document-privacy')).toBeTruthy();
    PRIVACY_POLICY.sections.forEach((sec, i) => {
      expect(res.getByText(`${i + 1}. ${sec.title}`)).toBeTruthy();
    });
    expect(res.getByText(/privacy\.gov\.ph/)).toBeTruthy();
  });

  it('opens the mail app on the contact address', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValueOnce(true);
    const res: any = await render(
      <LegalDocumentScreen navigation={navigation} route={{ params: { doc: 'privacy' } }} />
    );

    fireEvent.press(res.getByTestId('legal-email'));
    expect(openURL).toHaveBeenCalledWith(`mailto:${LEGAL_CONTACT.email}`);
  });

  it('switches to the other document in place', async () => {
    const res: any = await render(
      <LegalDocumentScreen navigation={navigation} route={{ params: { doc: 'terms' } }} />
    );

    fireEvent.press(res.getByTestId('legal-open-privacy'));
    expect(navigation.replace).toHaveBeenCalledWith('LegalDocument', { doc: 'privacy' });
  });

  it('jumps to a section from the contents without throwing', async () => {
    const res: any = await render(
      <LegalDocumentScreen navigation={navigation} route={{ params: { doc: 'terms' } }} />
    );

    expect(() => fireEvent.press(res.getByTestId('legal-contents-payment'))).not.toThrow();
  });

  it('goes back from the header', async () => {
    const res: any = await render(
      <LegalDocumentScreen navigation={navigation} route={{ params: { doc: 'terms' } }} />
    );

    fireEvent.press(res.getByTestId('legal-back-button'));
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('explains and offers a way back when the document is unknown', async () => {
    const res: any = await render(
      <LegalDocumentScreen navigation={navigation} route={{ params: { doc: 'cookies' } }} />
    );

    expect(res.getByTestId('legal-document-missing')).toBeTruthy();
    expect(res.getByText('This document could not be opened')).toBeTruthy();
    fireEvent.press(res.getByText('Go back'));
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('exposes exactly the two documents', () => {
    expect(Object.keys(LEGAL_DOCUMENTS).sort()).toEqual(['privacy', 'terms']);
  });
});
