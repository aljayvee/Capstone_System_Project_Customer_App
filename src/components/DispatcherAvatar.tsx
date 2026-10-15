import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Headphones } from 'lucide-react-native';
import { apiClient } from '../services/apiClient';
import { useThemeColor } from '../hooks/useThemeColor';

export interface DispatcherAvatarProps {
  dispatcherId?: string | number | null;
  size?: number;
  iconSize?: number;
}

// Mirrors RiderMobileApp's riderApiService.fetchProfilePhoto: a 404 just means
// this dispatcher hasn't set a photo yet, not a failure worth logging.
async function fetchDispatcherPhoto(dispatcherId: string | number): Promise<string | null> {
  try {
    const res = await apiClient.get(`/riders/${dispatcherId}/photo`);
    return res.data?.photoData ?? null;
  } catch (err: any) {
    if (err?.response?.status !== 404) {
      console.warn('[DispatcherAvatar] Failed to fetch dispatcher photo:', err);
    }
    return null;
  }
}

export default function DispatcherAvatar({ dispatcherId, size = 44, iconSize }: DispatcherAvatarProps) {
  const { colors, isDark } = useThemeColor();
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPhotoUri(null);
    if (!dispatcherId) return;
    fetchDispatcherPhoto(dispatcherId).then((uri) => {
      if (!cancelled) setPhotoUri(uri);
    });
    return () => {
      cancelled = true;
    };
  }, [dispatcherId]);

  const resolvedIconSize = iconSize ?? Math.round(size * 0.45);

  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: isDark ? 'rgba(246, 36, 89, 0.15)' : '#FFEEF3',
        },
      ]}
    >
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={[styles.image, { borderRadius: size / 2 }]} />
      ) : (
        <Headphones size={resolvedIconSize} color={colors.primary} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
