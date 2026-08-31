import React, { useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import { MapPin, X, Navigation, CheckCircle2, LocateFixed } from 'lucide-react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { FontSizes, FontWeights, Spacing, BorderRadius, FontFamily, Shadows } from '../config/theme';
import { MapCoordinate, sanitizeCoordinate, toRegion } from '../utils/coords';

export interface MapMarkerSpec {
  key: string;
  coordinate: MapCoordinate;
  title?: string;
  description?: string;
  pinColor?: string;
}

export interface MapPreviewFieldProps {
  /** Map centre / current pin. null renders a "no location set" placeholder. */
  center: MapCoordinate | null;
  markers?: MapMarkerSpec[];
  label: string;
  hint?: string;
  /** Enables tap-to-move + draggable marker + a Confirm footer. */
  editable?: boolean;
  onConfirm?: (coordinate: MapCoordinate) => void;
  confirmLabel?: string;
  modalTitle?: string;
  previewHeight?: number;
  locationLabel?: string | null;
  addressText?: string | null;
  /** When provided, the component renders ONLY the modal — visibility is driven externally instead of its own placeholder. */
  controlled?: { visible: boolean; onClose: () => void };
  testID?: string;
  mapTestID?: string;
}

export default function MapPreviewField(props: MapPreviewFieldProps) {
  const { colors, isDark } = useThemeColor();
  const mapRef = useRef<MapView>(null);
  const [selfOpen, setSelfOpen] = useState(false);
  const isControlled = props.controlled != null;
  const open = isControlled ? props.controlled!.visible : selfOpen;
  const close = () => (isControlled ? props.controlled!.onClose() : setSelfOpen(false));

  const center = sanitizeCoordinate(props.center);
  const [draft, setDraft] = useState<MapCoordinate>(center);
  const [selectedMarkerKey, setSelectedMarkerKey] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(center);
      setSelectedMarkerKey(null);
    }
  }, [open]);

  // Handle smooth map camera hover/pan to specific coordinates
  const hoverToLocation = (target: MapCoordinate) => {
    setDraft(target);
    mapRef.current?.animateToRegion(
      {
        latitude: target.latitude,
        longitude: target.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      },
      500
    );
  };

  const markersList = props.markers || [];
  const selectedMarker = markersList.find((m) => m.key === selectedMarkerKey);

  const activeLabel = selectedMarker?.title || props.locationLabel || props.label || 'Delivery Pin';
  const activeAddress =
    selectedMarker?.description || props.addressText || `${draft.latitude.toFixed(4)}, ${draft.longitude.toFixed(4)}`;

  return (
    <>
      {!isControlled && (
        <TouchableOpacity
          style={[styles.placeholder, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => setSelfOpen(true)}
          testID={props.testID}
        >
          <MapPin size={28} color={colors.textGray} strokeWidth={1.8} style={styles.placeholderIcon} />
          <Text style={[styles.placeholderLabel, { color: colors.textDark }]}>{props.label}</Text>
          <Text style={[styles.placeholderCoords, { color: colors.textGray }]}>
            {props.center
              ? `${center.latitude.toFixed(4)}, ${center.longitude.toFixed(4)}`
              : 'No location set'}
          </Text>
          {props.hint ? <Text style={[styles.placeholderHint, { color: colors.textLight }]}>{props.hint}</Text> : null}
        </TouchableOpacity>
      )}

      <Modal visible={open} animationType="slide" transparent={false} onRequestClose={close}>
        <View style={[styles.modalRoot, { backgroundColor: colors.bgApp }]}>
          {/* Top Modal Header */}
          <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <View style={styles.headerTextGroup}>
              <Text style={[styles.modalTitle, { color: colors.textDark }]}>{props.modalTitle || props.label}</Text>
              <Text style={[styles.modalSubtitle, { color: colors.textGray }]}>Tap overlay or map to inspect location</Text>
            </View>
            <TouchableOpacity onPress={close} style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.bgGray }]}>
              <X size={20} color={colors.textDark} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          {/* Interactive Map View Container */}
          <View style={styles.mapWrapper}>
            {open && (
              <MapView
                ref={mapRef}
                testID={props.mapTestID}
                style={StyleSheet.absoluteFill}
                initialRegion={toRegion(center)}
                onPress={
                  props.editable
                    ? (e) => {
                        const coords = e.nativeEvent.coordinate;
                        setDraft(coords);
                        setSelectedMarkerKey(null);
                      }
                    : undefined
                }
              >
                {/* Primary Draggable Pin */}
                {props.editable && (
                  <Marker
                    draggable
                    coordinate={draft}
                    onDragEnd={(e) => {
                      const coords = e.nativeEvent.coordinate;
                      setDraft(coords);
                      setSelectedMarkerKey(null);
                    }}
                    pinColor={colors.primary}
                    title={activeLabel}
                    description={activeAddress}
                  >
                    <Callout style={styles.calloutContainer}>
                      <View style={styles.calloutContent}>
                        <Text style={styles.calloutTitle}>{activeLabel}</Text>
                        <Text style={styles.calloutDesc}>{activeAddress}</Text>
                      </View>
                    </Callout>
                  </Marker>
                )}

                {/* Synchronized Saved Location Markers */}
                {markersList.map((m) => (
                  <Marker
                    key={m.key}
                    coordinate={sanitizeCoordinate(m.coordinate)}
                    title={m.title}
                    description={m.description}
                    pinColor={m.key === selectedMarkerKey ? colors.primary : m.pinColor || colors.primary}
                    onPress={() => {
                      setSelectedMarkerKey(m.key);
                      hoverToLocation(m.coordinate);
                    }}
                  >
                    <Callout style={styles.calloutContainer}>
                      <View style={styles.calloutContent}>
                        <Text style={styles.calloutTitle}>{m.title}</Text>
                        {m.description ? <Text style={styles.calloutDesc}>{m.description}</Text> : null}
                      </View>
                    </Callout>
                  </Marker>
                ))}
              </MapView>
            )}

            {/* Interactive Floating Top Location Detail Overlay */}
            <View style={[styles.overlayWrapper, Shadows.liftedUp]}>
              <TouchableOpacity
                activeOpacity={0.9}
                style={[styles.detailBadgeOverlay, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => hoverToLocation(draft)}
              >
                <View style={[styles.pinIconBadge, { backgroundColor: isDark ? 'rgba(246,36,89,0.15)' : '#FFEEF3' }]}>
                  <Navigation size={18} color={colors.primary} />
                </View>
                <View style={styles.detailBadgeTextCol}>
                  <View style={styles.badgeHeaderRow}>
                    <Text style={[styles.badgeLabel, { color: colors.primary }]}>{activeLabel}</Text>
                    <View style={styles.badgeActionGroup}>
                      <TouchableOpacity
                        style={[styles.hoverChip, { backgroundColor: colors.primary }]}
                        onPress={() => hoverToLocation(draft)}
                      >
                        <LocateFixed size={11} color="#FFFFFF" />
                        <Text style={styles.hoverChipText}>Hover Map</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={[styles.badgeAddress, { color: colors.textDark }]} numberOfLines={1}>
                    {activeAddress}
                  </Text>
                  <Text style={[styles.badgeCoords, { color: colors.textGray }]}>
                    GPS: {draft.latitude.toFixed(4)}, {draft.longitude.toFixed(4)}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Saved Locations Selector (supports up to 5 configured locations without UI override) */}
              {markersList.length > 0 && (
                <View style={[styles.selectorBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorScrollContent}>
                    <TouchableOpacity
                      style={[
                        styles.locPill,
                        selectedMarkerKey === null
                          ? { backgroundColor: colors.primary }
                          : { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.bgGray },
                      ]}
                      onPress={() => {
                        setSelectedMarkerKey(null);
                        hoverToLocation(center);
                      }}
                    >
                      <Text style={[styles.locPillText, { color: selectedMarkerKey === null ? '#FFFFFF' : colors.textDark }]}>
                        Current Pin
                      </Text>
                    </TouchableOpacity>

                    {markersList.map((m) => {
                      const isSelected = m.key === selectedMarkerKey;
                      return (
                        <TouchableOpacity
                          key={m.key}
                          style={[
                            styles.locPill,
                            isSelected
                              ? { backgroundColor: colors.primary }
                              : { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.bgGray },
                          ]}
                          onPress={() => {
                            setSelectedMarkerKey(m.key);
                            hoverToLocation(m.coordinate);
                          }}
                        >
                          <Text style={[styles.locPillText, { color: isSelected ? '#FFFFFF' : colors.textDark }]} numberOfLines={1}>
                            {m.title}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>
          </View>

          {/* Footer Actions */}
          {props.editable && (
            <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.cancelBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.bgGray }]}
                onPress={close}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textDark }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: colors.primary }, Shadows.liftedUp]}
                onPress={() => {
                  props.onConfirm?.(draft);
                  close();
                }}
              >
                <Text style={styles.confirmBtnText}>{props.confirmLabel || 'Save Pinpoint Location'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  placeholderIcon: { marginBottom: Spacing.xs },
  placeholderLabel: { fontSize: FontSizes.md, fontFamily: FontFamily.bold },
  placeholderCoords: {
    fontSize: FontSizes.sm,
    fontFamily: FontFamily.medium,
    marginTop: Spacing.xs,
  },
  placeholderHint: { fontSize: FontSizes.xs, fontFamily: FontFamily.regular, marginTop: Spacing.xs, textAlign: 'center' },
  modalRoot: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  headerTextGroup: { flex: 1 },
  modalTitle: { fontSize: FontSizes.lg, fontFamily: FontFamily.bold },
  modalSubtitle: { fontSize: FontSizes.xs, fontFamily: FontFamily.regular, marginTop: 1 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapWrapper: { flex: 1, position: 'relative' },
  calloutContainer: { padding: Spacing.xs, minWidth: 140 },
  calloutContent: { alignItems: 'flex-start' },
  calloutTitle: { fontFamily: FontFamily.bold, fontSize: FontSizes.xs, color: '#111827' },
  calloutDesc: { fontFamily: FontFamily.regular, fontSize: 10, color: '#4B5563', marginTop: 1 },
  overlayWrapper: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    right: Spacing.md,
    gap: Spacing.xs,
  },
  detailBadgeOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
  },
  pinIconBadge: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  detailBadgeTextCol: { flex: 1 },
  badgeHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  badgeLabel: { fontFamily: FontFamily.bold, fontSize: FontSizes.sm, flex: 1, marginRight: Spacing.xs },
  badgeActionGroup: { flexDirection: 'row', alignItems: 'center' },
  hoverChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  hoverChipText: { color: '#FFFFFF', fontFamily: FontFamily.bold, fontSize: 10 },
  badgeAddress: { fontFamily: FontFamily.semibold, fontSize: FontSizes.xs },
  badgeCoords: { fontFamily: FontFamily.regular, fontSize: 10, marginTop: 1 },
  selectorBar: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  selectorScrollContent: { gap: Spacing.xs, alignItems: 'center' },
  locPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  locPillText: { fontFamily: FontFamily.bold, fontSize: FontSizes.xs },
  footer: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderTopWidth: 1,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { fontFamily: FontFamily.bold },
  confirmBtn: {
    flex: 2,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: { color: '#FFFFFF', fontFamily: FontFamily.bold },
});
