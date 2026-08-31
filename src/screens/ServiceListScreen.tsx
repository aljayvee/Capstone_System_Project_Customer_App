import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, ShoppingBag, ArrowRight, ChevronLeft } from 'lucide-react-native';
import { RootStackScreenProps } from '../navigation/types';
import { useThemeColor } from '../hooks/useThemeColor';
import { FontFamily, FontSizes, FontWeights, Spacing, BorderRadius, Shadows } from '../config/theme';

export const SERVICE_TYPES = [
  {
    id: 'Pabili',
    name: 'Pabili Service',
    tagline: 'Personal Shopper',
    desc: 'Buy grocery, food, medicines, and retail items from any store in Tacurong City',
  },
];

export default function ServiceListScreen({ route, navigation }: RootStackScreenProps<'ServiceList'>) {
  const { user } = route.params || {};
  const [selectedServices, setSelectedServices] = useState<string[]>(['Pabili']);
  const { colors, isDark } = useThemeColor();

  const toggleService = (serviceId: string) => {
    if (selectedServices.includes(serviceId)) {
      setSelectedServices([]);
    } else {
      setSelectedServices([serviceId]);
    }
  };

  const handleContinue = () => {
    if (selectedServices.length === 0) return;
    navigation.navigate('ErrandForm', { user, selectedServices });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgApp }]} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.navHeaderRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={[styles.backBtn, { backgroundColor: isDark ? 'transparent' : colors.bgGray }]}
          testID="back-button"
        >
          <ChevronLeft size={22} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.textDark }]}>Select Service</Text>
        <View style={styles.navHeaderRightPlaceholder} />
      </View>

      <View style={styles.headerSection}>
        <View style={[styles.iconBadge, { backgroundColor: isDark ? 'rgba(246, 36, 89, 0.15)' : '#FFEEF3' }]}>
          <ShoppingBag size={22} color={colors.primary} />
        </View>
        <Text style={[styles.headerTitle, { color: colors.textDark }]}>Select Errand Service</Text>
        <Text style={[styles.subTitle, { color: colors.textGray }]}>
          Select Pabili Personal Shopper service to build your errand request
        </Text>
      </View>

      <ScrollView style={styles.scrollList} contentContainerStyle={styles.scrollContent}>
        {SERVICE_TYPES.map((service) => {
          const isSelected = selectedServices.includes(service.id);
          return (
            <TouchableOpacity
              key={service.id}
              testID={`service-card-${service.id}`}
              activeOpacity={0.85}
              style={[
                styles.card,
                {
                  backgroundColor: isSelected
                    ? (isDark ? 'rgba(246, 36, 89, 0.12)' : '#FFEEF3')
                    : colors.card,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
                Shadows.soft,
              ]}
              onPress={() => toggleService(service.id)}
            >
              <View style={styles.cardHeader}>
                <Text
                  style={[
                    styles.cardTitle,
                    { color: isSelected ? colors.primary : colors.textDark },
                  ]}
                >
                  {service.name}
                </Text>
                {isSelected && (
                  <View style={[styles.checkBadge, { backgroundColor: colors.primary }]} testID={`selected-badge-${service.id}`}>
                    <Check size={12} color="#FFFFFF" strokeWidth={3} />
                    <Text style={styles.checkBadgeText}>Selected</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.tagline, { color: colors.primary }]}>{service.tagline}</Text>
              <Text style={[styles.desc, { color: colors.textMedium }]}>{service.desc}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {selectedServices.length > 0 && (
        <View
          style={[
            styles.summaryBar,
            { backgroundColor: isDark ? colors.card : colors.textDark },
            Shadows.liftedUp,
          ]}
          testID="summary-bar"
        >
          <View style={styles.summaryInfo}>
            <Text style={[styles.summaryText, { color: '#FFFFFF' }]}>
              Selected: {selectedServices.join(', ')}
            </Text>
            <Text style={[styles.summaryCount, { color: 'rgba(255, 255, 255, 0.7)' }]}>
              Pabili Shopper Service Active
            </Text>
          </View>
          <TouchableOpacity
            testID="continue-button"
            style={[styles.continueBtn, { backgroundColor: colors.primary }]}
            onPress={handleContinue}
          >
            <Text style={styles.continueBtnText}>Continue</Text>
            <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.xs },
  navHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.md,
  },
  navHeaderRightPlaceholder: {
    width: 38,
  },
  headerSection: { marginBottom: Spacing.lg },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.xxl,
    marginBottom: Spacing.xs,
  },
  subTitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.sm,
    lineHeight: 20,
  },
  scrollList: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.xl },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  cardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.xl,
  },
  checkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  checkBadgeText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: FontSizes.xs,
  },
  tagline: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.sm,
    marginBottom: Spacing.xs,
  },
  desc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.sm,
    lineHeight: 20,
  },
  summaryBar: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  summaryInfo: { flex: 1, marginRight: Spacing.sm },
  summaryText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.sm,
  },
  summaryCount: {
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.xs,
    marginTop: 2,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
  },
  continueBtnText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: FontSizes.sm,
  },
});
