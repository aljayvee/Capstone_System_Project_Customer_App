import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { ShieldAlert, ArrowLeft } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { PortalFontSizeMultipliers, PortalFontSizes, scaledPortalFontSize, getPortalLineHeight, FontFamily, Spacing } from '../config/theme';

interface AccessRestrictedModalProps {
  visible: boolean;
  title?: string;
  message?: string;
  onDismiss: () => void;
}

export const AccessRestrictedModal: React.FC<AccessRestrictedModalProps> = ({
  visible,
  title = "You can't open this",
  message = 'This part of Sugo is not available on your account.',
  onDismiss,
}) => {
  const { colors } = useTheme();

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.iconBox, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}>
            <ShieldAlert size={28} color={colors.danger} />
          </View>

          <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.title, { color: colors.textDark }]}>{title}</Text>
          <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.message, { color: colors.textGray }]}>{message}</Text>

          <TouchableOpacity
            onPress={onDismiss}
            style={[styles.button, { backgroundColor: colors.primary }]}
          >
            <ArrowLeft size={16} color={colors.onPrimary} />
            <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.buttonText, { color: colors.onPrimary }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconBox: {
    width: 54,
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  title: {
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.title), 'heading'),
    fontSize: scaledPortalFontSize(PortalFontSizes.title),
    fontFamily: FontFamily.bold,
    textAlign: 'center',
  },
  message: {
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    fontFamily: FontFamily.regular,
    textAlign: 'center',
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.body), 'body'),
  },
  button: {
    width: '100%',
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: Spacing.xs,
  },
  buttonText: {
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.body), 'body'),
    color: '#FFFFFF',
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    fontFamily: FontFamily.bold,
  },
});

export default AccessRestrictedModal;
