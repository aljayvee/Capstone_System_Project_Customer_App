import { Platform } from 'react-native';
import { showAppAlert } from '../services/alertModal';

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
  /**
   * Square-crops and lets the user reframe. Right for an avatar, WRONG for a
   * document: cropping a payment confirmation to 1:1 is how the reference
   * number ends up outside the image the OCR then fails to find it in.
   */
  allowsEditing?: boolean;
  /** Named in the permission prompt, so it says what it is actually for. */
  purpose?: string;
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
  allowsEditing = true,
  purpose = 'a profile photo',
}: PickImageOptions): Promise<ImagePickerResultAsset | null> {
  try {
    const ImagePicker = await import('expo-image-picker');

    if (!ImagePicker || !ImagePicker.launchImageLibraryAsync) {
      throw new Error('ExponentImagePicker native module not found');
    }

    if (mode === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        showAppAlert({
          title: 'Permission Denied',
          message: `Camera permission is required to take ${purpose}.`,
          variant: 'warning',
        });
        return null;
      }
    } else {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showAppAlert({
          title: 'Permission Denied',
          message: `Photo library permission is required to choose ${purpose}.`,
          variant: 'warning',
        });
        return null;
      }
    }

    const options: any = {
      mediaTypes: ['images'],
      allowsEditing,
      // Only meaningful alongside allowsEditing; passing it otherwise is inert.
      ...(allowsEditing ? { aspect } : {}),
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
      // Developer-facing, and only reachable on a dev build with an unlinked
      // module. The detail belongs in the log, not on a customer's screen.
      console.warn('[safeImagePicker] Native module not linked. Run: npx expo run:android');
      showAppAlert({
        title: 'Photos unavailable',
        message: 'This build cannot open your photos yet. Try again after the next app update.',
        variant: 'error',
      });
    } else {
      showAppAlert({
        title: 'Photos unavailable',
        message: "We couldn't open your photos. Check that Sugo has photo access, then try again.",
        variant: 'error',
      });
    }
    return null;
  }
}
