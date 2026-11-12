import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ShoppingBag } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColor } from '../../hooks/useThemeColor';
import { usePabiliDraft } from '../../hooks/usePabiliDraft';
import { usePabiliSubmission } from '../../hooks/usePabiliSubmission';
import { pabiliDraftStore } from '../../services/pabiliDraft';
import { FontFamily, Shadows, Spacing } from '../../config/theme';

/** Resume the customer's saved Stage 2 list while browsing Home. */
export default function ShoppingListFab({ user, navigation, raised = false }: {
  user: any;
  navigation: any;
  raised?: boolean;
}) {
  // Reuse account-scoped restoration, including pending submission recovery.
  usePabiliSubmission(user.id);
  const draft = usePabiliDraft();
  const { colors, isDark } = useThemeColor();
  const insets = useSafeAreaInsets();
  if (pabiliDraftStore.ownerId !== String(user.id) || !draft || draft.submission || draft.categories.length === 0) return null;
  const count = draft.categories.length;

  return (
    <View pointerEvents="box-none" style={[styles.slot, { bottom: Math.max(insets.bottom, 12) + 68 + 14 + (raised ? 74 : 0) }]}>
      <TouchableOpacity
        testID="shopping-list-fab"
        accessibilityRole="button"
        accessibilityLabel={`Shopping list, ${count} ${count === 1 ? 'store' : 'stores'}. Return to Stage 2`}
        activeOpacity={0.85}
        style={[styles.face, Shadows.liftedUp, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => navigation.navigate('ErrandItems', {
          user,
          selectedCats: draft.categories,
          ...(draft.mode === 'location' && draft.stores
            ? { stores: draft.categories.map((key) => draft.stores![key]) }
            : {}),
        })}
      >
        <ShoppingBag size={25} color={colors.textDark} strokeWidth={2.2} />
        <View style={[styles.badge, { backgroundColor: isDark ? colors.primary : colors.primaryStrong, borderColor: colors.card }]}>
          <Text testID="shopping-list-fab-count" maxFontSizeMultiplier={1.15} style={[styles.count, { color: colors.onPrimary }]}>{count}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { position: 'absolute', right: Spacing.md + 2, zIndex: 50 },
  face: { width: 60, height: 60, borderRadius: 30, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 24, height: 24, borderRadius: 12, borderWidth: 2, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  count: { fontFamily: FontFamily.bold, fontSize: 12, lineHeight: 16 },
});
