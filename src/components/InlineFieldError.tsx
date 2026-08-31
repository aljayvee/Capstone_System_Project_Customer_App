import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { FontSizes, FontFamily } from '../config/theme';

interface InlineFieldErrorProps {
  error?: string | null;
  style?: object;
}

export const InlineFieldError: React.FC<InlineFieldErrorProps> = ({ error, style }) => {
  const { colors } = useTheme();

  if (!error) return null;

  return (
    <View style={[styles.container, style]}>
      <AlertCircle size={13} color={colors.danger} style={styles.icon} />
      <Text style={[styles.text, { color: colors.danger }]}>{error}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
    gap: 4,
  },
  icon: {
    marginTop: 2,
  },
  text: {
    fontSize: FontSizes.xs,
    fontFamily: FontFamily.medium,
    flex: 1,
    lineHeight: 16,
  },
});

export default InlineFieldError;
