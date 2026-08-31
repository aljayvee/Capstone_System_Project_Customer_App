import { Alert, Platform } from 'react-native';

export interface ImagePickerResultAsset {
  uri: string;
  base64?: string | null;
  mimeType?: string;
  fileSize?: number;
  fileName?: string | null;
}

export interface PickImageOptions {
  mode: 'camera' | 'gallery';
  aspect?: [number, number];
  quality?: number;
}

/**
 * Safe Image Picker wrapper that dynamically imports expo-image-picker
 * and catches "Cannot find native module 'ExponentImagePicker'" errors
 * without crashing the app if the native APK hasn't been rebuilt yet.
 */
export async function safePickImage({
  mode,
  aspect = [1, 1],
  quality = 0.8,
}: PickImageOptions): Promise<ImagePickerResultAsset | null> {
  try {
    const ImagePicker = await import('expo-image-picker');

    if (!ImagePicker || !ImagePicker.launchImageLibraryAsync) {
      throw new Error('ExponentImagePicker native module not found');
    }

    if (mode === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Denied', 'Camera permission is required to take a profile photo.');
        return null;
      }
    } else {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Denied', 'Photo library permission is required to choose a profile photo.');
        return null;
      }
    }

    const options: any = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect,
      quality,
      base64: true,
    };

    const result =
      mode === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];
    return {
      uri: asset.uri,
      base64: asset.base64,
      mimeType: asset.mimeType,
      fileSize: asset.fileSize,
      fileName: asset.fileName,
    };
  } catch (err: any) {
    console.warn('[safeImagePicker] Native image picker error:', err);
    if (String(err?.message || '').includes('ExponentImagePicker') || String(err?.message || '').includes('native module')) {
      Alert.alert(
        'Native Module Update Required',
        'The photo upload feature requires rebuilding the native Android app to link the new camera module. Please run "npx expo run:android" or "expo start" in your terminal.'
      );
    } else {
      Alert.alert('Image Picker Error', err?.message || 'Failed to open image picker.');
    }
    return null;
  }
}
