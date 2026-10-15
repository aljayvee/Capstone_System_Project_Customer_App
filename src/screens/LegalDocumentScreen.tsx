import React, { useRef } from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Mail } from 'lucide-react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import {
  BorderRadius,
  FontFamily,
  MAX_CONTENT_WIDTH,
  PortalFontSizeMultipliers,
  PortalFontSizes,
  PortalTouchTargets,
  Spacing,
  getPortalLineHeight,
  scaledPortalFontSize,
} from '../config/theme';
import {
  LEGAL_CONTACT,
  LEGAL_DOCUMENTS,
  LEGAL_EFFECTIVE_DATE,
  type LegalBlock,
  type LegalDocumentId,
} from '../constants/legalDocuments';

/**
 * The Terms of Service or the Privacy Policy, full screen.
 *
 * Opened from the consent line on the onboarding screen (signed out) and from
 * Settings (signed in). The words come from constants/legalDocuments.ts, the
 * same file the portal's /terms and /privacy pages render, so the app and the
 * website never show two different versions.
 */

const BODY_SIZE = scaledPortalFontSize(PortalFontSizes.body);
const BODY_LINE = getPortalLineHeight(BODY_SIZE, 'body');
const HEADING_SIZE = scaledPortalFontSize(PortalFontSizes.subheading);

export default function LegalDocumentScreen({ route, navigation }: any) {
  const { colors } = useThemeColor();
  const scrollRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef<Record<string, number>>({});

  const docId: LegalDocumentId | undefined = route?.params?.doc;
  const doc = docId ? LEGAL_DOCUMENTS[docId] : undefined;

  const header = (
    <View style={styles.navHeaderRow}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        hitSlop={PortalTouchTargets.compactHitSlop}
        style={styles.backBtn}
        testID="legal-back-button"
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <ChevronLeft size={22} color={colors.textDark} />
      </TouchableOpacity>
      <Text
        style={[styles.navTitle, { color: colors.textDark }]}
        numberOfLines={1}
        maxFontSizeMultiplier={PortalFontSizeMultipliers.title}
        accessibilityRole="header"
      >
        {doc?.title ?? 'Legal'}
      </Text>
      <View style={styles.backBtn} />
    </View>
  );

  // A doc id this build does not know (an old deep link, a typo in a caller):
  // say so and offer the way back, rather than an empty page.
  if (!doc) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bgApp }]} edges={['top', 'bottom']}>
        {header}
        <View style={styles.errorWrap} testID="legal-document-missing">
          <Text style={[styles.errorTitle, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.title}>
            This document could not be opened
          </Text>
          <Text style={[styles.body, { color: colors.textMedium, textAlign: 'center' }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
            Go back and choose Terms of Service or Privacy Policy again.
          </Text>
          <TouchableOpacity
            style={[styles.errorBtn, { backgroundColor: colors.primary }]}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
          >
            <Text style={styles.errorBtnText} maxFontSizeMultiplier={PortalFontSizeMultipliers.button}>
              Go back
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const otherDocId: LegalDocumentId = doc.id === 'terms' ? 'privacy' : 'terms';
  const otherDoc = LEGAL_DOCUMENTS[otherDocId];

  const jumpTo = (sectionId: string) => {
    const y = sectionOffsets.current[sectionId];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - Spacing.md), animated: true });
  };

  const openEmail = () => {
    Linking.openURL(`mailto:${LEGAL_CONTACT.email}`).catch(() => {
      // No mail app: the address stays on screen and is selectable.
    });
  };

  const renderLead = (lead?: string) =>
    lead ? <Text style={[styles.lead, { color: colors.textDark }]}>{lead} </Text> : null;

  const renderBlock = (block: LegalBlock, key: number) => {
    if (block.kind === 'list') {
      return (
        <View key={key} style={styles.list}>
          {block.items.map((item, i) => (
            <View key={i} style={styles.listRow}>
              <View style={[styles.bullet, { backgroundColor: colors.textLight }]} />
              <Text style={[styles.body, styles.listText, { color: colors.textMedium }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
                {renderLead(item.lead)}
                {item.text}
              </Text>
            </View>
          ))}
        </View>
      );
    }
    if (block.kind === 'note') {
      return (
        <View key={key} style={[styles.note, { borderLeftColor: colors.primary }]}>
          <Text style={[styles.body, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
            {renderLead(block.lead)}
            {block.text}
          </Text>
        </View>
      );
    }
    return (
      <Text key={key} style={[styles.body, { color: colors.textMedium }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
        {renderLead(block.lead)}
        {block.text}
      </Text>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bgApp }]} edges={['top', 'bottom']}>
      {header}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        testID={`legal-document-${doc.id}`}
      >
        <View style={styles.inner}>
          <Text style={[styles.meta, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
            Effective {LEGAL_EFFECTIVE_DATE}
          </Text>
          <Text style={[styles.body, { color: colors.textMedium }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
            {doc.summary}
          </Text>

          {/* Contents: a long document on a small screen needs a way in. */}
          <View style={[styles.contents, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.contentsTitle, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
              Contents
            </Text>
            {doc.sections.map((sec, i) => (
              <TouchableOpacity
                key={sec.id}
                onPress={() => jumpTo(sec.id)}
                style={styles.contentsRow}
                accessibilityRole="link"
                accessibilityLabel={`Go to section ${i + 1}, ${sec.title}`}
                testID={`legal-contents-${sec.id}`}
              >
                <Text style={[styles.contentsNumber, { color: colors.primary }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
                  {i + 1}
                </Text>
                <Text style={[styles.contentsLabel, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
                  {sec.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {doc.sections.map((sec, i) => (
            <View
              key={sec.id}
              style={styles.section}
              onLayout={(e) => {
                sectionOffsets.current[sec.id] = e.nativeEvent.layout.y;
              }}
            >
              <Text
                style={[styles.sectionTitle, { color: colors.textDark }]}
                maxFontSizeMultiplier={PortalFontSizeMultipliers.card}
                accessibilityRole="header"
              >
                <Text style={{ color: colors.primary }}>{i + 1}. </Text>
                {sec.title}
              </Text>
              {sec.blocks.map(renderBlock)}
            </View>
          ))}

          <View style={[styles.contactCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.lead, styles.body, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.card}>
              {LEGAL_CONTACT.organization}
            </Text>
            <Text style={[styles.body, { color: colors.textMedium }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
              {LEGAL_CONTACT.location}
            </Text>
            <TouchableOpacity
              onPress={openEmail}
              style={styles.emailRow}
              accessibilityRole="link"
              accessibilityLabel={`Email ${LEGAL_CONTACT.email}`}
              testID="legal-email"
            >
              <Mail size={16} color={colors.primary} />
              <Text selectable style={[styles.body, styles.emailText, { color: colors.primary }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
                {LEGAL_CONTACT.email}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => navigation.replace('LegalDocument', { doc: otherDocId })}
            style={[styles.otherDocRow, { borderColor: colors.border }]}
            accessibilityRole="link"
            testID={`legal-open-${otherDocId}`}
          >
            <Text style={[styles.body, { color: colors.textDark, flex: 1 }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
              Read the {otherDoc.title}
            </Text>
            <ChevronRight size={18} color={colors.textLight} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  navHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  backBtn: {
    width: PortalTouchTargets.compact,
    height: PortalTouchTargets.compact,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(17),
    lineHeight: getPortalLineHeight(17, 'heading'),
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxl,
  },
  inner: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    gap: Spacing.md,
  },
  meta: {
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
  },
  body: {
    fontFamily: FontFamily.regular,
    fontSize: BODY_SIZE,
    lineHeight: BODY_LINE,
  },
  lead: {
    fontFamily: FontFamily.bold,
  },
  contents: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
  },
  contentsTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingVertical: Spacing.xs,
  },
  contentsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: PortalTouchTargets.compact,
    gap: Spacing.sm,
  },
  contentsNumber: {
    width: 22,
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    fontVariant: ['tabular-nums'],
  },
  contentsLabel: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: BODY_SIZE,
  },
  section: {
    gap: Spacing.sm,
    paddingTop: Spacing.lg,
  },
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: HEADING_SIZE,
    lineHeight: getPortalLineHeight(HEADING_SIZE, 'heading'),
    marginBottom: 2,
  },
  list: {
    gap: Spacing.sm,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: BODY_LINE / 2 - 2.5,
    marginRight: Spacing.sm,
  },
  listText: {
    flex: 1,
  },
  note: {
    borderLeftWidth: 3,
    paddingLeft: Spacing.md,
    paddingVertical: 2,
  },
  contactCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: 4,
    marginTop: Spacing.sm,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: PortalTouchTargets.compact,
  },
  emailText: {
    fontFamily: FontFamily.bold,
  },
  otherDocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: PortalTouchTargets.min,
    borderTopWidth: 1,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  errorTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
    textAlign: 'center',
  },
  errorBtn: {
    minHeight: PortalTouchTargets.buttonHeight,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBtnText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
  },
});
